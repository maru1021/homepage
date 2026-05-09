import re

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Classification(models.Model):
    name = models.CharField("名前", max_length=100)
    slug = models.SlugField("スラッグ", max_length=100, unique=True, allow_unicode=True)
    parent = models.ForeignKey(
        "self",
        verbose_name="親分類",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
    )
    order = models.IntegerField("表示順", default=0)
    show_in_sidebar = models.BooleanField("サイドバーに表示", default=True)

    class Meta:
        ordering = ["order", "name"]
        verbose_name = "分類"
        verbose_name_plural = "分類"

    def __str__(self):
        return self.name

    def get_ancestors(self):
        """ルートまでの祖先リストを返す（パンくず用）"""
        ancestors = []
        node = self.parent
        while node:
            ancestors.insert(0, node)
            node = node.parent
        return ancestors

    def get_slug_path(self):
        """ルートからのslugパスを返す（例: security/ssh-security）"""
        parts = [a.slug for a in self.get_ancestors()] + [self.slug]
        return "/".join(parts)


class Article(models.Model):
    title = models.CharField("タイトル", max_length=200)
    short_title = models.CharField("短縮タイトル（サイドバー用）", max_length=50, blank=True)
    slug = models.SlugField("スラッグ", max_length=200, unique=True, allow_unicode=True)
    content = models.TextField("本文（HTML）")
    excerpt = models.TextField("抜粋", max_length=300, blank=True)
    thumbnail = models.ImageField("サムネイル", upload_to="thumbnails/", blank=True, null=True)
    classification = models.ForeignKey(
        Classification,
        verbose_name="分類",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="articles",
    )
    order = models.IntegerField("表示順", default=0)
    is_published = models.BooleanField("公開", default=False)
    published_at = models.DateTimeField("公開日時", blank=True, null=True)
    is_tweeted = models.BooleanField("X投稿済み", default=False)
    is_landing_page = models.BooleanField("ランディングページ", default=False,
                                          help_text="アフィリエイト専用ページ。記事バリデーションをスキップし専用テンプレートで表示")
    created_at = models.DateTimeField("作成日時", auto_now_add=True)
    updated_at = models.DateTimeField("更新日時", auto_now=True)

    class Meta:
        ordering = ["order", "-published_at"]
        verbose_name = "記事"
        verbose_name_plural = "記事"

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        """全階層を含む記事URLを返す"""
        if self.classification:
            return f"/article/{self.classification.get_slug_path()}/{self.slug}/"
        return f"/article/{self.slug}/"

    _DARK_BG_RE = re.compile(
        r"background(?:-color)?[\s:]*#(?:1e1e1e|2d2d2d|252525|1a1a1a)",
        re.IGNORECASE,
    )
    _TABLE_RE = re.compile(
        r"<table\b[^>]*>.*?</table>", re.DOTALL | re.IGNORECASE
    )
    _SCRIPT_RE = re.compile(
        r"<script\b[^>]*>(.*?)</script>", re.DOTALL | re.IGNORECASE
    )
    _VAR_DECL_RE = re.compile(r"\bvar\s+\w")
    _TAB_BUTTONS_RE = re.compile(
        r'class="tab-buttons">(.*?)</div>', re.DOTALL
    )
    _CODE_TABS_BLOCK_RE = re.compile(
        r'<div class="code-tabs">.*?</div>\s*</div>\s*</div>\s*</div>',
        re.DOTALL,
    )

    _SECTION_H2_RE = re.compile(
        r"<h2\b[^>]*>.*?</h2>", re.DOTALL | re.IGNORECASE
    )
    _H2_ID_RE = re.compile(r'<h2\b[^>]*\bid="([^"]*)"')
    _STEP_LABEL_RE = re.compile(r'class="step-label">(.*?)</span>')
    _TOC_RE = re.compile(
        r'<nav\s+class="toc">(.*?)</nav>', re.DOTALL
    )
    _TOC_HREF_RE = re.compile(r'href="#([^"]*)"')
    _TAB_BTN_RE = re.compile(
        r'class="tab-btn[^"]*"\s*data-tab="(\d+)"'
    )
    _TAB_PANEL_RE = re.compile(
        r'class="tab-panel[^"]*"\s*data-tab="(\d+)"'
    )
    _CODE_BLOCK_NO_WHERE_RE = re.compile(
        r'class="code-block">(?!\s*<span class="where">)'
    )
    _CODE_BLOCK_NO_COPY_RE = re.compile(
        r'class="code-block">\s*<span class="where">[^<]*</span>'
        r'(?!\s*<button class="copy-btn")',
    )
    _BAD_TARGET_TEXT_RE = re.compile(
        r"こんな人向けの記事です|この記事の対象者|この記事で学べること"
    )
    _BAD_INFO_TITLE_RE = re.compile(
        r'class="info-box">\s*(?:<p>\s*<strong>|'
        r'<div class="info-box-title">)'
    )
    _BAD_WARN_TITLE_RE = re.compile(
        r'class="warn-box">\s*(?:<p>\s*<strong>|'
        r'<div class="warn-box-title">)'
    )
    _H2_COPY_BTN_RE = re.compile(
        r"<h2\b[^>]*>(?:(?!</h2>).)*copy-btn(?:(?!</h2>).)*</h2>",
        re.DOTALL,
    )
    _PLAINTEXT_TABS_RE = re.compile(
        r"\n  \n    表示\n    (?:HTML|CSS)"
    )

    @staticmethod
    def _strip_code_tabs(content):
        return re.sub(
            r'<div class="code-tabs">.*?</div>\s*</div>\s*</div>\s*</div>',
            "",
            content,
            flags=re.DOTALL,
        )

    def clean(self):
        errors = []
        content = self.content or ""

        if not content.strip():
            raise ValidationError("記事本文が空です")

        if self.is_landing_page:
            return

        if len(content) < 3000:
            errors.append(
                f"記事本文が短すぎます（{len(content)}文字 / 最低3000文字）"
            )

        # --- 共通構造 ---

        if "target-box" not in content:
            errors.append("target-box が必要です")
        elif self._BAD_TARGET_TEXT_RE.search(content):
            errors.append(
                "target-box の見出しは「この記事で身につくこと」に統一してください"
            )

        if 'class="toc"' not in content:
            errors.append("目次（toc）が必要です")

        if 'class="checklist"' not in content:
            errors.append("まとめチェックリスト（checklist）が必要です")

        # --- セクション見出し ---

        h2_tags = self._SECTION_H2_RE.findall(content)
        for h2 in h2_tags:
            if "step-label" in h2 and 'class="section-title"' not in h2:
                errors.append(
                    "step-label を含む h2 には class=\"section-title\" が必要です"
                )
                break

        step_labels = self._STEP_LABEL_RE.findall(content)
        for label in step_labels:
            if not label.startswith("STEP "):
                errors.append(
                    f"ステップラベルは「STEP N」（大文字）に統一してください"
                    f"（検出: {label}）"
                )
                break

        if self._H2_COPY_BTN_RE.search(content):
            errors.append(
                "h2 タグ内に copy-btn が混入しています"
            )

        # --- code-tabs 平文化検出 ---

        if self._PLAINTEXT_TABS_RE.search(content):
            errors.append(
                "code-tabs の HTML タグが平文化しています"
                "（<div class=\"code-tabs\"> 構造が必要です）"
            )

        # --- info-box / warn-box タイトル ---

        if "info-box" in content and self._BAD_INFO_TITLE_RE.search(content):
            errors.append(
                "info-box のタイトルは <div class=\"info-title\"> に統一してください"
            )

        if "warn-box" in content and self._BAD_WARN_TITLE_RE.search(content):
            errors.append(
                "warn-box のタイトルは <div class=\"warn-title\"> に統一してください"
            )

        # --- code-block（code-tabs 外のみ対象）---

        standalone = self._strip_code_tabs(content)
        if 'class="code-block"' in standalone:
            if self._CODE_BLOCK_NO_WHERE_RE.search(standalone):
                errors.append(
                    'code-block には <span class="where">言語名</span> が必要です'
                )
            if self._CODE_BLOCK_NO_COPY_RE.search(standalone):
                errors.append(
                    'code-block には <button class="copy-btn"> が必要です'
                )

        # --- テーブル ---

        for m in self._TABLE_RE.finditer(content):
            if self._DARK_BG_RE.search(m.group()):
                errors.append(
                    "テーブルにダークテーマの背景色は禁止です"
                    "（ヘッダ: #34495e / 行: #f8f9fa, #ffffff）"
                )
                break

        # --- code-tabs ---

        tabs_splits = content.split('class="code-tabs"')
        for i, part in enumerate(tabs_splits[1:], 1):
            btn_match = self._TAB_BUTTONS_RE.search(part)
            if not btn_match:
                errors.append(f"code-tabs #{i}: tab-buttons が見つかりません")
                continue
            buttons = btn_match.group(1)
            if "表示" not in buttons:
                errors.append(f"code-tabs #{i}: 「表示」タブが必要です")
            if "HTML" not in buttons:
                errors.append(f"code-tabs #{i}: 「HTML」タブが必要です")

        # --- script 内の var 禁止 ---

        for m in self._SCRIPT_RE.finditer(content):
            if self._VAR_DECL_RE.search(m.group(1)):
                errors.append(
                    "script 内で var は禁止です（let / const を使用）"
                )
                break

        # --- 目次リンクと h2 id の整合性 ---

        toc_match = self._TOC_RE.search(content)
        if toc_match:
            toc_hrefs = self._TOC_HREF_RE.findall(toc_match.group(1))
            h2_ids = set(self._H2_ID_RE.findall(content))
            missing = [h for h in toc_hrefs if h not in h2_ids]
            if missing:
                errors.append(
                    f"目次リンク先の h2 id が見つかりません: "
                    f"{', '.join(missing)}"
                )

        # --- h2 id 重複チェック ---

        all_h2_ids = self._H2_ID_RE.findall(content)
        seen = set()
        dupes = set()
        for hid in all_h2_ids:
            if hid in seen:
                dupes.add(hid)
            seen.add(hid)
        if dupes:
            errors.append(
                f"h2 id が重複しています: {', '.join(sorted(dupes))}"
            )

        # --- code-tabs ボタンとパネルの数の一致 ---

        for i, part in enumerate(tabs_splits[1:], 1):
            btns = self._TAB_BTN_RE.findall(part.split('class="code-tabs"')[0]
                                            if 'class="code-tabs"' in part
                                            else part)
            panels = self._TAB_PANEL_RE.findall(
                part.split('class="code-tabs"')[0]
                if 'class="code-tabs"' in part
                else part
            )
            if len(btns) != len(panels):
                errors.append(
                    f"code-tabs #{i}: ボタン数({len(btns)})と"
                    f"パネル数({len(panels)})が一致しません"
                )

        # --- div タグの整合性 ---

        open_divs = len(re.findall(r'<div\b', content, re.IGNORECASE))
        close_divs = len(re.findall(r'</div>', content, re.IGNORECASE))
        if open_divs != close_divs:
            errors.append(
                f"div タグの整合性エラー"
                f"（開始: {open_divs} / 終了: {close_divs}）"
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        skip_validation = kwargs.pop("skip_validation", False)
        if not skip_validation:
            self.clean()
        if self.is_published and not self.published_at:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)


