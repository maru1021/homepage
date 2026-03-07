from django.contrib.sitemaps import Sitemap
from django.db.models import Max, Q

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

    def lastmod(self, obj):
        """この分類と子孫分類に属する記事の最新更新日時を返す"""
        ids = [obj.pk]
        self._collect_descendant_ids(obj, ids)
        result = (
            Article.objects
            .filter(is_published=True, classification_id__in=ids)
            .aggregate(latest=Max("updated_at"))
        )
        return result["latest"]

    def location(self, obj):
        return f"/category/{obj.get_slug_path()}/"

    @staticmethod
    def _collect_descendant_ids(classification, id_list):
        for child in classification.children.all():
            id_list.append(child.pk)
            CategorySitemap._collect_descendant_ids(child, id_list)


class StaticSitemap(Sitemap):
    changefreq = "daily"
    priority = 1.0
    protocol = "https"

    def items(self):
        return ["/", "/about/", "/contact/", "/privacy/", "/disclaimer/"]

    def location(self, item):
        return item
