"""
ファンダメンタルズデータを yf.Ticker().info から取得し DB に保存する管理コマンド。

使い方:
  python manage.py fetch_fundamentals --once   # 1回だけ実行

対象: jp_stock + us_stock カテゴリの銘柄のみ
"""
import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

from stock_monitor.config import (
    CATEGORY_JP_STOCK, CATEGORY_US_STOCK,
    JST, STOCKS_BY_CATEGORY,
)
from stock_monitor.models import StockFetchLog, StockFundamentals
from stock_monitor.utils import fetch_fundamentals_batch

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'ファンダメンタルズデータを取得して DB に保存する'

    def add_arguments(self, parser):
        parser.add_argument(
            '--once', action='store_true',
            help='1回だけ実行して終了',
        )

    def handle(self, *args, **options):
        target_stocks = {}
        for cat in (CATEGORY_JP_STOCK, CATEGORY_US_STOCK):
            target_stocks.update(STOCKS_BY_CATEGORY.get(cat, {}))

        self.stdout.write(
            f'ファンダメンタルズ取得を開始します（銘柄数: {len(target_stocks)}）'
        )

        ticker_list = list(target_stocks.keys())
        batch_result = fetch_fundamentals_batch(ticker_list)

        today = timezone.now().astimezone(JST).date()
        success_count = 0
        for ticker, data in batch_result.items():
            StockFundamentals.objects.update_or_create(
                ticker=ticker,
                date=today,
                defaults=data,
            )
            success_count += 1

        fail_count = len(target_stocks) - success_count

        StockFetchLog.objects.create(
            tickers_count=success_count,
            success=fail_count == 0,
            message=f'ファンダメンタルズ: {success_count}成功 / {fail_count}失敗',
        )

        self.stdout.write(self.style.SUCCESS(
            f'ファンダメンタルズ取得完了: {success_count}成功 / {fail_count}失敗'
        ))
