"""stock_monitor の定数・設定"""
from zoneinfo import ZoneInfo

JST = ZoneInfo('Asia/Tokyo')

# データ取得設定
FETCH_INTERVAL = 3600       # 分足取得間隔（秒）= 60分
DAILY_FETCH_DELAY = 8       # 日足初回取得時の銘柄間待機（秒）
INTRADAY_RETENTION_DAYS = 3 # 分足データの保持日数
INTRADAY_OVERLAP_MINUTES = 5  # 重複許容バッファ（直近N分は再保存）
DAILY_CLOSE_MINUTES = 910   # 閉場後の日足取得トリガー（15:10 = 15*60+10）
MAX_CHART_TICKERS = 5       # チャート同時表示の最大銘柄数
DEFAULT_DAILY_MONTHS = 6    # 長期チャートのデフォルト月数

# バッチ取得設定
BATCH_SIZE = 10             # 1回の yf.download() あたりの銘柄数
BATCH_DELAY = 15            # バッチ間の待機秒数
MAX_RETRIES = 4             # リトライ最大回数
RETRY_BACKOFF_BASE = 30     # リトライ待機の基底秒数（指数バックオフ）

# ========== カテゴリ定義 ==========

CATEGORY_JP_STOCK = 'jp_stock'
CATEGORY_US_STOCK = 'us_stock'
CATEGORY_FOREX = 'forex'
CATEGORY_CRYPTO = 'crypto'
CATEGORY_INDEX_ETF = 'index_etf'

CATEGORY_LABELS = {
    CATEGORY_JP_STOCK: '日本株',
    CATEGORY_US_STOCK: '米国株',
    CATEGORY_FOREX: '為替',
    CATEGORY_CRYPTO: '仮想通貨',
    CATEGORY_INDEX_ETF: '指数・ETF',
}

# ========== カテゴリ別銘柄 ==========

