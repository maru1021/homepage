import logging
import posixpath

from django.views import View
from django.shortcuts import render

from .file_api import list_folder_items

logger = logging.getLogger(__name__)

INITIAL_PAGE_SIZE = 50


class DKCDriveView(View):
    """DKCドライブメイン画面（認証はurls.pyで強制）"""

    def get(self, request, *args, **kwargs):

        # ユーザーの印鑑情報を取得
        user_seal = ''
        user_name = ''
        if request.user.is_authenticated:
            profile = getattr(request.user, 'profile', None)
            if profile:
                user_seal = profile.seal or ''
            user_name = request.user.get_full_name() or request.user.username

        initial_folder = kwargs.get('folder_path', '')
        initial_file = kwargs.get('file_path', '')

        # 一覧取得対象フォルダを決定
        if initial_file:
            listing_folder = posixpath.dirname(initial_file) if '/' in initial_file else ''
        else:
            listing_folder = initial_folder

        # 初期ファイル一覧を事前取得（失敗時はJS側でAPIフォールバック）
        initial_file_list = None
        try:
            initial_file_list = list_folder_items(
                listing_folder, offset=0, limit=INITIAL_PAGE_SIZE
            )
        except Exception:
            logger.warning('初期ファイル一覧の取得に失敗: %s', listing_folder, exc_info=True)

        context = {
            'initial_folder': initial_folder,
            'initial_file': initial_file,
            'user_seal': user_seal,
            'user_name': user_name,
            'initial_file_list': initial_file_list,
        }
        return render(request, 'dkc_drive/index.html', context)
