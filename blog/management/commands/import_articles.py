"""旧サイト(React+FastAPI)のデータを新ブログシステムに移行するコマンド"""
import json
import re
from html import escape
from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.text import slugify

from blog.models import Classification, Article


# 新しい分類構造の定義
# (slug, name, parent_slug, order)
CLASSIFICATIONS = [
    # ルート分類
    ("programming", "プログラミング", None, 1),
    ("security", "セキュリティ", None, 2),
    ("network", "ネットワーク", None, 3),
    ("database", "データベース", None, 4),

    # プログラミング > 言語
    ("html", "HTML", "programming", 1),
    ("css", "CSS", "programming", 2),
    ("javascript", "JavaScript", "programming", 3),
    ("php", "PHP", "programming", 4),
    ("python", "Python", "programming", 5),
    ("ruby", "Ruby", "programming", 6),
    ("git", "Git", "programming", 7),

    # HTML > 基礎, Bootstrap
    ("html-basic", "基礎", "html", 1),
    ("bootstrap", "Bootstrap", "html", 2),

    # CSS（記事数少ないのでサブ分類なし）

    # JavaScript > 基礎, 組み込み関数, React
    ("js-basic", "基礎", "javascript", 1),
    ("js-builtin", "組み込み関数", "javascript", 2),
    ("react", "React", "javascript", 3),

    # PHP > 基礎, Laravel
    ("php-basic", "基礎", "php", 1),
    ("laravel", "Laravel", "php", 2),

    # Python > 基礎, Django
    ("python-basic", "基礎", "python", 1),
    ("django", "Django", "python", 2),
    ("django-basic", "基本", "django", 1),
    ("django-orm", "ORM", "django", 2),

    # Ruby > 基礎, Ruby on Rails
    ("ruby-basic", "基礎", "ruby", 1),
    ("rails", "Ruby on Rails", "ruby", 2),
    ("rails-basic", "基本", "rails", 1),
    ("rails-orm", "ORM", "rails", 2),

    # ネットワーク
    ("network-basic", "基礎", "network", 1),
    ("linux", "Linux", "network", 2),
    ("docker", "Docker", "network", 3),

    # セキュリティ (既存のものは保持)
    ("ssh-security", "SSH", "security", 1),
    ("nginx", "nginx", "security", 2),
    ("docker-security", "Docker", "security", 3),

    # ネットワーク > SSH
    ("ssh-network", "SSH", "network", 4),

    # データベース
    ("sql", "SQL", "database", 1),
]

# 旧分類 → 新分類のマッピング
# (old_type_name, old_classification_name) → new_classification_slug
MAPPING = {
    ("プログラミング基礎", "HTML"): "html-basic",
    ("プログラミング基礎", "CSS"): "css",
    ("プログラミング基礎", "Javascript"): "js-basic",
    ("プログラミング基礎", "PHP"): "php-basic",
    ("プログラミング基礎", "Python"): "python-basic",
    ("プログラミング基礎", "Ruby"): "ruby-basic",
    ("プログラミング基礎", "Git"): "git",
    ("プログラミング基礎", "その他"): "programming",
    ("組み込み関数など", "Javascript"): "js-builtin",
    ("フレームワーク", "Django(基本)"): "django-basic",
    ("フレームワーク", "Django(ORM)"): "django-orm",
    ("フレームワーク", "Laravel"): "laravel",
    ("フレームワーク", "React"): "react",
    ("フレームワーク", "Ruby on Rails"): "rails-basic",
    ("フレームワーク", "Ruby on Rails(ORM)"): "rails-orm",
    ("フレームワーク", "Bootstrap"): "bootstrap",
    ("プラグイン、モジュール", "Ruby on Rails(ORM)"): "rails-orm",
    ("その他", "Git"): "git",
    ("その他", "Linux"): "linux",
    ("その他", "SQL"): "sql",
    ("その他", "ネットワーク"): "network-basic",
    ("その他", "Docker"): "docker",
    ("その他", "CI/CD"): "network-basic",
    ("その他", "その他"): "linux",
}


def format_code_text(text):
    """旧サイトのコードテキストを整形する"""
    if not text:
        return ""
    return text.replace("\\n", "\n").replace("\\t", "    ")


def escape_html_for_code(text):
    """コードブロック内のHTMLをエスケープする"""
    if not text:
        return ""
    text = format_code_text(text)
    return escape(text)


def format_explanation(text):
    """旧サイトの説明テキストを新フォーマットに変換する"""
    if not text:
        return ""
    # すでにHTML構造がある場合はそのまま返す
    if "<div class=" in text or "<h2>" in text:
        return text
    # <br> ベースのテキストを <p> に変換
    paragraphs = re.split(r"<br\s*/?\s*>\s*<br\s*/?\s*>", text)
    result = []
    for p in paragraphs:
        p = p.strip()
        if p:
            # 単一の<br>は保持
            result.append(f"<p>{p}</p>")
    return "\n".join(result)


