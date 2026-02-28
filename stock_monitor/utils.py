"""stock_monitor の共通ユーティリティ"""
import logging
from datetime import datetime, timezone as dt_timezone

import requests

logger = logging.getLogger(__name__)


_YF_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
}

# Yahoo Finance の複数エンドポイントをラウンドロビンで分散
_YF_HOSTS = [
    'query1.finance.yahoo.com',
    'query2.finance.yahoo.com',
]
_yf_host_index = 0


def fetch_yahoo_chart(ticker, range_='5d', interval='1d'):
    """Yahoo Finance Chart API から OHLCV データを取得。

    複数のエンドポイントホストをラウンドロビンで使い分け、
    レートリミットを分散させる。

    Returns:
        list of dict: [{date, open, high, low, close, volume}, ...]
        空リスト on error
    """
    global _yf_host_index

    # 全ホストを試行（ラウンドロビン + フォールバック）
    for attempt in range(len(_YF_HOSTS)):
        host = _YF_HOSTS[_yf_host_index % len(_YF_HOSTS)]
        _yf_host_index += 1
        url = (
            f'https://{host}/v8/finance/chart/{ticker}'
            f'?range={range_}&interval={interval}'
        )
        try:
            resp = requests.get(url, headers=_YF_HEADERS, timeout=15)
            if resp.status_code == 429:
                logger.warning('%s: %s rate limited (429)', ticker, host)
                continue  # 次のホストを試行
            resp.raise_for_status()
            data = resp.json()
            break
        except Exception as e:
            logger.warning('%s: %s error: %s', ticker, host, e)
            if attempt < len(_YF_HOSTS) - 1:
                continue
            return []
    else:
        logger.warning('%s: 全ホストがレートリミット', ticker)
        return []

    try:
        result = data['chart']['result'][0]
        timestamps = result.get('timestamp') or []
        quote = result['indicators']['quote'][0]
    except (KeyError, IndexError, TypeError):
        return []

    records = []
    for i, ts in enumerate(timestamps):
        o = quote['open'][i]
        h = quote['high'][i]
        l = quote['low'][i]
        c = quote['close'][i]
        v = quote['volume'][i]
        if o is None or h is None or l is None or c is None:
            continue
        records.append({
            'date': datetime.fromtimestamp(ts, tz=dt_timezone.utc),
            'open': round(float(o), 1),
            'high': round(float(h), 1),
            'low': round(float(l), 1),
            'close': round(float(c), 1),
            'volume': int(v) if v else 0,
        })
    return records



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
