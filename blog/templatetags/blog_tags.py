from django import template

register = template.Library()


@register.simple_tag
def has_children(classification):
    """分類が子分類または公開記事を持つか判定（Prefetchキャッシュを利用）"""
    return bool(classification.children.all()) or bool(classification.articles.all())
