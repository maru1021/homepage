import json
import re
import socket
import ssl
import urllib.request
import urllib.error
from datetime import datetime, timezone

from django.http import JsonResponse
from django.shortcuts import render

from config.htmx import htmx_render


def index(request):
    return htmx_render(request, "tools/index.html", "tools/_index_content.html", title="便利ツール - 無料オンラインツール集")


def ip_lookup(request):
    return htmx_render(request, "tools/ip_lookup.html", "tools/_ip_lookup_content.html", title="IPアドレスからの住所検索 - 無料オンラインツール")


def json_formatter(request):
    return htmx_render(request, "tools/json_formatter.html", "tools/_json_formatter_content.html", title="JSON整形ツール - 無料オンラインツール")


def base64_tool(request):
    return htmx_render(request, "tools/base64.html", "tools/_base64_content.html", title="Base64エンコード/デコード - 無料オンラインツール")


def password_generator(request):
    return htmx_render(request, "tools/password_generator.html", "tools/_password_generator_content.html", title="パスワード生成器 - 安全なランダムパスワード作成")


def qr_code(request):
    return htmx_render(request, "tools/qr_code.html", "tools/_qr_code_content.html", title="QRコード生成 - 無料オンラインツール")


def char_counter(request):
    return htmx_render(request, "tools/char_counter.html", "tools/_char_counter_content.html", title="文字数カウンター - 無料オンラインツール")


def whois_lookup(request):
    return htmx_render(request, "tools/whois.html", "tools/_whois_content.html", title="Whois検索 - ドメイン登録情報調査")


def regex_tester(request):
    return htmx_render(request, "tools/regex_tester.html", "tools/_regex_tester_content.html", title="正規表現テスター - 無料オンラインツール")


def cron_generator(request):
    return htmx_render(request, "tools/cron_generator.html", "tools/_cron_generator_content.html", title="Cron式ジェネレータ - 無料オンラインツール")


def color_converter(request):
    return htmx_render(request, "tools/color_converter.html", "tools/_color_converter_content.html", title="色変換ツール - HEX/RGB/HSL相互変換")


def url_encode(request):
    return htmx_render(request, "tools/url_encode.html", "tools/_url_encode_content.html", title="URLエンコード/デコード - 無料オンラインツール")


def unix_time(request):
    return htmx_render(request, "tools/unix_time.html", "tools/_unix_time_content.html", title="Unix時間変換 - Unixタイムスタンプ変換ツール")


def diff_tool(request):
    return htmx_render(request, "tools/diff.html", "tools/_diff_content.html", title="テキスト比較 (diff) - 無料オンラインツール")


def hash_generator(request):
    return htmx_render(request, "tools/hash_generator.html", "tools/_hash_generator_content.html", title="ハッシュ生成 - MD5/SHA-1/SHA-256計算ツール")


def html_escape(request):
    return htmx_render(request, "tools/html_escape.html", "tools/_html_escape_content.html", title="HTMLエスケープ/アンエスケープ - 無料オンラインツール")


def jwt_decoder(request):
    return htmx_render(request, "tools/jwt_decoder.html", "tools/_jwt_decoder_content.html", title="JWTデコーダー - JWTトークン解析ツール")


def unit_converter(request):
    return htmx_render(request, "tools/unit_converter.html", "tools/_unit_converter_content.html", title="単位変換ツール - 長さ/重さ/温度/面積/体積/データ")


def age_calculator(request):
    return htmx_render(request, "tools/age_calculator.html", "tools/_age_calculator_content.html", title="年齢早見表・入学卒業年計算 - 生まれ年から一発検索")


def http_headers(request):
    return htmx_render(request, "tools/http_headers.html", "tools/_http_headers_content.html", title="HTTPヘッダー確認 - セキュリティヘッダーチェック")


def ssl_checker(request):
    return htmx_render(request, "tools/ssl_checker.html", "tools/_ssl_checker_content.html", title="SSL/TLS証明書チェッカー - 無料オンラインツール")


