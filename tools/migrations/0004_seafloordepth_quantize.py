from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tools', '0003_seafloordepth'),
    ]

    operations = [
        migrations.DeleteModel(name='SeafloorDepth'),
        migrations.CreateModel(
            name='SeafloorDepth',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('lat_q', models.IntegerField(verbose_name='緯度×250 (≒0.004°刻み)')),
                ('lon_q', models.IntegerField(verbose_name='経度×250 (≒0.004°刻み)')),
                ('elevation', models.FloatField(blank=True, null=True, verbose_name='標高/水深 (m)')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='取得日時')),
            ],
            options={
                'verbose_name': '海底深度キャッシュ',
                'verbose_name_plural': '海底深度キャッシュ',
                'indexes': [models.Index(fields=['lat_q', 'lon_q'], name='tools_seafl_lat_q_idx')],
                'constraints': [models.UniqueConstraint(fields=('lat_q', 'lon_q'), name='unique_seafloor_latlon_q')],
            },
        ),
    ]
