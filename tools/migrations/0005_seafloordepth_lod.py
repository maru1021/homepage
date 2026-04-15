from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tools', '0004_seafloordepth_quantize'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='seafloordepth',
            name='unique_seafloor_latlon_q',
        ),
        migrations.RemoveIndex(
            model_name='seafloordepth',
            name='tools_seafl_lat_q_idx',
        ),
        migrations.AddField(
            model_name='seafloordepth',
            name='quantize',
            field=models.IntegerField(default=0, verbose_name='量子化レベル (0=最細)'),
        ),
        migrations.AlterField(
            model_name='seafloordepth',
            name='lat_q',
            field=models.IntegerField(verbose_name='緯度×scale'),
        ),
        migrations.AlterField(
            model_name='seafloordepth',
            name='lon_q',
            field=models.IntegerField(verbose_name='経度×scale'),
        ),
        migrations.AddConstraint(
            model_name='seafloordepth',
            constraint=models.UniqueConstraint(
                fields=('quantize', 'lat_q', 'lon_q'),
                name='unique_seafloor_qll',
            ),
        ),
        migrations.AddIndex(
            model_name='seafloordepth',
            index=models.Index(
                fields=['quantize', 'lat_q', 'lon_q'],
                name='tools_seafl_qll_idx',
            ),
        ),
    ]
