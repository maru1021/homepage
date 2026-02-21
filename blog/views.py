from django.contrib.admin.views.decorators import staff_member_required
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import render, get_object_or_404, redirect
from django.template.loader import render_to_string

from .models import Classification, Article
from .forms import ClassificationForm


_PUBLISHED_ARTICLES = (
    Article.objects
    .filter(is_published=True)
    .select_related("classification__parent__parent")
)


def _render(request, full_template, partial_template, context):
    """htmxリクエスト時は部分テンプレートのみ返す"""
    template = partial_template if request.htmx else full_template
    return render(request, template, context)


def article_list(request):
    """トップページ: 最新記事（ページネーション対応）"""
    paginator = Paginator(_PUBLISHED_ARTICLES.all(), 12)
    page_number = request.GET.get("page")
    page_obj = paginator.get_page(page_number)
    return _render(request, "blog/article_list.html", "blog/_article_list_content.html", {
        "articles": page_obj,
        "page_obj": page_obj,
    })


def category_detail(request, path):
    """カテゴリページ: 分類ごとの記事一覧"""
    parts = path.strip("/").split("/")
    slug = parts[-1]
    classification = get_object_or_404(Classification, slug=slug)

    # パスが正しいかチェック
    expected_path = f"/category/{classification.get_slug_path()}/"
    if request.path != expected_path:
        return redirect(expected_path, permanent=True)

    # この分類と子孫分類の全記事を取得
    classification_ids = [classification.pk]
    _collect_descendant_ids(classification, classification_ids)
    articles = _PUBLISHED_ARTICLES.filter(classification_id__in=classification_ids)

    paginator = Paginator(articles, 12)
    page_number = request.GET.get("page")
    page_obj = paginator.get_page(page_number)

    ancestors = classification.get_ancestors()
    child_classifications = classification.children.all()

    return _render(request, "blog/category_detail.html", "blog/_category_detail_content.html", {
        "classification": classification,
        "articles": page_obj,
        "page_obj": page_obj,
        "ancestors": ancestors,
        "child_classifications": child_classifications,
    })


def _collect_descendant_ids(classification, id_list):
    """再帰的に子孫分類のIDを収集"""
    for child in classification.children.all():
        id_list.append(child.pk)
        _collect_descendant_ids(child, id_list)


def article_search(request):
    """記事検索（AJAX / 通常アクセス両対応）"""
    q = request.GET.get("q", "").strip()
    if q:
        articles = _PUBLISHED_ARTICLES.filter(
            Q(title__icontains=q) | Q(excerpt__icontains=q) | Q(content__icontains=q)
        )[:20]
    else:
        articles = Article.objects.none()
    return _render(request, "blog/search.html", "blog/_search_results.html", {
        "articles": articles,
        "query": q,
    })


def article_detail(request, path):
    """記事詳細ページ（URLは /article/分類1/分類2/.../記事slug/）"""
    parts = path.strip("/").split("/")
    slug = parts[-1]
    article = get_object_or_404(
        _PUBLISHED_ARTICLES, slug=slug,
    )
    # パスが正しいかチェックし、不一致なら正規URLにリダイレクト
    canonical = article.get_absolute_url()
    if request.path != canonical:
        return redirect(canonical, permanent=True)
    ancestors = []
    if article.classification:
        ancestors = article.classification.get_ancestors() + [article.classification]

    # 関連記事: 同じ分類の他の記事（最大5件）
    related_articles = []
    if article.classification:
        related_articles = list(
            _PUBLISHED_ARTICLES
            .filter(classification=article.classification)
            .exclude(pk=article.pk)
            .order_by("-published_at")[:5]
        )

    return _render(request, "blog/article_detail.html", "blog/_article_detail_content.html", {
        "article": article,
        "ancestors": ancestors,
        "related_articles": related_articles,
    })


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
