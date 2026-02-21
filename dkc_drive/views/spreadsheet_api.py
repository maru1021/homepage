"""
Excelスプレッドシート操作API（SQLite中間形式版）
"""
import os
import json
import logging
from django.views import View
from django.http import JsonResponse, HttpResponse

from ..sqlite_converter import SpreadsheetSQLite
from .utils import (
    DKC_DRIVE_DIR, validate_path, resolve_filepath,
    success_response, error_response,
)


logger = logging.getLogger(__name__)


def _get_db(filepath):
    """SpreadsheetSQLiteインスタンスを取得し、ensure_sqliteを実行"""
    db = SpreadsheetSQLite(filepath)
    db.ensure_sqlite()
    return db


class SpreadsheetAPIBase(View):
    """スプレッドシートPOST APIの基底クラス。

    JSON解析 → パス検証 → DB取得の共通ボイラープレートを集約。
    サブクラスは handle(request, data, db) を実装する。
    """

    def _parse_and_resolve(self, request):
        """JSON解析 + パス検証 + DB取得の共通処理。

        Returns:
            (data, db, None) on success
            (None, None, error_response) on error
        """
        data = json.loads(request.body)
        filepath, file_path, err = resolve_filepath(data)
        if err:
            return None, None, err
        db = _get_db(filepath)
        return data, db, None

    def post(self, request, *args, **kwargs):
        try:
            data, db, err = self._parse_and_resolve(request)
            if err:
                return err
            return self.handle(request, data, db)
        except ValueError as e:
            return error_response(str(e))
        except Exception as e:
            return error_response(str(e), status=500)

    def handle(self, request, data, db):
        """サブクラスで実装。data=パース済みJSON, db=SpreadsheetSQLiteインスタンス"""
        raise NotImplementedError


# ============================================================
# SpreadsheetDataAPI - データ読み込み（GETのため基底クラス不使用）
# ============================================================

class SpreadsheetDataAPI(View):
    """スプレッドシートデータ読み込みAPI（SQLite経由）"""

    def get(self, request, *args, **kwargs):
        filepath, file_path, err = resolve_filepath(request.GET)
        if err:
            return err

        try:
            db = _get_db(filepath)

            # ETagキャッシュ
            etag = db.get_etag()
            if_none_match = request.META.get('HTTP_IF_NONE_MATCH')
            if if_none_match and if_none_match == etag:
                response = JsonResponse({}, status=304)
                response['ETag'] = etag
                return response

            result = db.read_all_sheets()

            response = JsonResponse({
                'status': 'success',
                'sheets': result['sheets'],
                'sheetNames': result['sheetNames']
            })
            if etag:
                response['ETag'] = etag
            return response

        except Exception as e:
            logger.error("スプレッドシート読み込みエラー: %s", e, exc_info=True)
            return error_response(str(e), status=500)


# ============================================================
# SpreadsheetSaveAPI - セル編集保存
# ============================================================

class SpreadsheetSaveAPI(SpreadsheetAPIBase):
    """セル編集保存API（SQLite経由）"""

    def handle(self, request, data, db):
        sheet_name = data.get('sheetName')
        changes = data.get('changes', [])
        db.update_cells(sheet_name, changes)
        return success_response()


# ============================================================
# SpreadsheetCreateAPI - 新規Excelファイル作成（独自パターンのため基底クラス不使用）
# ============================================================

class SpreadsheetCreateAPI(View):
    """新規ファイル作成API（xlsx/csv/txt/html対応）"""

    ALLOWED_EXTENSIONS = {'.xlsx', '.csv', '.txt', '.html'}

    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            filename = data.get('filename', '新規ファイル')
            ext = data.get('ext', '.xlsx')
            folder_path = data.get('folder', '')

            if not validate_path(folder_path):
                return error_response('無効なパスです')

            if ext not in self.ALLOWED_EXTENSIONS:
                return error_response('サポートされていない拡張子です')

            # ファイル名に拡張子がなければ付与
            if not filename.endswith(ext):
                filename += ext

            target_dir = os.path.join(DKC_DRIVE_DIR, folder_path) if folder_path else DKC_DRIVE_DIR
            os.makedirs(target_dir, exist_ok=True)

            filepath = os.path.join(target_dir, filename)

            # 同名ファイルが存在する場合は番号を付ける
            base, file_ext = os.path.splitext(filename)
            counter = 1
            sqlite_path = filepath + '.sqlite'
            while os.path.exists(filepath) or os.path.exists(sqlite_path):
                filename = f"{base}_{counter}{file_ext}"
                filepath = os.path.join(target_dir, filename)
                sqlite_path = filepath + '.sqlite'
                counter += 1

            if ext == '.xlsx':
                from openpyxl import Workbook
                wb = Workbook()
                ws = wb.active
                ws.title = 'Sheet1'
                wb.save(filepath)
                wb.close()
                # 即座にSQLite変換
                db = SpreadsheetSQLite(filepath)
                db.xlsx_to_sqlite()
            elif ext == '.csv':
                # 空のCSVファイルを作成してSQLite変換
                with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
                    pass
                db = SpreadsheetSQLite(filepath)
                db.csv_to_sqlite()
            elif ext == '.txt':
                with open(filepath, 'w', encoding='utf-8') as f:
                    pass
            elif ext == '.html':
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write('<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="UTF-8">\n<title></title>\n</head>\n<body>\n\n</body>\n</html>\n')

            file_path_relative = os.path.join(folder_path, filename) if folder_path else filename
            return success_response(filename=filename, path=file_path_relative)

        except Exception as e:
            return error_response(str(e), status=500)


