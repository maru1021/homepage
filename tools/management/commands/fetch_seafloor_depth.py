"""海底水深を opentopodata (GEBCO2020) からバッチ取得して SeafloorDepth にキャッシュする。

- 指定 bbox と LOD レベルのグリッド全セルを順に取得
- 既にキャッシュ済みのセルはスキップ → レジューム可
- 陸 (elevation >= 0) や null 結果もレコード化して再取得を防止
- opentopodata レート制限: 100 locations/req, 1 req/sec (無料枠 1000 req/day)

Usage:
    python manage.py fetch_seafloor_depth --bbox 30,128,46,150 --level 2 --max-requests 800
    python manage.py fetch_seafloor_depth --bbox 34,138,36,142 --level 1 --max-requests 800 --clear
"""

import urllib.error

from django.core.management.base import BaseCommand, CommandError

from tools import seafloor
from tools.models import SeafloorDepth


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

        s_q, n_q, w_q, e_q = seafloor.quantized_bounds(s, w, n, e, scale)
        total_cells = (n_q - s_q + 1) * (e_q - w_q + 1)
        self.stdout.write(
            f"bbox={s},{w},{n},{e} level={level} scale=×{scale} "
            f"(≒{1 / scale:.4f}° / 約 {111 / scale:.1f}km) "
            f"総セル数 {total_cells:,} / 上限 {max_requests} req × {seafloor.CHUNK_SIZE} = "
            f"最大 {max_requests * seafloor.CHUNK_SIZE:,} 点"
        )

        existing = set(
            SeafloorDepth.objects.filter(
                quantize=level,
                lat_q__gte=s_q, lat_q__lte=n_q,
                lon_q__gte=w_q, lon_q__lte=e_q,
            ).values_list("lat_q", "lon_q")
        )
        self.stdout.write(
            f"キャッシュ済み: {len(existing):,} セル → 残 {total_cells - len(existing):,} セル"
        )

        pending = [
            (la_q, lo_q)
            for la_q in range(s_q, n_q + 1)
            for lo_q in range(w_q, e_q + 1)
            if (la_q, lo_q) not in existing
        ]

        if not pending:
            self.stdout.write(self.style.SUCCESS("未取得セルなし (完了済み)"))
            return

        def on_progress(reqs_done, saved_sea, land, null_count):
            if reqs_done % 20 == 0 or reqs_done == max_requests:
                self.stdout.write(
                    f"  req {reqs_done}/{max_requests}  saved_sea={saved_sea:,}  "
                    f"land={land:,}  null={null_count:,}"
                )

        try:
            result = seafloor.fetch_and_save(
                pending, level=level,
                max_requests=max_requests,
                on_progress=on_progress,
            )
        except urllib.error.HTTPError as ex:
            self.stdout.write(self.style.ERROR(f"HTTP {ex.code}: {ex.reason} → 停止"))
            if ex.code == 429:
                self.stdout.write("レート制限に到達した可能性あり。時間を置いて再実行してください。")
            return
        except (urllib.error.URLError, TimeoutError) as ex:
            self.stdout.write(self.style.ERROR(f"ネットワークエラー: {ex} → 停止"))
            return
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("中断 → ここまでの結果は保存済み"))
            return

        if result["requests"] >= max_requests and len(pending) > max_requests * seafloor.CHUNK_SIZE:
            self.stdout.write(self.style.WARNING(f"max-requests {max_requests} に到達 → 停止"))

        remaining = max(0, len(pending) - result["requests"] * seafloor.CHUNK_SIZE)
        self.stdout.write(self.style.SUCCESS(
            f"完了: requests={result['requests']}  saved_sea={result['saved_sea']:,}  "
            f"land={result['land']:,}  null={result['null']:,}  残 ≈ {remaining:,} セル"
        ))
