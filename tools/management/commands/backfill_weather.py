"""
Open-Meteo Archive API から過去の天気データを一括取得して DB に保存する。

使い方:
  python manage.py backfill_weather              # 1940年〜昨日まで全取得
  python manage.py backfill_weather --year 2020  # 2020年のみ取得
"""
import json
import logging
import time
import urllib.error
import urllib.request

from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from tools.models import WeatherForecast
from tools.weather_cities import CITIES

logger = logging.getLogger(__name__)

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


class Command(BaseCommand):
    help = '過去の天気データを一括取得して DB に保存する'

    def add_arguments(self, parser):
        parser.add_argument(
            '--year', type=int, default=None,
            help='特定の年だけ取得する（省略時は1940年〜昨日）',
        )

    def handle(self, *args, **options):
        year = options['year']
        yesterday = date.today() - timedelta(days=1)

        if year:
            start = date(year, 1, 1)
            end = min(date(year, 12, 31), yesterday)
            ranges = [(start, end)]
        else:
            # 1940年〜昨日を年単位でチャンク
            ranges = []
            for y in range(1940, yesterday.year + 1):
                start = date(y, 1, 1)
                end = min(date(y, 12, 31), yesterday)
                ranges.append((start, end))

        total_saved = 0
        for start, end in ranges:
            # その年のデータが既に十分あればスキップ（10都市 × 日数）
            expected_days = (end - start).days + 1
            expected_total = expected_days * len(CITIES)
            existing_count = WeatherForecast.objects.filter(
                forecast_date__gte=start,
                forecast_date__lte=end,
            ).count()
            if existing_count >= expected_total:
                self.stdout.write(f'  {start.year}: スキップ（{existing_count}件取得済み）')
                continue

            # 429 リトライ（最大5回、待機時間を増やす）
            for attempt in range(5):
                try:
                    saved = self._fetch_range(start, end)
                    total_saved += saved
                    self.stdout.write(f'  {start.year}: {saved}件保存')
                    break
                except urllib.error.HTTPError as e:
                    if e.code == 429 and attempt < 4:
                        wait = 60 * (attempt + 1)
                        self.stdout.write(f'  {start.year}: レート制限、{wait}秒待機... (試行{attempt + 1}/5)')
                        time.sleep(wait)
                    else:
                        self.stderr.write(f'  {start.year}: エラー - {e}')
                        logger.error('天気バックフィル %s: %s', start.year, e)
                        break
                except Exception as e:
                    self.stderr.write(f'  {start.year}: エラー - {e}')
                    logger.error('天気バックフィル %s: %s', start.year, e)
                    break
            # API レート制限対策
            time.sleep(10)

        self.stdout.write(self.style.SUCCESS(
            f'完了: 合計 {total_saved}件保存'
        ))

    def _fetch_range(self, start, end):
        keys = list(CITIES.keys())
        lats = ",".join(str(CITIES[k]["lat"]) for k in keys)
        lons = ",".join(str(CITIES[k]["lon"]) for k in keys)

        url = (
            f"{ARCHIVE_URL}?"
            f"latitude={lats}&longitude={lons}"
            f"&start_date={start}&end_date={end}"
            f"&daily=weather_code,temperature_2m_max,temperature_2m_min,"
            f"precipitation_probability_max"
            f"&timezone=Asia%2FTokyo"
        )

        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data_list = json.loads(resp.read().decode())

        now = timezone.now()
        objs_to_create = []
        objs_to_update = []

        # 既存データの (city_key, forecast_date) を取得して重複チェック
        existing = set(
            WeatherForecast.objects.filter(
                forecast_date__gte=start,
                forecast_date__lte=end,
            ).values_list('city_key', 'forecast_date')
        )

        for i, city_key in enumerate(keys):
            item = data_list[i] if isinstance(data_list, list) else data_list
            city_name = CITIES[city_key]["name"]
            daily = item.get("daily", {})

            times = daily.get("time", [])
            codes = daily.get("weather_code", [])
            maxs = daily.get("temperature_2m_max", [])
            mins = daily.get("temperature_2m_min", [])
            probs = daily.get("precipitation_probability_max", [])

            for j, date_str in enumerate(times):
                forecast_date = date.fromisoformat(date_str)
                if (city_key, forecast_date) in existing:
                    continue

                objs_to_create.append(WeatherForecast(
                    city_key=city_key,
                    city_name=city_name,
                    forecast_date=forecast_date,
                    weather_code=codes[j] if codes[j] is not None else 0,
                    temp_max=maxs[j] if maxs[j] is not None else 0,
                    temp_min=mins[j] if mins[j] is not None else 0,
                    precipitation_prob=probs[j] if probs[j] is not None else 0,
                    fetched_at=now,
                ))

        if objs_to_create:
            WeatherForecast.objects.bulk_create(objs_to_create, batch_size=1000)

        return len(objs_to_create)
