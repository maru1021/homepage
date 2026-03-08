from django.contrib import admin

from .models import QuizQuestion, WeatherForecast


@admin.register(QuizQuestion)
class QuizQuestionAdmin(admin.ModelAdmin):
    list_display = ('language', 'question_format', 'difficulty', 'question_text_short')
    list_filter = ('language', 'question_format', 'difficulty')
    search_fields = ('question_text', 'explanation')

    def question_text_short(self, obj):
        return obj.question_text[:60]
    question_text_short.short_description = '問題文'


@admin.register(WeatherForecast)
class WeatherForecastAdmin(admin.ModelAdmin):
    list_display = ('city_name', 'forecast_date', 'temp_max', 'temp_min')
    list_filter = ('city_key',)
