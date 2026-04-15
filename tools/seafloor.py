"""海底水深 (SeafloorDepth) 関連の共有ヘルパー。

views.py と management コマンドで共通利用する:
- bbox → 量子化境界の変換
- LOD キャッシュのクエリ / フォールバック / 集約
- opentopodata GEBCO2020 のバッチ取得
"""

import json
import math
import time
import urllib.error
import urllib.request

from django.db.models import Q

from tools.models import SeafloorDepth


OPENTOPODATA_URL = "https://api.opentopodata.org/v1/gebco2020"
CHUNK_SIZE = 100
SLEEP_SEC = 1.05
MAX_POINTS_PER_BBOX = 20000
LOD_LEVELS = (0, 1, 2, 3)


def quantized_bounds(south, west, north, east, scale):
    """bbox を量子化整数境界 (s_q, n_q, w_q, e_q) に変換。"""
    return (
        int(math.floor(south * scale)),
        int(math.ceil(north * scale)),
        int(math.floor(west * scale)),
        int(math.ceil(east * scale)),
    )


def query_cells_in_bbox(level, south, west, north, east, limit=None):
    """指定 LOD の bbox 内キャッシュ (海のみ) を返す。"""
    scale = SeafloorDepth.QUANTIZE_SCALES[level]
    s_q, n_q, w_q, e_q = quantized_bounds(south, west, north, east, scale)
    qs = SeafloorDepth.objects.filter(
        quantize=level,
        lat_q__gte=s_q, lat_q__lte=n_q,
        lon_q__gte=w_q, lon_q__lte=e_q,
        elevation__lt=0,
    ).values_list("lat_q", "lon_q", "elevation")
    if limit is not None:
        qs = qs[: limit + 1]
    return list(qs)


def lookup_multi_lod(points):
    """点列を L0→L3 の順でキャッシュ参照。戻り値は (elevations, source)。

    source[i] は int (ヒットした LOD) または None (未ヒット)。
    """
    n = len(points)
    elevations = [None] * n
    source = [None] * n

    for lv in LOD_LEVELS:
        scale = SeafloorDepth.QUANTIZE_SCALES[lv]
        keys_to_idx = {}
        for idx in range(n):
            if source[idx] is not None:
                continue
            la, lo = points[idx]
            key = (int(round(la * scale)), int(round(lo * scale)))
            keys_to_idx.setdefault(key, []).append(idx)
        if not keys_to_idx:
            break
        q = Q()
        for la_q, lo_q in keys_to_idx.keys():
            q |= Q(lat_q=la_q, lon_q=lo_q)
        for row in SeafloorDepth.objects.filter(quantize=lv).filter(q).values("lat_q", "lon_q", "elevation"):
            key = (row["lat_q"], row["lon_q"])
            for idx in keys_to_idx.get(key, []):
                if source[idx] is None:
                    elevations[idx] = row["elevation"]
                    source[idx] = lv
    return elevations, source


def _aggregate_in_memory(target_level, south, west, north, east):
    """target より細かい LOD を走査し、最初にデータがあったレベルを target セルに集約。

    永続化はしない (巨大な bbox でも DB を汚さない)。
    戻り値: [(lat_q, lon_q, mean_elev), ...] (target スケール)、source_level or None。
    """
    if target_level <= 0:
        return [], None
    target_scale = SeafloorDepth.QUANTIZE_SCALES[target_level]

    for src_lv in range(target_level - 1, -1, -1):
        src_scale = SeafloorDepth.QUANTIZE_SCALES[src_lv]
        s2, n2, w2, e2 = quantized_bounds(south, west, north, east, src_scale)
        src_rows = SeafloorDepth.objects.filter(
            quantize=src_lv,
            lat_q__gte=s2, lat_q__lte=n2,
            lon_q__gte=w2, lon_q__lte=e2,
            elevation__lt=0,
        ).values_list("lat_q", "lon_q", "elevation")
        bucket = {}
        for la, lo, el in src_rows:
            key = (
                int(round((la / src_scale) * target_scale)),
                int(round((lo / src_scale) * target_scale)),
            )
            b = bucket.get(key)
            if b is None:
                bucket[key] = [el, 1]
            else:
                b[0] += el
                b[1] += 1
        if bucket:
            rows = [(k[0], k[1], v[0] / v[1]) for k, v in bucket.items()]
            return rows, src_lv
    return [], None


