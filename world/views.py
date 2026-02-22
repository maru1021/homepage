from django.views.generic import TemplateView


class WorldView(TemplateView):
    template_name = "world/index.html"
