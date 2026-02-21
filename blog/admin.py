from django.contrib import admin

from .models import Classification, Article, UserProfile


@admin.register(Classification)
class ClassificationAdmin(admin.ModelAdmin):
    list_display = ["name", "parent", "order"]
    list_filter = ["parent"]
    search_fields = ["name"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ["title", "short_title", "classification", "is_published", "published_at"]
    list_filter = ["classification", "is_published"]
    search_fields = ["title", "content"]
    prepopulated_fields = {"slug": ("title",)}


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ["user"]
    search_fields = ["user__username"]
