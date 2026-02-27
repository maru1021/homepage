from django.shortcuts import render


def htmx_render(request, full, partial, context=None, *, title=""):
    """htmxリクエスト時は部分テンプレートのみ返す（タブタイトルも更新）"""
    if request.htmx:
        response = render(request, partial, context or {})
        if title:
            response.content = f"<title>{title}</title>".encode() + response.content
        return response
    return render(request, full, context or {})
