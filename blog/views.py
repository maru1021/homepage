from django.conf import settings as django_settings
from django.contrib.admin.views.decorators import staff_member_required
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import render, get_object_or_404, redirect
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.views.decorators.http import require_GET

from config.htmx import htmx_render
from .models import Classification, Article
from .forms import ClassificationForm

ARTICLES_PER_PAGE = 12
RELATED_ARTICLES_COUNT = 5
SEARCH_RESULTS_LIMIT = 20

SITE_NAME = django_settings.SITE_NAME


def _published_articles():
    """公開記事のベースQuerySetを返す（毎回新鮮なQuerySetを生成）"""
    return (
        Article.objects
        .filter(is_published=True)
        .select_related("classification__parent__parent")
    )


def _paginate(queryset, request):
    """ページネーション共通処理"""
    paginator = Paginator(queryset, ARTICLES_PER_PAGE)
    return paginator.get_page(request.GET.get("page"))


def _redirect_if_wrong_path(request, canonical_path):
    """正規URLと異なるパスの場合、リダイレクトレスポンスを返す"""
    if request.path != canonical_path:
        return redirect(canonical_path, permanent=True)
    return None


def _collect_descendant_ids(classification, id_list):
    """再帰的に子孫分類のIDを収集"""
    for child in classification.children.all():
        id_list.append(child.pk)
        _collect_descendant_ids(child, id_list)


def article_list(request):
    """トップページ: 最新記事（ページネーション対応）"""
    page_obj = _paginate(_published_articles().all(), request)
    page_num = page_obj.number
    title = f"{page_num}ページ目 - {SITE_NAME} - Web開発・プログラミング技術ブログ" if page_num > 1 else f"{SITE_NAME} - Web開発・プログラミング技術ブログ"
    return htmx_render(request, "blog/article_list.html", "blog/_article_list_content.html", {
        "articles": page_obj,
        "page_obj": page_obj,
    }, title=title)


def category_detail(request, path):
    """カテゴリページ: 分類ごとの記事一覧"""
    slug = path.strip("/").split("/")[-1]
    classification = get_object_or_404(Classification, slug=slug)

    redirect_response = _redirect_if_wrong_path(
        request, f"/category/{classification.get_slug_path()}/"
    )
    if redirect_response:
        return redirect_response

    # この分類と子孫分類の全記事を取得
    classification_ids = [classification.pk]
    _collect_descendant_ids(classification, classification_ids)
    articles = _published_articles().filter(classification_id__in=classification_ids)

    page_obj = _paginate(articles, request)

    page_num = page_obj.number
    title = f"{classification.name}の記事一覧"
    if page_num > 1:
        title += f" ({page_num}ページ目)"
    title += f" - {SITE_NAME}"
    return htmx_render(request, "blog/category_detail.html", "blog/_category_detail_content.html", {
        "classification": classification,
        "articles": page_obj,
        "page_obj": page_obj,
        "ancestors": classification.get_ancestors(),
        "child_classifications": classification.children.all(),
    }, title=title)


def article_search(request):
    """記事検索（AJAX / 通常アクセス両対応）"""
    q = request.GET.get("q", "").strip()
    if q:
        articles = _published_articles().filter(
            Q(title__icontains=q) | Q(excerpt__icontains=q) | Q(content__icontains=q)
        )[:SEARCH_RESULTS_LIMIT]
    else:
        articles = Article.objects.none()
    title = f'"{q}" の検索結果 - {SITE_NAME}' if q else f"検索 - {SITE_NAME}"
    return htmx_render(request, "blog/search.html", "blog/_search_results.html", {
        "articles": articles,
        "query": q,
    }, title=title)


def article_detail(request, path):
    """記事詳細ページ（URLは /article/分類1/分類2/.../記事slug/）"""
    slug = path.strip("/").split("/")[-1]
    article = get_object_or_404(_published_articles(), slug=slug)

    redirect_response = _redirect_if_wrong_path(request, article.get_absolute_url())
    if redirect_response:
        return redirect_response

    ancestors = []
    related_articles = []
    if article.classification:
        ancestors = article.classification.get_ancestors() + [article.classification]
        related_articles = list(
            _published_articles()
            .filter(classification=article.classification)
            .exclude(pk=article.pk)
            .order_by("-published_at")[:RELATED_ARTICLES_COUNT]
        )

    return htmx_render(request, "blog/article_detail.html", "blog/_article_detail_content.html", {
        "article": article,
        "ancestors": ancestors,
        "related_articles": related_articles,
    }, title=f"{article.title} - {SITE_NAME}")


# --- 分類管理（staff のみ） ---

@staff_member_required
def classification_manage(request):
    """分類管理: 一覧テーブル"""
    classifications = Classification.objects.select_related("parent").all()
    return render(request, "blog/classification_manage.html", {
        "classifications": classifications,
        "form": ClassificationForm(),
    })


@staff_member_required
def classification_create(request):
    """分類登録（Ajax）"""
    return _classification_form_ajax(request)


@staff_member_required
def classification_edit(request, pk):
    """分類編集（Ajax）"""
    return _classification_form_ajax(request, instance=get_object_or_404(Classification, pk=pk))


@staff_member_required
def classification_delete(request, pk):
    """分類削除"""
    classification = get_object_or_404(Classification, pk=pk)
    if request.method == "POST":
        classification.delete()
        return redirect("blog:classification_manage")
    return render(request, "blog/classification_delete.html", {
        "classification": classification,
    })


def _classification_form_ajax(request, instance=None):
    """分類の登録・編集を処理する共通ロジック（Ajax）"""
    form = ClassificationForm(request.POST or None, instance=instance)
    if request.method == "POST" and form.is_valid():
        form.save()
        return JsonResponse({"success": True})
    html = render_to_string("blog/_classification_form_body.html", {"form": form}, request=request)
    if request.method == "POST":
        return JsonResponse({"success": False, "html": html})
    return JsonResponse({"html": html})


# ============================================================
# 外部連携用 API
# ============================================================

@require_GET
def api_articles(request):
    """公開記事からランダム1件を返す（auto_post用）

    クエリパラメータ:
        classifications: カンマ区切りの分類slug（親slugを指定すると子孫も含む）
    """
    qs = Article.objects.filter(is_published=True)

    slugs = request.GET.get("classifications", "")
    if slugs:
        slug_list = [s.strip() for s in slugs.split(",") if s.strip()]
        # 指定slugとその子孫分類を全て取得
        target_ids = set()
        for slug in slug_list:
            parents = Classification.objects.filter(slug=slug)
            for parent in parents:
                target_ids.add(parent.id)
                # 子孫を再帰的に取得（2階層まで）
                for child in parent.children.all():
                    target_ids.add(child.id)
                    for grandchild in child.children.all():
                        target_ids.add(grandchild.id)
        if target_ids:
            qs = qs.filter(classification_id__in=target_ids)

    article = qs.order_by("?").first()
    if not article:
        return JsonResponse({"article": None})

    return JsonResponse({"article": {
        "title": article.title,
        "excerpt": article.excerpt or "",
        "content_text": strip_tags(article.content)[:1000],
        "url": article.get_absolute_url(),
    }})