def build_article_html(article_data):
    """旧サイトの記事データを新システムのHTML形式に変換する"""
    parts = []
    has_tabs = False

    # タブデータ収集
    tabs = []
    if article_data.get("disp"):
        tabs.append({
            "label": "表示",
            "type": "display",
            "content": article_data["disp"],
        })
    if article_data.get("code"):
        lang = article_data.get("language") or "コード"
        tabs.append({
            "label": lang,
            "type": "code",
            "content": article_data["code"],
            "language": lang,
        })
    if article_data.get("code2"):
        lang = article_data.get("language2") or "コード2"
        tabs.append({
            "label": lang,
            "type": "code",
            "content": article_data["code2"],
            "language": lang,
        })
    if article_data.get("code3"):
        lang = article_data.get("language3") or "コード3"
        tabs.append({
            "label": lang,
            "type": "code",
            "content": article_data["code3"],
            "language": lang,
        })

    # タブセクション生成
    if tabs:
        has_tabs = True
        parts.append('<div class="code-tabs">')
        parts.append('  <div class="tab-buttons">')
        for i, tab in enumerate(tabs):
            active = " active" if i == 0 else ""
            parts.append(
                f'    <button class="tab-btn{active}" data-tab="{i}">'
                f"{tab['label']}</button>"
            )
        parts.append("  </div>")

        for i, tab in enumerate(tabs):
            active = " active" if i == 0 else ""
            parts.append(f'  <div class="tab-panel{active}" data-tab="{i}">')
            if tab["type"] == "display":
                display_text = tab["content"]
                # \n を <br> に変換
                display_text = display_text.replace("\\n", "<br>")
                display_text = display_text.replace("\\t", "&nbsp;&nbsp;&nbsp;&nbsp;")
                parts.append(f'    <div class="tab-display">{display_text}</div>')
            else:
                code_content = escape_html_for_code(tab["content"])
                parts.append('    <div class="code-block">')
                parts.append(
                    f'      <span class="where">{escape(tab["language"])}</span>'
                )
                parts.append(f"      <pre><code>{code_content}</code></pre>")
                parts.append("    </div>")
            parts.append("  </div>")

        parts.append("</div>")

    # 説明セクション
    explanation = article_data.get("explanation")
    if explanation:
        formatted = format_explanation(explanation)
        if has_tabs:
            parts.append("")
            parts.append('<h2 class="section-title">説明</h2>')
        parts.append(formatted)

    return "\n".join(parts)


def make_unique_slug(base_slug, existing_slugs):
    """重複しないスラッグを生成する"""
    slug = base_slug
    counter = 2
    while slug in existing_slugs:
        slug = f"{base_slug}-{counter}"
        counter += 1
    existing_slugs.add(slug)
    return slug


def title_to_slug(title):
    """タイトルからスラッグを生成する"""
    # 日本語タイトルの場合、allow_unicodeを使用
    slug = slugify(title, allow_unicode=True)
    if not slug:
        slug = "article"
    # 長すぎるスラッグを切り詰め
    if len(slug) > 150:
        slug = slug[:150]
    return slug


class Command(BaseCommand):
    help = "旧サイトのデータを新ブログシステムに移行する"

    def add_arguments(self, parser):
        parser.add_argument(
            "json_file",
            help="エクスポートしたJSONファイルのパス",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="実際にDBに書き込まない（確認用）",
        )

    def handle(self, *args, **options):
        json_file = options["json_file"]
        dry_run = options["dry_run"]

        with open(json_file) as f:
            articles_data = json.load(f)

        self.stdout.write(f"読み込んだ記事数: {len(articles_data)}")

        if dry_run:
            self.stdout.write(self.style.WARNING("ドライラン: DBへの書き込みなし"))

        # 1. 分類の作成
        self.stdout.write("分類を作成中...")
        cls_map = {}  # slug → Classification instance

        # 既存の分類を取得
        for c in Classification.objects.all():
            cls_map[c.slug] = c

        for slug, name, parent_slug, order in CLASSIFICATIONS:
            if slug in cls_map:
                self.stdout.write(f"  既存: {name} ({slug})")
                continue
            parent = cls_map.get(parent_slug) if parent_slug else None
            if not dry_run:
                obj = Classification.objects.create(
                    name=name,
                    slug=slug,
                    parent=parent,
                    order=order,
                )
                cls_map[slug] = obj
            else:
                cls_map[slug] = None
            self.stdout.write(f"  作成: {name} ({slug})")

        # 2. 記事の作成
        self.stdout.write("\n記事を作成中...")
        existing_slugs = set(Article.objects.values_list("slug", flat=True))
        created = 0
        skipped = 0

        for data in articles_data:
            type_name = data.get("type_name", "")
            cls_name = data.get("classification_name", "")
            key = (type_name, cls_name)

            new_cls_slug = MAPPING.get(key)
            if not new_cls_slug:
                self.stdout.write(
                    self.style.WARNING(
                        f"  スキップ: [{data['id']}] {data['title']} "
                        f"(マッピングなし: {key})"
                    )
                )
                skipped += 1
                continue

            classification = cls_map.get(new_cls_slug)
            title = data["title"]
            slug = make_unique_slug(title_to_slug(title), existing_slugs)
            content = build_article_html(data)

            # excerpt 生成
            explanation = data.get("explanation", "") or ""
            # HTMLタグを除去して先頭100文字
            clean_text = re.sub(r"<[^>]+>", "", explanation)
            clean_text = clean_text.replace("\\n", " ").replace("\\t", " ")
            clean_text = re.sub(r"\s+", " ", clean_text).strip()
            excerpt = clean_text[:150]

            if not dry_run:
                Article.objects.create(
                    title=title,
                    short_title=title if len(title) <= 30 else title[:28] + "…",
                    slug=slug,
                    content=content,
                    excerpt=excerpt,
                    classification=classification,
                    is_published=True,
                    published_at=timezone.now(),
                )
            created += 1
            self.stdout.write(f"  作成: [{data['id']}] {title} → {new_cls_slug}")

        self.stdout.write(
            self.style.SUCCESS(
                f"\n完了: 作成={created}, スキップ={skipped}"
            )
        )
