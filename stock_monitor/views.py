from datetime import date as date_type
from itertools import groupby

from dateutil.relativedelta import relativedelta
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone

from .config import (
    CATEGORY_JP_STOCK, CATEGORY_LABELS, DEFAULT_DAILY_MONTHS, JST,
    MAX_CHART_TICKERS, STOCKS, STOCKS_BY_CATEGORY,
    get_market_overview_for_category, get_stocks_for_category,
)
from .models import (
    DailyStockPrice, StockFundamentals, StockPrice,
)


def index(request):
    return render(request, 'stock_monitor/index.html')


# ========== 共通ヘルパー ==========

def _get_latest_trading_date():
    """DB に保存されている最新の取引日を返す"""
    ts = (
        StockPrice.objects
        .order_by('-timestamp')
        .values_list('timestamp', flat=True)
        .first()
    )
    if not ts:
        return None
    return ts.astimezone(JST).date()


def _make_day_start(trading_date):
    """取引日の 00:00 JST datetime を返す"""
    return timezone.datetime(
        trading_date.year, trading_date.month, trading_date.day, tzinfo=JST,
    )


def _calc_intraday_changes_batch(ticker_list, day_start):
    """複数銘柄の当日始値→終値の変動を一括計算する（2クエリ）。

    PostgreSQL の DISTINCT ON を使い、銘柄ごとの最初/最後のレコードを
    1クエリずつで取得する。

    Returns:
        dict: {ticker: {'price': float, 'diff': float, 'pct': float}}
    """
    if not ticker_list:
        return {}

    base_qs = StockPrice.objects.filter(
        ticker__in=ticker_list, timestamp__gte=day_start,
    )

    # 各銘柄の最初のレコード（始値）— 1クエリ
    first_prices = {}
    for sp in base_qs.order_by('ticker', 'timestamp').distinct('ticker'):
        first_prices[sp.ticker] = sp.open

    # 各銘柄の最後のレコード（終値）— 1クエリ
    last_prices = {}
    for sp in base_qs.order_by('ticker', '-timestamp').distinct('ticker'):
        last_prices[sp.ticker] = sp.close

    result = {}
    for ticker in ticker_list:
        if ticker not in first_prices:
            continue
        open_price = first_prices[ticker]
        current_price = last_prices[ticker]
        diff = round(current_price - open_price, 2)
        pct = round((diff / open_price) * 100, 2) if open_price else 0
        result[ticker] = {'price': current_price, 'diff': diff, 'pct': pct}

    return result


def _build_ohlcv_dict(records, time_field, time_format='%Y-%m-%d'):
    """モデルインスタンスのリストから OHLCV 配列を構築する"""
    timestamps, opens, highs, lows, closes, volumes = [], [], [], [], [], []
    for p in records:
        raw = getattr(p, time_field)
        if hasattr(raw, 'astimezone'):
            ts = raw.astimezone(JST).strftime(time_format)
        else:
            ts = raw.strftime(time_format)
        timestamps.append(ts)
        opens.append(p.open)
        highs.append(p.high)
        lows.append(p.low)
        closes.append(p.close)
        volumes.append(p.volume)
    return timestamps, opens, highs, lows, closes, volumes


def _find_adjacent_trading_date(tickers, boundary, direction):
    """指定境界の前後でデータが存在する取引日を検索する。

    Args:
        tickers: 対象銘柄リスト
        boundary: 境界の datetime（前日検索なら day_start、翌日検索なら day_end）
        direction: 'prev' or 'next'

    Returns:
        str (ISO date) or None
    """
    if direction == 'prev':
        ts = (
            StockPrice.objects
            .filter(ticker__in=tickers, timestamp__lt=boundary)
            .order_by('-timestamp')
            .values_list('timestamp', flat=True)
            .first()
        )
    else:
        ts = (
            StockPrice.objects
            .filter(ticker__in=tickers, timestamp__gte=boundary)
            .order_by('timestamp')
            .values_list('timestamp', flat=True)
            .first()
        )
    return ts.astimezone(JST).date().isoformat() if ts else None


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
    changes = _calc_intraday_changes_batch(
        list(category_stocks.keys()), day_start,
    )

    stocks = []
    for ticker, name in category_stocks.items():
        change = changes.get(ticker)
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

    # 全ティッカーの分足を一括取得（1クエリ）→ ticker でグループ化
    all_prices = list(
        StockPrice.objects
        .filter(ticker__in=tickers, timestamp__gte=day_start, timestamp__lt=day_end)
        .order_by('ticker', 'timestamp')
    )

    charts = {}
    for ticker, group in groupby(all_prices, key=lambda p: p.ticker):
        records = list(group)
        timestamps, opens, highs, lows, closes, volumes = _build_ohlcv_dict(
            records, 'timestamp', '%H:%M',
        )
        charts[ticker] = {
            'name': STOCKS.get(ticker, ticker),
            'timestamps': timestamps,
            'open': opens, 'high': highs, 'low': lows, 'close': closes,
            'volume': volumes,
        }

    # 前日・翌日: 選択中の銘柄でデータが存在する取引日を検索（各1クエリ）
    prev_date = _find_adjacent_trading_date(tickers, day_start, 'prev')
    next_date = _find_adjacent_trading_date(tickers, day_end, 'next')

    return JsonResponse({
        'charts': charts,
        'date': str(trading_date),
        'prev_date': prev_date,
        'next_date': next_date,
    })


def api_daily_chart_data(request):
    """DB から日足 OHLCV データを返却（長期チャート用）"""
    tickers = _parse_tickers_param(request)
    if not tickers:
        return JsonResponse({'charts': {}})

    months = int(request.GET.get('months', str(DEFAULT_DAILY_MONTHS)))
    start_date = None
    if months > 0:
        start_date = (timezone.now().astimezone(JST).date()
                      - relativedelta(months=months))

    # 全ティッカーの日足を一括取得（1クエリ）→ ticker でグループ化
    qs = DailyStockPrice.objects.filter(ticker__in=tickers)
    if start_date:
        qs = qs.filter(date__gte=start_date)
    all_prices = list(qs.order_by('ticker', 'date'))

    charts = {}
    for ticker, group in groupby(all_prices, key=lambda p: p.ticker):
        records = list(group)
        dates, opens, highs, lows, closes, volumes = _build_ohlcv_dict(
            records, 'date',
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
        return JsonResponse({
            section_name: [
                {'ticker': t, 'name': n, **no_data} for t, n in items
            ]
            for section_name, items in overview.items()
        })

    day_start = _make_day_start(trading_date)

    # 全ティッカーの変動を一括計算（2クエリ）
    all_tickers = {
        ticker: name
        for items in overview.values()
        for ticker, name in items
    }

    changes = _calc_intraday_changes_batch(list(all_tickers.keys()), day_start)

    # セクション別に整形
    result = {
        section_name: [
            {'ticker': t, 'name': n, **changes.get(t, no_data)}
            for t, n in items
        ]
        for section_name, items in overview.items()
    }

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
    descending = sort_by not in ('per', 'pbr')

    def _sort_key(x):
        val = x.get(sort_field)
        if val is None:
            return (1, 0)
        return (0, -val) if descending else (0, val)

    fundamentals.sort(key=_sort_key)

    return JsonResponse({
        'fundamentals': fundamentals,
        'date': str(target_date),
        'count': len(fundamentals),
    })
