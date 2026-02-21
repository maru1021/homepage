from django.contrib.admin.views.decorators import staff_member_required
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
    """トップページ: 最新記事"""
    return _render(request, "blog/article_list.html", "blog/_article_list_content.html", {
        "articles": _PUBLISHED_ARTICLES.all()[:10],
    })


def article_search(request):
    """記事検索（AJAX）"""
    q = request.GET.get("q", "").strip()
    if q:
        articles = _PUBLISHED_ARTICLES.filter(
            Q(title__icontains=q) | Q(excerpt__icontains=q) | Q(content__icontains=q)
        )[:20]
    else:
        articles = Article.objects.none()
    return render(request, "blog/_search_results.html", {
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
    return _render(request, "blog/article_detail.html", "blog/_article_detail_content.html", {
        "article": article,
        "ancestors": ancestors,
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
