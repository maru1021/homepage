import json
import re
import socket
import ssl
import urllib.request
import urllib.error
from datetime import datetime, timezone

from django.http import JsonResponse
from django.shortcuts import render


# ---------------------
# ページ表示
# ---------------------

def _render(request, full, partial, context=None):
    template = partial if request.htmx else full
    return render(request, template, context or {})


def index(request):
    return _render(request, "tools/index.html", "tools/_index_content.html")


def ip_lookup(request):
    return _render(request, "tools/ip_lookup.html", "tools/_ip_lookup_content.html")


def json_formatter(request):
    return _render(request, "tools/json_formatter.html", "tools/_json_formatter_content.html")


def base64_tool(request):
    return _render(request, "tools/base64.html", "tools/_base64_content.html")


def password_generator(request):
    return _render(request, "tools/password_generator.html", "tools/_password_generator_content.html")


def qr_code(request):
    return _render(request, "tools/qr_code.html", "tools/_qr_code_content.html")


def char_counter(request):
    return _render(request, "tools/char_counter.html", "tools/_char_counter_content.html")


def whois_lookup(request):
    return _render(request, "tools/whois.html", "tools/_whois_content.html")


def regex_tester(request):
    return _render(request, "tools/regex_tester.html", "tools/_regex_tester_content.html")


def cron_generator(request):
    return _render(request, "tools/cron_generator.html", "tools/_cron_generator_content.html")


def color_converter(request):
    return _render(request, "tools/color_converter.html", "tools/_color_converter_content.html")


def url_encode(request):
    return _render(request, "tools/url_encode.html", "tools/_url_encode_content.html")


def unix_time(request):
    return _render(request, "tools/unix_time.html", "tools/_unix_time_content.html")


def diff_tool(request):
    return _render(request, "tools/diff.html", "tools/_diff_content.html")


def hash_generator(request):
    return _render(request, "tools/hash_generator.html", "tools/_hash_generator_content.html")


def html_escape(request):
    return _render(request, "tools/html_escape.html", "tools/_html_escape_content.html")


def jwt_decoder(request):
    return _render(request, "tools/jwt_decoder.html", "tools/_jwt_decoder_content.html")


def unit_converter(request):
    return _render(request, "tools/unit_converter.html", "tools/_unit_converter_content.html")


def age_calculator(request):
    return _render(request, "tools/age_calculator.html", "tools/_age_calculator_content.html")


def http_headers(request):
    return _render(request, "tools/http_headers.html", "tools/_http_headers_content.html")


def ssl_checker(request):
    return _render(request, "tools/ssl_checker.html", "tools/_ssl_checker_content.html")


def port_scanner(request):
    return _render(request, "tools/port_scanner.html", "tools/_port_scanner_content.html")


def password_strength(request):
    return _render(request, "tools/password_strength.html", "tools/_password_strength_content.html")


def subnet_calculator(request):
    return _render(request, "tools/subnet_calculator.html", "tools/_subnet_calculator_content.html")


def speech_to_text(request):
    return _render(request, "tools/speech_to_text.html", "tools/_speech_to_text_content.html")


def network_sim(request):
    return _render(request, "tools/network_sim.html", "tools/_network_sim_content.html")


# ---------------------
# API エンドポイント
# ---------------------

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