STOCKS_BY_CATEGORY = {
    CATEGORY_JP_STOCK: {
        # 時価総額上位・主要銘柄 (~100銘柄)
        "7203.T": "トヨタ自動車",
        "9984.T": "ソフトバンクG",
        "6758.T": "ソニーG",
        "8306.T": "三菱UFJ",
        "9432.T": "NTT",
        "6861.T": "キーエンス",
        "7974.T": "任天堂",
        "6098.T": "リクルートHD",
        "8035.T": "東京エレクトロン",
        "4063.T": "信越化学",
        "6501.T": "日立製作所",
        "7741.T": "HOYA",
        "4519.T": "中外製薬",
        "9433.T": "KDDI",
        "6902.T": "デンソー",
        "6367.T": "ダイキン工業",
        "4568.T": "第一三共",
        "8058.T": "三菱商事",
        "8766.T": "東京海上HD",
        "9983.T": "ファーストリテイリング",
        "6981.T": "村田製作所",
        "4661.T": "OLC",
        "8001.T": "伊藤忠商事",
        "7267.T": "本田技研",
        "4502.T": "武田薬品",
        "6702.T": "富士通",
        "2914.T": "日本たばこ",
        "8031.T": "三井物産",
        "4901.T": "富士フイルム",
        "7832.T": "バンダイナムコ",
        "6857.T": "アドバンテスト",
        "6920.T": "レーザーテック",
        "7011.T": "三菱重工",
        "6273.T": "SMC",
        "8316.T": "三井住友FG",
        "8411.T": "みずほFG",
        "6971.T": "京セラ",
        "3407.T": "旭化成",
        "6301.T": "小松製作所",
        "4503.T": "アステラス製薬",
        "6762.T": "TDK",
        "7751.T": "キヤノン",
        "5401.T": "日本製鉄",
        "2802.T": "味の素",
        "4578.T": "大塚HD",
        "6954.T": "ファナック",
        "8591.T": "オリックス",
        "9434.T": "ソフトバンク",
        "3659.T": "ネクソン",
        "2801.T": "キッコーマン",
        # 追加銘柄
        "6594.T": "日本電産",
        "6723.T": "ルネサスエレクトロニクス",
        "4543.T": "テルモ",
        "6869.T": "シスメックス",
        "4911.T": "資生堂",
        "6988.T": "日東電工",
        "3382.T": "セブン&アイ",
        "8053.T": "住友商事",
        "2502.T": "アサヒグループ",
        "4507.T": "塩野義製薬",
        "6752.T": "パナソニックHD",
        "7269.T": "スズキ",
        "6326.T": "クボタ",
        "7201.T": "日産自動車",
        "8725.T": "MS&AD",
        "8750.T": "第一生命HD",
        "8802.T": "三菱地所",
        "8801.T": "三井不動産",
        "9020.T": "JR東日本",
        "9022.T": "JR東海",
        "9021.T": "JR西日本",
        "9101.T": "日本郵船",
        "9104.T": "商船三井",
        "9107.T": "川崎汽船",
        "5713.T": "住友金属鉱山",
        "5020.T": "ENEOS",
        "4188.T": "三菱ケミカルG",
        "3405.T": "クラレ",
        "6305.T": "日立建機",
        "7733.T": "オリンパス",
        "4385.T": "メルカリ",
        "6526.T": "ソシオネクスト",
        "6146.T": "ディスコ",
        "4755.T": "楽天グループ",
        "2413.T": "エムスリー",
        "6503.T": "三菱電機",
        "7182.T": "ゆうちょ銀行",
        "8309.T": "三井住友トラスト",
        "4452.T": "花王",
        "6506.T": "安川電機",
        "7735.T": "SCREENホールディングス",
        "6479.T": "ミネベアミツミ",
        "9843.T": "ニトリHD",
        "2871.T": "ニチレイ",
        "7272.T": "ヤマハ発動機",
        "6753.T": "シャープ",
        "6178.T": "日本郵政",
        "3086.T": "Jフロントリテイリング",
        "2269.T": "明治HD",
    },

    CATEGORY_US_STOCK: {
        # メガキャップ (Magnificent 7 + α)
        "AAPL": "Apple",
        "MSFT": "Microsoft",
        "GOOGL": "Alphabet",
        "AMZN": "Amazon",
        "NVDA": "NVIDIA",
        "TSLA": "Tesla",
        "META": "Meta",
        # テック大手
        "NFLX": "Netflix",
        "AMD": "AMD",
        "INTC": "Intel",
        "CRM": "Salesforce",
        "ORCL": "Oracle",
        "AVGO": "Broadcom",
        "ADBE": "Adobe",
        "CSCO": "Cisco",
        "QCOM": "Qualcomm",
        "TXN": "Texas Instruments",
        "IBM": "IBM",
        "MU": "Micron",
        "AMAT": "Applied Materials",
        "LRCX": "Lam Research",
        "KLAC": "KLA Corp",
        "MRVL": "Marvell",
        "SNPS": "Synopsys",
        "CDNS": "Cadence",
        "NOW": "ServiceNow",
        "PANW": "Palo Alto Networks",
        "CRWD": "CrowdStrike",
        # 金融
        "JPM": "JPMorgan Chase",
        "BAC": "Bank of America",
        "WFC": "Wells Fargo",
        "GS": "Goldman Sachs",
        "MS": "Morgan Stanley",
        "BLK": "BlackRock",
        "V": "Visa",
        "MA": "Mastercard",
        "AXP": "American Express",
        # ヘルスケア
        "JNJ": "Johnson & Johnson",
        "UNH": "UnitedHealth",
        "LLY": "Eli Lilly",
        "PFE": "Pfizer",
        "ABBV": "AbbVie",
        "MRK": "Merck",
        "TMO": "Thermo Fisher",
        "ABT": "Abbott Labs",
        "AMGN": "Amgen",
        # 消費財・小売
        "WMT": "Walmart",
        "PG": "Procter & Gamble",
        "KO": "Coca-Cola",
        "PEP": "PepsiCo",
        "COST": "Costco",
        "MCD": "McDonald's",
        "NKE": "Nike",
        "SBUX": "Starbucks",
        "DIS": "Walt Disney",
        # 産業・エネルギー
        "XOM": "ExxonMobil",
        "CVX": "Chevron",
        "CAT": "Caterpillar",
        "BA": "Boeing",
        "LMT": "Lockheed Martin",
        "RTX": "RTX Corp",
        "GE": "GE Aerospace",
        "HON": "Honeywell",
        "UPS": "UPS",
        "DE": "Deere & Co",
        # その他注目
        "UBER": "Uber",
        "COIN": "Coinbase",
        "XYZ": "Block",
        "SHOP": "Shopify",
        "PLTR": "Palantir",
        "SNOW": "Snowflake",
        "RIVN": "Rivian",
        "ABNB": "Airbnb",
        "DKNG": "DraftKings",
        "RBLX": "Roblox",
        "ARM": "Arm Holdings",
        "SMCI": "Super Micro Computer",
    },

    CATEGORY_FOREX: {
        # 主要通貨ペア
        "USDJPY=X": "USD/JPY",
        "EURJPY=X": "EUR/JPY",
        "GBPJPY=X": "GBP/JPY",
        "AUDJPY=X": "AUD/JPY",
        "NZDJPY=X": "NZD/JPY",
        "CADJPY=X": "CAD/JPY",
        "CHFJPY=X": "CHF/JPY",
        "CNYJPY=X": "CNY/JPY",
        "HKDJPY=X": "HKD/JPY",
        "KRWJPY=X": "KRW/JPY",
        # ドルストレート
        "EURUSD=X": "EUR/USD",
        "GBPUSD=X": "GBP/USD",
        "AUDUSD=X": "AUD/USD",
        "NZDUSD=X": "NZD/USD",
        "USDCHF=X": "USD/CHF",
        "USDCAD=X": "USD/CAD",
        "USDCNH=X": "USD/CNH",
        # クロスカレンシー
        "EURGBP=X": "EUR/GBP",
        "EURAUD=X": "EUR/AUD",
        "GBPAUD=X": "GBP/AUD",
    },

    CATEGORY_CRYPTO: {
        # 時価総額上位
        "BTC-USD": "Bitcoin",
        "ETH-USD": "Ethereum",
        "XRP-USD": "Ripple",
        "SOL-USD": "Solana",
        "BNB-USD": "BNB",
        "ADA-USD": "Cardano",
        "DOGE-USD": "Dogecoin",
        "TRX-USD": "TRON",
        "AVAX-USD": "Avalanche",
        "DOT-USD": "Polkadot",
        "LINK-USD": "Chainlink",
        "MATIC-USD": "Polygon",
        "SHIB-USD": "Shiba Inu",
        "UNI-USD": "Uniswap",
        "LTC-USD": "Litecoin",
        "ATOM-USD": "Cosmos",
        "XLM-USD": "Stellar",
        "NEAR-USD": "NEAR Protocol",
        "APT-USD": "Aptos",
        "FIL-USD": "Filecoin",
        "AAVE-USD": "Aave",
        "ARB-USD": "Arbitrum",
        "OP-USD": "Optimism",
        "SUI-USD": "Sui",
        "SEI-USD": "Sei",
        "PEPE-USD": "Pepe",
        "RENDER-USD": "Render",
        "INJ-USD": "Injective",
        "FET-USD": "Fetch.ai",
        "ALGO-USD": "Algorand",
    },

    CATEGORY_INDEX_ETF: {
        # 日本指数
        "^N225": "日経平均",
        "1306.T": "TOPIX連動ETF",
        "2516.T": "グロース250ETF",
        "1321.T": "日経225連動ETF",
        "1570.T": "日経レバレッジETF",
        "1357.T": "日経ダブルインバース",
        # 米国指数
        "^GSPC": "S&P 500",
        "^DJI": "ダウ平均",
        "^IXIC": "NASDAQ総合",
        "^RUT": "Russell 2000",
        "^VIX": "VIX恐怖指数",
        # 米国ETF
        "SPY": "SPDR S&P 500",
        "QQQ": "Invesco QQQ",
        "IWM": "iShares Russell 2000",
        "DIA": "SPDR ダウ",
        "VOO": "Vanguard S&P 500",
        "VTI": "Vanguard Total Stock",
        "ARKK": "ARK Innovation",
        "SOXL": "半導体ブル3倍",
        "TQQQ": "NASDAQ ブル3倍",
        # その他指数
        "^FTSE": "FTSE 100",
        "^GDAXI": "DAX",
        "^HSI": "ハンセン指数",
        "000001.SS": "上海総合",
        "^KS11": "韓国KOSPI",
        "^BSESN": "インドSENSEX",
        # 先物
        "NIY=F": "日経先物",
        "ES=F": "S&P先物",
        "YM=F": "ダウ先物",
        "NQ=F": "NASDAQ先物",
        "GC=F": "金先物",
        "SI=F": "銀先物",
        "CL=F": "原油先物(WTI)",
    },
}

