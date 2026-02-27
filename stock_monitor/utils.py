"""stock_monitor の共通ユーティリティ"""
import logging
import time

import pandas as pd
import requests

from .config import BATCH_DELAY, BATCH_SIZE, MAX_RETRIES, RETRY_BACKOFF_BASE

logger = logging.getLogger(__name__)


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


def batch_download(tickers_list, **yf_kwargs):
    """ティッカーを BATCH_SIZE ずつ分割して yf.download() を実行。

    429 エラー時は指数バックオフでリトライ。
    結果を pd.concat(axis=1) で結合して返却。
    """
    import yfinance as yf

    batches = [
        tickers_list[i:i + BATCH_SIZE]
        for i in range(0, len(tickers_list), BATCH_SIZE)
    ]

    all_data = []
    for batch_idx, batch in enumerate(batches):
        tickers_str = ' '.join(batch)
        success = False

        for attempt in range(MAX_RETRIES):
            try:
                data = yf.download(
                    tickers_str, progress=False, threads=True,
                    group_by='ticker', **yf_kwargs,
                )
                if not data.empty:
                    # 1銘柄のみの場合、マルチレベルカラムにならないので補正
                    if len(batch) == 1 and not isinstance(
                        data.columns, pd.MultiIndex,
                    ):
                        data.columns = pd.MultiIndex.from_product(
                            [batch, data.columns],
                        )
                    all_data.append(data)
                    success = True
                    break
                # yfinance はレートリミット時に例外を投げず空データを返す
                wait = RETRY_BACKOFF_BASE * (2 ** attempt)
                logger.warning(
                    'Batch %d/%d: empty data (likely rate limited), '
                    'retry in %ds... (attempt %d/%d)',
                    batch_idx + 1, len(batches), wait,
                    attempt + 1, MAX_RETRIES,
                )
                time.sleep(wait)
            except Exception as e:
                err_str = str(e)
                if '429' in err_str or 'Too Many Requests' in err_str:
                    wait = RETRY_BACKOFF_BASE * (2 ** attempt)
                    logger.warning(
                        'Rate limited (batch %d/%d), retry in %ds...',
                        batch_idx + 1, len(batches), wait,
                    )
                    time.sleep(wait)
                else:
                    logger.error('Batch %d/%d error: %s',
                                 batch_idx + 1, len(batches), e)
                    break

        if not success:
            logger.warning('Batch %d/%d skipped', batch_idx + 1, len(batches))

        # 最後のバッチ以外は待機
        if batch_idx < len(batches) - 1:
            time.sleep(BATCH_DELAY)

    if not all_data:
        return pd.DataFrame()
    if len(all_data) == 1:
        return all_data[0]
    return pd.concat(all_data, axis=1)


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


def fetch_crypto_from_coingecko(ticker_to_cg_map):
    """CoinGecko API から仮想通貨の現在価格を取得。

    Args:
        ticker_to_cg_map: {"BTC-USD": "bitcoin", ...}

    Returns:
        {ticker: {price, high_24h, low_24h, volume}} or {} on error
    """
    ids = ','.join(ticker_to_cg_map.values())
    url = (
        'https://api.coingecko.com/api/v3/coins/markets'
        f'?vs_currency=usd&ids={ids}&order=market_cap_desc&per_page=50'
    )

    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.error('CoinGecko API error: %s', e)
        return {}

    id_to_ticker = {v: k for k, v in ticker_to_cg_map.items()}

    result = {}
    for coin in data:
        ticker = id_to_ticker.get(coin['id'])
        if ticker:
            price = coin.get('current_price') or 0
            result[ticker] = {
                'price': price,
                'high_24h': coin.get('high_24h') or price,
                'low_24h': coin.get('low_24h') or price,
                'volume': int(coin.get('total_volume') or 0),
            }
    return result
