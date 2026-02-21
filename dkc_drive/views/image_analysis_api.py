"""
DKCドライブ - 画像判定API（ResNet18 特徴ベクトル + コサイン類似度）

フォルダ内の OK/NG 教師画像から特徴ベクトルを抽出し、
未判定フォルダの画像をコサイン類似度で OK/NG に判定する。
NG判定画像には欠陥箇所を赤丸で囲んだオーバーレイ画像を生成する。
"""
import os
import shutil
import logging

from django.views import View
from django.http import JsonResponse

from .utils import validate_path, get_full_path, error_response, JSONRequestMixin

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
RESULT_FOLDER_NAME = '_判定結果'
REQUIRED_SUBDIRS = ('OK', 'NG', '未判定')
DEFECT_THRESHOLD_SIGMA = 0.5


def _collect_images(directory):
    """ディレクトリ内の画像ファイルパスを収集"""
    if not os.path.isdir(directory):
        return []
    return [
        os.path.join(directory, name)
        for name in sorted(os.listdir(directory))
        if os.path.splitext(name)[1].lower() in IMAGE_EXTENSIONS
        and os.path.isfile(os.path.join(directory, name))
    ]


def _find_regions(mask):
    """バイナリマスクから連結領域を BFS で検出"""
    h, w = mask.shape
    visited = set()
    regions = []

    for i in range(h):
        for j in range(w):
            if not mask[i, j] or (i, j) in visited:
                continue
            region = []
            queue = [(i, j)]
            while queue:
                ci, cj = queue.pop(0)
                if (ci, cj) in visited or not mask[ci, cj]:
                    continue
                visited.add((ci, cj))
                region.append((ci, cj))
                for di, dj in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    ni, nj = ci + di, cj + dj
                    if 0 <= ni < h and 0 <= nj < w:
                        queue.append((ni, nj))
            regions.append(region)

    return regions


class ImageJudge:
    """ResNet18 空間特徴マップ抽出器（シングルトン）

    モデル出力: (N, 512, 7, 7) の空間特徴マップ
    - 判定時: adaptive_avg_pool2d で 512 次元ベクトルに変換して類似度比較
    - 欠陥検出時: 7×7 の各位置で OK 教師との類似度を計算しヒートマップ生成
    """

    _model = None
    _transform = None
    _device = None

    @classmethod
    def _load_model(cls):
        if cls._model is not None:
            return

        import torch
        import torch.nn as nn
        from torchvision import models, transforms

        if torch.cuda.is_available():
            cls._device = torch.device('cuda')
        elif torch.backends.mps.is_available():
            cls._device = torch.device('mps')
        else:
            cls._device = torch.device('cpu')

        logger.info("モデル読み込み中 (device=%s)", cls._device)

        weights = models.ResNet18_Weights.IMAGENET1K_V1
        base = models.resnet18(weights=weights)
        # avgpool・fc を除去 → 空間特徴マップ (512, 7, 7) を出力
        cls._model = nn.Sequential(*list(base.children())[:-2])
        cls._model.to(cls._device)
        cls._model.eval()

        cls._transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ])

        logger.info("モデル読み込み完了")

    @classmethod
    def _extract_spatial(cls, image_paths):
        """画像群から空間特徴マップを抽出 (N, 512, 7, 7)"""
        import torch
        from PIL import Image

        cls._load_model()

        tensors = [cls._transform(Image.open(p).convert('RGB')) for p in image_paths]
        if not tensors:
            return torch.tensor([])

        batch = torch.stack(tensors).to(cls._device)
        with torch.no_grad():
            return cls._model(batch)

    @classmethod
    def _to_vector(cls, spatial):
        """空間特徴マップ (N, 512, 7, 7) → ベクトル (N, 512)"""
        import torch.nn.functional as F
        return F.adaptive_avg_pool2d(spatial, 1).flatten(1)

    @classmethod
    def extract_teacher_data(cls, ok_images, ng_images):
        """教師画像から判定に必要な全データを一括抽出（重複呼び出しを排除）

        Returns:
            ok_vectors (N_ok, 512), ng_vectors (N_ng, 512), ok_spatial_avg (512, 7, 7)
        """
        ok_spatial = cls._extract_spatial(ok_images)
        ng_spatial = cls._extract_spatial(ng_images)
        return cls._to_vector(ok_spatial), cls._to_vector(ng_spatial), ok_spatial.mean(dim=0)

    @classmethod
    def judge_single(cls, spatial, ok_vectors, ng_vectors):
        """空間特徴マップ1枚からOK/NG判定し (judgment, confidence) を返す"""
        import torch.nn.functional as F

        vector = cls._to_vector(spatial.unsqueeze(0)).squeeze(0)
        ok_sim = F.cosine_similarity(vector.unsqueeze(0), ok_vectors, dim=1).mean().item()
        ng_sim = F.cosine_similarity(vector.unsqueeze(0), ng_vectors, dim=1).mean().item()

        if ok_sim >= ng_sim:
            return 'OK', round(ok_sim * 100, 1)
        return 'NG', round(ng_sim * 100, 1)

    @classmethod
    def generate_defect_overlay(cls, image_path, spatial, ok_spatial_avg):
        """空間特徴マップから欠陥箇所を赤丸で囲んだ画像を生成（None = 検出なし）"""
        import torch.nn.functional as F
        from PIL import Image, ImageDraw

        # 7×7 の各位置で OK 教師平均との類似度を計算
        test_flat = spatial.permute(1, 2, 0).reshape(49, -1)
        ok_flat = ok_spatial_avg.permute(1, 2, 0).reshape(49, -1)
        sim = F.cosine_similarity(test_flat, ok_flat, dim=1)
        defect = (1.0 - sim.reshape(7, 7)).cpu().numpy()

        threshold = defect.mean() + DEFECT_THRESHOLD_SIGMA * defect.std()
        regions = _find_regions(defect > threshold) if (defect > threshold).any() else []
        if not regions:
            return None

        img = Image.open(image_path).convert('RGB')
        draw = ImageDraw.Draw(img)
        w, h = img.size
        cell_w, cell_h = w / 7, h / 7

        for region in regions:
            rows = [r for r, _ in region]
            cols = [c for _, c in region]
            cy = (min(rows) + max(rows) + 1) / 2 * cell_h
            cx = (min(cols) + max(cols) + 1) / 2 * cell_w
            span = max(
                (max(rows) - min(rows) + 1) * cell_h,
                (max(cols) - min(cols) + 1) * cell_w,
            )
            r = span / 2 + cell_w * 0.5
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline='red', width=3)

        return img


