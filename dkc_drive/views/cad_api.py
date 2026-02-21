"""
DKCドライブ - CADファイル変換API
STEP形式をSTLに変換してブラウザで表示可能にする

対応形式:
- STP/STEP: OpenCASCADE（cadquery-ocp）で変換
"""
import hashlib
import logging
from pathlib import Path

from django.conf import settings
from django.http import JsonResponse, FileResponse
from django.views import View

logger = logging.getLogger(__name__)


class CADConvertAPI(View):
    """STPファイルをSTLに変換して返す"""

    # キャッシュディレクトリ
    CACHE_DIR = Path(settings.MEDIA_ROOT) / 'dkc_drive' / '.cad_cache'

    def get(self, request):
        file_path = request.GET.get('path', '')
        if not file_path:
            return JsonResponse({'status': 'error', 'message': 'パスが指定されていません'}, status=400)

        # ファイルパスのセキュリティチェック
        from .utils import validate_path
        if not validate_path(file_path):
            return JsonResponse({'status': 'error', 'message': '不正なパスです'}, status=400)

        # 実際のファイルパス
        base_path = Path(settings.MEDIA_ROOT) / 'dkc_drive'
        full_path = base_path / file_path

        if not full_path.exists():
            return JsonResponse({'status': 'error', 'message': 'ファイルが見つかりません'}, status=404)

        # 拡張子チェック（STEP形式のみ対応）
        ext = full_path.suffix.lower()
        if ext not in ['.stp', '.step']:
            return JsonResponse({'status': 'error', 'message': '対応していないファイル形式です'}, status=400)

        try:
            logger.info(f"CAD変換開始: {full_path}")

            # キャッシュ確認
            stl_path = self._get_cached_stl(full_path)

            if stl_path is None:
                # 変換実行
                logger.info(f"キャッシュなし、変換実行: {ext}")
                stl_path = self._convert_to_stl(full_path)

            logger.info(f"CAD変換完了: {stl_path}")

            # STLファイルを返す
            return FileResponse(
                open(stl_path, 'rb'),
                content_type='application/sla',
                as_attachment=False,
                filename=f"{full_path.stem}.stl"
            )

        except ImportError as e:
            logger.error(f"CAD変換ライブラリエラー: {e}")
            return JsonResponse({
                'status': 'error',
                'message': 'CAD変換ライブラリがインストールされていません。pip install cadquery-ocp を実行してください。'
            }, status=500)
        except Exception as e:
            logger.exception(f"CAD変換エラー: {e}")
            return JsonResponse({
                'status': 'error',
                'message': 'ファイルの変換中にエラーが発生しました'
            }, status=500)

    def _get_cache_key(self, file_path: Path) -> str:
        """ファイルのハッシュをキャッシュキーとして生成"""
        stat = file_path.stat()
        key_str = f"{file_path}:{stat.st_size}:{stat.st_mtime}"
        return hashlib.md5(key_str.encode()).hexdigest()

    def _get_cached_stl(self, file_path: Path) -> Path | None:
        """キャッシュされたSTLファイルがあれば返す"""
        self.CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_key = self._get_cache_key(file_path)
        cached_path = self.CACHE_DIR / f"{cache_key}.stl"

        if cached_path.exists():
            return cached_path
        return None

    def _convert_to_stl(self, file_path: Path) -> Path:
        """STEP形式をSTLに変換"""
        ext = file_path.suffix.lower()

        # STEP形式はOpenCASCADEで変換
        from OCP.StlAPI import StlAPI_Writer
        from OCP.BRepMesh import BRepMesh_IncrementalMesh

        if ext in ['.stp', '.step']:
            shape = self._read_step(file_path)
        else:
            raise ValueError(f"未対応の形式: {ext}")

        # メッシュ生成（STL用）- ファイルサイズに応じて精度調整
        file_size_mb = file_path.stat().st_size / (1024 * 1024)
        # 大きいファイルは精度を下げて高速化
        tolerance = 0.5 if file_size_mb > 10 else 0.1
        mesh = BRepMesh_IncrementalMesh(shape, tolerance)
        mesh.Perform()

        # STL書き出し
        cache_key = self._get_cache_key(file_path)
        stl_path = self.CACHE_DIR / f"{cache_key}.stl"

        writer = StlAPI_Writer()
        writer.ASCIIMode = False  # バイナリSTL（高速・小サイズ）
        writer.Write(shape, str(stl_path))

        return stl_path

    def _read_step(self, file_path: Path):
        """STEPファイルを読み込む"""
        from OCP.STEPControl import STEPControl_Reader
        from OCP.IFSelect import IFSelect_RetDone

        reader = STEPControl_Reader()
        status = reader.ReadFile(str(file_path))

        # 列挙型の比較（値で比較）
        if status.value != IFSelect_RetDone.value:
            raise ValueError(f"STEPファイルの読み込みに失敗しました: {file_path.name}")

        reader.TransferRoots()
        shape = reader.OneShape()

        if shape.IsNull():
            raise ValueError(f"STEPファイルから形状を取得できませんでした: {file_path.name}")

        return shape


