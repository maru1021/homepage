from django.db import models


class BaseStockPrice(models.Model):
    """OHLCV 共通フィールドの抽象ベースクラス"""
    ticker = models.CharField('ティッカー', max_length=20, db_index=True)
    name = models.CharField('銘柄名', max_length=100)
    open = models.FloatField('始値')
    high = models.FloatField('高値')
    low = models.FloatField('安値')
    close = models.FloatField('終値')
    volume = models.BigIntegerField('出来高', default=0)

    class Meta:
        abstract = True


class StockPrice(BaseStockPrice):
    """分足の OHLC データを保存"""
    timestamp = models.DateTimeField('時刻', db_index=True)

    class Meta:
        ordering = ['ticker', 'timestamp']
        indexes = [
            models.Index(fields=['ticker', 'timestamp']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['ticker', 'timestamp'],
                name='unique_ticker_timestamp',
            ),
        ]
        verbose_name = '株価データ'
        verbose_name_plural = '株価データ'

    def __str__(self):
        return f'{self.name}({self.ticker}) {self.timestamp:%H:%M} C={self.close}'


class DailyStockPrice(BaseStockPrice):
    """日足の OHLCV データを保存（長期チャート用）"""
    date = models.DateField('日付', db_index=True)

    class Meta:
        ordering = ['ticker', 'date']
        indexes = [
            models.Index(fields=['ticker', 'date']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['ticker', 'date'],
                name='unique_ticker_date',
            ),
        ]
        verbose_name = '日足データ'
        verbose_name_plural = '日足データ'

    def __str__(self):
        return f'{self.name}({self.ticker}) {self.date} C={self.close}'


class StockFundamentals(models.Model):
    """ファンダメンタルズデータ（日次スナップショット）"""
    ticker = models.CharField('ティッカー', max_length=20, db_index=True)
    date = models.DateField('日付', db_index=True)
    market_cap = models.BigIntegerField('時価総額', null=True, blank=True)
    per = models.FloatField('PER', null=True, blank=True)
    pbr = models.FloatField('PBR', null=True, blank=True)
    dividend_yield = models.FloatField('配当利回り(%)', null=True, blank=True)
    eps = models.FloatField('EPS', null=True, blank=True)
    roe = models.FloatField('ROE(%)', null=True, blank=True)
    revenue = models.BigIntegerField('売上高', null=True, blank=True)
    profit_margin = models.FloatField('利益率(%)', null=True, blank=True)
    fifty_two_week_high = models.FloatField('52週高値', null=True, blank=True)
    fifty_two_week_low = models.FloatField('52週安値', null=True, blank=True)

    class Meta:
        ordering = ['ticker', '-date']
        indexes = [
            models.Index(fields=['ticker', 'date']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['ticker', 'date'],
                name='unique_fundamentals_ticker_date',
            ),
        ]
        verbose_name = 'ファンダメンタルズ'
        verbose_name_plural = 'ファンダメンタルズ'

    def __str__(self):
        return f'{self.ticker} {self.date} PER={self.per} PBR={self.pbr}'


class StockFetchLog(models.Model):
    """取得ログ（最終取得時刻の管理用）"""
    fetched_at = models.DateTimeField('取得日時', auto_now_add=True)
    tickers_count = models.IntegerField('取得銘柄数', default=0)
    success = models.BooleanField('成功', default=True)
    message = models.TextField('メッセージ', blank=True)

    class Meta:
        ordering = ['-fetched_at']
        verbose_name = '取得ログ'
        verbose_name_plural = '取得ログ'

    def __str__(self):
        return f'{self.fetched_at:%Y-%m-%d %H:%M} ({self.tickers_count}銘柄)'
