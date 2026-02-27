from django.urls import path
from . import views

app_name = 'stock_monitor'

urlpatterns = [
    path('', views.index, name='index'),
    path('api/prices/', views.api_prices, name='api_prices'),
    path('api/chart/', views.api_chart_data, name='api_chart_data'),
    path('api/daily-chart/', views.api_daily_chart_data, name='api_daily_chart_data'),
    path('api/stocks/', views.api_stock_list, name='api_stock_list'),
    path('api/market-overview/', views.api_market_overview, name='api_market_overview'),
    path('api/categories/', views.api_categories, name='api_categories'),
    path('api/scores/', views.api_stock_scores, name='api_stock_scores'),
]
