from django.conf import settings
from django.contrib.syndication.views import Feed

from .models import Article


class LatestArticlesFeed(Feed):
    title = settings.SITE_NAME
    description = "Python・JavaScript・PHP・Ruby・Linux・Docker・ネットワーク・セキュリティなど、Web開発に必要な技術を幅広く解説する技術ブログ"
    link = "/"

    def items(self):
        return Article.objects.filter(is_published=True).order_by("-published_at")[:20]

    def item_title(self, item):
        return item.title

    def item_description(self, item):
        return item.excerpt or item.title

    def item_link(self, item):
        return item.get_absolute_url()

    def item_pubdate(self, item):
        return item.published_at

    def item_updateddate(self, item):
        return item.updated_at