# 後方互換: 全カテゴリのフラット union
STOCKS = {}
for _cat_stocks in STOCKS_BY_CATEGORY.values():
    STOCKS.update(_cat_stocks)

# ========== カテゴリ別マーケット概況 ==========

MARKET_OVERVIEW_BY_CATEGORY = {
    CATEGORY_JP_STOCK: {
        '主要指数': [("^N225", "日経平均"), ("1306.T", "TOPIX"), ("2516.T", "グロース250")],
        '為替': [("USDJPY=X", "USD/JPY"), ("EURJPY=X", "EUR/JPY")],
        '先物': [("NIY=F", "日経先物"), ("ES=F", "S&P先物")],
    },
    CATEGORY_US_STOCK: {
        '主要指数': [("^GSPC", "S&P 500"), ("^DJI", "ダウ平均"), ("^IXIC", "NASDAQ")],
        '為替': [("USDJPY=X", "USD/JPY"), ("EURUSD=X", "EUR/USD")],
        '先物': [("ES=F", "S&P先物"), ("NQ=F", "NASDAQ先物"), ("YM=F", "ダウ先物")],
    },
    CATEGORY_FOREX: {
        '円クロス': [("USDJPY=X", "USD/JPY"), ("EURJPY=X", "EUR/JPY"), ("GBPJPY=X", "GBP/JPY")],
        'ドルストレート': [("EURUSD=X", "EUR/USD"), ("GBPUSD=X", "GBP/USD"), ("AUDUSD=X", "AUD/USD")],
    },
    CATEGORY_CRYPTO: {
        '主要通貨': [("BTC-USD", "Bitcoin"), ("ETH-USD", "Ethereum"), ("XRP-USD", "Ripple")],
        '指数参考': [("^GSPC", "S&P 500"), ("USDJPY=X", "USD/JPY")],
    },
    CATEGORY_INDEX_ETF: {
        '日本': [("^N225", "日経平均"), ("1306.T", "TOPIX")],
        '米国': [("^GSPC", "S&P 500"), ("^DJI", "ダウ平均"), ("^IXIC", "NASDAQ")],
        '先物': [("NIY=F", "日経先物"), ("ES=F", "S&P先物"), ("GC=F", "金先物"), ("CL=F", "原油先物")],
    },
}

