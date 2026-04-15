import random

from django.db import models


class QuizQuestion(models.Model):
    LANGUAGE_CHOICES = [
        ('html', 'HTML'),
        ('css', 'CSS'),
        ('javascript', 'JavaScript'),
        ('python', 'Python'),
    ]
    FORMAT_CHOICES = [
        ('fill', '穴埋め'),
        ('choice', '選択'),
        ('output', '出力予測'),
        ('error', 'エラー発見'),
    ]

    language = models.CharField('言語', max_length=20, choices=LANGUAGE_CHOICES, db_index=True)
    question_format = models.CharField('形式', max_length=20, choices=FORMAT_CHOICES)
    difficulty = models.IntegerField('難易度', default=1, help_text='1=初級, 2=中級, 3=上級')
    question_text = models.TextField('問題文')
    code_snippet = models.TextField('コードスニペット', blank=True)
    choice_1 = models.CharField('選択肢1', max_length=500)
    choice_2 = models.CharField('選択肢2', max_length=500)
    choice_3 = models.CharField('選択肢3', max_length=500)
    choice_4 = models.CharField('選択肢4', max_length=500)
    correct_choice = models.IntegerField('正解番号', help_text='1〜4')
    explanation = models.TextField('解説')
    created_at = models.DateTimeField('作成日時', auto_now_add=True)

    class Meta:
        verbose_name = 'クイズ問題'
        verbose_name_plural = 'クイズ問題'

    def __str__(self):
        return f'[{self.language}] {self.question_text[:50]}'

    @classmethod
    def get_random(cls, language=None, count=1):
        qs = cls.objects.all()
        if language:
            qs = qs.filter(language=language)
        ids = list(qs.values_list('id', flat=True))
        if not ids:
            return []
        selected = random.sample(ids, min(count, len(ids)))
        return list(qs.filter(id__in=selected))


class WeatherForecast(models.Model):
    city_key = models.CharField('都市キー', max_length=20, db_index=True)
    city_name = models.CharField('都市名', max_length=50)
    forecast_date = models.DateField('予報日付', db_index=True)
    weather_code = models.IntegerField('天気コード')
    temp_max = models.FloatField('最高気温')
    temp_min = models.FloatField('最低気温')
    precipitation_prob = models.IntegerField('降水確率')
    # 当日分のみ: 現在の天気情報
    temperature = models.FloatField('現在気温', null=True, blank=True)
    humidity = models.IntegerField('現在湿度', null=True, blank=True)
    wind_speed = models.FloatField('現在風速', null=True, blank=True)
    current_weather_code = models.IntegerField('現在天気コード', null=True, blank=True)
    fetched_at = models.DateTimeField('取得日時')

    class Meta:
        verbose_name = '天気予報'
        verbose_name_plural = '天気予報'
        constraints = [
            models.UniqueConstraint(
                fields=['city_key', 'forecast_date'],
                name='unique_city_forecast_date',
            ),
        ]

    def __str__(self):
        return f'{self.city_name} {self.forecast_date} {self.temp_max}°/{self.temp_min}°'


class SeafloorDepth(models.Model):
    # 量子化レベルごとの係数: lat_q = round(lat * scale)
    # 0 が最細。広域表示時は粗いレベルを使い、転送量と描画コストを抑える
    QUANTIZE_SCALES = {
        0: 250,  # 約 0.004° (≒450m) — GEBCO2020 ネイティブ。クリック取得・拡大時用
        1: 50,   # 約 0.02°  (≒2.2km)
        2: 10,   # 約 0.1°   (≒11km)
        3: 2,    # 約 0.5°   (≒55km)
    }

    quantize = models.IntegerField('量子化レベル (0=最細)', default=0)
    lat_q = models.IntegerField('緯度×scale')
    lon_q = models.IntegerField('経度×scale')
    elevation = models.FloatField('標高/水深 (m)', null=True, blank=True)
    created_at = models.DateTimeField('取得日時', auto_now_add=True)

    class Meta:
        verbose_name = '海底深度キャッシュ'
        verbose_name_plural = '海底深度キャッシュ'
        constraints = [
            models.UniqueConstraint(fields=['quantize', 'lat_q', 'lon_q'], name='unique_seafloor_qll'),
        ]
        indexes = [models.Index(fields=['quantize', 'lat_q', 'lon_q'], name='tools_seafl_qll_idx')]

    @classmethod
    def zoom_to_quantize(cls, zoom):
        if zoom >= 12:
            return 0
        if zoom >= 9:
            return 1
        if zoom >= 6:
            return 2
        return 3
