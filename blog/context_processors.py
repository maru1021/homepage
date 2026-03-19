from django.conf import settings
from django.db.models import Prefetch

from .models import Classification, Article


def site_name(request):
    """サイト名を全テンプレートに渡す"""
    return {"SITE_NAME": settings.SITE_NAME}


def sidebar_classifications(request):
    """サイドバー用: ルート分類を全テンプレートに渡す"""
    published_qs = Article.objects.filter(is_published=True)
    roots = (
        Classification.objects
        .filter(parent=None)
        .prefetch_related(
            "children__children__children",
            Prefetch("articles", queryset=published_qs),
            Prefetch("children__articles", queryset=published_qs),
            Prefetch("children__children__articles", queryset=published_qs),
        )
    )
    return {"sidebar_roots": roots}
