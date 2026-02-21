from django.contrib.sitemaps import Sitemap

from .models import Article, Classification


class ArticleSitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.8
    protocol = "https"

    def items(self):
        return Article.objects.filter(is_published=True)

    def lastmod(self, obj):
        return obj.updated_at

    def location(self, obj):
        return obj.get_absolute_url()


class CategorySitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.6
    protocol = "https"

    def items(self):
        return Classification.objects.all()

    def location(self, obj):
        return f"/category/{obj.get_slug_path()}/"


class StaticSitemap(Sitemap):
    changefreq = "daily"
    priority = 1.0
    protocol = "https"

    def items(self):
        return ["/"]

    def location(self, item):
        return item
