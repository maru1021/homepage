"""
DKCドライブ - 共通定数・ユーティリティ
"""
import os
import json
import posixpath
from django.http import JsonResponse
from django.views import View
from django.conf import settings


logger_module = __name__

# ベースディレクトリ
DKC_DRIVE_DIR = os.path.join(settings.MEDIA_ROOT, 'dkc_drive')
os.makedirs(DKC_DRIVE_DIR, exist_ok=True)

# ファイルタイプ定義（拡張子 → (タイプ, アイコン)）
FILE_TYPE_MAP = {
    # Excel
    '.xlsx': ('excel', 'bi-file-earmark-excel'),
    '.xls': ('excel', 'bi-file-earmark-excel'),
    # CSV
    '.csv': ('csv', 'bi-file-earmark-spreadsheet'),
    # PowerPoint
    '.pptx': ('powerpoint', 'bi-file-earmark-slides'),
    '.ppt': ('powerpoint', 'bi-file-earmark-slides'),
    # 画像
    '.jpg': ('image', 'bi-file-earmark-image'),
    '.jpeg': ('image', 'bi-file-earmark-image'),
    '.png': ('image', 'bi-file-earmark-image'),
    '.gif': ('image', 'bi-file-earmark-image'),
    '.bmp': ('image', 'bi-file-earmark-image'),
    '.webp': ('image', 'bi-file-earmark-image'),
    '.svg': ('image', 'bi-file-earmark-image'),
    # 3Dモデル
    '.stl': ('model3d', 'bi-box'),
    '.obj': ('model3d', 'bi-box'),
    '.gltf': ('model3d', 'bi-box'),
    '.glb': ('model3d', 'bi-box'),
    '.fbx': ('model3d', 'bi-box'),
    '.3ds': ('model3d', 'bi-box'),
    '.stp': ('model3d', 'bi-box'),
    '.step': ('model3d', 'bi-box'),
    # PDF
    '.pdf': ('pdf', 'bi-file-earmark-pdf'),
    # 動画
    '.mp4': ('video', 'bi-file-earmark-play'),
    '.webm': ('video', 'bi-file-earmark-play'),
    '.mov': ('video', 'bi-file-earmark-play'),
    '.avi': ('video', 'bi-file-earmark-play'),
    # 音声
    '.mp3': ('audio', 'bi-file-earmark-music'),
    '.wav': ('audio', 'bi-file-earmark-music'),
    '.ogg': ('audio', 'bi-file-earmark-music'),
    '.m4a': ('audio', 'bi-file-earmark-music'),
    # テキスト
    '.txt': ('text', 'bi-file-earmark-text'),
    '.log': ('text', 'bi-file-earmark-text'),
    '.md': ('text', 'bi-file-earmark-text'),
    '.json': ('text', 'bi-file-earmark-code'),
    '.xml': ('text', 'bi-file-earmark-code'),
    '.yaml': ('text', 'bi-file-earmark-code'),
    '.yml': ('text', 'bi-file-earmark-code'),
    '.js': ('text', 'bi-file-earmark-code'),
    '.py': ('text', 'bi-file-earmark-code'),
    '.css': ('text', 'bi-file-earmark-code'),
    # HTML
    '.html': ('html', 'bi-file-earmark-code'),
    '.htm': ('html', 'bi-file-earmark-code'),
    # メール
    '.msg': ('msg', 'bi-envelope'),
}

DEFAULT_FILE_TYPE = ('other', 'bi-file-earmark')
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB


def get_file_info(filename):
    """ファイル名からタイプとアイコンを取得"""
    ext = os.path.splitext(filename)[1].lower()
    return FILE_TYPE_MAP.get(ext, DEFAULT_FILE_TYPE)


def validate_path(path):
    """パストラバーサル対策（..チェック、NULバイトチェック、realpathによる実パス検証）"""
    if '..' in path:
        return False
    if '\x00' in path:
        return False
    full = os.path.realpath(os.path.join(DKC_DRIVE_DIR, path))
    return full.startswith(os.path.realpath(DKC_DRIVE_DIR))


def get_full_path(relative_path=''):
    """相対パスからフルパスを取得"""
    return os.path.join(DKC_DRIVE_DIR, relative_path) if relative_path else DKC_DRIVE_DIR


def join_path(parent, name):
    """親パスと名前を結合（親が空の場合は名前のみ）。フロントエンド向けのため常に/区切り"""
    return posixpath.join(parent, name) if parent else name


def get_unique_path(base_path):
    """重複しないパスを生成"""
    if not os.path.exists(base_path):
        return base_path

    directory = os.path.dirname(base_path)
    name = os.path.basename(base_path)
    base, ext = os.path.splitext(name)

    counter = 1
    while True:
        new_name = f"{base}_{counter}{ext}"
        new_path = os.path.join(directory, new_name)
        if not os.path.exists(new_path):
            return new_path
        counter += 1


def success_response(data=None, **kwargs):
    """成功レスポンスを生成"""
    response = {'status': 'success'}
    if data:
        response.update(data)
    response.update(kwargs)
    return JsonResponse(response)


def error_response(message, status=400):
    """エラーレスポンスを生成"""
    return JsonResponse({'status': 'error', 'message': message}, status=status)


def resolve_filepath(request_data, check_sqlite=True):
    """パス検証とファイルパス構築（共通ヘルパー）。

    Args:
        request_data: dictまたはQueryDict（path/filenameキーを持つ）
        check_sqlite: Trueの場合、.sqliteファイルの存在もチェック

    Returns:
        (filepath, file_path, None) on success
        (None, None, error_response) on error
    """
    file_path = request_data.get('path') or request_data.get('filename')
    if not file_path:
        return None, None, error_response('ファイルパスが指定されていません')

    if not validate_path(file_path):
        return None, None, error_response('無効なパスです')

    filepath = os.path.join(DKC_DRIVE_DIR, file_path)
    if check_sqlite:
        if not os.path.exists(filepath) and not os.path.exists(filepath + '.sqlite'):
            return None, None, error_response('ファイルが見つかりません', status=404)
    else:
        if not os.path.exists(filepath):
            return None, None, error_response('ファイルが見つかりません', status=404)

    return filepath, file_path, None


def file_or_sqlite_exists(filepath):
    """ファイルまたは対応する.sqliteファイルが存在するか確認"""
    return os.path.exists(filepath) or os.path.exists(filepath + '.sqlite')


def convert_to_sqlite(filepath, name_for_logging=''):
    """スプレッドシートをSQLiteに変換（xlsx/xls/csv対応）。

    Args:
        filepath: 変換対象ファイルのパス
        name_for_logging: ログ出力用のファイル名
    """
    import logging
    _logger = logging.getLogger(__name__)
    ext = os.path.splitext(filepath)[1].lower()
    if ext in ('.xlsx', '.xls', '.csv'):
        try:
            from ..sqlite_converter import SpreadsheetSQLite
            db = SpreadsheetSQLite(filepath)
            db.ensure_sqlite()
        except Exception as e:
            _logger.error("SQLite変換エラー: %s - %s", name_for_logging or filepath, e)


class JSONRequestMixin:
    """JSONリクエスト処理のミックスイン"""

    def parse_json(self, request):
        """リクエストボディをJSONとしてパース"""
        return json.loads(request.body)