def port_scanner(request):
    return htmx_render(request, "tools/port_scanner.html", "tools/_port_scanner_content.html", title="ポートスキャナー - オープンポート確認ツール")


def password_strength(request):
    return htmx_render(request, "tools/password_strength.html", "tools/_password_strength_content.html", title="パスワード強度チェッカー - 安全性診断ツール")


def subnet_calculator(request):
    return htmx_render(request, "tools/subnet_calculator.html", "tools/_subnet_calculator_content.html", title="サブネット計算機 - CIDR/サブネットマスク変換")


def speech_to_text(request):
    return htmx_render(request, "tools/speech_to_text.html", "tools/_speech_to_text_content.html", title="音声文字起こし - 無料オンラインツール")


def network_sim(request):
    return htmx_render(request, "tools/network_sim.html", "tools/_network_sim_content.html", title="ネットワークシミュレーター - 構成・ルーティング学習ツール")


def markdown_preview(request):
    return htmx_render(request, "tools/markdown_preview.html", "tools/_markdown_preview_content.html", title="Markdownプレビューア - 無料オンラインツール")


def image_compress(request):
    return htmx_render(request, "tools/image_compress.html", "tools/_image_compress_content.html", title="画像圧縮・リサイズ - 無料オンラインツール")


def sql_formatter(request):
    return htmx_render(request, "tools/sql_formatter.html", "tools/_sql_formatter_content.html", title="SQLフォーマッター - 無料オンラインツール")


def csv_json(request):
    return htmx_render(request, "tools/csv_json.html", "tools/_csv_json_content.html", title="CSV ↔ JSON 変換 - 無料オンラインツール")


def compound_interest(request):
    return htmx_render(request, "tools/compound_interest.html", "tools/_compound_interest_content.html", title="複利計算シミュレーター - 無料オンラインツール")


def loan_calculator(request):
    return htmx_render(request, "tools/loan_calculator.html", "tools/_loan_calculator_content.html", title="ローン返済シミュレーター - 無料オンラインツール")


def currency_converter(request):
    return htmx_render(request, "tools/currency_converter.html", "tools/_currency_converter_content.html", title="為替換算ツール - 無料オンラインツール")


def text_transform(request):
    return htmx_render(request, "tools/text_transform.html", "tools/_text_transform_content.html", title="テキスト変換ツール - 無料オンラインツール")


def dummy_text(request):
    return htmx_render(request, "tools/dummy_text.html", "tools/_dummy_text_content.html", title="ダミーテキスト生成 - 無料オンラインツール")


def typing_test(request):
    return htmx_render(request, "tools/typing_test.html", "tools/_typing_test_content.html", title="タイピング速度テスト - 無料オンラインツール")


def pdf_tool(request):
    return htmx_render(request, "tools/pdf_tool.html", "tools/_pdf_tool_content.html", title="PDF結合・分割 - 無料オンラインツール")


def text_proofreader(request):
    return htmx_render(request, "tools/text_proofreader.html", "tools/_text_proofreader_content.html", title="文章校正チェッカー - 無料オンラインツール")


def ruby_generator(request):
    return htmx_render(request, "tools/ruby_generator.html", "tools/_ruby_generator_content.html", title="ルビ（ふりがな）HTML生成 - 無料オンラインツール")


def image_converter(request):
    return htmx_render(request, "tools/image_converter.html", "tools/_image_converter_content.html", title="画像フォーマット変換 - 無料オンラインツール")


def ogp_preview(request):
    return htmx_render(request, "tools/ogp_preview.html", "tools/_ogp_preview_content.html", title="OGP画像プレビュー - 無料オンラインツール")


def favicon_generator(request):
    return htmx_render(request, "tools/favicon_generator.html", "tools/_favicon_generator_content.html", title="ファビコン生成 - 無料オンラインツール")


def yaml_json(request):
    return htmx_render(request, "tools/yaml_json.html", "tools/_yaml_json_content.html", title="YAML ↔ JSON 変換 - 無料オンラインツール")