# ============================================================
# SheetAddAPI - シート追加
# ============================================================

class SheetAddAPI(SpreadsheetAPIBase):
    """シート追加API（SQLite経由）"""

    def handle(self, request, data, db):
        sheet_name = data.get('sheetName')
        if not sheet_name:
            return error_response('シート名が指定されていません')
        db.add_sheet(sheet_name)
        return success_response(sheetName=sheet_name)


# ============================================================
# SheetDeleteAPI - シート削除
# ============================================================

class SheetDeleteAPI(SpreadsheetAPIBase):
    """シート削除API（SQLite経由）"""

    def handle(self, request, data, db):
        sheet_name = data.get('sheetName')
        if not sheet_name:
            return error_response('シート名が指定されていません')
        db.delete_sheet(sheet_name)
        return success_response()


# ============================================================
# SheetRenameAPI - シート名変更
# ============================================================

class SheetRenameAPI(SpreadsheetAPIBase):
    """シート名変更API（SQLite経由）"""

    def handle(self, request, data, db):
        old_sheet_name = data.get('oldSheetName')
        new_sheet_name = data.get('newSheetName')
        if not old_sheet_name or not new_sheet_name:
            return error_response('シート名が指定されていません')
        db.rename_sheet(old_sheet_name, new_sheet_name)
        return success_response(newSheetName=new_sheet_name)


# ============================================================
# AutoFilterAPI - オートフィルター設定
# ============================================================

class AutoFilterAPI(SpreadsheetAPIBase):
    """オートフィルター設定API（SQLite経由）"""

    def handle(self, request, data, db):
        sheet_name = data.get('sheetName')
        filter_ref = data.get('filterRef')
        db.set_auto_filter(sheet_name, filter_ref)
        return success_response()


# ============================================================
# ColumnWidthAPI - 列幅変更
# ============================================================

class ColumnWidthAPI(SpreadsheetAPIBase):
    """列幅変更API（SQLite経由）"""

    def handle(self, request, data, db):
        sheet_name = data.get('sheetName')
        col = data.get('col')
        width = data.get('width')
        if col is None or width is None:
            return error_response('列番号または幅が指定されていません')
        db.set_column_width(sheet_name, col, width)
        return success_response()


# ============================================================
# RowHeightAPI - 行高さ変更
# ============================================================

class RowHeightAPI(SpreadsheetAPIBase):
    """行高さ変更API（SQLite経由）"""

    def handle(self, request, data, db):
        sheet_name = data.get('sheetName')
        row = data.get('row')
        height = data.get('height')
        if row is None or height is None:
            return error_response('行番号または高さが指定されていません')
        db.set_row_height(sheet_name, row, height)
        return success_response()


# ============================================================
# MergeCellsAPI - セル結合
# ============================================================

class MergeCellsAPI(SpreadsheetAPIBase):
    """セル結合API（SQLite経由）"""

    def handle(self, request, data, db):
        sheet_name = data.get('sheetName')
        merges = data.get('merges', [])
        if not merges:
            return error_response('結合範囲が指定されていません')
        db.add_merges(sheet_name, merges)
        return success_response(merges=merges)


# ============================================================
# UnmergeCellsAPI - セル結合解除
# ============================================================

class UnmergeCellsAPI(SpreadsheetAPIBase):
    """セル結合解除API（SQLite経由）"""

    def handle(self, request, data, db):
        sheet_name = data.get('sheetName')
        merges = data.get('merges', [])
        if not merges:
            return error_response('解除する結合が指定されていません')
        db.remove_merges(sheet_name, merges)
        return success_response()


# ============================================================
# SpreadsheetImageAPI - 画像保存
# ============================================================

