"""株価テクニカル分析・スコアリングエンジン

DailyStockPrice の日足データからテクニカル指標を算出し、
カテゴリ内でパーセンタイルランク化して銘柄をスコアリングする。
"""

from bisect import bisect_left, bisect_right
from datetime import timedelta

import pandas as pd
from django.utils import timezone

from .config import STOCKS_BY_CATEGORY
from .models import DailyStockPrice

LOOKBACK_DAYS = 250
MIN_DATA_DAYS = 30

# (指標キー, direction, weight)
# direction: 1=高いほど良い, -1=低いほど良い
SHORT_TERM_COMPONENTS = [
    ('rsi_14', -1, 0.20),
    ('ma5_deviation', -1, 0.15),
    ('ma25_deviation', -1, 0.10),
    ('volume_spike', 1, 0.15),
    ('momentum_5d', 1, 0.20),
    ('momentum_10d', 1, 0.10),
    ('bollinger_pos', -1, 0.10),
]

LONG_TERM_COMPONENTS = [
    ('ma_cross_25_75', 1, 0.15),
    ('ma_cross_75_200', 1, 0.10),
    ('momentum_60d', 1, 0.20),
    ('momentum_120d', 1, 0.15),
    ('vol_adj_return_60d', 1, 0.15),
    ('vol_adj_return_120d', 1, 0.10),
    ('ma75_deviation', 1, 0.075),
    ('ma200_deviation', 1, 0.075),
]

# シグナル判定ルール: (指標キー, 判定関数, テキスト生成, タイプ)
SIGNAL_RULES = [
    ('rsi_14', lambda v: v < 30, lambda v: f'RSI 売られすぎ ({v})', 'bullish'),
    ('rsi_14', lambda v: v > 70, lambda v: f'RSI 買われすぎ ({v})', 'bearish'),
    ('ma_cross_25_75', lambda v: v == 1, lambda _: 'GC 25/75日', 'bullish'),
    ('ma_cross_25_75', lambda v: v == -1, lambda _: 'DC 25/75日', 'bearish'),
    ('ma_cross_75_200', lambda v: v == 1, lambda _: 'GC 75/200日', 'bullish'),
    ('ma_cross_75_200', lambda v: v == -1, lambda _: 'DC 75/200日', 'bearish'),
    ('bollinger_pos', lambda v: v < 0.1, lambda _: 'BB下限接近', 'bullish'),
    ('bollinger_pos', lambda v: v > 0.9, lambda _: 'BB上限接近', 'bearish'),
    ('volume_spike', lambda v: v > 2.0, lambda v: f'出来高急増 ({v}倍)', 'neutral'),
    ('ma5_deviation', lambda v: v < -5, lambda v: f'短期乖離大 ({v}%)', 'bullish'),
]


# ========== テクニカル指標計算 ==========

def _calc_rsi(closes: pd.Series, period: int = 14) -> float | None:
    if len(closes) < period + 1:
        return None
    delta = closes.diff()
    avg_gain = delta.clip(lower=0).rolling(period, min_periods=period).mean().iloc[-1]
    avg_loss = (-delta.clip(upper=0)).rolling(period, min_periods=period).mean().iloc[-1]
    if avg_loss == 0:
        return 100.0
    return round(100 - (100 / (1 + avg_gain / avg_loss)), 2)


def _calc_ma_deviation(closes: pd.Series, period: int) -> float | None:
    if len(closes) < period:
        return None
    ma = closes.rolling(period).mean().iloc[-1]
    if ma == 0:
        return None
    return round((closes.iloc[-1] - ma) / ma * 100, 2)


def _calc_volume_spike(volumes: pd.Series, period: int = 20) -> float | None:
    if len(volumes) < period + 1:
        return None
    avg_vol = volumes.iloc[-(period + 1):-1].mean()
    if avg_vol == 0:
        return None
    return round(volumes.iloc[-1] / avg_vol, 2)


