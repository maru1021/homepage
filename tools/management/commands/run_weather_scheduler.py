"""
天気データ定期取得スケジューラ。

ジョブ:
  - 天気取得: 1時間間隔（起動時に即時実行 + 以降1時間ごと）

使い方:
  python manage.py run_weather_scheduler
"""
import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger

from django.core.management import call_command
from django.core.management.base import BaseCommand

JST = ZoneInfo("Asia/Tokyo")
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'APScheduler で天気データ取得ジョブを定期実行する'

    def handle(self, *args, **options):
        # 起動時に即時1回実行
        self._run_fetch()

        scheduler = BlockingScheduler(timezone=JST)

        scheduler.add_job(
            self._run_fetch,
            IntervalTrigger(hours=1),
            id='weather_fetch',
            name='天気データ取得',
        )

        self.stdout.write(self.style.SUCCESS(
            '天気取得スケジューラを起動しました（1時間間隔）'
        ))

        try:
            scheduler.start()
        except (KeyboardInterrupt, SystemExit):
            self.stdout.write('スケジューラを停止します')

    def _run_fetch(self):
        self.stdout.write('天気データ取得ジョブを実行...')
        try:
            call_command('fetch_weather')
        except Exception as e:
            logger.error('天気データ取得エラー: %s', e)
            self.stderr.write(f'天気データ取得エラー: {e}')
