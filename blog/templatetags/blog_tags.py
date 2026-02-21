import re

from django import template

register = template.Library()


@register.simple_tag
def has_children(classification):
    """分類が子分類または公開記事を持つか判定（Prefetchキャッシュを利用）"""
    return bool(classification.children.all()) or bool(classification.articles.all())


@register.filter
def word_count(html_content):
    """HTMLからタグを除去して文字数を返す"""
    text = re.sub(r'<[^>]+>', '', html_content)
    text = re.sub(r'\s+', '', text)
    return len(text)


@register.filter
def reading_time(html_content):
    """推定読了時間（分）を返す（日本語: 約500文字/分）"""
    count = word_count(html_content)
    minutes = max(1, round(count / 500))
    return minutes
