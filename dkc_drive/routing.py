"""
DKCドライブ WebSocket ルーティング
"""

from django.urls import re_path
from .consumers import DKCDriveConsumer

websocket_urlpatterns = [
    re_path(r'ws/dkc-drive/(?P<file_path>.+)/$', DKCDriveConsumer.as_asgi()),
]
