"""
Django基礎・ORM をサブ分類に分割するスクリプト。
実行: docker compose exec web python /app/scripts/split_django_classifications.py
"""
import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, "/app")
django.setup()

from blog.models import Classification, Article

# 親: django (id=54)
PARENT_DJANGO_ID = 54

# django-basic のサブ分類: (order, slug, name)
BASIC_SUBCATS = [
    (1, "django-setup", "入門・セットアップ"),
    (2, "django-models-forms", "モデル・フォーム"),
    (3, "django-views-urls", "ビュー・URL"),
    (4, "django-templates", "テンプレート"),
    (5, "django-auth-perm", "認証・権限"),
    (6, "django-admin", "管理画面"),
    (7, "django-drf", "DRF (REST API)"),
    (8, "django-deploy-ops", "デプロイ・運用"),
    (9, "django-features", "ミドルウェア・機能"),
    (10, "django-extensions", "外部連携・拡張"),
]

# django-orm のサブ分類
ORM_SUBCATS = [
    (11, "django-orm-crud", "CRUD基本操作"),
    (12, "django-orm-relations", "リレーション"),
    (13, "django-orm-query", "高度なクエリ"),
    (14, "django-orm-design", "モデル設計"),
    (15, "django-orm-performance", "パフォーマンス"),
]

