from django.contrib import admin
from django.contrib.auth.views import LoginView, LogoutView
from django.contrib.sitemaps.views import index as sitemap_index, sitemap
from django.http import HttpResponse
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from blog.sitemaps import ArticleSitemap, CategorySitemap, StaticSitemap
from tools.sitemaps import ToolsSitemap
from vulnerability.sitemaps import VulnerabilitySitemap


def robots_txt(request):
    # Bot blocking is handled by Nginx ($bad_bot / $scanner_bot maps)
    # robots.txt only needs path restrictions for well-behaved crawlers
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
        f"Sitemap: https://{request.get_host()}/sitemap.xml",
    ]
    return HttpResponse("\n".join(lines), content_type="text/plain")


sitemaps = {
    "articles": ArticleSitemap,
    "categories": CategorySitemap,
    "static": StaticSitemap,
    "tools": ToolsSitemap,
    "vulnerability": VulnerabilitySitemap,
}

urlpatterns = [
    path('robots.txt', robots_txt, name='robots_txt'),
    path('sitemap.xml', sitemap_index, {'sitemaps': sitemaps, 'sitemap_url_name': 'sitemaps'}),
    path('sitemap-<section>.xml', sitemap, {'sitemaps': sitemaps}, name='sitemaps'),
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