def env_json(request):
    return htmx_render(request, "tools/env_json.html", "tools/_env_json_content.html", title=".env ↔ JSON 変換 - 無料オンラインツール")


def http_status(request):
    return htmx_render(request, "tools/http_status.html", "tools/_http_status_content.html", title="HTTPステータスコード一覧 - 無料オンラインツール")


def ogp_generator(request):
    return htmx_render(request, "tools/ogp_generator.html", "tools/_ogp_generator_content.html", title="OGP/メタタグ生成 - 無料オンラインツール")


def split_bill(request):
    return htmx_render(request, "tools/split_bill.html", "tools/_split_bill_content.html", title="割り勘計算機 - 無料オンラインツール")


def bmi_calculator(request):
    return htmx_render(request, "tools/bmi_calculator.html", "tools/_bmi_calculator_content.html", title="BMI計算機 - 無料オンラインツール")


def date_calculator(request):
    return htmx_render(request, "tools/date_calculator.html", "tools/_date_calculator_content.html", title="日付計算機 - 無料オンラインツール")


def email_header(request):
    return htmx_render(request, "tools/email_header.html", "tools/_email_header_content.html", title="メールヘッダー解析 - 無料オンラインツール")


def weather(request):
    return htmx_render(request, "tools/weather.html", "tools/_weather_content.html", title="天気予報 - 無料オンラインツール")


def zip_code(request):
    return htmx_render(request, "tools/zip_code.html", "tools/_zip_code_content.html", title="郵便番号検索 - 無料オンラインツール")


def holidays(request):
    return htmx_render(request, "tools/holidays.html", "tools/_holidays_content.html", title="祝日カレンダー - 無料オンラインツール")



def wikipedia(request):
    return htmx_render(request, "tools/wikipedia.html", "tools/_wikipedia_content.html", title="Wikipedia検索 - 無料オンラインツール")



def geocoding(request):
    return htmx_render(request, "tools/geocoding.html", "tools/_geocoding_content.html", title="ジオコーディング - 無料オンラインツール")


# ---------------------
# API エンドポイント
# ---------------------

def api_ogp_preview(request):
    url = request.GET.get("url", "").strip()
    if not url or not re.match(r"^https?://", url, re.IGNORECASE):
        return JsonResponse({"error": "有効なURL（http/https）を入力してください"}, status=400)

    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "Mozilla/5.0 (compatible; OGPPreview/1.0)")
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, OSError):
        return JsonResponse({"error": "URLの取得に失敗しました"}, status=502)

    def get_meta(prop):
        for attr in ["property", "name"]:
            m = re.search(
                rf'<meta\s+{attr}=["\']?{re.escape(prop)}["\']?\s+content=["\']([^"\']*)["\']',
                html, re.IGNORECASE,
            )
            if m:
                return m.group(1)
            m = re.search(
                rf'<meta\s+content=["\']([^"\']*)["\']?\s+{attr}=["\']?{re.escape(prop)}["\']',
                html, re.IGNORECASE,
            )
            if m:
                return m.group(1)
        return ""

    title = get_meta("og:title")
    if not title:
        m = re.search(r"<title>([^<]*)</title>", html, re.IGNORECASE)
        title = m.group(1) if m else ""

    meta_dict = {}
    for prop in ["og:title", "og:description", "og:image", "og:url", "og:type",
                  "og:site_name", "twitter:card", "twitter:title", "twitter:description",
                  "twitter:image", "twitter:site"]:
        v = get_meta(prop)
        if v:
            meta_dict[prop] = v

    return JsonResponse({
        "title": title,
        "description": get_meta("og:description") or get_meta("description"),
        "image": get_meta("og:image"),
        "site_name": get_meta("og:site_name"),
        "meta": meta_dict,
    })


_IP_RE = re.compile(
    r"^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$"
)


