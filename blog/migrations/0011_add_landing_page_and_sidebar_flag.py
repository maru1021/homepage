from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0010_affiliatelink_book_title_affiliatelink_image_url_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="classification",
            name="show_in_sidebar",
            field=models.BooleanField(default=True, verbose_name="サイドバーに表示"),
        ),
        migrations.AddField(
            model_name="article",
            name="is_landing_page",
            field=models.BooleanField(
                default=False,
                help_text="アフィリエイト専用ページ。記事バリデーションをスキップし専用テンプレートで表示",
                verbose_name="ランディングページ",
            ),
        ),
    ]
