import re
from html import escape

from django import template
from django.utils.safestring import mark_safe

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


@register.filter
def glossary_tooltip(content):
    """記事content内の用語を自動検出してツールチップ付きspanに置換する"""
    from blog.models import GlossaryTerm

    terms = list(GlossaryTerm.objects.all())
    if not terms:
        return content

    # 長い用語から先にマッチ（部分マッチ防止）
    terms.sort(key=lambda t: len(t.term), reverse=True)

    # 置換対象外のブロックを一時退避
    preserved = []

    def _preserve(match):
        preserved.append(match.group(0))
        return f'\x00PRESERVED{len(preserved) - 1}\x00'

    work = re.sub(r'<(pre|code|h1|h2|h3|h4)[^>]*>.*?</\1>', _preserve, content, flags=re.DOTALL)
    work = re.sub(r'<span class="(tag|category|glossary-term)"[^>]*>.*?</span>', _preserve, work, flags=re.DOTALL)

    def _replace_first_in_text(html, search, repl):
        """HTMLタグの外側のテキスト部分のみで最初の1回だけ置換"""
        found = [False]

        def _replacer(match):
            text = match.group(0)
            if found[0]:
                return text
            if search in text:
                found[0] = True
                return text.replace(search, repl, 1)
            return text

        return re.sub(r'(?<=>)[^<]+(?=<|$)', _replacer, html)

    for term in terms:
        desc_escaped = escape(term.description, quote=True)
        placeholder = f'\x00PRESERVED{len(preserved)}\x00'
        tooltip_html = f'<span class="glossary-term" tabindex="0" data-tooltip="{desc_escaped}">{term.term}</span>'

        # まずプレースホルダーで置換し、後で復元（他の用語の置換で壊れないように）
        new_work = _replace_first_in_text(work, term.term, placeholder)
        if new_work != work:
            preserved.append(tooltip_html)
            work = new_work

    # 退避したブロックを復元
    for i, block in enumerate(preserved):
        work = work.replace(f'\x00PRESERVED{i}\x00', block)

    return mark_safe(work)
