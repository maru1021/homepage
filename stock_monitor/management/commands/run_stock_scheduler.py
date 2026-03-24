"""
APScheduler ベースの株価データ取得スケジューラ。

ジョブ:
  - 仮想通貨 分足取得: 5分間隔（24時間365日、CoinGecko）
  - 株・為替 分足取得: 30分間隔（市場開場時のみ、yfinance）
  - 米国株+為替+指数ETF 日足取得: 平日 6:30 JST（yfinance）
  - 日本株+指数ETF 日足取得: 平日 15:10 JST（yfinance）
  - 仮想通貨 日足取得: 毎日 15:10 JST（CoinGecko）
  - ファンダメンタルズ取得: 平日 16:00 JST（yfinance）

yfinance 系ジョブは排他ロックで同時実行を防止し、レートリミットを回避する。

使い方:
  python manage.py run_stock_scheduler
"""
import gc
import logging
import threading

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django import db

from stock_monitor.config import JST

logger = logging.getLogger(__name__)

# yfinance 系ジョブの排他ロック（同時実行防止）
_yf_lock = threading.Lock()


def _cleanup():
    """ジョブ完了後にDB接続を閉じ、GCを実行してメモリを解放する"""
    db.close_old_connections()
    gc.collect()


def _run_command(label, *args):
    """管理コマンドを実行し、エラーをログに記録する"""
    try:
        call_command(*args)
    except Exception as e:
        logger.error('%s エラー: %s', label, e)
    finally:
        _cleanup()


def _run_command_with_lock(label, *args):
    """排他ロック付きで管理コマンドを実行する（最大5分待機）"""
    acquired = _yf_lock.acquire(timeout=300)
    if not acquired:
        logger.warning('%s: ロック取得タイムアウト（他ジョブ実行中）、スキップします', label)
        return
    try:
        _run_command(label, *args)  # _run_command 内で _cleanup() 実行済み
    finally:
        _yf_lock.release()


class Command(BaseCommand):
    help = 'APScheduler で株価取得ジョブを定期実行する'

    def handle(self, *args, **options):
        scheduler = BlockingScheduler(timezone=JST)

        # 仮想通貨 分足取得: 5分間隔（CoinGecko — ロック不要）
        scheduler.add_job(
            _run_command, args=('仮想通貨分足', 'fetch_stock_prices', '--once', '--crypto-only'),
            trigger=IntervalTrigger(minutes=5),
            id='crypto_intraday_fetch',
            name='仮想通貨 分足データ取得',
        )

        # 株・為替 分足取得: 30分間隔（yfinance — ロック取得）
        scheduler.add_job(
            _run_command_with_lock, args=('株為替分足', 'fetch_stock_prices', '--once', '--exclude-crypto'),
            trigger=IntervalTrigger(minutes=30),
            id='intraday_fetch',
            name='株・為替 分足データ取得',
        )

        # 米国株+為替+指数ETF 日足取得: 平日 6:30 JST（yfinance — ロック取得）
        # 米国市場は 6:00 JST に閉場するため、30分後に取得
        scheduler.add_job(
            _run_command_with_lock,
            args=('米国日足', 'fetch_daily_stock_prices', '--once',
                  '--categories', 'us_stock', 'forex', 'index_etf'),
            trigger=CronTrigger(hour=6, minute=30, day_of_week='tue-sat', timezone=JST),
            id='daily_fetch_us',
            name='米国株+為替+指数ETF 日足取得',
        )

        # 日本株+指数ETF 日足取得: 平日 15:10 JST（yfinance — ロック取得）
        scheduler.add_job(
            _run_command_with_lock,
            args=('日本日足', 'fetch_daily_stock_prices', '--once',
                  '--categories', 'jp_stock', 'index_etf'),
            trigger=CronTrigger(hour=15, minute=10, day_of_week='mon-fri', timezone=JST),
            id='daily_fetch_jp',
            name='日本株+指数ETF 日足取得',
        )

        # 仮想通貨 日足取得: 毎日 15:10 JST（CoinGecko — ロック不要）
        scheduler.add_job(
            _run_command,
            args=('仮想通貨日足', 'fetch_daily_stock_prices', '--once', '--crypto-only'),
            trigger=CronTrigger(hour=15, minute=10, timezone=JST),
            id='daily_fetch_crypto',
            name='仮想通貨 日足取得',
        )

        # ファンダメンタルズ取得: 平日 16:00 JST（yfinance — ロック取得）
        scheduler.add_job(
            _run_command_with_lock, args=('ファンダメンタルズ', 'fetch_fundamentals', '--once'),
            trigger=CronTrigger(hour=16, minute=0, day_of_week='mon-fri', timezone=JST),
            id='fundamentals_fetch',
            name='ファンダメンタルズ取得',
        )

        self.stdout.write(self.style.SUCCESS(
            '株価取得スケジューラを起動しました'
        ))
        self.stdout.write('  仮想通貨 分足: 5分間隔')
        self.stdout.write('  株・為替 分足: 30分間隔')
        self.stdout.write('  米国日足: 平日(火〜土) 6:30 JST')
        self.stdout.write('  日本日足: 平日(月〜金) 15:10 JST')
        self.stdout.write('  仮想通貨日足: 毎日 15:10 JST')
        self.stdout.write('  ファンダメンタルズ: 平日 16:00 JST')

        try:
            scheduler.start()
        except (KeyboardInterrupt, SystemExit):
            self.stdout.write('スケジューラを停止します')
