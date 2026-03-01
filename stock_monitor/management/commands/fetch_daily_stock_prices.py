"""
日足データを Yahoo Finance API から取得し DB に保存する管理コマンド。

使い方:
  python manage.py fetch_daily_stock_prices --once   # 1回だけ実行

初回（DBにデータなし）: 全期間を yf.download() で一括取得
2回目以降: 直近5日分を yf.download() で一括取得
仮想通貨: CoinGecko API から取得
"""
import logging

from django.core.management.base import BaseCommand

from stock_monitor.config import (
    CRYPTO_COINGECKO_MAP, STOCKS,
)
from stock_monitor.models import DailyStockPrice, StockFetchLog
from stock_monitor.utils import (
    fetch_crypto_from_coingecko, fetch_yahoo_chart_batch,
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = '日足の株価データを取得して DB に保存する'

    def add_arguments(self, parser):
        parser.add_argument(
            '--once', action='store_true',
            help='1回だけ実行して終了',
        )

    def handle(self, *args, **options):
        self.stdout.write(f'日足データ取得を開始します（銘柄数: {len(STOCKS)}）')

        # DBに既にデータがある銘柄を取得
        existing_tickers = set(
            DailyStockPrice.objects.values_list('ticker', flat=True).distinct()
        )
        new_tickers = {
            t: n for t, n in STOCKS.items() if t not in existing_tickers
        }

        if not existing_tickers:
            self._fetch_initial(STOCKS)
        else:
            self._fetch_bulk_update()
            if new_tickers:
                self.stdout.write(
                    f'新規銘柄 {len(new_tickers)}件 の過去データを取得します...'
                )
                self._fetch_initial(new_tickers)

        self.stdout.write(self.style.SUCCESS('日足データ取得完了'))

    def _fetch_bulk_update(self):
        """2回目以降: 仮想通貨は CoinGecko、他は yf.download() で一括取得"""
        from django.utils import timezone
        from stock_monitor.config import (
            CATEGORY_CRYPTO, JST, STOCKS_BY_CATEGORY,
        )

        self.stdout.write('更新モード: 直近5日分を一括取得')

        saved_count = 0
        total_records = 0

        # --- 仮想通貨: CoinGecko から一括取得 ---
        crypto_tickers = STOCKS_BY_CATEGORY.get(CATEGORY_CRYPTO, {})
        cg_data = fetch_crypto_from_coingecko(CRYPTO_COINGECKO_MAP)
        if cg_data:
            today = timezone.now().astimezone(JST).date()
            for ticker, name in crypto_tickers.items():
                if ticker in cg_data:
                    d = cg_data[ticker]
                    DailyStockPrice.objects.update_or_create(
                        ticker=ticker, date=today,
                        defaults={
                            'name': name,
                            'open': d['price'],
                            'high': d['high_24h'],
                            'low': d['low_24h'],
                            'close': d['price'],
                            'volume': d['volume'],
                        },
                    )
                    saved_count += 1
                    total_records += 1
            self.stdout.write(f'  CoinGecko: {len(cg_data)}銘柄取得')

        # --- その他: yf.download() で一括取得 ---
        yf_stocks = {
            t: n for t, n in STOCKS.items() if t not in crypto_tickers
        }
        ticker_list = list(yf_stocks.keys())
        self.stdout.write(f'  yf.download(): {len(ticker_list)}銘柄を一括取得')

        batch_result = fetch_yahoo_chart_batch(
            ticker_list, range_='5d', interval='1d',
        )

        for ticker, records in batch_result.items():
            name = yf_stocks.get(ticker, ticker)
            for rec in records:
                date_val = rec['date'].date()
                DailyStockPrice.objects.update_or_create(
                    ticker=ticker,
                    date=date_val,
                    defaults={
                        'name': name,
                        'open': rec['open'],
                        'high': rec['high'],
                        'low': rec['low'],
                        'close': rec['close'],
                        'volume': rec['volume'],
                    },
                )
                total_records += 1
            saved_count += 1

        StockFetchLog.objects.create(
            tickers_count=saved_count, success=True,
            message=f'日足更新: {saved_count}銘柄, {total_records}件',
        )
        self.stdout.write(
            f'  yf.download(): {len(batch_result)}銘柄のデータを取得'
        )
        self.stdout.write(f'{saved_count}銘柄, {total_records}件を更新')

    def _fetch_initial(self, stocks_dict):
        """初回: yf.download() で全期間をバッチ取得"""
        from stock_monitor.config import (
            CATEGORY_CRYPTO, STOCKS_BY_CATEGORY,
        )

        crypto_tickers = STOCKS_BY_CATEGORY.get(CATEGORY_CRYPTO, {})
        yf_stocks = {
            t: n for t, n in stocks_dict.items() if t not in crypto_tickers
        }

        if not yf_stocks:
            return

        self.stdout.write(
            f'初回取得モード: {len(yf_stocks)}銘柄を一括取得します'
        )

        ticker_list = list(yf_stocks.keys())
        batch_result = fetch_yahoo_chart_batch(
            ticker_list, range_='max', interval='1d',
        )

        total_saved = 0
        total_records = 0
        for ticker, records in batch_result.items():
            name = yf_stocks.get(ticker, ticker)
            for rec in records:
                date_val = rec['date'].date()
                DailyStockPrice.objects.update_or_create(
                    ticker=ticker,
                    date=date_val,
                    defaults={
                        'name': name,
                        'open': rec['open'],
                        'high': rec['high'],
                        'low': rec['low'],
                        'close': rec['close'],
                        'volume': rec['volume'],
                    },
                )
                total_records += 1
            total_saved += 1

        StockFetchLog.objects.create(
            tickers_count=total_saved, success=True,
            message=f'日足初回: {total_saved}銘柄, {total_records}件保存',
        )
        self.stdout.write(self.style.SUCCESS(
            f'合計: {total_saved}銘柄, {total_records}件の日足データを保存しました'
        ))
