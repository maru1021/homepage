from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.urls import path
from .views import (
    DKCDriveView,
    FileListAPI,
    FileUploadAPI,
    FolderUploadAPI,
    FileDeleteAPI,
    FolderCreateAPI,
    FileRenameAPI,
    FileMoveAPI,
    FileServeAPI,
    SaveChartAPI,
    SaveHTMLAPI,
    FolderAnalysisAPI,
    FolderAnalysisDataAPI,
    SpreadsheetDataAPI,
    SpreadsheetSaveAPI,
    SpreadsheetCreateAPI,
    SheetAddAPI,
    SheetDeleteAPI,
    SheetRenameAPI,
    AutoFilterAPI,
    ColumnWidthAPI,
    RowHeightAPI,
    MergeCellsAPI,
    UnmergeCellsAPI,
    SpreadsheetImageAPI,
    SpreadsheetImageDeleteAPI,
    SpreadsheetImageDataAPI,
    SpreadsheetShapeAPI,
    SpreadsheetShapeDeleteAPI,
    SpreadsheetChartAPI,
    SpreadsheetChartDeleteAPI,
    SpreadsheetDownloadAPI,
    PowerPointDataAPI,
    MsgDataAPI,
    TextFileAPI,
    CADConvertAPI,
    ImageAnalysisAPI,
)

app_name = 'dkc_drive'


def _login_page(view):
    """メイン画面用: 未認証時はログインページにリダイレクト"""
    return login_required(view)


def _login_api(view):
    """API用: 未認証時は403 JSONを返す"""
    from functools import wraps

    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({'error': '認証が必要です'}, status=403)
        return view(request, *args, **kwargs)
    return wrapper


urlpatterns = [
    # メイン画面（未認証→ログインページへリダイレクト）
    path('', _login_page(DKCDriveView.as_view()), name='index'),
    path('folder/<path:folder_path>/', _login_page(DKCDriveView.as_view()), name='index_folder'),
    path('file/<path:file_path>/', _login_page(DKCDriveView.as_view()), name='index_file'),

    # ファイル・フォルダ操作API（未認証→403 JSON）
    path('api/list/', _login_api(FileListAPI.as_view()), name='list'),
    path('api/upload/', _login_api(FileUploadAPI.as_view()), name='upload'),
    path('api/upload-folder/', _login_api(FolderUploadAPI.as_view()), name='upload_folder'),
    path('api/delete/', _login_api(FileDeleteAPI.as_view()), name='delete'),
    path('api/folder/', _login_api(FolderCreateAPI.as_view()), name='folder'),
    path('api/rename/', _login_api(FileRenameAPI.as_view()), name='rename'),
    path('api/move/', _login_api(FileMoveAPI.as_view()), name='move'),
    path('api/serve/<path:file_path>', _login_api(FileServeAPI.as_view()), name='serve'),
    path('api/save-chart/', _login_api(SaveChartAPI.as_view()), name='save_chart'),
    path('api/save-html/', _login_api(SaveHTMLAPI.as_view()), name='save_html'),
    path('api/folder-analysis/', _login_api(FolderAnalysisAPI.as_view()), name='folder_analysis'),
    path('api/folder-analysis-data/', _login_api(FolderAnalysisDataAPI.as_view()), name='folder_analysis_data'),

    # スプレッドシートAPI（未認証→403 JSON）
    path('api/download/', _login_api(SpreadsheetDownloadAPI.as_view()), name='download'),
    path('api/data/', _login_api(SpreadsheetDataAPI.as_view()), name='data'),
    path('api/save/', _login_api(SpreadsheetSaveAPI.as_view()), name='save'),
    path('api/create/', _login_api(SpreadsheetCreateAPI.as_view()), name='create'),
    path('api/add-sheet/', _login_api(SheetAddAPI.as_view()), name='add_sheet'),
    path('api/delete-sheet/', _login_api(SheetDeleteAPI.as_view()), name='delete_sheet'),
    path('api/rename-sheet/', _login_api(SheetRenameAPI.as_view()), name='rename_sheet'),
    path('api/auto-filter/', _login_api(AutoFilterAPI.as_view()), name='auto_filter'),
    path('api/column-width/', _login_api(ColumnWidthAPI.as_view()), name='column_width'),
    path('api/row-height/', _login_api(RowHeightAPI.as_view()), name='row_height'),
    path('api/merge-cells/', _login_api(MergeCellsAPI.as_view()), name='merge_cells'),
    path('api/unmerge-cells/', _login_api(UnmergeCellsAPI.as_view()), name='unmerge_cells'),
    path('api/spreadsheet/image/', _login_api(SpreadsheetImageAPI.as_view()), name='spreadsheet_image'),
    path('api/spreadsheet/image/delete/', _login_api(SpreadsheetImageDeleteAPI.as_view()), name='spreadsheet_image_delete'),
    path('api/spreadsheet/image-data/', _login_api(SpreadsheetImageDataAPI.as_view()), name='spreadsheet_image_data'),
    path('api/spreadsheet/shape/', _login_api(SpreadsheetShapeAPI.as_view()), name='spreadsheet_shape'),
    path('api/spreadsheet/shape/delete/', _login_api(SpreadsheetShapeDeleteAPI.as_view()), name='spreadsheet_shape_delete'),
    path('api/spreadsheet/chart/', _login_api(SpreadsheetChartAPI.as_view()), name='spreadsheet_chart'),
    path('api/spreadsheet/chart/delete/', _login_api(SpreadsheetChartDeleteAPI.as_view()), name='spreadsheet_chart_delete'),

    # PowerPoint・Text・MSG API（未認証→403 JSON）
    path('api/ppt/', _login_api(PowerPointDataAPI.as_view()), name='ppt_data'),
    path('api/msg/', _login_api(MsgDataAPI.as_view()), name='msg_data'),
    path('api/text/', _login_api(TextFileAPI.as_view()), name='text_data'),

    # CAD変換API（未認証→403 JSON）
    path('api/cad/', _login_api(CADConvertAPI.as_view()), name='cad_convert'),

    # 画像分類API（未認証→403 JSON）
    path('api/image-analysis/', _login_api(ImageAnalysisAPI.as_view()), name='image_analysis'),
]