class ImageAnalysisAPI(JSONRequestMixin, View):
    """フォルダ内画像をOK/NG判定し、結果フォルダにコピーするAPI"""

    def post(self, request):
        data = self.parse_json(request)
        folder_path = data.get('folder', '')

        if not validate_path(folder_path):
            return error_response('無効なパスです')

        target_dir = get_full_path(folder_path)
        if not os.path.isdir(target_dir):
            return error_response('フォルダが見つかりません', 404)

        err = self._validate_folders(target_dir)
        if err:
            return err

        ok_images = _collect_images(os.path.join(target_dir, 'OK'))
        ng_images = _collect_images(os.path.join(target_dir, 'NG'))
        unjudged_images = _collect_images(os.path.join(target_dir, '未判定'))

        err = self._validate_images(ok_images, ng_images, unjudged_images)
        if err:
            return err

        # 教師データ一括抽出（ベクトル + OK空間平均）
        try:
            ok_vectors, ng_vectors, ok_spatial_avg = ImageJudge.extract_teacher_data(ok_images, ng_images)
        except Exception as e:
            logger.error("教師画像の特徴抽出エラー: %s", e)
            return error_response('教師画像の処理に失敗しました')

        # 判定 → コピー → 欠陥マーキング
        result_dir = os.path.join(target_dir, RESULT_FOLDER_NAME)
        for label in ('OK', 'NG'):
            os.makedirs(os.path.join(result_dir, label), exist_ok=True)

        results, counts = self._judge_and_copy(
            unjudged_images, ok_vectors, ng_vectors, ok_spatial_avg, result_dir,
        )

        result_folder_path = f"{folder_path}/{RESULT_FOLDER_NAME}" if folder_path else RESULT_FOLDER_NAME

        return JsonResponse({
            'status': 'success',
            'summary': [{'label': k, 'count': v} for k, v in counts.items()],
            'total': len(unjudged_images),
            'results': results,
            'resultFolder': result_folder_path,
        })

    # ---- private ----

    @staticmethod
    def _validate_folders(target_dir):
        missing = [d for d in REQUIRED_SUBDIRS if not os.path.isdir(os.path.join(target_dir, d))]
        if missing:
            return error_response(
                f"必要なフォルダが見つかりません: {', '.join(missing)}\n"
                f"OK/, NG/, 未判定/ フォルダを作成してください"
            )
        return None

    @staticmethod
    def _validate_images(ok_images, ng_images, unjudged_images):
        if not ok_images:
            return error_response('OK フォルダに教師画像がありません')
        if not ng_images:
            return error_response('NG フォルダに教師画像がありません')
        if not unjudged_images:
            return error_response('未判定フォルダに画像がありません')
        return None

    @staticmethod
    def _judge_and_copy(unjudged_images, ok_vectors, ng_vectors, ok_spatial_avg, result_dir):
        results = []
        counts = {'OK': 0, 'NG': 0}

        for img_path in unjudged_images:
            name = os.path.basename(img_path)
            try:
                # 空間特徴を1回だけ抽出し、判定と欠陥検出の両方に使う
                spatial = ImageJudge._extract_spatial([img_path]).squeeze(0)
                judgment, confidence = ImageJudge.judge_single(spatial, ok_vectors, ng_vectors)
                shutil.copy2(img_path, os.path.join(result_dir, judgment, name))
                counts[judgment] += 1

                item = {'name': name, 'judgment': judgment, 'confidence': confidence}

                if judgment == 'NG':
                    defect_img = ImageJudge.generate_defect_overlay(img_path, spatial, ok_spatial_avg)
                    if defect_img:
                        defect_name = os.path.splitext(name)[0] + '_defect.jpg'
                        defect_img.save(os.path.join(result_dir, 'NG', defect_name), quality=90)
                        item['defectImage'] = defect_name

                results.append(item)
            except Exception as e:
                logger.warning("画像判定エラー: %s - %s", name, e)
                results.append({'name': name, 'judgment': 'エラー', 'confidence': 0, 'error': True})

        return results, counts