# 記事 slug -> 新分類 slug (django-basic 用)
BASIC_SLUG_TO_SUBCAT = {
    "django-installation": "django-setup",
    "development-server": "django-setup",
    "app-creation": "django-setup",
    "superuser": "django-setup",
    "django-project-structure": "django-setup",
    "django-settings-detail": "django-setup",
    "django-settings-split": "django-setup",
    "django-model-definition": "django-models-forms",
    "django-custom-user": "django-models-forms",
    "django-custom-model-fields": "django-models-forms",
    "django-forms": "django-models-forms",
    "django-formsets": "django-models-forms",
    "django-crispy-forms": "django-models-forms",
    "django-form-wizards": "django-models-forms",
    "django-form-rendering": "django-models-forms",
    "django-validators": "django-models-forms",
    "django-model-save-patterns": "django-models-forms",
    "django-fixtures": "django-models-forms",
    "django-generic-foreignkey": "django-models-forms",
    "django-contenttypes": "django-models-forms",
    "django-inspectdb": "django-models-forms",
    "django-contrib-postgres": "django-models-forms",
    "django-money-handling": "django-models-forms",
    "django-data-migrations": "django-models-forms",
    "django-migrations-guide": "django-models-forms",
    "django-migrations-squash": "django-models-forms",
    "django-cbv": "django-views-urls",
    "django-cbv-detail": "django-views-urls",
    "django-mixins": "django-views-urls",
    "django-async-views": "django-views-urls",
    "urls-py": "django-views-urls",
    "django-url-advanced": "django-views-urls",
    "django-request-lifecycle": "django-views-urls",
    "django-exception-handling": "django-views-urls",
    "django-custom-error-pages": "django-views-urls",
    "django-rest-api": "django-views-urls",
    "template-advanced": "django-templates",
    "django-template-tags": "django-templates",
    "django-template-engine-deep": "django-templates",
    "django-context-processors": "django-templates",
    "django-jinja2": "django-templates",
    "django-auth": "django-auth-perm",
    "django-permissions": "django-auth-perm",
    "django-custom-auth-backend": "django-auth-perm",
    "django-allauth": "django-auth-perm",
    "django-password-reset-flow": "django-auth-perm",
    "django-simple-jwt": "django-auth-perm",
    "django-axes-bruteforce": "django-auth-perm",
    "admin-py": "django-admin",
    "django-admin-advanced": "django-admin",
    "django-admin-actions": "django-admin",
    "django-admin-themes": "django-admin",
    "django-admin-inlines": "django-admin",
    "django-drf-serializers": "django-drf",
    "django-drf-viewsets": "django-drf",
    "django-drf-auth": "django-drf",
    "django-drf-permissions": "django-drf",
    "django-drf-filtering": "django-drf",
    "django-drf-throttling": "django-drf",
    "django-drf-pagination": "django-drf",
    "django-drf-testing": "django-drf",
    "django-drf-nested": "django-drf",
    "django-drf-file-upload": "django-drf",
    "django-drf-renderers": "django-drf",
    "django-drf-routers": "django-drf",
    "django-drf-serializer-fields": "django-drf",
    "django-api-docs": "django-drf",
    "django-api-versioning": "django-drf",
    "django-ninja": "django-drf",
    "django-deploy": "django-deploy-ops",
    "django-nginx-gunicorn": "django-deploy-ops",
    "django-docker-deploy": "django-deploy-ops",
    "django-ci-cd": "django-deploy-ops",
    "django-performance": "django-deploy-ops",
    "django-health-check": "django-deploy-ops",
    "django-collectstatic-deep": "django-deploy-ops",
    "django-compressor": "django-deploy-ops",
    "django-static-media": "django-deploy-ops",
    "django-silk": "django-deploy-ops",
    "django-sentry": "django-deploy-ops",
    "django-debug-toolbar": "django-deploy-ops",
    "django-logging": "django-deploy-ops",
    "django-environ": "django-deploy-ops",
    "django-task-scheduling": "django-deploy-ops",
    "django-rate-limiting": "django-deploy-ops",
    "django-middleware": "django-features",
    "django-signals": "django-features",
    "django-signals-patterns": "django-features",
    "django-caching": "django-features",
    "django-sessions": "django-features",
    "django-messages": "django-features",
    "django-email": "django-features",
    "django-email-html-template": "django-features",
    "django-file-upload": "django-features",
    "django-file-upload-complete": "django-features",
    "django-file-streaming": "django-features",
    "django-pagination": "django-features",
    "django-management-commands": "django-features",
    "django-managers": "django-features",
    "django-i18n": "django-features",
    "django-modeltranslation": "django-features",
    "django-timezone-handling": "django-features",
    "django-transactions": "django-features",
    "django-on-commit": "django-features",
    "django-cors": "django-features",
    "django-htmx": "django-features",
    "django-sitemap": "django-features",
    "django-rss": "django-features",
    "django-celery": "django-extensions",
    "django-channels": "django-extensions",
    "django-elasticsearch": "django-extensions",
    "django-s3-storage": "django-extensions",
    "django-redis-advanced": "django-extensions",
    "django-taggit": "django-extensions",
    "django-import-export": "django-extensions",
    "django-guardian": "django-extensions",
    "django-mptt": "django-extensions",
    "django-extensions": "django-extensions",
    "django-wagtail": "django-extensions",
    "django-graphql": "django-extensions",
    "django-webhook": "django-extensions",
    "django-pdf-generation": "django-extensions",
    "django-excel-generation": "django-extensions",
    "django-geodjango": "django-extensions",
    "django-oauth2-provider": "django-extensions",
    "django-simple-history": "django-extensions",
    "django-rich-text-editor": "django-extensions",
    "django-service-layer": "django-extensions",
    "django-multi-tenancy": "django-extensions",
    "django-feature-flags": "django-extensions",
    "django-audit-log": "django-extensions",
    "django-soft-delete": "django-extensions",
    "django-database-views": "django-extensions",
    "django-database-routing": "django-extensions",
    "django-multi-db": "django-extensions",
    "django-factory-boy": "django-extensions",
    "django-pytest-advanced": "django-extensions",
    "django-test-client-advanced": "django-extensions",
    "django-testing": "django-extensions",
}