# 後方互換
MARKET_OVERVIEW = MARKET_OVERVIEW_BY_CATEGORY[CATEGORY_JP_STOCK]

# ========== CoinGecko マッピング（仮想通貨） ==========
# yfinance ticker → CoinGecko ID
CRYPTO_COINGECKO_MAP = {
    "BTC-USD": "bitcoin",
    "ETH-USD": "ethereum",
    "XRP-USD": "ripple",
    "SOL-USD": "solana",
    "BNB-USD": "binancecoin",
    "ADA-USD": "cardano",
    "DOGE-USD": "dogecoin",
    "TRX-USD": "tron",
    "AVAX-USD": "avalanche-2",
    "DOT-USD": "polkadot",
    "LINK-USD": "chainlink",
    "MATIC-USD": "polygon-ecosystem-token",
    "SHIB-USD": "shiba-inu",
    "UNI-USD": "uniswap",
    "LTC-USD": "litecoin",
    "ATOM-USD": "cosmos",
    "XLM-USD": "stellar",
    "NEAR-USD": "near",
    "APT-USD": "aptos",
    "FIL-USD": "filecoin",
    "AAVE-USD": "aave",
    "ARB-USD": "arbitrum",
    "OP-USD": "optimism",
    "SUI-USD": "sui",
    "SEI-USD": "sei-network",
    "PEPE-USD": "pepe",
    "RENDER-USD": "render-token",
    "INJ-USD": "injective-protocol",
    "FET-USD": "fetch-ai",
    "ALGO-USD": "algorand",
}


