import re
from datetime import date
from html import escape

from django import template
from django.utils import timezone
from django.utils.safestring import mark_safe

register = template.Library()

_TIPS = [
    "Ctrl+Shift+I でブラウザの開発者ツールを開けます",
    "git stash で作業中の変更を一時退避できます",
    "Python の f'{変数=}' でデバッグが捗ります",
    "CSS の clamp() でレスポンシブなフォントサイズが作れます",
    "VS Code で Ctrl+D を連打すると同じ単語を複数選択できます",
    "console.table() でオブジェクトを表形式で表示できます",
    "Django の select_related() でN+1問題を解決できます",
    "git bisect で不具合が入ったコミットを二分探索できます",
    "HTML の <details> タグで折りたたみUIが作れます",
    "Python の enumerate() でインデックス付きループができます",
    "JavaScript の ?? 演算子で null/undefined のみをフォールバックできます",
    "Linux で Ctrl+R でコマンド履歴を検索できます",
    "CSS Grid の repeat(auto-fit, minmax()) でレスポンシブ対応が簡単に",
    "docker compose logs -f でリアルタイムにログを確認できます",
    "Python の pathlib を使うとファイルパス操作が直感的になります",
    "git log --oneline --graph でブランチの流れが見やすくなります",
    "JavaScript の structuredClone() でオブジェクトを深いコピーできます",
    "SSH の -L オプションでポートフォワーディングができます",
    "Django の values_list(flat=True) でリスト取得が簡潔に",
    "HTML の loading='lazy' で画像の遅延読み込みができます",
    "Python の collections.Counter で要素の出現回数を簡単にカウント",
    "CSS の :has() セレクタで親要素を条件付きでスタイリングできます",
    "git diff --staged でステージ済みの変更だけを確認できます",
    "JavaScript の Array.at(-1) で末尾の要素を取得できます",
    "curl -I でHTTPレスポンスヘッダーだけを確認できます",
    "Django の Q オブジェクトで複雑なOR条件のクエリが書けます",
    "CSS の scroll-margin-top でアンカーリンクの余白を調整できます",
    "Python の functools.lru_cache でメモ化が簡単にできます",
    "HTML の inputmode 属性でモバイルキーボードを制御できます",
    "git cherry-pick で特定のコミットだけを取り込めます",
]


@register.simple_tag
def greeting():
    """時間帯に応じた挨拶を返す"""
    hour = timezone.localtime().hour
    if 5 <= hour < 11:
        return "おはようございます！"
    elif 11 <= hour < 17:
        return "こんにちは！"
    else:
        return "お疲れ様！"


@register.simple_tag
def daily_tip():
    """日替わりのTipsを返す（日付ベースで1日1つ固定）"""
    day_index = date.today().toordinal() % len(_TIPS)
    return _TIPS[day_index]

# preserve 対象の正規表現パターン
_PRESERVE_BLOCK_RE = re.compile(
    r'<(pre|code|script|h1|h2|h3|h4)[^>]*>.*?</\1>', re.DOTALL
)
_PRESERVE_SPAN_RE = re.compile(
    r'<span class="(tag|category|glossary-term)"[^>]*>.*?</span>', re.DOTALL
)
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
