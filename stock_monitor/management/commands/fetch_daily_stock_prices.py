"""
日足データを yfinance から取得し DB に保存する管理コマンド。

使い方:
  python manage.py fetch_daily_stock_prices --once   # 1回だけ実行

初回（DBにデータなし）: 全期間を1銘柄ずつ取得（レートリミット回避のため間隔を空ける）
2回目以降: 全銘柄一括で直近5日分を取得
"""
import time
import logging

from django.core.management.base import BaseCommand

import yfinance as yf

from stock_monitor.config import (
    CRYPTO_COINGECKO_MAP, DAILY_FETCH_DELAY, STOCKS,
)
from stock_monitor.models import DailyStockPrice, StockFetchLog
from stock_monitor.utils import (
    batch_download, build_ohlcv_defaults, fetch_crypto_from_coingecko,
    parse_ohlcv,
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = '日足の株価データを yfinance から取得して DB に保存する'

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
            # 完全初回: 全銘柄を1つずつ取得
            self._fetch_initial(STOCKS)
        else:
            # 既存銘柄は直近5日分をバッチ更新
            self._fetch_bulk_update()
            # 新規銘柄があれば全期間を1つずつ取得
            if new_tickers:
                self.stdout.write(
                    f'新規銘柄 {len(new_tickers)}件 の過去データを取得します...'
                )
                self._fetch_initial(new_tickers)

        self.stdout.write(self.style.SUCCESS('日足データ取得完了'))

    def _fetch_bulk_update(self):
        """2回目以降: 全銘柄をバッチ分割で直近5日分取得"""
        self.stdout.write('更新モード: 直近5日分をバッチ取得')

        data = batch_download(list(STOCKS.keys()), period='5d', interval='1d')

        if data.empty:
            self.stderr.write('データ空')
            return

        saved_count = 0
        total_records = 0
        failed_crypto = {}
        for ticker, name in STOCKS.items():
            try:
                if ticker not in data.columns.get_level_values(0):
                    # yfinance で取得できなかった仮想通貨を記録
                    if ticker in CRYPTO_COINGECKO_MAP:
                        failed_crypto[ticker] = name
                    continue
                records = self._save_ticker_data(data[ticker], ticker, name)
                total_records += records
                saved_count += 1
            except (KeyError, IndexError) as e:
                logger.warning(f'{ticker}: {e}')
                if ticker in CRYPTO_COINGECKO_MAP:
                    failed_crypto[ticker] = name

        # yfinance で失敗した仮想通貨を CoinGecko でフォールバック
        if failed_crypto:
            cg_map = {
                t: CRYPTO_COINGECKO_MAP[t] for t in failed_crypto
            }
            cg_data = fetch_crypto_from_coingecko(cg_map)
            if cg_data:
                from django.utils import timezone
                from stock_monitor.config import JST
                today = timezone.now().astimezone(JST).date()
                for ticker, name in failed_crypto.items():
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
                self.stdout.write(
                    f'CoinGecko フォールバック: {len(cg_data)}/{len(failed_crypto)}銘柄'
                )

        StockFetchLog.objects.create(
            tickers_count=saved_count, success=True,
            message=f'日足更新: {saved_count}銘柄, {total_records}件',
        )
        self.stdout.write(f'{saved_count}銘柄, {total_records}件を更新')

    def _fetch_initial(self, stocks_dict):
        """1銘柄ずつ全期間取得（レートリミット回避）"""
        self.stdout.write(f'初回取得モード: {len(stocks_dict)}銘柄を1つずつ取得します')

        total_saved = 0
        total_records = 0
        items = list(stocks_dict.items())

        for i, (ticker, name) in enumerate(items):
            self.stdout.write(f'[{i+1}/{len(items)}] {name}({ticker}) を取得中...')

            try:
                data = yf.download(
                    ticker, period='max', interval='1d',
                    progress=False, threads=False,
                )
            except Exception as e:
                logger.warning(f'{ticker} ダウンロードエラー: {e}')
                self.stderr.write(f'  エラー: {e}')
                time.sleep(DAILY_FETCH_DELAY)
                continue

            if data.empty:
                self.stderr.write(f'  データ空')
                time.sleep(DAILY_FETCH_DELAY)
                continue

            try:
                records = self._save_ticker_data(data, ticker, name)
                total_records += records
                total_saved += 1
                self.stdout.write(f'  {records}件保存')
            except Exception as e:
                logger.warning(f'{ticker} 保存エラー: {e}')
                self.stderr.write(f'  保存エラー: {e}')

            if i < len(items) - 1:
                time.sleep(DAILY_FETCH_DELAY)

        StockFetchLog.objects.create(
            tickers_count=total_saved, success=True,
            message=f'日足初回: {total_saved}銘柄, {total_records}件保存',
        )
        self.stdout.write(self.style.SUCCESS(
            f'合計: {total_saved}銘柄, {total_records}件の日足データを保存しました'
        ))

    def _save_ticker_data(self, td, ticker, name):
        """DataFrameから日足データを保存し、保存件数を返す"""
        o, h, l, c, v, valid_idx = parse_ohlcv(td)

        count = 0
        for ts in valid_idx:
            dt = ts.to_pydatetime()
            date_val = dt.date() if hasattr(dt, 'date') else dt
            DailyStockPrice.objects.update_or_create(
                ticker=ticker,
                date=date_val,
                defaults=build_ohlcv_defaults(name, o, h, l, c, v, ts),
            )
            count += 1
        return count
