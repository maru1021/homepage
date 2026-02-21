"""stock_monitor の共通ユーティリティ"""
import pandas as pd


def to_series(col):
    """DataFrame カラムを Series に変換（yfinance のマルチレベルカラム対策）"""
    if isinstance(col, pd.DataFrame):
        return col.iloc[:, 0]
    return col


def parse_ohlcv(ticker_data):
    """yfinance の DataFrame から OHLCV データを抽出。

    Returns:
        (open, high, low, close, volume, valid_index)
    """
    o = to_series(ticker_data['Open'])
    h = to_series(ticker_data['High'])
    l = to_series(ticker_data['Low'])
    c = to_series(ticker_data['Close'])
    v = to_series(ticker_data['Volume'])

    mask = o.notna() & h.notna() & l.notna() & c.notna()
    valid_idx = mask[mask].index

    return o, h, l, c, v, valid_idx


def build_ohlcv_defaults(name, o, h, l, c, v, ts):
    """1レコード分の defaults dict を生成"""
    return {
        'name': name,
        'open': round(float(o[ts]), 1),
        'high': round(float(h[ts]), 1),
        'low': round(float(l[ts]), 1),
        'close': round(float(c[ts]), 1),
        'volume': int(v[ts]) if pd.notna(v[ts]) else 0,
    }
