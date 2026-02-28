import json
import logging
import urllib.request

from datetime import date

from django.core.management.base import BaseCommand
from django.utils import timezone

from tools.models import WeatherForecast
from tools.weather_cities import CITIES

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = '天気データを Open-Meteo API から取得して DB に保存する'

    def handle(self, *args, **options):
        try:
            self._fetch_and_save()
        except Exception as e:
            logger.error('天気データ取得エラー: %s', e)
            self.stderr.write(f'エラー: {e}')

    def _fetch_and_save(self):
        keys = list(CITIES.keys())
        lats = ",".join(str(CITIES[k]["lat"]) for k in keys)
        lons = ",".join(str(CITIES[k]["lon"]) for k in keys)

        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lats}&longitude={lons}"
            f"&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m"
            f"&daily=weather_code,temperature_2m_max,temperature_2m_min,"
            f"precipitation_probability_max"
            f"&timezone=Asia%2FTokyo&forecast_days=7"
        )

        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data_list = json.loads(resp.read().decode())

        now = timezone.now()
        today = date.today()

        for i, city_key in enumerate(keys):
            item = data_list[i] if isinstance(data_list, list) else data_list
            city_name = CITIES[city_key]["name"]
            current = item.get("current", {})
            daily = item.get("daily", {})

            for j, date_str in enumerate(daily.get("time", [])):
                forecast_date = date.fromisoformat(date_str)
                defaults = {
                    "city_name": city_name,
                    "weather_code": daily["weather_code"][j],
                    "temp_max": daily["temperature_2m_max"][j],
                    "temp_min": daily["temperature_2m_min"][j],
                    "precipitation_prob": daily["precipitation_probability_max"][j],
                    "fetched_at": now,
                }
                # 当日分には current データを含める
                if forecast_date == today:
                    defaults["temperature"] = current.get("temperature_2m")
                    defaults["humidity"] = current.get("relative_humidity_2m")
                    defaults["wind_speed"] = current.get("wind_speed_10m")
                    defaults["current_weather_code"] = current.get("weather_code")

                WeatherForecast.objects.update_or_create(
                    city_key=city_key,
                    forecast_date=forecast_date,
                    defaults=defaults,
                )

        self.stdout.write(self.style.SUCCESS(
            f'[{now:%H:%M:%S}] {len(keys)}都市の天気データを保存しました'
        ))
