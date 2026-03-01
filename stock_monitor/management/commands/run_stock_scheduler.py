"""
APScheduler ベースの株価データ取得スケジューラ。

ジョブ:
  - 分足取得: 30分間隔（起動時に即時実行 + 以降30分ごと）
  - 日足取得: 平日 15:10 JST に1回
  - ファンダメンタルズ取得: 平日 16:00 JST に1回

使い方:
  python manage.py run_stock_scheduler
"""
import logging

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from django.core.management import call_command
from django.core.management.base import BaseCommand

from stock_monitor.config import JST

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'APScheduler で株価取得ジョブを定期実行する'

    def handle(self, *args, **options):
        scheduler = BlockingScheduler(timezone=JST)

        # 分足取得: 30分間隔
        scheduler.add_job(
            self._run_intraday,
            IntervalTrigger(minutes=30),
            id='intraday_fetch',
            name='分足データ取得',
        )

        # 日足取得: 平日 15:10 JST
        scheduler.add_job(
            self._run_daily,
            CronTrigger(
                hour=15, minute=10,
                day_of_week='mon-fri',
                timezone=JST,
            ),
            id='daily_fetch',
            name='日足データ取得',
        )

        # ファンダメンタルズ取得: 平日 16:00 JST
        scheduler.add_job(
            self._run_fundamentals,
            CronTrigger(
                hour=16, minute=0,
                day_of_week='mon-fri',
                timezone=JST,
            ),
            id='fundamentals_fetch',
            name='ファンダメンタルズ取得',
        )

        self.stdout.write(self.style.SUCCESS(
            '株価取得スケジューラを起動しました'
        ))
        self.stdout.write('  分足: 30分間隔')
        self.stdout.write('  日足: 平日 15:10 JST')
        self.stdout.write('  ファンダメンタルズ: 平日 16:00 JST')

        try:
            scheduler.start()
        except (KeyboardInterrupt, SystemExit):
            self.stdout.write('スケジューラを停止します')

    def _run_intraday(self):
        self.stdout.write('分足取得ジョブを実行...')
        try:
            call_command('fetch_stock_prices', '--once')
        except Exception as e:
            logger.error(f'分足取得エラー: {e}')
            self.stderr.write(f'分足取得エラー: {e}')

    def _run_daily(self):
        self.stdout.write('日足取得ジョブを実行...')
        try:
            call_command('fetch_daily_stock_prices', '--once')
        except Exception as e:
            logger.error(f'日足取得エラー: {e}')
            self.stderr.write(f'日足取得エラー: {e}')

    def _run_fundamentals(self):
        self.stdout.write('ファンダメンタルズ取得ジョブを実行...')
        try:
            call_command('fetch_fundamentals', '--once')
        except Exception as e:
            logger.error(f'ファンダメンタルズ取得エラー: {e}')
            self.stderr.write(f'ファンダメンタルズ取得エラー: {e}')
