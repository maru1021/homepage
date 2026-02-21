"""
DKCドライブ - ファイル・フォルダ操作API
"""
import os
import posixpath
import shutil
import logging
import mimetypes
from urllib.parse import quote
from django.views import View
from django.http import JsonResponse, FileResponse, Http404
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.utils.decorators import method_decorator

from .utils import (
    MAX_FILE_SIZE,
    get_file_info, validate_path, get_full_path, join_path, get_unique_path,
    file_or_sqlite_exists, convert_to_sqlite,
    success_response, error_response, JSONRequestMixin,
)
from .security import (
    validate_and_reject_html, check_html_security,
)

logger = logging.getLogger(__name__)


def list_folder_items(folder_path='', offset=0, limit=50):
    """フォルダ内のファイル・フォルダ一覧を取得（FileListAPIとDKCDriveViewで共用）"""
    if not validate_path(folder_path):
        raise ValueError('無効なパスです')

    target_dir = get_full_path(folder_path)
    os.makedirs(target_dir, exist_ok=True)

    folders, files = [], []
    all_entries = list(os.scandir(target_dir))
    originals = set(e.name for e in all_entries if not e.name.endswith('.sqlite') and not e.is_dir())

    for entry in all_entries:
        if entry.name.endswith('.sqlite'):
            display_name = entry.name[:-7]
            if display_name in originals:
                continue
        else:
            display_name = entry.name

        stat = entry.stat()
        relative_path = join_path(folder_path, display_name)

        if entry.is_dir():
            folders.append({
                'name': display_name,
                'type': 'folder',
                'path': relative_path,
                'modified': stat.st_mtime
            })
        else:
            file_type, icon = get_file_info(display_name)
            files.append({
                'name': display_name,
                'type': 'file',
                'fileType': file_type,
                'icon': icon,
                'path': relative_path,
                'size': stat.st_size,
                'modified': stat.st_mtime
            })

    folders.sort(key=lambda x: x['name'].lower())
    files.sort(key=lambda x: x['modified'], reverse=True)

    all_items = folders + files
    total_count = len(all_items)

    return {
        'items': all_items[offset:offset + limit],
        'currentFolder': folder_path,
        'parentFolder': posixpath.dirname(folder_path) if folder_path else None,
        'totalCount': total_count
    }


class FileListAPI(View):
    """ファイル・フォルダ一覧API"""

    def get(self, request):
        folder_path = request.GET.get('folder', '')
        search_query = request.GET.get('search', '').strip().lower()
        try:
            offset = max(0, int(request.GET.get('offset', 0)))
            limit = min(max(1, int(request.GET.get('limit', 50))), 10000)
        except (ValueError, TypeError):
            offset, limit = 0, 50

        if not search_query:
            try:
                return JsonResponse(list_folder_items(folder_path, offset, limit))
            except ValueError:
                return error_response('無効なパスです')

        # 検索時: os.walk() で再帰的に検索
        if not validate_path(folder_path):
            return error_response('無効なパスです')

        target_dir = get_full_path(folder_path)
        os.makedirs(target_dir, exist_ok=True)

        folders, files = [], []

        for dirpath, dirnames, filenames in os.walk(target_dir):
            rel_dir = os.path.relpath(dirpath, get_full_path())
            if rel_dir == '.':
                rel_dir = ''

            for dirname in dirnames:
                if search_query not in dirname.lower():
                    continue
                full = os.path.join(dirpath, dirname)
                stat = os.stat(full)
                relative_path = join_path(rel_dir, dirname)
                folders.append({
                    'name': dirname,
                    'type': 'folder',
                    'path': relative_path,
                    'modified': stat.st_mtime,
                    'location': rel_dir,
                })

            # .sqliteファイルを元ファイル名で表示
            originals = set(f for f in filenames if not f.endswith('.sqlite'))
            for filename in filenames:
                if filename.endswith('.sqlite'):
                    display_name = filename[:-7]
                    if display_name in originals:
                        continue
                else:
                    display_name = filename

                if search_query not in display_name.lower():
                    continue
                full = os.path.join(dirpath, filename)
                stat = os.stat(full)
                relative_path = join_path(rel_dir, display_name)
                file_type, icon = get_file_info(display_name)
                files.append({
                    'name': display_name,
                    'type': 'file',
                    'fileType': file_type,
                    'icon': icon,
                    'path': relative_path,
                    'size': stat.st_size,
                    'modified': stat.st_mtime,
                    'location': rel_dir,
                })

        folders.sort(key=lambda x: x['name'].lower())
        files.sort(key=lambda x: x['modified'], reverse=True)

        all_items = folders + files
        total_count = len(all_items)

        return JsonResponse({
            'items': all_items[offset:offset + limit],
            'currentFolder': folder_path,
            'parentFolder': posixpath.dirname(folder_path) if folder_path else None,
            'totalCount': total_count
        })