# ========== ヘルパー関数 ==========

def is_market_open():
    """いずれかの市場が開いているかどうかを返す"""
    return bool(get_active_categories())


def get_active_categories():
    """現在取得すべきカテゴリのリストを返す"""
    from django.utils import timezone
    now = timezone.now().astimezone(JST)
    weekday = now.weekday()  # 0=月 ... 6=日
    minutes = now.hour * 60 + now.minute
    active = []

    # 日本株: 平日 9:00〜15:00 JST
    if weekday < 5 and 540 <= minutes < 900:
        active.append(CATEGORY_JP_STOCK)

    # 米国株: 平日 23:30〜翌6:00 JST（通常時）/ 22:30〜翌5:00（サマータイム）
    # ※簡易実装: 22:00〜翌7:00 で広めにカバー（プレ・アフター含む）
    # 月曜〜金曜の夜 or 火曜〜土曜の朝
    us_night = weekday < 5 and minutes >= 1320  # 平日22:00以降
    us_morning = 0 < weekday <= 5 and minutes < 420  # 火〜土の7:00まで
    # 月曜朝は米国市場は開いていない（日曜夜に相当するため除外）
    if us_night or us_morning:
        active.append(CATEGORY_US_STOCK)

    # 為替: 月曜 5:00 JST 〜 土曜 7:00 JST（ほぼ24/5）
    forex_open = False
    if weekday == 0:  # 月曜
        forex_open = minutes >= 300  # 5:00以降
    elif 1 <= weekday <= 4:  # 火〜金
        forex_open = True  # 24時間
    elif weekday == 5:  # 土曜
        forex_open = minutes < 420  # 7:00まで
    if forex_open:
        active.append(CATEGORY_FOREX)

    # 仮想通貨: 24時間365日
    active.append(CATEGORY_CRYPTO)

    # 指数・ETF: 日本市場 or 米国市場のどちらかが開いていれば取得
    if CATEGORY_JP_STOCK in active or CATEGORY_US_STOCK in active:
        active.append(CATEGORY_INDEX_ETF)
    else:
        # 先物は為替と同様ほぼ24/5で動いているので、為替が開いていれば先物も取得
        if CATEGORY_FOREX in active:
            active.append(CATEGORY_INDEX_ETF)

    return active


def get_stocks_for_category(category):
    """カテゴリの銘柄 dict を返す"""
    return STOCKS_BY_CATEGORY.get(category, {})


def get_market_overview_for_category(category):
    """カテゴリに応じた MARKET_OVERVIEW を返す"""
    return MARKET_OVERVIEW_BY_CATEGORY.get(category, MARKET_OVERVIEW)


def get_all_market_tickers():
    """全カテゴリの MARKET_OVERVIEW ティッカーを {ticker: name} で返す"""
    result = {}
    for cat_overview in MARKET_OVERVIEW_BY_CATEGORY.values():
        for items in cat_overview.values():
            for ticker, name in items:
                result[ticker] = name
    return result