class GlossaryTerm(models.Model):
    term = models.CharField("用語", max_length=100, unique=True)
    description = models.TextField("説明")

    class Meta:
        ordering = ["term"]
        verbose_name = "用語"
        verbose_name_plural = "用語"

    def __str__(self):
        return self.term


class AffiliateLink(models.Model):
    service_name = models.CharField("サービス名", max_length=100)
    url = models.URLField("アフィリエイトURL", max_length=500)
    description = models.TextField("説明文", max_length=300, blank=True)
    display_text = models.CharField("表示テキスト", max_length=100, default="詳しく見る")
    book_title = models.CharField("書籍タイトル", max_length=200, blank=True, help_text="書籍の場合に設定。書籍カードとして表示される")
    image_url = models.URLField("画像URL", max_length=500, blank=True, help_text="書影画像のURL")
    icon = models.CharField("アイコン（Bootstrap Icons）", max_length=50, blank=True,
                            help_text="例: bi-hdd-rack, bi-globe, bi-server")
    badge = models.CharField("バッジテキスト", max_length=30, blank=True, help_text="例: おすすめ, 人気No.1")
    color = models.CharField("テーマカラー", max_length=7, default="#10b981", help_text="例: #10b981")
    classifications = models.ManyToManyField(
        Classification,
        verbose_name="対象分類",
        related_name="affiliate_links",
        blank=True,
    )
    order = models.IntegerField("表示順", default=0)
    is_active = models.BooleanField("有効", default=True)
    created_at = models.DateTimeField("作成日時", auto_now_add=True)

    class Meta:
        ordering = ["order", "service_name"]
        verbose_name = "アフィリエイトリンク"
        verbose_name_plural = "アフィリエイトリンク"

    def __str__(self):
        return self.service_name


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    seal = models.TextField("印鑑", blank=True, default='')

    class Meta:
        verbose_name = "ユーザープロフィール"
        verbose_name_plural = "ユーザープロフィール"

    def __str__(self):
        return self.user.username