def _validate_and_save_file(file_obj, target_dir, request, rejected_files, relative_path=None):
    """アップロードファイルのバリデーション・保存・SQLite変換の共通処理

    Args:
        file_obj: Django UploadedFile
        target_dir: 保存先ディレクトリ
        request: Django request（セキュリティログ用）
        rejected_files: 拒否ファイル情報の追加先リスト
        relative_path: フォルダアップロード時の相対パス（Noneなら単体アップロード）

    Returns:
        dict with {'filepath', 'final_name', 'file_type'} on success, None on skip/reject
    """
    file_type, _ = get_file_info(file_obj.name)

    # サイズチェック（3Dファイル以外）
    if file_type != 'model3d' and file_obj.size > MAX_FILE_SIZE:
        return None

    # HTMLファイルのセキュリティチェック
    if file_type == 'html':
        identifier = relative_path or file_obj.name
        passed, rejection = check_html_security(file_obj, request, identifier=identifier)
        if not passed:
            if relative_path:
                rejection['path'] = relative_path
            rejected_files.append(rejection)
            return None

    # 保存先パスの決定
    if relative_path:
        file_dest_path = os.path.join(target_dir, relative_path)
        os.makedirs(os.path.dirname(file_dest_path), exist_ok=True)
    else:
        file_dest_path = os.path.join(target_dir, file_obj.name)

    filepath = get_unique_path(file_dest_path)
    final_name = os.path.basename(filepath)

    # ファイル書き込み
    with open(filepath, 'wb') as dest:
        for chunk in file_obj.chunks():
            dest.write(chunk)

    # スプレッドシートはSQLiteに変換して元ファイル削除
    convert_to_sqlite(filepath, relative_path or final_name)

    return {'filepath': filepath, 'final_name': final_name, 'file_type': file_type}


class FileUploadAPI(View):
    """ファイルアップロードAPI"""

    def post(self, request):
        uploaded_files = request.FILES.getlist('file')
        folder_path = request.POST.get('folder', '')

        if not uploaded_files:
            return error_response('ファイルが選択されていません')

        if not validate_path(folder_path):
            return error_response('無効なパスです')

        target_dir = get_full_path(folder_path)
        os.makedirs(target_dir, exist_ok=True)

        uploaded = []
        rejected_files = []

        for f in uploaded_files:
            result = _validate_and_save_file(f, target_dir, request, rejected_files)
            if result:
                uploaded.append({
                    'filename': result['final_name'],
                    'path': join_path(folder_path, result['final_name']),
                    'fileType': result['file_type']
                })

        # 拒否されたファイルがある場合
        if rejected_files and not uploaded:
            # 全て拒否された場合
            error_details = '\n'.join([f"・{r['filename']}: {r['reason']}" for r in rejected_files])
            return error_response(f'セキュリティ上の理由でアップロードが拒否されました:\n{error_details}')

        if not uploaded:
            return error_response('アップロードに失敗しました')

        response_data = {}
        if len(uploaded) == 1:
            response_data = uploaded[0]
        else:
            response_data['files'] = uploaded

        # 一部拒否されたファイルがある場合は警告を追加
        if rejected_files:
            response_data['warnings'] = [
                f"{r['filename']}: セキュリティチェックにより拒否されました"
                for r in rejected_files
            ]

        return success_response(response_data)


