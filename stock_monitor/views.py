import logging

from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone

from .config import (
    CATEGORY_JP_STOCK, CATEGORY_LABELS, DEFAULT_DAILY_MONTHS,
    INTRADAY_RETENTION_DAYS, JST,
    MAX_CHART_TICKERS, STOCKS, STOCKS_BY_CATEGORY,
    get_market_overview_for_category, get_stocks_for_category,
)
from .models import (
    DailyStockPrice, StockFundamentals, StockPrice,
)

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


def _parse_category(request):
    """リクエストからカテゴリを取得。無効なら jp_stock を返す"""
    cat = request.GET.get('category', CATEGORY_JP_STOCK)
    if cat not in STOCKS_BY_CATEGORY:
        return CATEGORY_JP_STOCK
    return cat


# ========== API エンドポイント ==========

def api_prices(request):
    """DB から最新取引日の価格と始値を取得して返却（カテゴリフィルタ対応）"""
    category = _parse_category(request)
    category_stocks = get_stocks_for_category(category)

    trading_date = _get_latest_trading_date()
    if not trading_date:
        return JsonResponse({
            'stocks': [],
            'total_tracked': len(category_stocks), 'fetched': 0,
        })

    day_start = _make_day_start(trading_date)

    stocks = []
    for ticker, name in category_stocks.items():
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
        'total_tracked': len(category_stocks),
        'fetched': len(stocks),
    })



def api_chart_data(request):
    """DB から指定日の OHLC 分足データを返却。

    パラメータ:
        tickers: カンマ区切りの銘柄コード
        date: 取引日 (YYYY-MM-DD)。省略時は最新取引日
    """
    tickers = _parse_tickers_param(request)
    if not tickers:
        return JsonResponse({'charts': {}})

    date_param = request.GET.get('date')

    if date_param:
        from datetime import date as date_type
        try:
            trading_date = date_type.fromisoformat(date_param)
        except ValueError:
            return JsonResponse({'charts': {}})
    else:
        trading_date = _get_latest_trading_date()
        if not trading_date:
            return JsonResponse({'charts': {}})

    day_start = _make_day_start(trading_date)
    day_end = day_start + timezone.timedelta(days=1)

    charts = {}

    # 前日・翌日ボタン: 保持日数の範囲内なら表示
    today = timezone.now().astimezone(JST).date()
    oldest_date = today - timezone.timedelta(days=INTRADAY_RETENTION_DAYS)
    has_prev = trading_date > oldest_date
    has_next = trading_date < today

    for ticker in tickers:
        prices = StockPrice.objects.filter(
            ticker=ticker, timestamp__gte=day_start, timestamp__lt=day_end,
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

    return JsonResponse({
        'charts': charts,
        'date': str(trading_date),
        'has_prev': has_prev,
        'has_next': has_next,
    })


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
    """カテゴリに応じたマーケット概況データを返却"""
    category = _parse_category(request)
    overview = get_market_overview_for_category(category)
    trading_date = _get_latest_trading_date()
    no_data = {'price': None, 'diff': None, 'pct': None}

    if not trading_date:
        result = {}
        for section_name, items in overview.items():
            result[section_name] = [
                {'ticker': t, 'name': n, **no_data} for t, n in items
            ]
        return JsonResponse(result)

    day_start = _make_day_start(trading_date)

    # 全ティッカーの変動を一括計算
    all_tickers = {}
    for items in overview.values():
        for ticker, name in items:
            all_tickers[ticker] = name

    overview_data = {}
    for ticker in all_tickers:
        change = _calc_intraday_change(ticker, day_start)
        overview_data[ticker] = change or no_data

    # セクション別に整形
    result = {}
    for section_name, items in overview.items():
        result[section_name] = []
        for ticker, name in items:
            d = overview_data.get(ticker, no_data)
            result[section_name].append({
                'ticker': ticker, 'name': name, **d,
            })

    return JsonResponse(result)


def api_stock_list(request):
    """銘柄一覧を返却（カテゴリフィルタ対応）"""
    category = request.GET.get('category', '')
    if category and category in STOCKS_BY_CATEGORY:
        source = get_stocks_for_category(category)
    else:
        source = STOCKS
    stocks = [{'ticker': t, 'name': n} for t, n in source.items()]
    stocks.sort(key=lambda x: x['ticker'])
    return JsonResponse({'stocks': stocks})


def api_categories(request):
    """カテゴリ一覧を返却"""
    categories = [
        {'key': k, 'label': v, 'count': len(STOCKS_BY_CATEGORY[k])}
        for k, v in CATEGORY_LABELS.items()
    ]
    return JsonResponse({'categories': categories})


def api_stock_scores(request):
    """カテゴリ内の銘柄スコアリング結果を返却"""
    from .analysis import score_category

    category = _parse_category(request)
    sort_by = request.GET.get('sort', 'combined')
    limit = int(request.GET.get('limit', '0'))

    results = score_category(category)

    sort_key = {
        'short_term': 'short_term_score',
        'long_term': 'long_term_score',
    }.get(sort_by, 'combined_score')

    results.sort(key=lambda x: x.get(sort_key, 0), reverse=True)

    if limit > 0:
        results = results[:limit]

    return JsonResponse({
        'category': category,
        'scores': results,
        'count': len(results),
    })


def api_fundamentals(request):
    """カテゴリ内の最新ファンダメンタルズデータを返却"""
    category = _parse_category(request)
    category_stocks = get_stocks_for_category(category)
    sort_by = request.GET.get('sort', 'market_cap')

    empty = {'fundamentals': [], 'date': None, 'count': 0}

    # 最新日付のデータを取得
    try:
        latest = StockFundamentals.objects.filter(
            ticker__in=category_stocks.keys(),
        ).order_by('-date').first()
    except Exception:
        return JsonResponse(empty)

    if not latest:
        return JsonResponse(empty)

    target_date = latest.date
    qs = StockFundamentals.objects.filter(
        ticker__in=category_stocks.keys(),
        date=target_date,
    )

    fields = [
        'ticker', 'market_cap', 'per', 'pbr', 'dividend_yield',
        'eps', 'roe', 'revenue', 'profit_margin',
        'fifty_two_week_high', 'fifty_two_week_low',
    ]
    fundamentals = []
    for f in qs.values(*fields):
        f['name'] = category_stocks.get(f['ticker'], f['ticker'])
        fundamentals.append(f)

    # ソート（null は末尾へ）
    sort_field = sort_by if sort_by in fields else 'market_cap'
    reverse = sort_by != 'per' and sort_by != 'pbr'
    fundamentals.sort(
        key=lambda x: (x.get(sort_field) is None, -(x.get(sort_field) or 0) if reverse else (x.get(sort_field) or float('inf'))),
    )

    return JsonResponse({
        'fundamentals': fundamentals,
        'date': str(target_date),
        'count': len(fundamentals),
    })