def api_ip_lookup(request):
    ip = request.GET.get("ip", "").strip()
    if not ip or not _IP_RE.match(ip):
        return JsonResponse({"error": "有効な IPv4 アドレスを入力してください"}, status=400)

    try:
        url = f"http://ip-api.com/json/{ip}?fields=status,message,country,regionName,city,zip,lat,lon,timezone,isp,org,as&lang=ja"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError):
        return JsonResponse({"error": "外部 API への接続に失敗しました"}, status=502)

    if data.get("status") == "fail":
        return JsonResponse({"error": data.get("message", "検索に失敗しました")}, status=400)

    return JsonResponse({
        "country": data.get("country", ""),
        "region": data.get("regionName", ""),
        "city": data.get("city", ""),
        "zip": data.get("zip", ""),
        "lat": data.get("lat"),
        "lon": data.get("lon"),
        "timezone": data.get("timezone", ""),
        "isp": data.get("isp", ""),
        "org": data.get("org", ""),
        "as": data.get("as", ""),
    })


_DOMAIN_RE = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
)


def api_whois(request):
    domain = request.GET.get("domain", "").strip().lower()
    if not domain or not _DOMAIN_RE.match(domain):
        return JsonResponse({"error": "有効なドメイン名を入力してください"}, status=400)

    try:
        url = f"https://rdap.org/domain/{domain}"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return JsonResponse({"error": "ドメインが見つかりません"}, status=404)
        return JsonResponse({"error": "検索に失敗しました"}, status=502)
    except (urllib.error.URLError, TimeoutError):
        return JsonResponse({"error": "外部 API への接続に失敗しました"}, status=502)

    # RDAP レスポンスから主要情報を抽出
    result = {
        "domain": data.get("ldhName", domain),
        "status": data.get("status", []),
        "events": [],
        "nameservers": [],
        "registrar": "",
    }

    for event in data.get("events", []):
        result["events"].append({
            "action": event.get("eventAction", ""),
            "date": event.get("eventDate", ""),
        })

    for ns in data.get("nameservers", []):
        result["nameservers"].append(ns.get("ldhName", ""))

    for entity in data.get("entities", []):
        roles = entity.get("roles", [])
        if "registrar" in roles:
            vcards = entity.get("vcardArray", [None, []])
            if len(vcards) > 1:
                for field in vcards[1]:
                    if field[0] == "fn":
                        result["registrar"] = field[3]
                        break

    return JsonResponse(result)


_URL_RE = re.compile(r"^https?://[^\s/$.?#].[^\s]*$", re.IGNORECASE)


def api_http_headers(request):
    url = request.GET.get("url", "").strip()
    if not url or not _URL_RE.match(url):
        return JsonResponse({"error": "有効なURL（http/https）を入力してください"}, status=400)

    try:
        req = urllib.request.Request(url, method="HEAD")
        req.add_header("User-Agent", "Mozilla/5.0 (compatible; HeaderChecker/1.0)")
        with urllib.request.urlopen(req, timeout=10) as resp:
            status_code = resp.status
            headers = dict(resp.headers)
    except urllib.error.HTTPError as e:
        status_code = e.code
        headers = dict(e.headers)
    except (urllib.error.URLError, TimeoutError, OSError):
        return JsonResponse({"error": "接続に失敗しました。URLを確認してください"}, status=502)

    security_headers = [
        "Strict-Transport-Security",
        "Content-Security-Policy",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "X-XSS-Protection",
        "Referrer-Policy",
        "Permissions-Policy",
    ]
    security_check = {}
    headers_lower = {k.lower(): k for k in headers}
    for sh in security_headers:
        real_key = headers_lower.get(sh.lower())
        security_check[sh] = {
            "present": real_key is not None,
            "value": headers.get(real_key, "") if real_key else "",
        }

    return JsonResponse({
        "status_code": status_code,
        "headers": headers,
        "security": security_check,
    })


