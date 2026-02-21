"""
セキュリティ・アクセスログ・パフォーマンスミドルウェア
daihatsu_system の middleware.py / security_middleware.py から個人ブログ用に移行
"""

import os
import re
import html
import logging
import time
import urllib.parse

from django.http import HttpResponseForbidden
from django.template.loader import render_to_string

security_logger = logging.getLogger('security')
access_logger = logging.getLogger('access')
performance_logger = logging.getLogger('performance')

# 共通: 静的ファイル等のログ除外パス
EXCLUDED_PATHS = ('/static/', '/media/', '/favicon.ico')

# アクセスログ除外IPアドレス（自分自身のアクセスを除外）
_exclude_ips = os.environ.get('ACCESS_LOG_EXCLUDE_IPS', '')
EXCLUDED_IPS = {ip.strip() for ip in _exclude_ips.split(',') if ip.strip()}


def get_client_ip(request):
    """クライアントIPアドレスを取得（プロキシ対応）"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    x_real_ip = request.META.get('HTTP_X_REAL_IP')
    if x_real_ip:
        return x_real_ip.strip()
    return request.META.get('REMOTE_ADDR', 'unknown')


def _get_username(request):
    """認証済みユーザー名を取得"""
    if hasattr(request, 'user') and request.user.is_authenticated:
        return request.user.username
    return 'Anonymous'


def _is_excluded_path(path):
    """ログ除外パスかどうか判定"""
    return any(path.startswith(p) for p in EXCLUDED_PATHS)


class AccessLoggingMiddleware:
    """
    アクセスログミドルウェア
    全リクエストのIP、ユーザー、パス、メソッド、ステータスコードを記録
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if _is_excluded_path(request.path):
            return self.get_response(request)

        response = self.get_response(request)

        client_ip = get_client_ip(request)
        if client_ip not in EXCLUDED_IPS:
            access_logger.info(
                '%s,%s,%s,%s,%s,%s',
                client_ip, _get_username(request), request.method,
                request.path, response.status_code,
                request.META.get('HTTP_USER_AGENT', '-'),
            )

        return response


class PerformanceMiddleware:
    """
    パフォーマンス監視ミドルウェア
    リクエストの処理時間を記録し、遅いリクエストを警告
    """

    SLOW_REQUEST_THRESHOLD = 2.0

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if _is_excluded_path(request.path):
            return self.get_response(request)

        start_time = time.time()
        response = self.get_response(request)
        process_time = time.time() - start_time

        log_func = performance_logger.warning if process_time > self.SLOW_REQUEST_THRESHOLD else performance_logger.info
        log_func(
            '%.3f秒,%s,%s,%s,%s',
            process_time, get_client_ip(request), _get_username(request),
            request.method, request.path,
        )

        return response


class SecurityLoggingMiddleware:
    """
    セキュリティ攻撃検知・ログ記録ミドルウェア
    XSS、SQLインジェクション、ディレクトリトラバーサル等の攻撃を検知しブロック
    """

    # admin は Nginx IP制限で保護済みのため、検知のみ（ブロックしない）
    LOG_ONLY_PATHS = [
        '/admin/',
    ]

    def __init__(self, get_response):
        self.get_response = get_response
        self.suspicious_patterns = [
            # XSS
            (r'<\s*script', 'XSS Attack'),
            (r'<\s*iframe', 'XSS iframe Attack'),
            (r'<\s*object', 'XSS object Attack'),
            (r'<\s*embed', 'XSS embed Attack'),
            (r'<\s*svg\b.*?\bon', 'XSS SVG Attack'),
            (r'javascript\s*:', 'JavaScript Injection'),
            (r'vbscript\s*:', 'VBScript Injection'),
            (r'\bon\w+\s*=', 'XSS Event Handler'),
            (r'&#x?[\da-fA-F]+;', 'HTML Entity XSS'),
            (r'%3[cC].*?%3[eE]', 'URL Encoded XSS'),
            (r'%25(?:3[cC]|3[eE])', 'Double Encoded XSS'),
            (r'data\s*:\s*text/html', 'Data URI XSS'),
            (r'data\s*:\s*[^,]*base64', 'Data URI Base64 XSS'),
            # SQL Injection
            (r'\b(?:union\s+select|select\s+.*\bfrom\b|drop\s+table|insert\s+into|delete\s+from|update\s+.*\bset\b)\b', 'SQL Injection'),
            (r'(?:--|;)\s*(?:drop|alter|create|truncate)\b', 'SQL Injection'),
            # File/Directory Attack
            (r'/etc/(?:passwd|shadow|hosts)', 'File Access Attack'),
            (r'(\.\./){2,}', 'Directory Traversal'),
            (r'\.\.[\\/]', 'Directory Traversal'),
            # Code Injection
            (r'(cmd|exec|system|eval|passthru|popen)\s*\(', 'Code Injection'),
            (r'<\?php', 'PHP Code Injection'),
            (r'\$\{.*?\}', 'Template Injection'),
        ]

    def __call__(self, request):
        try:
            log_only = any(request.path.startswith(p) for p in self.LOG_ONLY_PATHS)

            request_data = self._get_request_data(request)

            for pattern, attack_type in self.suspicious_patterns:
                match = re.search(pattern, request_data, re.IGNORECASE)
                if match:
                    security_logger.warning(
                        '%s,%s,%s,%s,%s,%s,%s',
                        attack_type, get_client_ip(request), _get_username(request),
                        request.method, request.path, match.group(0),
                        request_data,
                    )
                    if not log_only:
                        content = render_to_string('403.html', request=request)
                        return HttpResponseForbidden(content)

            return self.get_response(request)

        except Exception:
            security_logger.exception('SecurityLoggingMiddleware Error')
            content = render_to_string('403.html', request=request)
            return HttpResponseForbidden(content)

    def _get_request_data(self, request):
        data_parts = [request.path]
        data_parts.extend(f'{k}={v}' for k, v in request.GET.items())

        if hasattr(request, 'POST'):
            data_parts.extend(
                f'{k}={v}' for k, v in request.POST.items()
                if isinstance(v, str) and k != 'csrfmiddlewaretoken'
            )

        data_parts.append(request.META.get('HTTP_USER_AGENT', ''))

        combined_data = ' '.join(data_parts)
        return self._normalize_data(combined_data)

    def _normalize_data(self, data):
        try:
            decoded = data
            for _ in range(3):
                prev = decoded
                decoded = urllib.parse.unquote(decoded, errors='ignore')
                if decoded == prev:
                    break
            decoded = html.unescape(decoded)
            decoded = decoded.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ')
            return decoded + ' ' + data
        except Exception:
            return data
