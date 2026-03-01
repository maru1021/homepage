"""
分足データを取得して DB に保存する管理コマンド。

使い方:
  python manage.py fetch_stock_prices --once                # 全市場（アクティブなもの）
  python manage.py fetch_stock_prices --once --crypto-only  # 仮想通貨のみ
  python manage.py fetch_stock_prices --once --exclude-crypto  # 仮想通貨を除外

※ 定期実行は run_stock_scheduler コマンド（APScheduler）で管理。
"""
import logging

from django.core.management.base import BaseCommand
from django.db.models import Max
from django.utils import timezone

from stock_monitor.config import (
    CATEGORY_CRYPTO, CATEGORY_LABELS, CRYPTO_COINGECKO_MAP,
    INTRADAY_RETENTION_DAYS,
    INTRADAY_OVERLAP_MINUTES, MARKET_OVERVIEW_BY_CATEGORY,
    STOCKS_BY_CATEGORY, get_active_categories,
)
from stock_monitor.models import StockFetchLog, StockPrice
from stock_monitor.utils import fetch_crypto_from_coingecko, fetch_yahoo_chart_batch

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = '分足の株価データを取得して DB に保存する'

    def add_arguments(self, parser):
        parser.add_argument(
            '--once', action='store_true',
            help='1回だけ実行して終了（互換性のため残存）',
        )
        parser.add_argument(
            '--crypto-only', action='store_true',
            help='仮想通貨のみ取得（高頻度取得用）',
        )
        parser.add_argument(
            '--exclude-crypto', action='store_true',
            help='仮想通貨を除外（仮想通貨は別ジョブで取得）',
        )

    def handle(self, *args, **options):
        if options['crypto_only']:
            active = [CATEGORY_CRYPTO]
        else:
            active = get_active_categories()
            if options['exclude_crypto']:
                active = [c for c in active if c != CATEGORY_CRYPTO]
            if not active:
                self.stdout.write('全市場が閉場中のため分足取得をスキップします')
                return

        active_labels = ', '.join(
            CATEGORY_LABELS.get(c, c) for c in active
        )
        self.stdout.write(f'アクティブ市場: {active_labels}')

        try:
            self._fetch_intraday(active)
        except Exception as e:
            logger.error('分足取得エラー: %s', e)
            StockFetchLog.objects.create(
                tickers_count=0, success=False, message=str(e),
            )
            self.stderr.write(f'エラー: {e}')

    def _fetch_intraday(self, active_categories):
        self.stdout.write(f'[{timezone.now():%H:%M:%S}] 分足データ取得中...')

        # アクティブなカテゴリの銘柄 + 概況ティッカーのみ取得
        all_tickers = {}
        for cat in active_categories:
            all_tickers.update(STOCKS_BY_CATEGORY.get(cat, {}))
            for items in MARKET_OVERVIEW_BY_CATEGORY.get(cat, {}).values():
                for ticker, name in items:
                    all_tickers[ticker] = name

        saved_count = 0
        new_records = 0

        # --- 仮想通貨: CoinGecko API から取得 ---
        crypto_tickers = {}
        if CATEGORY_CRYPTO in active_categories:
            crypto_tickers = STOCKS_BY_CATEGORY.get(CATEGORY_CRYPTO, {})
            for items in MARKET_OVERVIEW_BY_CATEGORY.get(
                CATEGORY_CRYPTO, {},
            ).values():
                for ticker, name in items:
                    if ticker in CRYPTO_COINGECKO_MAP:
                        crypto_tickers[ticker] = name

            crypto_data = fetch_crypto_from_coingecko(CRYPTO_COINGECKO_MAP)
            if crypto_data:
                now = timezone.now()
                for ticker, name in crypto_tickers.items():
                    if ticker in crypto_data:
                        d = crypto_data[ticker]
                        StockPrice.objects.update_or_create(
                            ticker=ticker, timestamp=now,
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
                        new_records += 1
                self.stdout.write(
                    f'  CoinGecko: {len(crypto_data)}銘柄取得'
                )
            else:
                self.stderr.write('  CoinGecko: 取得失敗')

        # --- その他: yf.download() で一括取得 ---
        yf_tickers = {
            t: n for t, n in all_tickers.items()
            if t not in crypto_tickers
        }

        if not yf_tickers:
            self._finalize_intraday(saved_count, new_records)
            return

        ticker_list = list(yf_tickers.keys())
        self.stdout.write(f'  yf.download(): {len(ticker_list)}銘柄を一括取得')

        # 銘柄ごとのDB最新タイムスタンプを一括取得
        cutoff_map = {}
        latest_by_ticker = (
            StockPrice.objects
            .filter(ticker__in=ticker_list)
            .values('ticker')
            .annotate(latest=Max('timestamp'))
        )
        overlap = timezone.timedelta(minutes=INTRADAY_OVERLAP_MINUTES)
        for row in latest_by_ticker:
            cutoff_map[row['ticker']] = row['latest'] - overlap

        # 一括取得
        batch_result = fetch_yahoo_chart_batch(
            ticker_list, range_='1d', interval='1m',
        )

        for ticker, records in batch_result.items():
            name = yf_tickers.get(ticker, ticker)
            cutoff_ts = cutoff_map.get(ticker)
            for rec in records:
                ts_dt = rec['date']
                if cutoff_ts and ts_dt < cutoff_ts:
                    continue
                StockPrice.objects.update_or_create(
                    ticker=ticker,
                    timestamp=ts_dt,
                    defaults={
                        'name': name,
                        'open': rec['open'],
                        'high': rec['high'],
                        'low': rec['low'],
                        'close': rec['close'],
                        'volume': rec['volume'],
                    },
                )
                new_records += 1
            saved_count += 1

        self.stdout.write(
            f'  yf.download(): {len(batch_result)}銘柄のデータを取得'
        )
        self._finalize_intraday(saved_count, new_records)

    def _finalize_intraday(self, saved_count, new_records):
        """古いデータ削除・ログ記録"""
        cutoff = timezone.now() - timezone.timedelta(days=INTRADAY_RETENTION_DAYS)
        deleted, _ = StockPrice.objects.filter(timestamp__lt=cutoff).delete()

        StockFetchLog.objects.create(
            tickers_count=saved_count, success=True,
            message=f'{saved_count}銘柄, {new_records}件保存, {deleted}件削除',
        )
        old_log_ids = list(
            StockFetchLog.objects.order_by('-fetched_at')
            .values_list('id', flat=True)[100:]
        )
        if old_log_ids:
            StockFetchLog.objects.filter(id__in=old_log_ids).delete()

        self.stdout.write(self.style.SUCCESS(
            f'[{timezone.now():%H:%M:%S}] {saved_count}銘柄, {new_records}件を保存しました'
        ))