def api_ssl_check(request):
    host = request.GET.get("host", "").strip().lower()
    if not host or not (_DOMAIN_RE.match(host) or _IP_RE.match(host)):
        return JsonResponse({"error": "有効なホスト名またはIPアドレスを入力してください"}, status=400)

    is_ip = bool(_IP_RE.match(host))
    port = 443
    try:
        ctx = ssl.create_default_context()
        if is_ip:
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        with socket.create_connection((host, port), timeout=5) as sock:
            with ctx.wrap_socket(sock, server_hostname=None if is_ip else host) as ssock:
                cert = ssock.getpeercert() if not is_ip else ssock.getpeercert(binary_form=True)
                protocol = ssock.version()
    except ssl.SSLCertVerificationError as e:
        return JsonResponse({"error": f"証明書の検証に失敗しました: {e.reason}"}, status=400)
    except (socket.gaierror, socket.timeout, OSError):
        return JsonResponse({"error": "ホストに接続できませんでした"}, status=502)

    # IPアドレスの場合はDER形式からパース
    if is_ip:
        from cryptography import x509
        from cryptography.hazmat.backends import default_backend
        c = x509.load_der_x509_certificate(cert, default_backend())
        issuer = " / ".join(
            a.value for a in c.issuer
            if a.oid in (x509.oid.NameOID.ORGANIZATION_NAME, x509.oid.NameOID.COMMON_NAME)
        ) or "不明"
        subject_cn = ""
        for a in c.subject:
            if a.oid == x509.oid.NameOID.COMMON_NAME:
                subject_cn = a.value
        not_before = c.not_valid_before_utc.strftime("%b %d %H:%M:%S %Y GMT")
        not_after = c.not_valid_after_utc.strftime("%b %d %H:%M:%S %Y GMT")
        days_remaining = (c.not_valid_after_utc - datetime.now(timezone.utc)).days
        sans = []
        try:
            ext = c.extensions.get_extension_for_class(x509.SubjectAlternativeName)
            sans = ext.value.get_values_for_type(x509.DNSName)
        except x509.ExtensionNotFound:
            pass
        serial_number = format(c.serial_number, 'X')
        return JsonResponse({
            "host": host,
            "subject": subject_cn,
            "issuer": issuer,
            "not_before": not_before,
            "not_after": not_after,
            "days_remaining": days_remaining,
            "sans": sans,
            "protocol": protocol or "",
            "serial_number": serial_number,
            "warning": "IPアドレス指定のため証明書の検証はスキップされています",
        })

    # 発行者
    issuer_parts = []
    for rdn in cert.get("issuer", ()):
        for attr, val in rdn:
            if attr == "organizationName":
                issuer_parts.append(val)
            elif attr == "commonName":
                issuer_parts.append(val)
    issuer = " / ".join(issuer_parts) if issuer_parts else "不明"

    # サブジェクト
    subject_cn = ""
    for rdn in cert.get("subject", ()):
        for attr, val in rdn:
            if attr == "commonName":
                subject_cn = val

    # 有効期限
    not_before = cert.get("notBefore", "")
    not_after = cert.get("notAfter", "")
    days_remaining = None
    if not_after:
        expiry = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
        days_remaining = (expiry - datetime.now(timezone.utc)).days

    # SANs
    sans = []
    for typ, val in cert.get("subjectAltName", ()):
        if typ == "DNS":
            sans.append(val)

    return JsonResponse({
        "host": host,
        "subject": subject_cn,
        "issuer": issuer,
        "not_before": not_before,
        "not_after": not_after,
        "days_remaining": days_remaining,
        "sans": sans,
        "protocol": protocol or "",
        "serial_number": cert.get("serialNumber", ""),
    })


_COMMON_PORTS = {
    20: "FTP Data", 21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP",
    53: "DNS", 80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS",
    465: "SMTPS", 587: "Submission", 993: "IMAPS", 995: "POP3S",
    3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL", 5900: "VNC",
    6379: "Redis", 8080: "HTTP-Alt", 8443: "HTTPS-Alt", 27017: "MongoDB",
}


