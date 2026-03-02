from django.contrib import admin
from django.contrib.auth.views import LoginView, LogoutView
from django.contrib.sitemaps.views import sitemap
from django.http import HttpResponse
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from blog.sitemaps import ArticleSitemap, CategorySitemap, StaticSitemap
from tools.sitemaps import ToolsSitemap


def robots_txt(request):
    # AI crawlers and malicious bots to block entirely
    blocked_bots = [
        # AI crawlers (US)
        "GPTBot", "OAI-SearchBot", "ChatGPT-User", "CCBot",
        "ClaudeBot", "anthropic-ai", "Google-Extended",
        "Cohere-ai", "PerplexityBot", "Diffbot", "img2dataset",
        # AI crawlers (China)
        "Bytespider", "TikTokSpider", "PetalBot",
        "Baiduspider", "YisouSpider", "Qihoo360Spider",
        "360Spider", "DeepSeek", "Sogou",
        # AI crawlers (Other)
        "YandexBot", "Amazonbot", "meta-externalagent",
        "FacebookBot", "Timpibot",
        # SEO crawlers
        "SemrushBot", "AhrefsBot", "MJ12bot", "DotBot",
        "MegaIndex", "BLEXBot", "DataForSeoBot",
        "serpstatbot", "ZoominfoBot",
    ]
    lines = [
        "User-agent: *",
        "Disallow: /admin/",
        "Disallow: /drive/",
        "Disallow: /manage/",
        "Disallow: /search/",
        "Disallow: /login/",
        "Disallow: /logout/",
        "Disallow: /tools/api/",
        "Disallow: /vulnerability/api/",
        "",
    ]
    for bot in blocked_bots:
        lines.extend([f"User-agent: {bot}", "Disallow: /", ""])
    lines.append(f"Sitemap: https://{request.get_host()}/sitemap.xml")
    return HttpResponse("\n".join(lines), content_type="text/plain")


sitemaps = {
    "articles": ArticleSitemap,
    "categories": CategorySitemap,
    "static": StaticSitemap,
    "tools": ToolsSitemap,
}

urlpatterns = [
    path('robots.txt', robots_txt, name='robots_txt'),
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='django.contrib.sitemaps.views.sitemap'),
    path('login/', LoginView.as_view(template_name='login.html'), name='login'),
    path('logout/', LogoutView.as_view(next_page='/'), name='logout'),
    path('admin/', admin.site.urls),
    path('drive/', include('dkc_drive.urls')),
    path('world/', include('world.urls')),
    path('stocks/', include('stock_monitor.urls')),
    path('tools/', include('tools.urls')),
    path('vulnerability/', include('vulnerability.urls')),
    path('', include('blog.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
