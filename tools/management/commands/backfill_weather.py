"""
Open-Meteo Archive API から過去の天気データを取得する。

Phase 1: ローカルCSVに保存（Django不要のスタンドアロン実行も可能）
Phase 2: CSVをサーバーDBにインポート

使い方:
  # CSVに取得（Django管理コマンドとして）
  python manage.py backfill_weather
  python manage.py backfill_weather --year 2020

  # スタンドアロン実行（Django不要）
  python backfill_weather.py
  python backfill_weather.py --year 2020

  # CSVからDBにインポート
  python manage.py backfill_weather --import-csv
"""
import csv
import json
import logging
import os
import sys
import time
import urllib.error
import urllib.request

from datetime import date, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

CITIES = {
    "tokyo": {"name": "東京", "lat": 35.6762, "lon": 139.6503},
    "osaka": {"name": "大阪", "lat": 34.6937, "lon": 135.5023},
    "nagoya": {"name": "名古屋", "lat": 35.1815, "lon": 136.9066},
    "fukuoka": {"name": "福岡", "lat": 33.5904, "lon": 130.4017},
    "sapporo": {"name": "札幌", "lat": 43.0618, "lon": 141.3545},
    "sendai": {"name": "仙台", "lat": 38.2682, "lon": 140.8694},
    "hiroshima": {"name": "広島", "lat": 34.3853, "lon": 132.4553},
    "naha": {"name": "那覇", "lat": 26.2124, "lon": 127.6809},
    "niigata": {"name": "新潟", "lat": 37.9026, "lon": 139.0236},
    "kanazawa": {"name": "金沢", "lat": 36.5613, "lon": 136.6562},
}

# ファイルパス
DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "weather_data"
CSV_FILE = DATA_DIR / "weather_history.csv"
PROGRESS_FILE = DATA_DIR / "progress.json"

CSV_FIELDS = ["city_key", "city_name", "forecast_date", "weather_code",
              "temp_max", "temp_min", "precipitation_prob"]


def load_progress():
    """進捗ファイルを読み込む。完了済みの (year, city_key) セットを返す。"""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            data = json.load(f)
        return set(tuple(x) for x in data.get("completed", []))
    return set()