def _calc_momentum(closes: pd.Series, period: int) -> float | None:
    if len(closes) < period + 1:
        return None
    prev = closes.iloc[-(period + 1)]
    if prev == 0:
        return None
    return round((closes.iloc[-1] - prev) / prev * 100, 2)


def _calc_bollinger_position(closes: pd.Series, period: int = 20, num_std: float = 2.0) -> float | None:
    if len(closes) < period:
        return None
    rolling = closes.rolling(period)
    ma = rolling.mean().iloc[-1]
    std = rolling.std().iloc[-1]
    if std == 0:
        return 0.5
    band_width = 2 * num_std * std
    if band_width == 0:
        return 0.5
    lower = ma - num_std * std
    return round((closes.iloc[-1] - lower) / band_width, 3)


def _detect_ma_cross(closes: pd.Series, short_period: int, long_period: int) -> int:
    """ゴールデンクロス=+1, デッドクロス=-1, なし=0（直近5日以内）"""
    if len(closes) < long_period + 5:
        return 0
    diff = closes.rolling(short_period).mean() - closes.rolling(long_period).mean()
    recent = diff.iloc[-5:]
    for i in range(1, len(recent)):
        prev_val, curr_val = recent.iloc[i - 1], recent.iloc[i]
        if pd.isna(prev_val) or pd.isna(curr_val):
            continue
        if prev_val <= 0 < curr_val:
            return 1
        if prev_val >= 0 > curr_val:
            return -1
    return 0


def _calc_volatility_adjusted_return(closes: pd.Series, period: int) -> float | None:
    if len(closes) < period + 1:
        return None
    std = closes.pct_change().iloc[-period:].std()
    if std == 0 or pd.isna(std):
        return None
    total_return = (closes.iloc[-1] - closes.iloc[-(period + 1)]) / closes.iloc[-(period + 1)]
    return round(total_return / std, 2)


# ========== データ取得 ==========

def _fetch_category_data(category: str) -> dict[str, pd.DataFrame]:
    """カテゴリ全銘柄の日足データを一括取得し、ticker別に分割"""
    stocks = STOCKS_BY_CATEGORY.get(category, {})
    if not stocks:
        return {}

    tickers = list(stocks.keys())
    cutoff = timezone.now().date() - timedelta(days=int(LOOKBACK_DAYS * 1.5))

    rows = list(
        DailyStockPrice.objects
        .filter(ticker__in=tickers, date__gte=cutoff)
        .order_by('ticker', 'date')
        .values_list('ticker', 'date', 'open', 'high', 'low', 'close', 'volume')
    )
    if not rows:
        return {}

    df_all = pd.DataFrame(rows, columns=['ticker', 'date', 'open', 'high', 'low', 'close', 'volume'])
    return {
        ticker: group.drop(columns=['ticker']).reset_index(drop=True)
        for ticker, group in df_all.groupby('ticker')
        if len(group) >= MIN_DATA_DAYS
    }


# ========== 指標計算 ==========

def _compute_indicators(ticker: str, name: str, df: pd.DataFrame) -> dict:
    closes, volumes = df['close'], df['volume']
    return {
        'ticker': ticker,
        'name': name,
        'rsi_14': _calc_rsi(closes, 14),
        'ma5_deviation': _calc_ma_deviation(closes, 5),
        'ma25_deviation': _calc_ma_deviation(closes, 25),
        'volume_spike': _calc_volume_spike(volumes, 20),
        'momentum_5d': _calc_momentum(closes, 5),
        'momentum_10d': _calc_momentum(closes, 10),
        'bollinger_pos': _calc_bollinger_position(closes, 20),
        'ma_cross_25_75': _detect_ma_cross(closes, 25, 75),
        'ma_cross_75_200': _detect_ma_cross(closes, 75, 200),
        'momentum_60d': _calc_momentum(closes, 60),
        'momentum_120d': _calc_momentum(closes, 120),
        'vol_adj_return_60d': _calc_volatility_adjusted_return(closes, 60),
        'vol_adj_return_120d': _calc_volatility_adjusted_return(closes, 120),
        'ma75_deviation': _calc_ma_deviation(closes, 75),
        'ma200_deviation': _calc_ma_deviation(closes, 200),
    }


