from django.contrib.auth.models import User
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

    def save(self, *args, **kwargs):
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
    icon = models.CharField("アイコン（Bootstrap Icons）", max_length=50, blank=True, help_text="例: bi-hdd-rack, bi-globe, bi-server")
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