def api_port_scan(request):
    host = request.GET.get("host", "").strip().lower()
    if not host or not (_DOMAIN_RE.match(host) or _IP_RE.match(host)):
        return JsonResponse({"error": "有効なホスト名またはIPアドレスを入力してください"}, status=400)

    ports_param = request.GET.get("ports", "").strip()
    if ports_param:
        try:
            ports = [int(p) for p in ports_param.split(",") if p.strip()]
            ports = [p for p in ports if 1 <= p <= 65535]
        except ValueError:
            return JsonResponse({"error": "ポート番号が不正です"}, status=400)
    else:
        ports = sorted(_COMMON_PORTS.keys())

    if len(ports) > 50:
        return JsonResponse({"error": "一度にスキャンできるポートは50個までです"}, status=400)

    if _IP_RE.match(host):
        ip = host
    else:
        try:
            ip = socket.gethostbyname(host)
        except socket.gaierror:
            return JsonResponse({"error": "ホスト名を解決できませんでした"}, status=400)

    results = []
    for port in ports:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1)
                result = s.connect_ex((ip, port))
                is_open = result == 0
        except OSError:
            is_open = False
        results.append({
            "port": port,
            "open": is_open,
            "service": _COMMON_PORTS.get(port, ""),
        })

    return JsonResponse({"host": host, "ip": ip, "results": results})


# 天気予報 API
from tools.weather_cities import CITIES as _CITIES
from tools.models import WeatherForecast


def _build_city_response(city_key, forecasts):
    """DB の WeatherForecast queryset から1都市分のレスポンスを組み立てる。"""
    today_row = next((f for f in forecasts if f.temperature is not None), None)
    current = {}
    if today_row:
        current = {
            "temperature_2m": today_row.temperature,
            "relative_humidity_2m": today_row.humidity,
            "weather_code": today_row.current_weather_code,
            "wind_speed_10m": today_row.wind_speed,
        }
    return {
        "current": current,
        "daily": {
            "time": [str(f.forecast_date) for f in forecasts],
            "weather_code": [f.weather_code for f in forecasts],
            "temperature_2m_max": [f.temp_max for f in forecasts],
            "temperature_2m_min": [f.temp_min for f in forecasts],
            "precipitation_probability_max": [f.precipitation_prob for f in forecasts],
        },
    }


def _fetch_from_api_fallback(city_key):
    """DB にデータがない場合、外部 API から直接取得する（フォールバック）。"""
    city = _CITIES[city_key]
    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={city['lat']}&longitude={city['lon']}"
        f"&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m"
        f"&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
        f"&timezone=Asia%2FTokyo&forecast_days=7"
    )
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())


def api_weather(request):
    from datetime import date
    city_key = request.GET.get("city", "").strip().lower()

    # 全都市一括取得
    if city_key == "all":
        today = date.today()
        all_forecasts = WeatherForecast.objects.filter(
            forecast_date__gte=today,
        ).order_by('city_key', 'forecast_date')

        # DB にデータがあればそこから返す
        if all_forecasts.exists():
            cities = {}
            for key in _CITIES:
                fc_list = [f for f in all_forecasts if f.city_key == key]
                if fc_list:
                    resp = _build_city_response(key, fc_list)
                    resp["name"] = _CITIES[key]["name"]
                    cities[key] = resp
            return JsonResponse({"cities": cities})

        # フォールバック: 外部 API から直接取得
        keys = list(_CITIES.keys())
        lats = ",".join(str(_CITIES[k]["lat"]) for k in keys)
        lons = ",".join(str(_CITIES[k]["lon"]) for k in keys)
        try:
            url = (
                f"https://api.open-meteo.com/v1/forecast?"
                f"latitude={lats}&longitude={lons}"
                f"&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m"
                f"&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
                f"&timezone=Asia%2FTokyo&forecast_days=7"
            )
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data_list = json.loads(resp.read().decode())
        except (urllib.error.URLError, TimeoutError):
            return JsonResponse({"error": "天気情報の取得に失敗しました"}, status=502)

        cities = {}
        for i, key in enumerate(keys):
            item = data_list[i] if isinstance(data_list, list) else data_list
            cities[key] = {
                "name": _CITIES[key]["name"],
                "current": item.get("current", {}),
                "daily": item.get("daily", {}),
            }
        return JsonResponse({"cities": cities})

    # 単一都市取得
    if city_key not in _CITIES:
        return JsonResponse({"error": "都市を選択してください"}, status=400)

    today = date.today()
    forecasts = list(WeatherForecast.objects.filter(
        city_key=city_key,
        forecast_date__gte=today,
    ).order_by('forecast_date'))

    # DB にデータがあればそこから返す
    if forecasts:
        resp = _build_city_response(city_key, forecasts)
        resp["city"] = _CITIES[city_key]["name"]
        return JsonResponse(resp)

    # フォールバック: 外部 API から直接取得
    try:
        data = _fetch_from_api_fallback(city_key)
    except (urllib.error.URLError, TimeoutError):
        return JsonResponse({"error": "天気情報の取得に失敗しました"}, status=502)

    return JsonResponse({
        "city": _CITIES[city_key]["name"],
        "current": data.get("current", {}),
        "daily": data.get("daily", {}),
    })



