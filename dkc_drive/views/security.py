"""
DKCドライブ - HTMLセキュリティ検証
"""
import os
import re
import logging
from datetime import datetime
from django.conf import settings


logger = logging.getLogger(__name__)

# セキュリティログの設定
SECURITY_LOG_PATH = os.path.join(settings.BASE_DIR, 'log', 'security.log')

# HTMLセキュリティ: 許可されたfetchのパス（static/js/base_setting.jsのみ許可）
ALLOWED_FETCH_PATHS = [
    '/static/js/base_setting.js',
    'base_setting.js',  # 相対パスも許可
]


def log_html_security_rejection(request, filename, reason):
    """HTMLセキュリティ拒否をログに記録"""
    try:
        # IPアドレス取得
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', 'unknown')

        # ユーザー名取得
        username = request.user.username if request.user.is_authenticated else 'anonymous'

        # ログメッセージ作成
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        # 理由から改行を除去して1行に
        reason_oneline = reason.replace('\n', ' | ')
        log_message = f"{timestamp},{ip},{username},HTMLセキュリティ拒否: {filename} - {reason_oneline}\n"

        # ログファイルに追記
        os.makedirs(os.path.dirname(SECURITY_LOG_PATH), exist_ok=True)
        with open(SECURITY_LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(log_message)

    except Exception as e:
        # ログ記録の失敗は無視（本来の処理を妨げない）
        logging.error(f"セキュリティログ記録エラー: {e}")


def is_local_ip(ip):
    """IPアドレスがローカル（プライベート）かどうかをチェック"""
    # 127.x.x.x (ループバック)
    if ip.startswith('127.'):
        return True
    # 10.x.x.x (クラスA プライベート)
    if ip.startswith('10.'):
        return True
    # 192.168.x.x (クラスC プライベート)
    if ip.startswith('192.168.'):
        return True
    # 172.16.x.x - 172.31.x.x (クラスB プライベート)
    if ip.startswith('172.'):
        try:
            second_octet = int(ip.split('.')[1])
            if 16 <= second_octet <= 31:
                return True
        except (ValueError, IndexError):
            pass
    return False


def is_local_url(url):
    """URLがローカルホスト/ローカルIPへのアクセスかどうかをチェック"""
    # localhost
    if 'localhost' in url.lower():
        return True
    # IPアドレスを抽出してチェック
    ip_match = re.search(r'(?:https?:)?//(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', url)
    if ip_match:
        return is_local_ip(ip_match.group(1))
    return False


def _is_allowed_url(url):
    """URLが許可されているかチェック"""
    # 相対パスの場合
    if not url.startswith('http://') and not url.startswith('https://') and not url.startswith('//'):
        # base_setting.jsへのアクセスは許可
        for allowed in ALLOWED_FETCH_PATHS:
            if url == allowed or url.endswith(allowed):
                return True
        # その他の相対パスは許可（同一オリジン内のAPIアクセス）
        return True

    # ローカルURLは許可
    if is_local_url(url):
        return True

    # 外部の絶対URLは禁止
    return False


def _is_same_origin_ws(url):
    """WebSocketがローカルかチェック"""
    # localhostへの接続は許可
    if 'localhost' in url.lower():
        return True
    # ローカルIPへの接続は許可
    ip_match = re.search(r'wss?://(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', url)
    if ip_match:
        return is_local_ip(ip_match.group(1))
    return False


# URLベースのセキュリティチェック定義
# (pattern, validator_func, error_template)
# validator: 一致URLに対して呼び出し、Trueなら許可（スキップ）、Falseならエラー
_URL_CHECKS = [
    (r'fetch\s*\(\s*[\'"`]([^\'"`]+)[\'"`]',                                     _is_allowed_url, '許可されていないfetch先: {}'),
    (r'\.open\s*\(\s*[\'"`][^\'"`]+[\'"`]\s*,\s*[\'"`]([^\'"`]+)[\'"`]',          _is_allowed_url, '許可されていないXHRリクエスト先: {}'),
    (r'new\s+EventSource\s*\(\s*[\'"`]([^\'"`]+)[\'"`]',                          _is_allowed_url, '許可されていないEventSource接続先: {}'),
    (r'navigator\.sendBeacon\s*\(\s*[\'"`]([^\'"`]+)[\'"`]',                      _is_allowed_url, '許可されていないsendBeacon先: {}'),
]

# 危険なJavaScriptパターン
_DANGEROUS_PATTERNS = [
    (r'eval\s*\(', 'eval()の使用'),
    (r'Function\s*\(', 'Function()コンストラクタの使用'),
    (r'document\.write', 'document.writeの使用'),
    (r'innerHTML\s*=\s*[^\'"][^\'"]*\+', '動的なinnerHTML操作'),
]


def validate_html_security(content):
    """
    HTMLファイルのセキュリティチェック
    - 外部IPへのアクセスを禁止
    - 許可されていないfetchを禁止
    - 危険なスクリプトパターンを検出

    Returns:
        tuple: (is_valid, error_message)
    """
    errors = []

    # 1. IPアドレスへの直接アクセスチェック
    ip_pattern = r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b'
    ip_matches = re.findall(ip_pattern, content)
    external_ips = [ip for ip in ip_matches if not is_local_ip(ip)]
    if external_ips:
        errors.append(f'外部IPアドレスへのアクセスが検出されました: {", ".join(set(external_ips))}')

    # 2-3, 6, 8. 共通パターンのURLチェック（fetch, XHR, EventSource, sendBeacon）
    for pattern, validator, error_template in _URL_CHECKS:
        for url in re.findall(pattern, content, re.IGNORECASE):
            if not validator(url):
                errors.append(error_template.format(url))

    # 4. 外部URLチェック（src, href, action属性）
    attr_pattern = r'(?:src|href|action)\s*=\s*[\'"]([^\'"]+)[\'"]'
    for url in re.findall(attr_pattern, content, re.IGNORECASE):
        if url.startswith('//') or url.startswith('http://') or url.startswith('https://'):
            if not is_local_url(url):
                errors.append(f'外部リソースへのアクセスが検出されました: {url}')

    # 5. WebSocketチェック
    ws_pattern = r'new\s+WebSocket\s*\(\s*[\'"`]([^\'"`]+)[\'"`]'
    for url in re.findall(ws_pattern, content, re.IGNORECASE):
        if url.startswith('ws://') or url.startswith('wss://'):
            if not _is_same_origin_ws(url):
                errors.append(f'外部WebSocketへの接続が検出されました: {url}')

    # 7. 動的importチェック
    import_pattern = r'import\s*\(\s*[\'"`]([^\'"`]+)[\'"`]'
    for url in re.findall(import_pattern, content, re.IGNORECASE):
        if url.startswith('http://') or url.startswith('https://') or url.startswith('//'):
            if not is_local_url(url):
                errors.append(f'外部モジュールのインポートが検出されました: {url}')

    # 9. 危険なJavaScriptパターンのチェック
    for pattern, description in _DANGEROUS_PATTERNS:
        if re.search(pattern, content, re.IGNORECASE):
            errors.append(f'危険なパターンが検出されました: {description}')

    if errors:
        return False, '\n'.join(errors)

    return True, None


def check_html_security(file_obj, request, identifier=None):
    """HTMLファイルのセキュリティチェックを実行。

    Args:
        file_obj: アップロードされたファイルオブジェクト
        request: Djangoリクエスト（セキュリティログ用）
        identifier: ログに記録する識別子（デフォルトはfile_obj.name）

    Returns:
        (passed, rejection_info): passed=True なら安全。
        False の場合、rejection_info は {'filename': ..., 'reason': ...} の辞書。
    """
    log_id = identifier or file_obj.name
    try:
        content = file_obj.read().decode('utf-8', errors='replace')
        file_obj.seek(0)

        is_valid, error_msg = validate_html_security(content)
        if not is_valid:
            log_html_security_rejection(request, log_id, error_msg)
            return False, {'filename': file_obj.name, 'reason': error_msg}
    except Exception as e:
        error_reason = f'HTMLファイルの検証中にエラーが発生しました: {str(e)}'
        log_html_security_rejection(request, log_id, error_reason)
        return False, {'filename': file_obj.name, 'reason': error_reason}

    return True, None


def validate_and_reject_html(request, content, identifier):
    """HTMLコンテンツのセキュリティ検証を実行し、不正な場合はエラーレスポンスを返す。

    Args:
        request: Djangoリクエスト（セキュリティログ用）
        content: 検証対象のHTMLコンテンツ文字列
        identifier: ログに記録するファイル識別子

    Returns:
        None: 検証OK
        JsonResponse: セキュリティ違反時のエラーレスポンス
    """
    from .utils import error_response
    is_valid, error_msg = validate_html_security(content)
    if not is_valid:
        log_html_security_rejection(request, identifier, error_msg)
        return error_response(f'セキュリティ上の理由で保存が拒否されました:\n{error_msg}')
    return None
