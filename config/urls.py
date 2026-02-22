from django.contrib import admin
from django.contrib.auth.views import LoginView, LogoutView
from django.contrib.sitemaps.views import sitemap
from django.http import HttpResponse
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from blog.sitemaps import ArticleSitemap, CategorySitemap, StaticSitemap


def robots_txt(request):
    lines = [
        "User-agent: *",
        "Disallow: /admin/",
        "Disallow: /drive/",
        "Disallow: /manage/",
        "Disallow: /search/",
        "Disallow: /login/",
        "Disallow: /logout/",
        "",
        "User-agent: SemrushBot",
        "Disallow: /",
        "",
        "User-agent: TikTokSpider",
        "Disallow: /",
        "",
        f"Sitemap: https://{request.get_host()}/sitemap.xml",
    ]
    return HttpResponse("\n".join(lines), content_type="text/plain")


sitemaps = {
    "articles": ArticleSitemap,
    "categories": CategorySitemap,
    "static": StaticSitemap,
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
    path('', include('blog.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
