from django.urls import path

from . import views
from .feeds import LatestArticlesFeed

app_name = "blog"

urlpatterns = [
    path("", views.article_list, name="article_list"),
    path("search/", views.article_search, name="article_search"),
    path("feed/", LatestArticlesFeed(), name="feed"),
    path("category/<path:path>/", views.category_detail, name="category_detail"),
    path("article/<path:path>/", views.article_detail, name="article_detail"),
    # 分類管理
    path("manage/classifications/", views.classification_manage, name="classification_manage"),
    path("manage/classifications/create/", views.classification_create, name="classification_create"),
    path("manage/classifications/<int:pk>/edit/", views.classification_edit, name="classification_edit"),
    path("manage/classifications/<int:pk>/delete/", views.classification_delete, name="classification_delete"),
]