def collect_for_view(south, west, north, east, target_level, limit=MAX_POINTS_PER_BBOX):
    """ビュー描画用に bbox 内の水深セルを LOD 調整して返す。

    優先順:
      1) target_level のキャッシュをそのまま
      2) より細かい LOD から in-memory 集約 (現状データの大半が L2 の想定)
      3) より粗い LOD をそのまま (ズームより大きいセルで表示)

    戻り値: (used_level, rows, source_info)
      source_info: "direct" / "aggregated-from-L{n}" / "coarser-L{n}" / "empty"
    """
    rows = query_cells_in_bbox(target_level, south, west, north, east, limit=limit)
    if rows:
        return target_level, rows, "direct"

    agg_rows, src_lv = _aggregate_in_memory(target_level, south, west, north, east)
    if agg_rows:
        return target_level, agg_rows[:limit], f"aggregated-from-L{src_lv}"

    for try_lv in range(target_level + 1, 4):
        r = query_cells_in_bbox(try_lv, south, west, north, east, limit=limit)
        if r:
            return try_lv, r, f"coarser-L{try_lv}"

    return target_level, [], "empty"


def _opentopodata_request(chunk_keys, scale, timeout=30):
    """100 件以下のキー配列を opentopodata に投げて elevation リストを返す。"""
    locs = "|".join(f"{la / scale:.4f},{lo / scale:.4f}" for la, lo in chunk_keys)
    url = f"{OPENTOPODATA_URL}?locations={urllib.request.quote(locs, safe=',|')}"
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "maruomosquit-tools/1.0"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode())
    results = data.get("results") or []
    return [r.get("elevation") for r in results]


def fetch_and_save(pending_keys, level, *, sleep_between=True, max_requests=None, on_progress=None):
    """opentopodata から (level のスケールで量子化済みの) キーを順次取得し保存。

    pending_keys: [(lat_q, lon_q), ...]
    戻り値 dict: {requests, saved_sea, land, null, elevations}
      elevations は入力キーと同じ順の elevation リスト (途中停止分は None)。
    on_progress(reqs_done, saved_sea, land, null) を各リクエスト後に呼ぶ。
    HTTP/ネットワークエラー時は例外を送出 (呼び出し側で停止判断)。
    """
    scale = SeafloorDepth.QUANTIZE_SCALES[level]
    elevations = [None] * len(pending_keys)
    reqs_done = 0
    saved_sea = 0
    land = 0
    null_count = 0

    for start in range(0, len(pending_keys), CHUNK_SIZE):
        if max_requests is not None and reqs_done >= max_requests:
            break
        if sleep_between and reqs_done > 0:
            time.sleep(SLEEP_SEC)
        chunk_keys = pending_keys[start:start + CHUNK_SIZE]
        elevs = _opentopodata_request(chunk_keys, scale)
        reqs_done += 1

        rows = []
        for i, ((la_q, lo_q), elev) in enumerate(zip(chunk_keys, elevs)):
            elevations[start + i] = elev
            rows.append(SeafloorDepth(quantize=level, lat_q=la_q, lon_q=lo_q, elevation=elev))
            if elev is None:
                null_count += 1
            elif elev >= 0:
                land += 1
            else:
                saved_sea += 1
        if rows:
            SeafloorDepth.objects.bulk_create(rows, ignore_conflicts=True)
        if on_progress is not None:
            on_progress(reqs_done, saved_sea, land, null_count)

    return {
        "requests": reqs_done,
        "saved_sea": saved_sea,
        "land": land,
        "null": null_count,
        "elevations": elevations,
    }