class SpreadsheetImageAPI(SpreadsheetAPIBase):
    """スプレッドシート画像保存API（SQLite経由）"""

    def handle(self, request, data, db):
        sheet_name = data.get('sheetName')
        image_data = data.get('image')
        if not image_data:
            return error_response('画像データがありません')

        # dataUrlがあれば新規保存、なければ位置・サイズのみ更新
        if image_data.get('dataUrl'):
            new_image_index = db.save_image(sheet_name, image_data)
            return success_response(imageIndex=new_image_index)
        else:
            db.update_image_position(sheet_name, image_data)
            return success_response()


# ============================================================
# SpreadsheetImageDeleteAPI - 画像削除
# ============================================================

class SpreadsheetImageDeleteAPI(SpreadsheetAPIBase):
    """スプレッドシート画像削除API（SQLite経由）"""

    def handle(self, request, data, db):
        sheet_name = data.get('sheetName')
        image_index = data.get('imageIndex')
        if image_index is None:
            return error_response('画像インデックスが指定されていません')
        db.delete_image(sheet_name, image_index)
        return success_response()


# ============================================================
# SpreadsheetImageDataAPI - 画像データ遅延取得（GETのため基底クラス不使用）
# ============================================================

class SpreadsheetImageDataAPI(View):
    """画像データ遅延取得API（SQLite経由）"""

    def get(self, request, *args, **kwargs):
        filepath, file_path, err = resolve_filepath(request.GET)
        if err:
            return err

        sheet_name = request.GET.get('sheetName')
        image_index = request.GET.get('imageIndex')

        if sheet_name is None or image_index is None:
            return error_response('パラメータ不足')

        try:
            image_index = int(image_index)
        except (ValueError, TypeError):
            return error_response('無効な画像インデックス')

        try:
            db = _get_db(filepath)
            image_bytes, content_type = db.get_image_data(sheet_name, image_index)

            if not image_bytes:
                return error_response('画像が見つかりません', status=404)

            response = HttpResponse(image_bytes, content_type=content_type)
            response['Cache-Control'] = 'private, max-age=3600'
            return response

        except Exception as e:
            return error_response(str(e), status=500)


# ============================================================
# SpreadsheetShapeAPI - 図形保存・更新
# ============================================================

class SpreadsheetShapeAPI(SpreadsheetAPIBase):
    """スプレッドシート図形保存API（SQLite経由）"""

    def handle(self, request, data, db):
        sheet_name = data.get('sheetName')
        shape_data = data.get('shape')
        if not shape_data:
            return error_response('図形データがありません')

        # shapeIndexがあれば更新、なければ新規作成
        if shape_data.get('shapeIndex') is not None:
            db.update_shape(sheet_name, shape_data)
            return success_response()
        else:
            new_shape_index = db.save_shape(sheet_name, shape_data)
            return success_response(shapeIndex=new_shape_index)


# ============================================================
# SpreadsheetShapeDeleteAPI - 図形削除
# ============================================================

class SpreadsheetShapeDeleteAPI(SpreadsheetAPIBase):
    """スプレッドシート図形削除API（SQLite経由）"""

    def handle(self, request, data, db):
        sheet_name = data.get('sheetName')
        shape_index = data.get('shapeIndex')
        if shape_index is None:
            return error_response('図形インデックスが指定されていません')
        db.delete_shape(sheet_name, shape_index)
        return success_response()


# ============================================================
# SpreadsheetChartAPI - グラフ保存・更新
# ============================================================

class SpreadsheetChartAPI(SpreadsheetAPIBase):
    """スプレッドシートグラフ保存API（SQLite経由）"""

    def handle(self, request, data, db):
        sheet_name = data.get('sheetName')
        chart_data = data.get('chart')
        if not chart_data:
            return error_response('グラフデータがありません')

        # chartIndexがあれば更新、なければ新規作成
        if chart_data.get('chartIndex') is not None:
            db.update_chart(sheet_name, chart_data)
            return success_response()
        else:
            new_chart_index = db.save_chart(sheet_name, chart_data)
            return success_response(chartIndex=new_chart_index)


# ============================================================
# SpreadsheetChartDeleteAPI - グラフ削除
# ============================================================

class SpreadsheetChartDeleteAPI(SpreadsheetAPIBase):
    """スプレッドシートグラフ削除API（SQLite経由）"""

    def handle(self, request, data, db):
        sheet_name = data.get('sheetName')
        chart_index = data.get('chartIndex')
        if chart_index is None:
            return error_response('グラフインデックスが指定されていません')
        db.delete_chart(sheet_name, chart_index)
        return success_response()
