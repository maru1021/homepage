from django.contrib.sitemaps import Sitemap
from django.urls import reverse


class ToolsSitemap(Sitemap):
    changefreq = "monthly"
    protocol = "https"

    # (url_name, priority)
    _tools = [
        ("tools:index", 0.8),
        ("tools:age_calculator", 0.8),
        ("tools:unit_converter", 0.7),
        ("tools:qr_code", 0.8),
        ("tools:password_generator", 0.8),
        ("tools:char_counter", 0.7),
        ("tools:color_converter", 0.6),
        ("tools:json_formatter", 0.7),
        ("tools:base64", 0.7),
        ("tools:url_encode", 0.7),
        ("tools:html_escape", 0.6),
        ("tools:regex_tester", 0.7),
        ("tools:diff", 0.6),
        ("tools:hash_generator", 0.7),
        ("tools:jwt_decoder", 0.6),
        ("tools:unix_time", 0.6),
        ("tools:cron_generator", 0.6),
        ("tools:ip_lookup", 0.7),
        ("tools:whois", 0.6),
        ("tools:http_headers", 0.7),
        ("tools:ssl_checker", 0.7),
        ("tools:port_scanner", 0.7),
        ("tools:password_strength", 0.7),
        ("tools:subnet_calculator", 0.6),
    ]

    def items(self):
        return self._tools

    def location(self, item):
        return reverse(item[0])

    def priority(self, item):
        return item[1]