# django-orm: slug -> 新分類 slug
ORM_SLUG_TO_SUBCAT = {
    "what-is-orm": "django-orm-crud",
    "all": "django-orm-crud",
    "get": "django-orm-crud",
    "create": "django-orm-crud",
    "update": "django-orm-crud",
    "delete": "django-orm-crud",
    "filter": "django-orm-crud",
    "exclude": "django-orm-crud",
    "order-by": "django-orm-crud",
    "values": "django-orm-crud",
    "foreign-key-access": "django-orm-relations",
    "reverse-relation": "django-orm-relations",
    "django-m2m": "django-orm-relations",
    "django-select-related": "django-orm-relations",
    "prefetch-related": "django-orm-relations",
    "django-prefetch-advanced": "django-orm-relations",
    "django-polymorphic": "django-orm-relations",
    "q-objects": "django-orm-query",
    "f-expressions": "django-orm-query",
    "annotate": "django-orm-query",
    "annotate-count": "django-orm-query",
    "annotate-value": "django-orm-query",
    "aggregate": "django-orm-query",
    "aggregate-sum": "django-orm-query",
    "subquery": "django-orm-query",
    "conditional-expressions": "django-orm-query",
    "coalesce": "django-orm-query",
    "trunc-date": "django-orm-query",
    "django-raw-sql": "django-orm-query",
    "django-set-operations": "django-orm-query",
    "django-queryset-methods": "django-orm-query",
    "django-filter": "django-orm-query",
    "django-model-inheritance": "django-orm-design",
    "django-model-meta": "django-orm-design",
    "django-proxy-model": "django-orm-design",
    "django-model-choices": "django-orm-design",
    "django-db-constraints": "django-orm-design",
    "django-custom-lookups": "django-orm-design",
    "django-db-functions": "django-orm-design",
    "django-window-functions": "django-orm-design",
    "django-jsonfield": "django-orm-design",
    "django-query-optimization": "django-orm-performance",
    "django-database-indexes": "django-orm-performance",
    "django-database-locking": "django-orm-performance",
    "django-select-for-update": "django-orm-performance",
    "django-bulk-operations": "django-orm-performance",
    "django-only-defer": "django-orm-performance",
    "django-distinct": "django-orm-performance",
    "django-count-first-last": "django-orm-performance",
    "django-exists": "django-orm-performance",
    "django-queryset-advanced": "django-orm-performance",
    "django-fulltext-search": "django-orm-performance",
}


def main():
    parent = Classification.objects.get(pk=PARENT_DJANGO_ID)
    slug_to_classification = {}

    print("--- 新規分類作成 ---")
    for order, slug, name in BASIC_SUBCATS:
        c, created = Classification.objects.get_or_create(
            slug=slug,
            defaults={"name": name, "parent": parent, "order": order},
        )
        if not created:
            c.order = order
            c.name = name
            c.save()
        slug_to_classification[slug] = c
        print(f"  {slug}: {name} (id={c.pk})")

    for order, slug, name in ORM_SUBCATS:
        c, created = Classification.objects.get_or_create(
            slug=slug,
            defaults={"name": name, "parent": parent, "order": order},
        )
        if not created:
            c.order = order
            c.name = name
            c.save()
        slug_to_classification[slug] = c
        print(f"  {slug}: {name} (id={c.pk})")

    print("\n--- 記事の移動 ---")
    basic = Classification.objects.filter(slug="django-basic").first()
    if basic:
        moved = 0
        unmapped = []
        for art in Article.objects.filter(classification=basic):
            new_slug = BASIC_SLUG_TO_SUBCAT.get(art.slug)
            if new_slug and new_slug in slug_to_classification:
                art.classification = slug_to_classification[new_slug]
                art.save()
                moved += 1
            else:
                unmapped.append(art.slug)
        print(f"django-basic: {moved} 記事を移動")
        if unmapped:
            print(f"  未マッピング: {unmapped}")

    orm = Classification.objects.filter(slug="django-orm").first()
    if orm:
        moved = 0
        unmapped = []
        for art in Article.objects.filter(classification=orm):
            new_slug = ORM_SLUG_TO_SUBCAT.get(art.slug)
            if new_slug and new_slug in slug_to_classification:
                art.classification = slug_to_classification[new_slug]
                art.save()
                moved += 1
            else:
                unmapped.append(art.slug)
        print(f"django-orm: {moved} 記事を移動")
        if unmapped:
            print(f"  未マッピング: {unmapped}")

    print("\n--- 旧分類の削除 ---")
    for old_slug in ("django-basic", "django-orm"):
        old = Classification.objects.filter(slug=old_slug).first()
        if old and old.articles.count() == 0:
            old.delete()
            print(f"削除: {old_slug}")

    print("\n--- 新分類の記事数 ---")
    for slug in [s[1] for s in BASIC_SUBCATS] + [s[1] for s in ORM_SUBCATS]:
        c = Classification.objects.filter(slug=slug).first()
        if c:
            print(f"  {slug}: {c.articles.count()} 記事")


if __name__ == "__main__":
    main()
