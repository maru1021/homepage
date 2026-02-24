from django.urls import path

from . import views

app_name = "tools"

urlpatterns = [
    path("", views.index, name="index"),
    path("ip-lookup/", views.ip_lookup, name="ip_lookup"),
    path("json-formatter/", views.json_formatter, name="json_formatter"),
    path("base64/", views.base64_tool, name="base64"),
    path("password-generator/", views.password_generator, name="password_generator"),
    path("qr-code/", views.qr_code, name="qr_code"),
    path("char-counter/", views.char_counter, name="char_counter"),
    path("whois/", views.whois_lookup, name="whois"),
    path("regex-tester/", views.regex_tester, name="regex_tester"),
    path("cron-generator/", views.cron_generator, name="cron_generator"),
    path("color-converter/", views.color_converter, name="color_converter"),
    path("url-encode/", views.url_encode, name="url_encode"),
    path("unix-time/", views.unix_time, name="unix_time"),
    path("diff/", views.diff_tool, name="diff"),
    path("hash-generator/", views.hash_generator, name="hash_generator"),
    path("html-escape/", views.html_escape, name="html_escape"),
    path("jwt-decoder/", views.jwt_decoder, name="jwt_decoder"),
    path("unit-converter/", views.unit_converter, name="unit_converter"),
    path("age-calculator/", views.age_calculator, name="age_calculator"),
    path("http-headers/", views.http_headers, name="http_headers"),
    path("ssl-checker/", views.ssl_checker, name="ssl_checker"),
    path("port-scanner/", views.port_scanner, name="port_scanner"),
    path("password-strength/", views.password_strength, name="password_strength"),
    path("subnet-calculator/", views.subnet_calculator, name="subnet_calculator"),
    # API
    path("api/ip-lookup/", views.api_ip_lookup, name="api_ip_lookup"),
    path("api/whois/", views.api_whois, name="api_whois"),
    path("api/http-headers/", views.api_http_headers, name="api_http_headers"),
    path("api/ssl-check/", views.api_ssl_check, name="api_ssl_check"),
    path("api/port-scan/", views.api_port_scan, name="api_port_scan"),
]
