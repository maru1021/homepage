"""海底水深を opentopodata (GEBCO2020) からバッチ取得して SeafloorDepth にキャッシュする。

- 指定 bbox と LOD レベルのグリッド全セルを順に取得
- 既にキャッシュ済みのセル (同じ quantize, lat_q, lon_q) はスキップ → レジューム可
- 陸 (elevation >= 0) は保存しない
- opentopodata レート制限: 100 locations/req, 1 req/sec (無料枠 1000 req/day)
- --max-requests で 1 回の実行での上限を指定、本番転送 → 続き実行の運用を想定

Usage:
    python manage.py fetch_seafloor_depth --bbox 30,128,46,150 --level 2 --max-requests 800
    python manage.py fetch_seafloor_depth --bbox 34,138,36,142 --level 1 --max-requests 800 --clear
"""

import json
import math
import time
import urllib.error
import urllib.request

from django.core.management.base import BaseCommand, CommandError

from tools.models import SeafloorDepth


API_URL = "https://api.opentopodata.org/v1/gebco2020"
CHUNK = 100
SLEEP_SEC = 1.05


class Command(BaseCommand):
    help = "opentopodata GEBCO2020 から海底水深をバッチ取得してキャッシュ"

    def add_arguments(self, parser):
        parser.add_argument("--bbox", required=True, help="south,west,north,east (例: 30,128,46,150)")
        parser.add_argument("--level", type=int, default=2, choices=[0, 1, 2, 3], help="LOD レベル (0=細, 3=粗)")
        parser.add_argument("--max-requests", type=int, default=800, help="opentopodata への最大リクエスト数")
        parser.add_argument("--clear", action="store_true", help="実行前に SeafloorDepth を全削除")

    def handle(self, *args, **opts):
        try:
            s, w, n, e = (float(x) for x in opts["bbox"].split(","))
        except ValueError:
            raise CommandError("bbox は south,west,north,east で指定してください")
        if not (-90 <= s < n <= 90 and -180 <= w < e <= 180):
            raise CommandError("bbox の範囲が不正です")

        level = opts["level"]
        scale = SeafloorDepth.QUANTIZE_SCALES[level]
        max_requests = opts["max_requests"]

        if opts["clear"]:
            deleted, _ = SeafloorDepth.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"既存 SeafloorDepth を削除しました: {deleted} 行"))

        s_q = int(math.floor(s * scale))
        n_q = int(math.ceil(n * scale))
        w_q = int(math.floor(w * scale))
        e_q = int(math.ceil(e * scale))
        total_cells = (n_q - s_q + 1) * (e_q - w_q + 1)
        self.stdout.write(
            f"bbox={s},{w},{n},{e} level={level} scale=×{scale} "
            f"(≒{1 / scale:.4f}° / 約 {111 / scale:.1f}km) "
            f"総セル数 {total_cells:,} / 上限 {max_requests} req × {CHUNK} = 最大 {max_requests * CHUNK:,} 点"
        )

        existing = set(
            SeafloorDepth.objects.filter(
                quantize=level,
                lat_q__gte=s_q, lat_q__lte=n_q,
                lon_q__gte=w_q, lon_q__lte=e_q,
            ).values_list("lat_q", "lon_q")
        )
        self.stdout.write(f"キャッシュ済み: {len(existing):,} セル → 残 {total_cells - len(existing):,} セル")

        # 未取得セルを順に列挙
        pending = []
        for la_q in range(s_q, n_q + 1):
            for lo_q in range(w_q, e_q + 1):
                if (la_q, lo_q) not in existing:
                    pending.append((la_q, lo_q))

        if not pending:
            self.stdout.write(self.style.SUCCESS("未取得セルなし (完了済み)"))
            return

        reqs_done = 0
        saved_sea = 0
        skipped_land = 0
        null_results = 0

        try:
            for i in range(0, len(pending), CHUNK):
                if reqs_done >= max_requests:
                    self.stdout.write(self.style.WARNING(f"max-requests {max_requests} に到達 → 停止"))
                    break
                if reqs_done > 0:
                    time.sleep(SLEEP_SEC)
                chunk_keys = pending[i:i + CHUNK]
                locs = "|".join(f"{la / scale:.4f},{lo / scale:.4f}" for la, lo in chunk_keys)
                url = f"{API_URL}?locations={urllib.request.quote(locs, safe=',|')}"
                req = urllib.request.Request(
                    url,
                    headers={
                        "Accept": "application/json",
                        "User-Agent": "maruomosquit-tools/1.0",
                    },
                )
                try:
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        data = json.loads(resp.read().decode())
                except urllib.error.HTTPError as ex:
                    self.stdout.write(self.style.ERROR(f"HTTP {ex.code}: {ex.reason} → 停止"))
                    if ex.code == 429:
                        self.stdout.write("レート制限に到達した可能性あり。時間を置いて再実行してください。")
                    break
                except (urllib.error.URLError, TimeoutError) as ex:
                    self.stdout.write(self.style.ERROR(f"ネットワークエラー: {ex} → 停止"))
                    break

                reqs_done += 1
                results = data.get("results") or []
                rows = []
                for (la, lo), r in zip(chunk_keys, results):
                    elev = r.get("elevation")
                    if elev is None:
                        null_results += 1
                        continue
                    if elev >= 0:
                        skipped_land += 1
                        continue
                    rows.append(SeafloorDepth(quantize=level, lat_q=la, lon_q=lo, elevation=elev))
                if rows:
                    SeafloorDepth.objects.bulk_create(rows, ignore_conflicts=True)
                    saved_sea += len(rows)

                if reqs_done % 20 == 0 or reqs_done == max_requests:
                    self.stdout.write(
                        f"  req {reqs_done}/{max_requests}  saved_sea={saved_sea:,}  "
                        f"land={skipped_land:,}  null={null_results:,}"
                    )
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("中断 → ここまでの結果は保存済み"))

        remaining = len(pending) - reqs_done * CHUNK
        self.stdout.write(self.style.SUCCESS(
            f"完了: requests={reqs_done}  saved_sea={saved_sea:,}  "
            f"land={skipped_land:,}  null={null_results:,}  残 ≈ {max(0, remaining):,} セル"
        ))
