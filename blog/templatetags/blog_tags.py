import re
from html import escape

from django import template
from django.core.cache import cache
from django.utils.safestring import mark_safe

register = template.Library()

_MIN_KEYWORD_LENGTH = 4
_MAX_LINKS_PER_ARTICLE = 10
_LINK_CACHE_KEY = "auto_internal_links_keywords"
_LINK_CACHE_TIMEOUT = 300  # 5分

# preserve 対象の正規表現パターン
_PRESERVE_BLOCK_RE = re.compile(
    r'<(pre|code|script|h1|h2|h3|h4)[^>]*>.*?</\1>', re.DOTALL
)
_PRESERVE_SPAN_RE = re.compile(
    r'<span class="(tag|category|glossary-term)"[^>]*>.*?</span>', re.DOTALL
)
_PRESERVE_LINK_RE = re.compile(r'<a\s[^>]*>.*?</a>', re.DOTALL)
_TEXT_NODE_RE = re.compile(r'(?<=>)[^<]+(?=<|$)')


def _replace_first_in_text(html, search, replacement):
    """HTMLタグの外側のテキスト部分のみで最初の1回だけ置換"""
    found = [False]

    def _replacer(match):
        text = match.group(0)
        if found[0]:
            return text
        if search in text:
            found[0] = True
            return text.replace(search, replacement, 1)
        return text

    return _TEXT_NODE_RE.sub(_replacer, html)


def _preserve_and_replace(content, preserve_patterns, replacements, marker="P",
                          max_replacements=0):
    """HTMLの保護ブロックを退避し、テキストノード内で一括置換して復元する。

    Args:
        content: 処理対象のHTML文字列
        preserve_patterns: 退避する正規表現パターンのリスト
        replacements: (search, html) のリスト。各キーワードの最初の1回のみ置換。
        marker: プレースホルダーのプレフィックス
        max_replacements: 置換の上限数（0=無制限）
    Returns:
        置換後のHTML文字列
    """
    preserved = []
    replaced_count = 0

    def _preserve(match):
        preserved.append(match.group(0))
        return f"\x00{marker}{len(preserved) - 1}\x00"

    work = content
    for pattern in preserve_patterns:
        work = pattern.sub(_preserve, work)

    for search, html in replacements:
        if max_replacements and replaced_count >= max_replacements:
            break
        placeholder = f"\x00{marker}{len(preserved)}\x00"
        new_work = _replace_first_in_text(work, search, placeholder)
        if new_work != work:
            preserved.append(html)
            work = new_work
            replaced_count += 1

    for i, block in enumerate(preserved):
        work = work.replace(f"\x00{marker}{i}\x00", block)

    return work


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
    return max(1, round(count / 500))


@register.filter
def glossary_tooltip(content):
    """記事content内の用語を自動検出してツールチップ付きspanに置換する"""
    from blog.models import GlossaryTerm

    terms = list(GlossaryTerm.objects.all())
    if not terms:
        return content

    # 長い用語から先にマッチ（部分マッチ防止）
    terms.sort(key=lambda t: len(t.term), reverse=True)

    replacements = []
    for term in terms:
        desc_escaped = escape(term.description, quote=True)
        tooltip_html = (
            f'<span class="glossary-term" tabindex="0"'
            f' data-tooltip="{desc_escaped}">{term.term}</span>'
        )
        replacements.append((term.term, tooltip_html))

    result = _preserve_and_replace(
        content,
        [_PRESERVE_BLOCK_RE, _PRESERVE_SPAN_RE],
        replacements,
        marker="GT",
    )
    return mark_safe(result)


def _get_keyword_map():
    """short_title → (pk, url) のマッピングをキャッシュ付きで取得"""
    mapping = cache.get(_LINK_CACHE_KEY)
    if mapping is not None:
        return mapping

    from blog.models import Article

    mapping = {}
    articles = (
        Article.objects.filter(is_published=True)
        .exclude(short_title="")
        .values_list(
            "pk", "short_title", "slug",
            "classification__slug",
            "classification__parent__slug",
            "classification__parent__parent__slug",
        )
    )
    for pk, short_title, slug, c_slug, p_slug, gp_slug in articles:
        if len(short_title) < _MIN_KEYWORD_LENGTH or short_title in mapping:
            continue
        parts = [p for p in [gp_slug, p_slug, c_slug] if p]
        url = "/article/" + "/".join(parts + [slug]) + "/"
        mapping[short_title] = (pk, url)

    cache.set(_LINK_CACHE_KEY, mapping, _LINK_CACHE_TIMEOUT)
    return mapping


_GLOSSARY_SPAN_RE = re.compile(
    r'<span class="glossary-term"[^>]*>([^<]+)</span>'
)


@register.filter
def auto_internal_links(content, article):
    """記事本文に他記事への内部リンクを自動挿入する。

    glossary_tooltip 処理済みの HTML を受け取り:
    1. glossary-term span に対応記事があれば <a> で囲む（ツールチップ+リンク両立）
    2. それ以外のテキスト中の short_title を <a> リンクに変換
    """
    keyword_map = _get_keyword_map()
    if not keyword_map:
        return content

    current_pk = article.pk if hasattr(article, "pk") else None
    keywords = sorted(keyword_map.keys(), key=len, reverse=True)

    # Phase 1: glossary-term span を記事リンクで囲む
    linked_keywords = set()

    def _wrap_glossary(match):
        span_html = match.group(0)
        inner_text = match.group(1)
        if inner_text in keyword_map and inner_text not in linked_keywords:
            pk, url = keyword_map[inner_text]
            if pk != current_pk:
                linked_keywords.add(inner_text)
                return (
                    f'<a href="{url}" class="internal-link"'
                    f' target="_blank" rel="noopener">{span_html}</a>'
                )
        return span_html

    work = _GLOSSARY_SPAN_RE.sub(_wrap_glossary, content)

    if len(linked_keywords) >= _MAX_LINKS_PER_ARTICLE:
        return mark_safe(work)

    # Phase 2: 残りのキーワードをリンク化
    remaining = _MAX_LINKS_PER_ARTICLE - len(linked_keywords)
    replacements = []
    for kw in keywords:
        if kw in linked_keywords:
            continue
        pk, url = keyword_map[kw]
        if pk == current_pk:
            continue
        link_html = (
            f'<a href="{url}" class="internal-link"'
            f' target="_blank" rel="noopener">{kw}</a>'
        )
        replacements.append((kw, link_html))

    if replacements:
        work = _preserve_and_replace(
            work,
            [_PRESERVE_BLOCK_RE, _PRESERVE_LINK_RE, _PRESERVE_SPAN_RE],
            replacements,
            marker="IL",
            max_replacements=remaining,
        )

    return mark_safe(work)
