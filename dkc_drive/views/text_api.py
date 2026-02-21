"""
DKCドライブ - テキスト表示・スプレッドシートダウンロードAPI
"""
import os
import mimetypes
import logging
from urllib.parse import quote
from django.views import View
from django.http import HttpResponse

from ..sqlite_converter import SpreadsheetSQLite
from .utils import validate_path, get_full_path, success_response, error_response

logger = logging.getLogger(__name__)


class TextFileAPI(View):
    """テキストファイル読み込みAPI"""

    MAX_TEXT_SIZE = 5 * 1024 * 1024  # 5MB

    def get(self, request):
        file_path = request.GET.get('path', '')

        if not file_path:
            return error_response('パスが指定されていません')

        if not validate_path(file_path):
            return error_response('無効なパスです')

        filepath = get_full_path(file_path)
        if not os.path.exists(filepath) or os.path.isdir(filepath):
            return error_response('ファイルが見つかりません', 404)

        # ファイルサイズチェック
        if os.path.getsize(filepath) > self.MAX_TEXT_SIZE:
            return error_response('ファイルサイズが大きすぎます（5MB以下）')

        # エンコーディングを自動判定して読み込み
        encodings = ['utf-8', 'utf-8-sig', 'shift_jis', 'cp932', 'euc-jp', 'iso-2022-jp']
        content = None

        for encoding in encodings:
            try:
                with open(filepath, 'r', encoding=encoding) as f:
                    content = f.read()
                break
            except (UnicodeDecodeError, UnicodeError):
                continue

        if content is None:
            # バイナリとして読み込んでエラー回避
            try:
                with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
            except Exception as e:
                logger.exception('ファイルの読み込みに失敗しました')
                return error_response('ファイルの読み込みに失敗しました')

        return success_response(content=content)


class SpreadsheetDownloadAPI(View):
    """スプレッドシートダウンロードAPI

    SQLiteから元形式（xlsx/csv）を再生成してダウンロードさせる。
    元ファイルは削除済みのため、常にSQLiteから再生成する。
    """

    def get(self, request):
        file_path = request.GET.get('path', '')

        if not file_path:
            return error_response('パスが指定されていません')

        if not validate_path(file_path):
            return error_response('無効なパスです')

        filepath = get_full_path(file_path)
        sqlite_path = filepath + '.sqlite'

        if not os.path.exists(sqlite_path):
            return error_response('ファイルが見つかりません', 404)

        try:
            db = SpreadsheetSQLite(filepath)
            ext = os.path.splitext(filepath)[1].lower()

            # SQLiteから元形式を再生成
            if ext == '.csv':
                db.sqlite_to_csv()
            else:
                db.sqlite_to_xlsx()

            # 再生成されたファイルをメモリに読み込み
            with open(filepath, 'rb') as f:
                file_content = f.read()

            # 再生成ファイルを削除（SQLiteのみ保持）
            os.remove(filepath)

            content_type, _ = mimetypes.guess_type(filepath)
            if content_type is None:
                content_type = 'application/octet-stream'

            filename = os.path.basename(filepath)
            encoded = quote(filename)
            response = HttpResponse(file_content, content_type=content_type)
            response['Content-Disposition'] = f"attachment; filename*=UTF-8''{encoded}"
            return response

        except Exception as e:
            # 再生成ファイルが残っていれば削除
            if os.path.exists(filepath):
                os.remove(filepath)
            logger.exception('ダウンロードエラー')
            return error_response('ダウンロードエラーが発生しました', 500)
