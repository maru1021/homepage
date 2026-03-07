from django import forms

from .models import Classification


class ContactForm(forms.Form):
    name = forms.CharField(
        label="お名前",
        max_length=100,
        widget=forms.TextInput(attrs={"class": "form-control", "placeholder": "お名前"}),
    )
    email = forms.EmailField(
        label="メールアドレス",
        widget=forms.EmailInput(attrs={"class": "form-control", "placeholder": "your@email.com"}),
    )
    subject = forms.CharField(
        label="件名",
        max_length=200,
        widget=forms.TextInput(attrs={"class": "form-control", "placeholder": "件名"}),
    )
    message = forms.CharField(
        label="お問い合わせ内容",
        widget=forms.Textarea(attrs={"class": "form-control", "rows": 6, "placeholder": "お問い合わせ内容をご記入ください"}),
    )


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
