from django.contrib import admin

from .models import Classification, Article, GlossaryTerm, UserProfile, AffiliateLink


@admin.register(Classification)
class ClassificationAdmin(admin.ModelAdmin):
    list_display = ["name", "parent", "order"]
    list_filter = ["parent"]
    search_fields = ["name"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ["title", "short_title", "classification", "order", "is_published", "published_at"]
    list_filter = ["classification", "is_published"]
    list_editable = ["order"]
    search_fields = ["title", "content"]
    prepopulated_fields = {"slug": ("title",)}


@admin.register(GlossaryTerm)
class GlossaryTermAdmin(admin.ModelAdmin):
    list_display = ["term", "reading", "description"]
    search_fields = ["term", "reading"]


@admin.register(AffiliateLink)
class AffiliateLinkAdmin(admin.ModelAdmin):
    list_display = ["service_name", "url", "order", "is_active"]
    list_filter = ["is_active", "classifications"]
    search_fields = ["service_name", "description"]
    filter_horizontal = ["classifications"]
    list_editable = ["order", "is_active"]


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ["user"]
    search_fields = ["user__username"]
