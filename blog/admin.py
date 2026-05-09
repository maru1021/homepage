from django.contrib import admin

from .models import Classification, Article, GlossaryTerm, UserProfile, AffiliateLink


@admin.register(Classification)
class ClassificationAdmin(admin.ModelAdmin):
    list_display = ["name", "parent", "order", "show_in_sidebar"]
    list_filter = ["parent", "show_in_sidebar"]
    list_editable = ["show_in_sidebar"]
    search_fields = ["name"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ["title", "short_title", "classification", "order",
                    "is_published", "is_tweeted", "is_landing_page", "published_at"]
    list_filter = ["classification", "is_published", "is_tweeted", "is_landing_page"]
    list_editable = ["order", "is_tweeted", "is_landing_page"]
    search_fields = ["title", "content"]
    prepopulated_fields = {"slug": ("title",)}


@admin.register(GlossaryTerm)
class GlossaryTermAdmin(admin.ModelAdmin):
    list_display = ["term", "description"]
    search_fields = ["term"]


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
