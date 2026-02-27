"""
株価データ取得の統合コマンド。
- 分足: 5分間隔で取得（市場時間中）
- 日足: 閉場後（15:10 JST）に1日1回取得

使い方:
  python manage.py fetch_stock_prices          # ループ実行
  python manage.py fetch_stock_prices --once   # 1回だけ実行して終了
"""
import time
import logging

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone

from django.db.models import Max

from stock_monitor.config import (
    CATEGORY_LABELS, DAILY_CLOSE_MINUTES, FETCH_INTERVAL,
    INTRADAY_RETENTION_DAYS, INTRADAY_OVERLAP_MINUTES, JST,
    MARKET_OVERVIEW_BY_CATEGORY, STOCKS,
    STOCKS_BY_CATEGORY, get_active_categories, is_market_open,
)
from stock_monitor.models import DailyStockPrice, StockFetchLog, StockPrice
from stock_monitor.utils import batch_download, build_ohlcv_defaults, parse_ohlcv

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = '株価データを yfinance から取得して DB に保存する（分足+日足）'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._daily_fetched_date = None  # 当日の日足取得済みフラグ

    def add_arguments(self, parser):
        parser.add_argument(
            '--once', action='store_true',
            help='1回だけ実行して終了',
        )

    def handle(self, *args, **options):
        once = options['once']
        self.stdout.write(f'株価取得を開始します（間隔: {FETCH_INTERVAL}秒, 銘柄数: {len(STOCKS)}）')

        # 初回起動時: 日足データがなければ全期間取得
        if not DailyStockPrice.objects.exists():
            self.stdout.write('日足データが未取得のため、初回取得を実行します...')
            try:
                call_command('fetch_daily_stock_prices', '--once')
            except Exception as e:
                logger.error(f'初回日足取得エラー: {e}')
                self.stderr.write(f'初回日足取得エラー: {e}')

        while True:
            active = get_active_categories()
            if not active:
                self.stdout.write('全市場が閉場中のため分足取得をスキップします')
            else:
                active_labels = ', '.join(
                    CATEGORY_LABELS.get(c, c) for c in active
                )
                self.stdout.write(f'アクティブ市場: {active_labels}')
                try:
                    self._fetch_intraday(active)
                except Exception as e:
                    logger.error(f'分足取得エラー: {e}')
                    StockFetchLog.objects.create(
                        tickers_count=0, success=False, message=str(e),
                    )
                    self.stderr.write(f'エラー: {e}')

            # 閉場後に日足を取得（15:10 JST 以降、1日1回）
            self._try_fetch_daily()

            if once:
                break

            self.stdout.write(f'次の取得まで {FETCH_INTERVAL}秒 待機...')
            time.sleep(FETCH_INTERVAL)

    def _try_fetch_daily(self):
        now_jst = timezone.now().astimezone(JST)
        today = now_jst.date()
        # 平日の15:10以降で、まだ当日取得していない場合
        if (now_jst.weekday() < 5
                and now_jst.hour * 60 + now_jst.minute >= DAILY_CLOSE_MINUTES
                and self._daily_fetched_date != today):
            # 分足取得との間隔を空ける
            self.stdout.write('閉場後の日足データ取得を60秒後に実行...')
            time.sleep(60)
            try:
                call_command('fetch_daily_stock_prices', '--once')
                self._daily_fetched_date = today
                self.stdout.write(self.style.SUCCESS('日足データ取得完了'))
            except Exception as e:
                logger.error(f'日足取得エラー: {e}')
                self.stderr.write(f'日足取得エラー: {e}')

    def _fetch_intraday(self, active_categories):
        self.stdout.write(f'[{timezone.now():%H:%M:%S}] 分足データ取得中...')

        # アクティブなカテゴリの銘柄 + 概況ティッカーのみ取得
        all_tickers = {}
        for cat in active_categories:
            all_tickers.update(STOCKS_BY_CATEGORY.get(cat, {}))
            for items in MARKET_OVERVIEW_BY_CATEGORY.get(cat, {}).values():
                for ticker, name in items:
                    all_tickers[ticker] = name
        data = batch_download(
            list(all_tickers.keys()), period='1d', interval='1m',
        )

        if data.empty:
            self.stderr.write('データが空です（レートリミットまたは市場時間外の可能性）')
            StockFetchLog.objects.create(
                tickers_count=0, success=False,
                message='データ空（レートリミットまたは市場時間外）',
            )
            return

        # 銘柄ごとのDB最新タイムスタンプを一括取得
        cutoff_map = {}
        latest_by_ticker = (
            StockPrice.objects
            .filter(ticker__in=all_tickers.keys())
            .values('ticker')
            .annotate(latest=Max('timestamp'))
        )
        overlap = timezone.timedelta(minutes=INTRADAY_OVERLAP_MINUTES)
        for row in latest_by_ticker:
            cutoff_map[row['ticker']] = row['latest'] - overlap

        saved_count = 0
        new_records = 0
        for ticker, name in all_tickers.items():
            try:
                if ticker not in data.columns.get_level_values(0):
                    continue

                o, h, l, c, v, valid_idx = parse_ohlcv(data[ticker])
                cutoff_ts = cutoff_map.get(ticker)
                for ts in valid_idx:
                    ts_dt = ts.to_pydatetime()
                    # カットオフ以前のデータはスキップ（既に保存済み）
                    if cutoff_ts and ts_dt < cutoff_ts:
                        continue
                    StockPrice.objects.update_or_create(
                        ticker=ticker,
                        timestamp=ts_dt,
                        defaults=build_ohlcv_defaults(name, o, h, l, c, v, ts),
                    )
                    new_records += 1
                saved_count += 1
            except (KeyError, IndexError) as e:
                logger.warning(f'{ticker} のデータ解析エラー: {e}')
                continue

        # 古いデータを削除
        cutoff = timezone.now() - timezone.timedelta(days=INTRADAY_RETENTION_DAYS)
        deleted, _ = StockPrice.objects.filter(timestamp__lt=cutoff).delete()

        StockFetchLog.objects.create(
            tickers_count=saved_count, success=True,
            message=f'{saved_count}銘柄, {new_records}件保存, {deleted}件削除',
        )
        # ログも古いものを削除（100件以上残っている場合）
        old_log_ids = list(
            StockFetchLog.objects.order_by('-fetched_at')
            .values_list('id', flat=True)[100:]
        )
        if old_log_ids:
            StockFetchLog.objects.filter(id__in=old_log_ids).delete()

        self.stdout.write(self.style.SUCCESS(
            f'[{timezone.now():%H:%M:%S}] {saved_count}銘柄, {new_records}件を保存しました'
        ))
