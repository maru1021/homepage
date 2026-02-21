import logging

from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone

from .config import (
    DEFAULT_DAILY_MONTHS, JST, MARKET_OVERVIEW, MAX_CHART_TICKERS, STOCKS,
    get_all_market_tickers,
)
from .models import DailyStockPrice, StockPrice

logger = logging.getLogger(__name__)


def index(request):
    return render(request, 'stock_monitor/index.html')


# ========== 共通ヘルパー ==========

def _get_latest_trading_date():
    """DB に保存されている最新の取引日を返す"""
    latest = StockPrice.objects.order_by('-timestamp').first()
    if not latest:
        return None
    return latest.timestamp.astimezone(JST).date()


def _make_day_start(trading_date):
    """取引日の 00:00 JST datetime を返す"""
    return timezone.datetime(
        trading_date.year, trading_date.month, trading_date.day, tzinfo=JST,
    )


def _calc_intraday_change(ticker, day_start):
    """指定ティッカーの当日始値→終値の変動を計算。データなしなら None を返す"""
    prices = StockPrice.objects.filter(
        ticker=ticker, timestamp__gte=day_start,
    ).order_by('timestamp')

    if not prices.exists():
        return None

    first = prices.first()
    last = prices.last()
    open_price = first.open
    current_price = last.close
    diff = round(current_price - open_price, 2)
    pct = round((diff / open_price) * 100, 2) if open_price else 0
    return {'price': current_price, 'diff': diff, 'pct': pct}


def _serialize_ohlcv(queryset, time_field, time_format):
    """QuerySet から OHLCV + タイムスタンプ配列を生成"""
    timestamps, opens, highs, lows, closes, volumes = [], [], [], [], [], []
    for p in queryset:
        raw = getattr(p, time_field)
        if time_format:
            ts = (raw.astimezone(JST).strftime(time_format)
                  if hasattr(raw, 'astimezone') else raw.strftime(time_format))
        else:
            ts = raw.strftime('%Y-%m-%d')
        timestamps.append(ts)
        opens.append(p.open)
        highs.append(p.high)
        lows.append(p.low)
        closes.append(p.close)
        volumes.append(p.volume)
    return timestamps, opens, highs, lows, closes, volumes


def _parse_tickers_param(request):
    """リクエストから tickers パラメータをパースし、有効な銘柄リストを返す"""
    tickers_param = request.GET.get('tickers', '')
    if not tickers_param:
        return []
    requested = [t.strip() for t in tickers_param.split(',') if t.strip()]
    return [t for t in requested if t in STOCKS][:MAX_CHART_TICKERS]


# ========== API エンドポイント ==========

def api_prices(request):
    """DB から最新取引日の価格と始値を取得して返却"""
    trading_date = _get_latest_trading_date()
    if not trading_date:
        return JsonResponse({
            'stocks': [], 'has_prev': False,
            'total_tracked': len(STOCKS), 'fetched': 0,
            'timestamp': timezone.now().timestamp(),
        })

    day_start = _make_day_start(trading_date)

    stocks = []
    for ticker, name in STOCKS.items():
        change = _calc_intraday_change(ticker, day_start)
        if not change:
            continue
        stocks.append({
            'ticker': ticker,
            'name': name,
            'price': change['price'],
            'diff_day': change['diff'],
            'pct_day': change['pct'],
        })

    stocks.sort(key=lambda x: abs(x['pct_day']), reverse=True)
    show_all = request.GET.get('all') == '1'
    result_stocks = stocks if show_all else stocks[:10]

    return JsonResponse({
        'stocks': result_stocks,
        'has_prev': False,
        'total_tracked': len(STOCKS),
        'fetched': len(stocks),
        'timestamp': timezone.now().timestamp(),
    })


def api_chart_data(request):
    """DB から最新取引日の OHLC 分足データを返却"""
    tickers = _parse_tickers_param(request)
    if not tickers:
        return JsonResponse({'charts': {}})

    trading_date = _get_latest_trading_date()
    if not trading_date:
        return JsonResponse({'charts': {}})

    day_start = _make_day_start(trading_date)

    charts = {}
    for ticker in tickers:
        prices = StockPrice.objects.filter(
            ticker=ticker, timestamp__gte=day_start,
        ).order_by('timestamp')

        if not prices.exists():
            continue

        timestamps, opens, highs, lows, closes, volumes = _serialize_ohlcv(
            prices, 'timestamp', '%H:%M',
        )
        charts[ticker] = {
            'name': STOCKS.get(ticker, ticker),
            'timestamps': timestamps,
            'open': opens, 'high': highs, 'low': lows, 'close': closes,
            'volume': volumes,
        }

    return JsonResponse({'charts': charts})


def api_daily_chart_data(request):
    """DB から日足 OHLCV データを返却（長期チャート用）"""
    tickers = _parse_tickers_param(request)
    if not tickers:
        return JsonResponse({'charts': {}})

    months = int(request.GET.get('months', str(DEFAULT_DAILY_MONTHS)))
    start_date = None
    if months > 0:
        from dateutil.relativedelta import relativedelta
        start_date = (timezone.now().astimezone(JST).date()
                      - relativedelta(months=months))

    charts = {}
    for ticker in tickers:
        qs = DailyStockPrice.objects.filter(ticker=ticker)
        if start_date:
            qs = qs.filter(date__gte=start_date)
        prices = qs.order_by('date')

        if not prices.exists():
            continue

        dates, opens, highs, lows, closes, volumes = _serialize_ohlcv(
            prices, 'date', None,
        )
        charts[ticker] = {
            'name': STOCKS.get(ticker, ticker),
            'dates': dates,
            'open': opens, 'high': highs, 'low': lows, 'close': closes,
            'volume': volumes,
        }

    return JsonResponse({'charts': charts})


def api_market_overview(request):
    """マーケット概況（指数・為替・先物）の最新データを返却"""
    trading_date = _get_latest_trading_date()
    market_tickers = get_all_market_tickers()
    no_data = {'price': None, 'diff': None, 'pct': None}

    if not trading_date:
        result = {}
        for category, items in MARKET_OVERVIEW.items():
            result[category] = [
                {'ticker': t, 'name': n, **no_data} for t, n in items
            ]
        return JsonResponse(result)

    day_start = _make_day_start(trading_date)

    # 各ティッカーの変動を一括計算
    overview_data = {}
    for ticker, name in market_tickers.items():
        change = _calc_intraday_change(ticker, day_start)
        overview_data[ticker] = change or no_data

    # カテゴリ別に整形
    result = {}
    for category, items in MARKET_OVERVIEW.items():
        result[category] = []
        for ticker, name in items:
            d = overview_data.get(ticker, no_data)
            result[category].append({
                'ticker': ticker, 'name': name, **d,
            })

    return JsonResponse(result)


def api_stock_list(request):
    """銘柄一覧を返却（セレクトボックス用）"""
    stocks = [{'ticker': t, 'name': n} for t, n in STOCKS.items()]
    stocks.sort(key=lambda x: x['ticker'])
    return JsonResponse({'stocks': stocks})