class FolderUploadAPI(View):
    """フォルダアップロードAPI（再帰的にフォルダ構造を保持）"""

    def post(self, request):
        uploaded_files = request.FILES.getlist('file')
        relative_paths = request.POST.getlist('relativePath')
        folder_path = request.POST.get('folder', '')

        if not uploaded_files:
            return error_response('ファイルが選択されていません')

        if not validate_path(folder_path):
            return error_response('無効なパスです')

        if len(uploaded_files) != len(relative_paths):
            return error_response('ファイルとパスの数が一致しません')

        target_dir = get_full_path(folder_path)
        os.makedirs(target_dir, exist_ok=True)

        uploaded_count = 0
        rejected_files = []

        for f, rel_path in zip(uploaded_files, relative_paths):
            if not validate_path(rel_path):
                continue

            result = _validate_and_save_file(f, target_dir, request, rejected_files, relative_path=rel_path)
            if result:
                uploaded_count += 1

        # 拒否されたファイルがある場合
        if rejected_files and uploaded_count == 0:
            error_details = '\n'.join([f"・{r['path']}: {r['reason']}" for r in rejected_files])
            return error_response(f'セキュリティ上の理由でアップロードが拒否されました:\n{error_details}')

        if uploaded_count == 0:
            return error_response('アップロードに失敗しました')

        response_data = {'uploadedCount': uploaded_count}
        if rejected_files:
            response_data['rejectedCount'] = len(rejected_files)
            response_data['warnings'] = [
                f"{r['path']}: セキュリティチェックにより拒否されました"
                for r in rejected_files
            ]

        return success_response(response_data)


class FileDeleteAPI(JSONRequestMixin, View):
    """ファイル・フォルダ削除API"""

    def post(self, request):
        data = self.parse_json(request)
        path = data.get('path') or data.get('filename')

        if not path:
            return error_response('パスが指定されていません')

        if not validate_path(path):
            return error_response('無効なパスです')

        filepath = get_full_path(path)
        if not file_or_sqlite_exists(filepath):
            return error_response('ファイルまたはフォルダが見つかりません', 404)

        if os.path.isdir(filepath):
            shutil.rmtree(filepath)
        else:
            if os.path.exists(filepath):
                os.remove(filepath)
            sqlite_path = filepath + '.sqlite'
            if os.path.exists(sqlite_path):
                os.remove(sqlite_path)

        return success_response()


class FolderCreateAPI(JSONRequestMixin, View):
    """フォルダ作成API"""

    def post(self, request):
        data = self.parse_json(request)
        folder_name = data.get('name', '新規フォルダ')
        parent_path = data.get('parent', '')

        if not validate_path(parent_path) or not validate_path(folder_name):
            return error_response('無効なパスです')

        parent_dir = get_full_path(parent_path)
        os.makedirs(parent_dir, exist_ok=True)

        folder_path = get_unique_path(os.path.join(parent_dir, folder_name))
        final_name = os.path.basename(folder_path)

        os.makedirs(folder_path)

        return success_response(
            name=final_name,
            path=join_path(parent_path, final_name)
        )


class FileRenameAPI(JSONRequestMixin, View):
    """ファイル・フォルダ名変更API"""

    def post(self, request):
        data = self.parse_json(request)
        old_path = data.get('path')
        new_name = data.get('newName')
        item_type = data.get('type', 'file')

        if not old_path or not new_name:
            return error_response('パスまたは新しい名前が指定されていません')

        if not validate_path(old_path) or not validate_path(new_name):
            return error_response('無効なパスです')

        old_filepath = get_full_path(old_path)
        if not file_or_sqlite_exists(old_filepath):
            return error_response('ファイルまたはフォルダが見つかりません', 404)

        # ファイルの場合、拡張子を保持
        if item_type == 'file':
            _, ext = os.path.splitext(old_path)
            if ext and not new_name.lower().endswith(ext.lower()):
                new_name += ext

        parent_dir = os.path.dirname(old_filepath)
        new_filepath = os.path.join(parent_dir, new_name)
        new_sqlite = new_filepath + '.sqlite'

        if file_or_sqlite_exists(new_filepath):
            return error_response('同名のファイルまたはフォルダが既に存在します')

        if os.path.exists(old_filepath):
            os.rename(old_filepath, new_filepath)
        old_sqlite = old_filepath + '.sqlite'
        if os.path.exists(old_sqlite):
            os.rename(old_sqlite, new_sqlite)

        parent_relative = os.path.dirname(old_path)
        return success_response(
            path=join_path(parent_relative, new_name),
            name=new_name
        )


