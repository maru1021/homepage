"""
セキュリティ・アクセスログ・パフォーマンスミドルウェア
daihatsu_system の middleware.py / security_middleware.py から個人ブログ用に移行
"""

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


def get_client_ip(request):
    """クライアントIPアドレスを取得（プロキシ対応）"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    x_real_ip = request.META.get('HTTP_X_REAL_IP')
    if x_real_ip:
        return x_real_ip.strip()
    return request.META.get('REMOTE_ADDR', 'unknown')


class AccessLoggingMiddleware:
    """
    アクセスログミドルウェア
    全リクエストのIP、ユーザー、パス、メソッド、ステータスコードを記録
    """

    EXCLUDED_PATHS = [
        '/static/',
        '/media/',
        '/favicon.ico',
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if any(request.path.startswith(p) for p in self.EXCLUDED_PATHS):
            return self.get_response(request)

        response = self.get_response(request)

        client_ip = get_client_ip(request)
        username = request.user.username if hasattr(request, 'user') and request.user.is_authenticated else 'Anonymous'
        user_agent = request.META.get('HTTP_USER_AGENT', '-')

        access_logger.info(
            '%s,%s,%s,%s,%s,%s',
            client_ip, username, request.method,
            request.path, response.status_code, user_agent,
        )

        return response


class PerformanceMiddleware:
    """
    パフォーマンス監視ミドルウェア
    リクエストの処理時間を記録し、遅いリクエストを警告
    """

    EXCLUDED_PATHS = [
        '/static/',
        '/media/',
        '/favicon.ico',
    ]

    # この秒数を超えると警告ログ
    SLOW_REQUEST_THRESHOLD = 2.0

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if any(request.path.startswith(p) for p in self.EXCLUDED_PATHS):
            return self.get_response(request)

        start_time = time.time()
        response = self.get_response(request)
        process_time = time.time() - start_time

        client_ip = get_client_ip(request)
        username = request.user.username if hasattr(request, 'user') and request.user.is_authenticated else 'Anonymous'

        log_func = performance_logger.warning if process_time > self.SLOW_REQUEST_THRESHOLD else performance_logger.info
        log_func(
            '%.3f秒,%s,%s,%s,%s',
            process_time, client_ip, username,
            request.method, request.path,
        )

        return response


class SecurityLoggingMiddleware:
    """
    セキュリティ攻撃検知・ログ記録ミドルウェア
    XSS、SQLインジェクション、ディレクトリトラバーサル等の攻撃を検知しブロック
    """

    EXEMPT_PATHS = [
        '/admin/',
    ]

    def __init__(self, get_response):
        self.get_response = get_response
        self.suspicious_patterns = [
            (r'<script.*?>.*?</script>', 'XSS Attack'),
            (r'<iframe.*?>.*?</iframe>', 'XSS iframe Attack'),
            (r'javascript:', 'JavaScript Injection'),
            (r'\bon\w+\s*=', 'XSS Event Handler'),
            (r'&lt;.*?&gt;', 'HTML Entity XSS'),
            (r'&#\d+;', 'Numeric Entity XSS'),
            (r'%3[cC].*?%3[eE]', 'URL Encoded XSS'),
            (r'data\s*:\s*text/html', 'Data URI XSS'),
            (r'data\s*:\s*[^,]*base64', 'Data URI Base64 XSS'),
            (r'(union|select|drop|insert|delete|update)\s+', 'SQL Injection'),
            (r'(\.\./){2,}', 'Directory Traversal'),
            (r'(cmd|exec|system|eval)\s*\(', 'Code Injection'),
            (r'<\?php', 'PHP Code Injection'),
        ]

    def __call__(self, request):
        try:
            for exempt_path in self.EXEMPT_PATHS:
                if request.path.startswith(exempt_path):
                    return self.get_response(request)

            request_data = self._get_request_data(request)

            for pattern, attack_type in self.suspicious_patterns:
                match = re.search(pattern, request_data, re.IGNORECASE)
                if match:
                    matched_string = match.group(0)
                    client_ip = get_client_ip(request)
                    username = request.user.username if hasattr(request, 'user') and request.user.is_authenticated else 'Anonymous'
                    security_logger.warning(
                        '%s,%s,%s,%s,%s,%s',
                        attack_type, client_ip, username,
                        request.method, request.path, matched_string,
                    )
                    content = render_to_string('403.html', request=request)
                    return HttpResponseForbidden(content)

            return self.get_response(request)

        except Exception:
            security_logger.exception('SecurityLoggingMiddleware Error')
            content = render_to_string('403.html', request=request)
            return HttpResponseForbidden(content)

    def _get_request_data(self, request):
        data_parts = [request.path]

        for key, value in request.GET.items():
            data_parts.append(f'{key}={value}')

        if hasattr(request, 'POST'):
            for key, value in request.POST.items():
                if isinstance(value, str) and key != 'csrfmiddlewaretoken':
                    data_parts.append(f'{key}={value}')

        user_agent = request.META.get('HTTP_USER_AGENT', '')
        data_parts.append(user_agent)

        combined_data = ' '.join(data_parts)
        return self._normalize_data(combined_data)

    def _normalize_data(self, data):
        try:
            decoded = urllib.parse.unquote(data, errors='ignore')
            decoded = html.unescape(decoded)
            decoded = decoded.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ')
            return decoded + ' ' + data
        except Exception:
            return data
