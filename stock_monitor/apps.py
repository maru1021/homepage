from django.apps import AppConfig


class StockMonitorConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'stock_monitor'
    verbose_name = '株価モニター'