class FileMoveAPI(JSONRequestMixin, View):
    """ファイル・フォルダ移動API"""

    def post(self, request):
        data = self.parse_json(request)
        src_path = data.get('path')
        dest_folder = data.get('destFolder', '')
        item_type = data.get('type', 'file')

        if not src_path:
            return error_response('移動元パスが指定されていません')

        if not validate_path(src_path) or not validate_path(dest_folder):
            return error_response('無効なパスです')

        src_filepath = get_full_path(src_path)
        if not file_or_sqlite_exists(src_filepath):
            return error_response('ファイルまたはフォルダが見つかりません', 404)

        # 移動先ディレクトリを確認・作成
        dest_dir = get_full_path(dest_folder)
        os.makedirs(dest_dir, exist_ok=True)

        # ファイル/フォルダ名を取得
        item_name = os.path.basename(src_filepath)

        # 移動先パス
        dest_filepath = os.path.join(dest_dir, item_name)

        # フォルダを自分自身のサブフォルダに移動しようとしている場合はエラー
        if item_type == 'folder':
            src_abs = os.path.abspath(src_filepath)
            dest_abs = os.path.abspath(dest_dir)
            if dest_abs.startswith(src_abs + os.sep) or dest_abs == src_abs:
                return error_response('フォルダを自分自身またはそのサブフォルダに移動することはできません')

        # 同名ファイル/フォルダが存在する場合はユニークな名前を生成
        if file_or_sqlite_exists(dest_filepath):
            dest_filepath = get_unique_path(dest_filepath)
            item_name = os.path.basename(dest_filepath)

        # 移動実行
        if os.path.exists(src_filepath):
            shutil.move(src_filepath, dest_filepath)
        src_sqlite = src_filepath + '.sqlite'
        if os.path.exists(src_sqlite):
            shutil.move(src_sqlite, dest_filepath + '.sqlite')

        # 新しい相対パスを返す
        new_relative_path = join_path(dest_folder, item_name)

        return success_response(
            newPath=new_relative_path,
            name=item_name
        )


@method_decorator(xframe_options_sameorigin, name='dispatch')
class FileServeAPI(View):
    """ファイル配信API（iframe表示用にX-Frame-Optionsを調整）"""

    def get(self, _request, file_path):
        if not validate_path(file_path):
            raise Http404('無効なパスです')

        filepath = get_full_path(file_path)
        if not os.path.exists(filepath) or os.path.isdir(filepath):
            raise Http404('ファイルが見つかりません')

        content_type, _ = mimetypes.guess_type(filepath)
        if content_type is None:
            # 大文字拡張子（.PDF等）でmimetypesが判定できない場合、小文字で再判定
            content_type, _ = mimetypes.guess_type(filepath.lower())
        if content_type is None:
            content_type = 'application/octet-stream'

        response = FileResponse(open(filepath, 'rb'), content_type=content_type)
        encoded = quote(os.path.basename(filepath))
        response['Content-Disposition'] = f"inline; filename*=UTF-8''{encoded}"
        return response


class SaveChartAPI(JSONRequestMixin, View):
    """グラフHTML保存API"""

    def post(self, request):
        data = self.parse_json(request)
        folder = data.get('folder', '')
        file_name = data.get('fileName')
        content = data.get('content')

        if not file_name or not content:
            return error_response('ファイル名またはコンテンツが指定されていません')

        if not validate_path(folder) or not validate_path(file_name):
            return error_response('無効なパスです')

        # HTMLファイルのみ許可
        if not file_name.lower().endswith('.html'):
            return error_response('HTMLファイルのみ保存できます')

        # HTMLコンテンツのセキュリティチェック
        rejection = validate_and_reject_html(request, content, file_name)
        if rejection:
            return rejection

        target_dir = get_full_path(folder)
        os.makedirs(target_dir, exist_ok=True)

        filepath = get_unique_path(os.path.join(target_dir, file_name))
        final_name = os.path.basename(filepath)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        return success_response(
            name=final_name,
            path=join_path(folder, final_name)
        )


class SaveHTMLAPI(JSONRequestMixin, View):
    """HTML編集内容保存API（既存ファイル上書き）"""

    def post(self, request):
        data = self.parse_json(request)
        file_path = data.get('path')
        content = data.get('content')

        if not file_path or not content:
            return error_response('ファイルパスまたはコンテンツが指定されていません')

        if not validate_path(file_path):
            return error_response('無効なパスです')

        if not file_path.lower().endswith(('.html', '.htm')):
            return error_response('HTMLファイルのみ保存できます')

        # HTMLコンテンツのセキュリティチェック
        rejection = validate_and_reject_html(request, content, file_path)
        if rejection:
            return rejection

        filepath = get_full_path(file_path)
        if not os.path.exists(filepath):
            return error_response('ファイルが見つかりません')

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        return success_response()
