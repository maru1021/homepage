"""stock_monitor の共通ユーティリティ"""
import logging
import math
import time
from datetime import datetime, timezone as dt_timezone

from curl_cffi import requests as cffi_requests

logger = logging.getLogger(__name__)

# ========== 定数 ==========

_YF_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
}

BATCH_SIZE = 50
BATCH_DELAY = 5
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 30


# ========== リトライ共通 ==========

def _create_cffi_session():
    """curl_cffi でブラウザの TLS フィンガープリントを偽装したセッションを生成。"""
    return cffi_requests.Session(impersonate="chrome")


def _request_with_retry(url, label='', default=None):
    """curl_cffi セッションで GET し、429 / エラー時に指数バックオフでリトライする。

    Returns:
        成功時: レスポンスの JSON (dict/list)
        失敗時: default 引数の値
    """
    for attempt in range(MAX_RETRIES + 1):
        try:
            session = _create_cffi_session()
            resp = session.get(url, headers=_YF_HEADERS, timeout=15)
            if resp.status_code == 429:
                if attempt < MAX_RETRIES:
                    wait = RETRY_BACKOFF_BASE * (2 ** attempt)
                    logger.warning('%s: 429 rate limited, %d秒後にリトライ (%d/%d)',
                                   label, wait, attempt + 1, MAX_RETRIES + 1)
                    time.sleep(wait)
                    continue
                logger.warning('%s: 429 rate limited, 全リトライ失敗', label)
                return default
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            if attempt < MAX_RETRIES:
                wait = RETRY_BACKOFF_BASE * (2 ** attempt)
                logger.warning('%s: %s, %d秒後にリトライ', label, e, wait)
                time.sleep(wait)
                continue
            logger.warning('%s: %s (全リトライ失敗)', label, e)
            return default


# ========== yf.download() バッチ取得 ==========

def fetch_yahoo_chart_batch(tickers, range_='1d', interval='1m'):
    """Yahoo Finance から複数銘柄の OHLCV データをバッチ分割で取得。

    Args:
        tickers: ティッカーのリスト ['7203.T', 'AAPL', ...]
        range_: 期間 ('1d', '5d', 'max' など)
        interval: 足の間隔 ('1m', '1d' など)

    Returns:
        dict: {ticker: [{date, open, high, low, close, volume}, ...]}
    """
    result = {}
    if not tickers:
        return result

    for i in range(0, len(tickers), BATCH_SIZE):
        batch = tickers[i:i + BATCH_SIZE]
        result.update(_download_batch(batch, range_, interval))

        if i + BATCH_SIZE < len(tickers):
            time.sleep(BATCH_DELAY)

    return result


def _download_batch(tickers, range_, interval):
    """1バッチ分の yf.download() をリトライ付きで実行して結果を返す。"""
    import yfinance as yf

    ticker_str = ' '.join(tickers)

    for attempt in range(MAX_RETRIES + 1):
        try:
            df = yf.download(
                ticker_str,
                period=range_,
                interval=interval,
                group_by='ticker',
                progress=False,
                threads=True,
            )
        except Exception as e:
            logger.error('yf.download() エラー (%d/%d): %s',
                         attempt + 1, MAX_RETRIES + 1, e)
            if attempt < MAX_RETRIES:
                wait = RETRY_BACKOFF_BASE * (2 ** attempt)
                time.sleep(wait)
                continue
            return {}

        if not df.empty:
            break

        if attempt < MAX_RETRIES:
            wait = RETRY_BACKOFF_BASE * (2 ** attempt)
            logger.warning('yf.download() 空レスポンス (%d銘柄, %d/%d) → %d秒後にリトライ',
                           len(tickers), attempt + 1, MAX_RETRIES + 1, wait)
            time.sleep(wait)
        else:
            logger.warning('yf.download() 空レスポンス (%d銘柄, 全リトライ失敗)', len(tickers))
            return {}

    return _extract_tickers_from_df(df, tickers)


def _extract_tickers_from_df(df, tickers):
    """yf.download() の結果 DataFrame から銘柄ごとのレコードを抽出する。"""
    result = {}
    if len(tickers) == 1:
        records = _parse_single_ticker_df(df)
        if records:
            result[tickers[0]] = records
    else:
        for ticker in tickers:
            try:
                ticker_df = df[ticker]
            except (KeyError, TypeError):
                continue
            records = _parse_single_ticker_df(ticker_df)
            if records:
                result[ticker] = records
    return result


def _parse_single_ticker_df(df):
    """1銘柄分の DataFrame を [{date, open, high, low, close, volume}] に変換"""
    records = []
    for idx, row in df.iterrows():
        o, h, l, c = row.get('Open'), row.get('High'), row.get('Low'), row.get('Close')
        v = row.get('Volume')
        if any(x is None for x in (o, h, l, c)):
            continue
        if any(math.isnan(x) for x in (o, h, l, c)):
            continue

        if hasattr(idx, 'to_pydatetime'):
            dt = idx.to_pydatetime()
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=dt_timezone.utc)
        else:
            dt = idx

        records.append({
            'date': dt,
            'open': round(float(o), 1),
            'high': round(float(h), 1),
            'low': round(float(l), 1),
            'close': round(float(c), 1),
            'volume': int(v) if v and not math.isnan(v) else 0,
        })
    return records


# ========== Yahoo Finance 直接 API ==========

FUNDAMENTALS_BATCH_SIZE = 10
FUNDAMENTALS_BATCH_DELAY = 5


def _parse_fundamentals(info):
    """yf.Ticker().info の dict からファンダメンタルズを抽出する。

    Returns:
        dict or None (データ不足時)
    """
    if not info or not isinstance(info, dict):
        return None

    def _pct(val):
        return round(val * 100, 2) if val else None

    return {
        'market_cap': info.get('marketCap'),
        'per': info.get('trailingPE'),
        'pbr': info.get('priceToBook'),
        'dividend_yield': _pct(info.get('dividendYield')),
        'eps': info.get('trailingEps'),
        'roe': _pct(info.get('returnOnEquity')),
        'revenue': info.get('totalRevenue'),
        'profit_margin': _pct(info.get('profitMargins')),
        'fifty_two_week_high': info.get('fiftyTwoWeekHigh'),
        'fifty_two_week_low': info.get('fiftyTwoWeekLow'),
    }


def fetch_fundamentals_batch(tickers):
    """yf.Ticker().info を使ってファンダメンタルズをバッチ取得する。

    FUNDAMENTALS_BATCH_SIZE 銘柄ずつ取得し、バッチ間で待機する。
    yfinance 1.x 内蔵の curl_cffi でレートリミットを回避。

    Args:
        tickers: ティッカーのリスト ['7203.T', 'AAPL', ...]

    Returns:
        dict: {ticker: {market_cap, per, pbr, ...}} 取得成功した銘柄のみ
    """
    import yfinance as yf

    result = {}
    if not tickers:
        return result

    for i in range(0, len(tickers), FUNDAMENTALS_BATCH_SIZE):
        batch = tickers[i:i + FUNDAMENTALS_BATCH_SIZE]

        for ticker in batch:
            try:
                info = yf.Ticker(ticker).info
                data = _parse_fundamentals(info)
                if data:
                    result[ticker] = data
            except Exception as e:
                logger.warning('%s: fundamentals error: %s', ticker, e)

        if i + FUNDAMENTALS_BATCH_SIZE < len(tickers):
            time.sleep(FUNDAMENTALS_BATCH_DELAY)

    return result


# ========== CoinGecko ==========

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

    data = _request_with_retry(url, label='CoinGecko', default=None)
    if data is None:
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
