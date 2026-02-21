"""
DKCドライブ用WebSocketコンシューマー
同じファイルを編集しているユーザー間でリアルタイム同期を行う（SQLite中間形式版）
"""

import json
import os
import hashlib
import logging
from urllib.parse import unquote
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from .sqlite_converter import SpreadsheetSQLite
from .views.utils import DKC_DRIVE_DIR, file_or_sqlite_exists, validate_path

logger = logging.getLogger(__name__)


class DKCDriveConsumer(AsyncWebsocketConsumer):
    """DKCドライブのリアルタイム同期用コンシューマー"""

    async def connect(self):
        # 認証チェック
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close()
            return

        self.file_path = unquote(self.scope['url_route']['kwargs'].get('file_path', ''))

        # パストラバーサル対策
        if not validate_path(self.file_path):
            await self.close()
            return

        path_hash = hashlib.md5(self.file_path.encode('utf-8')).hexdigest()[:16]
        self.room_group_name = f'dkc_drive_{path_hash}'

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        await self._broadcast_user_count()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        await self._broadcast_user_count()

    async def receive(self, text_data):
        """クライアントからメッセージを受信"""
        try:
            data = json.loads(text_data)
            handler = {
                'cell_change': self._handle_cell_change,
                'save': self._handle_save,
                'cursor_move': self._broadcast_cursor,
                'sheet_add': self._handle_sheet_add,
                'sheet_delete': self._handle_sheet_delete,
                'sheet_rename': self._handle_sheet_rename,
                'merge_cells': self._handle_merge_cells,
                'unmerge_cells': self._handle_unmerge_cells,
            }.get(data.get('type'))

            if handler:
                await handler(data)
        except json.JSONDecodeError:
            await self._send_error('無効なJSON形式です')
        except Exception as e:
            await self._send_error(str(e))

    async def _handle_cell_change(self, data):
        """セル変更を処理（自動保存＋ブロードキャスト）"""
        await self._save_and_broadcast(data)

    async def _handle_save(self, data):
        """一括保存を処理"""
        if not data.get('changes'):
            await self._send_json('save_success', message='変更はありません')
            return
        await self._save_and_broadcast(data)

    async def _save_and_broadcast(self, data):
        """保存してブロードキャスト（共通処理）"""
        sheet_name = data.get('sheetName')
        changes = data.get('changes', [])

        if not changes:
            return

        success = await self._save_changes_to_file(sheet_name, changes)

        if success:
            await self._group_send('cell_update', sheetName=sheet_name, changes=changes)
            await self._send_json('save_success', message='保存しました')
        else:
            await self._send_error('保存に失敗しました')

    @database_sync_to_async
    def _save_changes_to_file(self, sheet_name, changes):
        """SQLite経由でファイルに変更を保存"""
        filepath = os.path.join(DKC_DRIVE_DIR, self.file_path)

        if not file_or_sqlite_exists(filepath):
            return False

        try:
            db = SpreadsheetSQLite(filepath)
            db.ensure_sqlite()
            db.update_cells(sheet_name, changes)
            return True
        except Exception as e:
            logger.error("保存エラー: %s", e)
            return False

    async def cell_update(self, event):
        """セル更新をクライアントに送信（自分以外）"""
        if self._is_sender(event):
            return
        await self._send_json('cell_update', sheetName=event['sheetName'], changes=event['changes'])

    async def _group_send(self, msg_type, **kwargs):
        """グループにメッセージをブロードキャスト（sender_channel自動付与）"""
        await self.channel_layer.group_send(
            self.room_group_name,
            {'type': msg_type, 'sender_channel': self.channel_name, **kwargs}
        )

    async def _broadcast_cursor(self, data):
        """カーソル位置をブロードキャスト"""
        await self._group_send(
            'cursor_update',
            row=data.get('row'), col=data.get('col'),
            username=data.get('username', '匿名'),
        )

    async def _handle_sheet_add(self, data):
        """シート追加を他のクライアントに通知"""
        await self._group_send('sheet_add_update', sheetName=data.get('sheetName'))

    async def sheet_add_update(self, event):
        """シート追加をクライアントに送信（自分以外）"""
        if self._is_sender(event):
            return
        await self._send_json('sheet_add', sheetName=event['sheetName'])

    async def _handle_sheet_delete(self, data):
        """シート削除を他のクライアントに通知"""
        await self._group_send('sheet_delete_update', sheetName=data.get('sheetName'))

    async def sheet_delete_update(self, event):
        """シート削除をクライアントに送信（自分以外）"""
        if self._is_sender(event):
            return
        await self._send_json('sheet_delete', sheetName=event['sheetName'])

    async def _handle_sheet_rename(self, data):
        """シート名変更を他のクライアントに通知"""
        await self._group_send(
            'sheet_rename_update',
            oldSheetName=data.get('oldSheetName'),
            newSheetName=data.get('newSheetName'),
        )

    async def sheet_rename_update(self, event):
        """シート名変更をクライアントに送信（自分以外）"""
        if self._is_sender(event):
            return
        await self._send_json('sheet_rename', oldSheetName=event['oldSheetName'], newSheetName=event['newSheetName'])

    async def _handle_merge_cells(self, data):
        """セル結合を処理（保存＋ブロードキャスト）"""
        await self._handle_merge_operation(data, 'merge', 'セル結合に失敗しました')

    async def _handle_unmerge_cells(self, data):
        """セル結合解除を処理（保存＋ブロードキャスト）"""
        await self._handle_merge_operation(data, 'unmerge', 'セル結合解除に失敗しました')

    async def _handle_merge_operation(self, data, action, error_msg):
        """セル結合/解除の共通処理"""
        sheet_name = data.get('sheetName')
        merges = data.get('merges', [])
        success = await self._save_merges(sheet_name, merges, action=action)
        if success:
            await self._group_send(
                'merge_update', sheetName=sheet_name, merges=merges, action=action,
            )
        else:
            await self._send_error(error_msg)

    @database_sync_to_async
    def _save_merges(self, sheet_name, merges, action):
        """SQLite経由でマージを保存"""
        filepath = os.path.join(DKC_DRIVE_DIR, self.file_path)
        if not file_or_sqlite_exists(filepath):
            return False
        try:
            db = SpreadsheetSQLite(filepath)
            db.ensure_sqlite()
            if action == 'merge':
                db.add_merges(sheet_name, merges)
            else:
                db.remove_merges(sheet_name, merges)
            return True
        except Exception as e:
            logger.error("マージ保存エラー: %s", e)
            return False

    async def merge_update(self, event):
        """マージ更新をクライアントに送信（自分以外）"""
        if self._is_sender(event):
            return
        await self._send_json('merge_update', sheetName=event['sheetName'],
                              merges=event['merges'], action=event['action'])

    async def cursor_update(self, event):
        """カーソル位置をクライアントに送信（自分以外）"""
        if self._is_sender(event):
            return
        await self._send_json('cursor_update', row=event['row'], col=event['col'], username=event['username'])

    async def _broadcast_user_count(self):
        """接続ユーザー数をブロードキャスト"""
        await self.channel_layer.group_send(self.room_group_name, {'type': 'user_count_update'})

    async def user_count_update(self, event):
        """ユーザー数更新を送信"""
        await self._send_json('user_count_update')

    def _is_sender(self, event):
        """自分が送信者かどうか判定"""
        return event.get('sender_channel') == self.channel_name

    async def _send_json(self, msg_type, **kwargs):
        """JSON形式でメッセージを送信"""
        await self.send(text_data=json.dumps({'type': msg_type, **kwargs}))

    async def _send_error(self, message):
        """エラーメッセージを送信"""
        await self._send_json('error', message=message)