# Wikipedia検索 API
def api_wikipedia(request):
    query = request.GET.get("q", "").strip()
    if not query:
        return JsonResponse({"error": "検索キーワードを入力してください"}, status=400)

    try:
        search_url = (
            f"https://ja.wikipedia.org/w/api.php?action=opensearch"
            f"&search={urllib.request.quote(query)}&limit=5&format=json"
        )
        req = urllib.request.Request(search_url, headers={
            "Accept": "application/json",
            "User-Agent": "ToolsApp/1.0",
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            search_data = json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError):
        return JsonResponse({"error": "Wikipedia への接続に失敗しました"}, status=502)

    titles = search_data[1] if len(search_data) > 1 else []
    if not titles:
        return JsonResponse({"error": "該当する記事が見つかりませんでした"}, status=404)

    title = titles[0]
    try:
        summary_url = f"https://ja.wikipedia.org/api/rest_v1/page/summary/{urllib.request.quote(title)}"
        req = urllib.request.Request(summary_url, headers={
            "Accept": "application/json",
            "User-Agent": "ToolsApp/1.0",
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            article = json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError):
        return JsonResponse({"error": "記事の取得に失敗しました"}, status=502)

    return JsonResponse({
        "title": article.get("title", ""),
        "extract": article.get("extract", ""),
        "thumbnail": article.get("thumbnail", {}).get("source", ""),
        "url": article.get("content_urls", {}).get("desktop", {}).get("page", ""),
        "suggestions": titles[1:],
    })


# ジオコーディング API (Nominatim プロキシ)
def api_geocoding(request):
    mode = request.GET.get("mode", "search")
    ua = "maruomosquit-tools/1.0 (https://maruomosquit.com)"

    try:
        if mode == "reverse":
            lat = request.GET.get("lat", "").strip()
            lon = request.GET.get("lon", "").strip()
            if not lat or not lon:
                return JsonResponse({"error": "緯度と経度を入力してください"}, status=400)
            url = (
                f"https://nominatim.openstreetmap.org/reverse?"
                f"lat={urllib.request.quote(lat)}&lon={urllib.request.quote(lon)}"
                f"&format=json&accept-language=ja"
            )
        else:
            q = request.GET.get("q", "").strip()
            if not q:
                return JsonResponse({"error": "検索キーワードを入力してください"}, status=400)
            url = (
                f"https://nominatim.openstreetmap.org/search?"
                f"q={urllib.request.quote(q)}&format=json&limit=5&accept-language=ja"
            )

        req = urllib.request.Request(url, headers={
            "Accept": "application/json",
            "User-Agent": ua,
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError):
        return JsonResponse({"error": "ジオコーディングに失敗しました"}, status=502)

    return JsonResponse({"results": data} if mode == "search" else {"result": data})