def save_progress(completed):
    """進捗をファイルに保存する。"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(PROGRESS_FILE, "w") as f:
        json.dump({"completed": list(completed)}, f, indent=2)


def fetch_city_year(city_key, start, end):
    """1都市・1年分のデータをAPIから取得してCSVに追記する。"""
    city = CITIES[city_key]

    url = (
        f"{ARCHIVE_URL}?"
        f"latitude={city['lat']}&longitude={city['lon']}"
        f"&start_date={start}&end_date={end}"
        f"&daily=weather_code,temperature_2m_max,temperature_2m_min,"
        f"precipitation_probability_max"
        f"&timezone=Asia%2FTokyo"
    )

    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode())

    daily = data.get("daily", {})
    times = daily.get("time", [])
    codes = daily.get("weather_code", [])
    maxs = daily.get("temperature_2m_max", [])
    mins = daily.get("temperature_2m_min", [])
    probs = daily.get("precipitation_probability_max", [])

    rows = []
    for j, date_str in enumerate(times):
        rows.append({
            "city_key": city_key,
            "city_name": city["name"],
            "forecast_date": date_str,
            "weather_code": codes[j] if codes[j] is not None else 0,
            "temp_max": maxs[j] if maxs[j] is not None else 0,
            "temp_min": mins[j] if mins[j] is not None else 0,
            "precipitation_prob": probs[j] if probs[j] is not None else 0,
        })

    # CSVに追記
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    file_exists = CSV_FILE.exists()
    with open(CSV_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        if not file_exists:
            writer.writeheader()
        writer.writerows(rows)

    return len(rows)


def run_backfill(year=None):
    """メイン取得ループ。進捗を追跡しながら取得する。"""
    yesterday = date.today() - timedelta(days=1)

    if year:
        years = [year]
    else:
        years = list(range(1940, yesterday.year + 1))

    completed = load_progress()
    total_saved = 0
    city_keys = list(CITIES.keys())

    print(f"取得対象: {years[0]}年〜{years[-1]}年 × {len(city_keys)}都市")
    print(f"進捗: {len(completed)}件完了済み")
    print(f"CSV: {CSV_FILE}")
    print()

    for y in years:
        start = date(y, 1, 1)
        end = min(date(y, 12, 31), yesterday)

        year_saved = 0
        year_skipped = 0

        for city_key in city_keys:
            key = (y, city_key)
            if key in completed:
                year_skipped += 1
                continue

            # リトライ（429対策）
            for attempt in range(5):
                try:
                    saved = fetch_city_year(city_key, start, end)
                    year_saved += saved
                    completed.add(key)
                    save_progress(completed)
                    break
                except urllib.error.HTTPError as e:
                    if e.code == 429:
                        if attempt < 4:
                            wait = 60 * (attempt + 1)
                            print(f"  {y}/{city_key}: レート制限、{wait}秒待機... (試行{attempt + 1}/5)")
                            time.sleep(wait)
                        else:
                            print(f"  {y}/{city_key}: レート制限超過 - 明日再実行してください")
                            print(f"\n中断: 合計 {total_saved}件保存（進捗は保存済み）")
                            return
                    else:
                        print(f"  {y}/{city_key}: HTTPエラー {e.code} - {e}")
                        break
                except Exception as e:
                    print(f"  {y}/{city_key}: エラー - {e}")
                    break

            # 都市間の待機
            time.sleep(1)

        total_saved += year_saved
        status = f"{year_saved}件保存"
        if year_skipped:
            status += f"（{year_skipped}都市スキップ）"
        if year_skipped == len(city_keys):
            status = f"スキップ（全都市取得済み）"
        print(f"  {y}: {status}")

        # 年間の待機
        time.sleep(3)

    print(f"\n完了: 合計 {total_saved}件保存")
    print(f"CSV: {CSV_FILE}")


# ===== Django 管理コマンド =====
try:
    from django.core.management.base import BaseCommand
    from django.utils import timezone
    from tools.models import WeatherForecast

    class Command(BaseCommand):
        help = '過去の天気データを取得（CSV保存 or CSVからDBインポート）'

        def add_arguments(self, parser):
            parser.add_argument('--year', type=int, default=None,
                                help='特定の年だけ取得する')
            parser.add_argument('--import-csv', action='store_true',
                                help='CSVファイルからDBにインポートする')

        def handle(self, *args, **options):
            if options['import_csv']:
                self._import_csv()
            else:
                run_backfill(year=options['year'])

        def _import_csv(self):
            if not CSV_FILE.exists():
                self.stderr.write(f'CSVファイルが見つかりません: {CSV_FILE}')
                return

            now = timezone.now()
            batch = []
            imported = 0
            skipped = 0

            # 既存データ取得
            existing = set(
                WeatherForecast.objects.values_list('city_key', 'forecast_date')
            )

            with open(CSV_FILE, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    forecast_date = date.fromisoformat(row["forecast_date"])
                    city_key = row["city_key"]

                    if (city_key, forecast_date) in existing:
                        skipped += 1
                        continue

                    batch.append(WeatherForecast(
                        city_key=city_key,
                        city_name=row["city_name"],
                        forecast_date=forecast_date,
                        weather_code=int(float(row["weather_code"])),
                        temp_max=float(row["temp_max"]),
                        temp_min=float(row["temp_min"]),
                        precipitation_prob=float(row["precipitation_prob"]),
                        fetched_at=now,
                    ))

                    if len(batch) >= 5000:
                        WeatherForecast.objects.bulk_create(batch, batch_size=1000)
                        imported += len(batch)
                        self.stdout.write(f'  {imported}件インポート済み...')
                        batch = []

            if batch:
                WeatherForecast.objects.bulk_create(batch, batch_size=1000)
                imported += len(batch)

            self.stdout.write(self.style.SUCCESS(
                f'完了: {imported}件インポート / {skipped}件スキップ（既存）'
            ))

except ImportError:
    pass

# ===== スタンドアロン実行 =====
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="天気データバックフィル")
    parser.add_argument("--year", type=int, default=None)
    args = parser.parse_args()
    run_backfill(year=args.year)
