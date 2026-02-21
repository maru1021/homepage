from django import forms

from .models import Classification


class ClassificationForm(forms.ModelForm):
    class Meta:
        model = Classification
        fields = ["name", "slug", "parent", "order"]
        widgets = {
            "name": forms.TextInput(attrs={"class": "form-control", "placeholder": "分類名"}),
            "slug": forms.TextInput(attrs={"class": "form-control", "placeholder": "url-slug"}),
            "parent": forms.Select(attrs={"class": "form-select"}),
            "order": forms.NumberInput(attrs={"class": "form-control", "placeholder": "0"}),
        }
