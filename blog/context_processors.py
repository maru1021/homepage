from django.conf import settings
from django.db.models import Prefetch

from .models import Classification, Article


def site_name(request):
    """サイト名を全テンプレートに渡す"""
    return {"SITE_NAME": settings.SITE_NAME}


def sidebar_classifications(request):
    """サイドバー用: ルート分類を全テンプレートに渡す"""
    published_articles = Prefetch("articles", queryset=Article.objects.filter(is_published=True))
    roots = (
        Classification.objects
        .filter(parent=None)
        .prefetch_related(
            "children__children__children",
            published_articles,
            Prefetch("children__articles", queryset=Article.objects.filter(is_published=True)),
            Prefetch("children__children__articles", queryset=Article.objects.filter(is_published=True)),
        )
    )
    return {"sidebar_roots": roots}
