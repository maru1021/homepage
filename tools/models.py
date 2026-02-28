from django.db import models


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