# ========== パーセンタイルランク ==========

def _percentile_rank(values: list) -> list:
    """None を除外して 0-100 のパーセンタイルランクを返す（O(n log n)）"""
    valid = [(i, v) for i, v in enumerate(values) if v is not None]
    result = [None] * len(values)
    if len(valid) <= 1:
        for i, _ in valid:
            result[i] = 50.0
        return result

    sorted_vals = sorted(v for _, v in valid)
    n = len(sorted_vals)
    for idx, val in valid:
        lo = bisect_left(sorted_vals, val)
        hi = bisect_right(sorted_vals, val) - 1
        result[idx] = round((lo + hi) / 2 / (n - 1) * 100, 1)
    return result


# ========== スコア計算共通 ==========

def _apply_component_scores(all_indicators: list[dict], components: list[tuple], score_key: str):
    """コンポーネント定義に基づいてパーセンタイルランク→加重平均スコアを計算"""
    for key, direction, _ in components:
        raw_values = [ind.get(key) for ind in all_indicators]
        ranks = _percentile_rank(raw_values)
        if direction == -1:
            ranks = [100 - r if r is not None else None for r in ranks]
        for i, rank in enumerate(ranks):
            all_indicators[i][f'_rank_{key}'] = rank

    for ind in all_indicators:
        total_weight = 0
        weighted_sum = 0
        for key, _, weight in components:
            rank = ind.get(f'_rank_{key}')
            if rank is not None:
                weighted_sum += rank * weight
                total_weight += weight
        ind[score_key] = round(weighted_sum / total_weight, 1) if total_weight > 0 else None


# ========== シグナル生成 ==========

def _generate_signals(indicators: dict) -> list[dict]:
    signals = []
    for key, condition, text_fn, signal_type in SIGNAL_RULES:
        val = indicators.get(key)
        if val is not None and condition(val):
            signals.append({'text': text_fn(val), 'type': signal_type})
    return signals


# ========== メイン ==========

_RESULT_KEYS = ('ticker', 'name', 'short_term_score', 'long_term_score', 'combined_score')


def score_category(category: str) -> list[dict]:
    """カテゴリ内の全銘柄をスコアリングしてランキングを返す。"""
    stocks = STOCKS_BY_CATEGORY.get(category, {})
    if not stocks:
        return []

    data_by_ticker = _fetch_category_data(category)
    if not data_by_ticker:
        return []

    all_indicators = [
        _compute_indicators(ticker, stocks.get(ticker, ticker), df)
        for ticker, df in data_by_ticker.items()
    ]
    if not all_indicators:
        return []

    _apply_component_scores(all_indicators, SHORT_TERM_COMPONENTS, 'short_term_score')
    _apply_component_scores(all_indicators, LONG_TERM_COMPONENTS, 'long_term_score')

    # 総合スコア
    for ind in all_indicators:
        short, long = ind.get('short_term_score'), ind.get('long_term_score')
        if short is not None and long is not None:
            ind['combined_score'] = round(short * 0.5 + long * 0.5, 1)
        else:
            ind['combined_score'] = short or long

    # 結果整形
    results = []
    for ind in all_indicators:
        if ind.get('combined_score') is None:
            continue
        results.append({
            **{k: ind[k] for k in _RESULT_KEYS},
            'indicators': {
                k: v for k, v in ind.items()
                if not k.startswith('_rank_') and k not in _RESULT_KEYS
            },
            'signals': _generate_signals(ind),
        })

    results.sort(key=lambda x: x['combined_score'], reverse=True)
    return results
