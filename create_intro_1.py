import django, os, sys
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
django.setup()
from blog.models import Article, Classification

articles = []

# 1. アニメーション入門
cls = Classification.objects.get(slug='js-sample-animation')
articles.append({
    'cls': cls,
    'title': 'JSアニメーションライブラリの選び方｜初心者ガイド',
    'short_title': 'アニメーション入門',
    'slug': 'js-animation-guide',
    'excerpt': 'GSAP・Anime.js・Typed.jsなど、JSアニメーションライブラリの特徴と使い分けを初心者向けに解説します。',
    'content': '''<p>Webサイトにアニメーションを加えると、ユーザー体験が大きく向上します。ここでは、代表的なJavaScriptアニメーションライブラリの特徴と使い分けを紹介します。</p>

<h2 class="section-title">アニメーションライブラリとは？</h2>

<p>CSSだけでもアニメーションは作れますが、<strong>複雑なタイミング制御</strong>や<strong>インタラクティブな動き</strong>を実装するには、JavaScriptライブラリが便利です。ライブラリを使うことで、数行のコードでプロ品質のアニメーションを実現できます。</p>

<div class="info-box"><div class="info-title">CSSアニメーションとの違い</div>
<ul>
<li><strong>CSS</strong>: シンプルなホバー効果やフェードに最適。軽量で高速</li>
<li><strong>JSライブラリ</strong>: 複数要素の連携、スクロール連動、物理演算など複雑な動きに最適</li>
</ul></div>

<h2 class="section-title">ライブラリ比較表</h2>

<table style="width:100%; border-collapse:collapse; font-size:14px;">
<thead><tr style="background:#6c5ce7; color:#fff;">
<th style="padding:10px; text-align:left;">ライブラリ</th>
<th style="padding:10px; text-align:left;">特徴</th>
<th style="padding:10px; text-align:left;">サイズ</th>
<th style="padding:10px; text-align:left;">おすすめ用途</th>
</tr></thead>
<tbody>
<tr style="background:#f8f9fa;"><td style="padding:8px; border-bottom:1px solid #eee;"><strong>GSAP</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">業界標準。最も高機能</td><td style="padding:8px; border-bottom:1px solid #eee;">~25KB</td><td style="padding:8px; border-bottom:1px solid #eee;">本格的なWebアニメーション全般</td></tr>
<tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Anime.js</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">軽量で直感的なAPI</td><td style="padding:8px; border-bottom:1px solid #eee;">~17KB</td><td style="padding:8px; border-bottom:1px solid #eee;">UI要素のアニメーション</td></tr>
<tr style="background:#f8f9fa;"><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Typed.js</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">タイプライター効果専用</td><td style="padding:8px; border-bottom:1px solid #eee;">~5KB</td><td style="padding:8px; border-bottom:1px solid #eee;">ヒーローセクションの文字演出</td></tr>
<tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>tsParticles</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">パーティクル背景エフェクト</td><td style="padding:8px; border-bottom:1px solid #eee;">~40KB</td><td style="padding:8px; border-bottom:1px solid #eee;">背景装飾・ヒーローセクション</td></tr>
<tr style="background:#f8f9fa;"><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Vivus</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">SVG線画アニメーション</td><td style="padding:8px; border-bottom:1px solid #eee;">~6KB</td><td style="padding:8px; border-bottom:1px solid #eee;">ロゴ・アイコンの登場演出</td></tr>
<tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Splitting.js</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">テキスト分割アニメーション</td><td style="padding:8px; border-bottom:1px solid #eee;">~2KB</td><td style="padding:8px; border-bottom:1px solid #eee;">見出し・タイトルの文字演出</td></tr>
<tr style="background:#f8f9fa;"><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Lottie-web</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">After Effectsアニメーション再生</td><td style="padding:8px; border-bottom:1px solid #eee;">~50KB</td><td style="padding:8px; border-bottom:1px solid #eee;">デザイナーが作った高品質アニメ</td></tr>
</tbody></table>

<h2 class="section-title">どれを選べばいい？</h2>

<div class="info-box"><div class="info-title">目的別おすすめ</div>
<ul>
<li><strong>迷ったらGSAP</strong>: 最も多機能で、学んだ知識が長く使える業界標準</li>
<li><strong>手軽に始めたい</strong>: Anime.jsが軽量で直感的。初心者に最適</li>
<li><strong>タイピング演出だけ</strong>: Typed.jsが最もシンプル</li>
<li><strong>背景を華やかに</strong>: tsParticlesでパーティクル背景</li>
<li><strong>SVGロゴを動かす</strong>: Vivusで線画アニメーション</li>
<li><strong>デザイナーと協業</strong>: Lottie-webでAfter Effectsの成果物を活用</li>
</ul></div>

<p>各ライブラリの具体的な使い方は、サイドバーから個別のサンプル記事を参照してください。</p>'''
})

# 2. グラフ・可視化入門
cls = Classification.objects.get(slug='js-sample-chart')
articles.append({
    'cls': cls,
    'title': 'JSグラフ・データ可視化ライブラリの選び方｜初心者ガイド',
    'short_title': 'グラフ・可視化入門',
    'slug': 'js-chart-guide',
    'excerpt': 'Chart.js・D3.js・ApexCharts・EChartsなど、グラフ描画ライブラリの特徴と使い分けを初心者向けに解説します。',
    'content': '''<p>データをグラフやチャートで表示すると、数字の羅列よりもずっと直感的に理解できます。ここでは代表的なJavaScriptグラフライブラリの特徴と使い分けを紹介します。</p>

<h2 class="section-title">グラフライブラリとは？</h2>

<p>JavaScriptのグラフライブラリを使うと、JSONやAPIから取得したデータを<strong>棒グラフ・折れ線グラフ・円グラフ</strong>などに自動変換して表示できます。多くのライブラリはツールチップやズームなどのインタラクティブ機能を標準搭載しています。</p>

<h2 class="section-title">ライブラリ比較表</h2>

<table style="width:100%; border-collapse:collapse; font-size:14px;">
<thead><tr style="background:#6c5ce7; color:#fff;">
<th style="padding:10px; text-align:left;">ライブラリ</th>
<th style="padding:10px; text-align:left;">特徴</th>
<th style="padding:10px; text-align:left;">難易度</th>
<th style="padding:10px; text-align:left;">おすすめ用途</th>
</tr></thead>
<tbody>
<tr style="background:#f8f9fa;"><td style="padding:8px; border-bottom:1px solid #eee;"><strong>ApexCharts</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">美しいデザイン、設定が簡単</td><td style="padding:8px; border-bottom:1px solid #eee;">★☆☆ 易しい</td><td style="padding:8px; border-bottom:1px solid #eee;">ダッシュボード、管理画面</td></tr>
<tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>ECharts</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">大量データに強い、多機能</td><td style="padding:8px; border-bottom:1px solid #eee;">★★☆ 普通</td><td style="padding:8px; border-bottom:1px solid #eee;">業務システム、大規模データ</td></tr>
<tr style="background:#f8f9fa;"><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Plotly.js</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">科学向け、3D対応</td><td style="padding:8px; border-bottom:1px solid #eee;">★★☆ 普通</td><td style="padding:8px; border-bottom:1px solid #eee;">データ分析、研究発表</td></tr>
<tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>D3.js</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">自由度最大、SVGベース</td><td style="padding:8px; border-bottom:1px solid #eee;">★★★ 難しい</td><td style="padding:8px; border-bottom:1px solid #eee;">カスタムビジュアライゼーション</td></tr>
<tr style="background:#f8f9fa;"><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Mermaid.js</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">テキスト記法で図を生成</td><td style="padding:8px; border-bottom:1px solid #eee;">★☆☆ 易しい</td><td style="padding:8px; border-bottom:1px solid #eee;">フローチャート、シーケンス図</td></tr>
<tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Rough.js</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">手書き風の描画</td><td style="padding:8px; border-bottom:1px solid #eee;">★☆☆ 易しい</td><td style="padding:8px; border-bottom:1px solid #eee;">プレゼン、教育コンテンツ</td></tr>
</tbody></table>

<h2 class="section-title">どれを選べばいい？</h2>

<div class="info-box"><div class="info-title">目的別おすすめ</div>
<ul>
<li><strong>手っ取り早く美しいグラフ</strong>: ApexChartsが最も簡単で見栄えが良い</li>
<li><strong>大量データを扱う業務システム</strong>: EChartsがパフォーマンスに優れる</li>
<li><strong>科学的なデータ分析</strong>: Plotly.jsが3Dグラフにも対応</li>
<li><strong>完全にカスタムな可視化</strong>: D3.jsは学習コストが高いが自由度最大</li>
<li><strong>ドキュメントに図を埋め込む</strong>: Mermaid.jsでテキストから自動生成</li>
<li><strong>親しみやすい手書き風</strong>: Rough.jsでスケッチ風の図を描画</li>
</ul></div>

<p>各ライブラリの具体的な使い方は、サイドバーから個別のサンプル記事を参照してください。</p>'''
})

# 3. ネットワーク図入門
cls = Classification.objects.get(slug='js-sample-network')
articles.append({
    'cls': cls,
    'title': 'JSネットワーク図ライブラリの選び方｜初心者ガイド',
    'short_title': 'ネットワーク図入門',
    'slug': 'js-network-guide',
    'excerpt': 'vis-network・Cytoscape.jsなどネットワーク図ライブラリの特徴と使い分けを初心者向けに解説します。',
    'content': '''<p>ネットワーク図（グラフ構造）は、システム構成図やSNSの関係図、依存関係の可視化などに使われます。ここでは代表的なライブラリを比較します。</p>

<h2 class="section-title">ネットワーク図ライブラリとは？</h2>

<p>ネットワーク図ライブラリは、<strong>ノード（点）</strong>と<strong>エッジ（線）</strong>で構成されるグラフ構造をインタラクティブに描画します。ドラッグでノードを動かしたり、ズームで全体を俯瞰したりできます。</p>

<h2 class="section-title">ライブラリ比較</h2>

<table style="width:100%; border-collapse:collapse; font-size:14px;">
<thead><tr style="background:#6c5ce7; color:#fff;">
<th style="padding:10px; text-align:left;">ライブラリ</th>
<th style="padding:10px; text-align:left;">特徴</th>
<th style="padding:10px; text-align:left;">おすすめ用途</th>
</tr></thead>
<tbody>
<tr style="background:#f8f9fa;"><td style="padding:8px; border-bottom:1px solid #eee;"><strong>vis-network</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">設定が簡単、物理演算あり</td><td style="padding:8px; border-bottom:1px solid #eee;">システム構成図、組織図</td></tr>
<tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Cytoscape.js</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">レイアウトアルゴリズムが豊富</td><td style="padding:8px; border-bottom:1px solid #eee;">依存関係、生物学的ネットワーク</td></tr>
</tbody></table>

<div class="info-box"><div class="info-title">どちらを選ぶ？</div>
<ul>
<li><strong>素早く構成図を作りたい</strong>: vis-networkが設定項目が少なく手軽</li>
<li><strong>複雑なレイアウトや分析が必要</strong>: Cytoscape.jsがアルゴリズムが充実</li>
</ul></div>

<p>各ライブラリの具体的な使い方は、サイドバーから個別のサンプル記事を参照してください。</p>'''
})

# 4. UIコンポーネント入門
cls = Classification.objects.get(slug='js-sample-ui')
articles.append({
    'cls': cls,
    'title': 'JS UIコンポーネントライブラリの選び方｜初心者ガイド',
    'short_title': 'UIコンポーネント入門',
    'slug': 'js-ui-guide',
    'excerpt': 'Splide・GLightbox・Masonry・Micromodalなど、UIコンポーネントライブラリの特徴と使い分けを初心者向けに解説します。',
    'content': '''<p>スライダー、モーダル、グリッドレイアウトなどのUI部品は、ゼロから作ると大変です。専用のライブラリを使えば、数行のコードで高品質なUIを実現できます。</p>

<h2 class="section-title">UIコンポーネントライブラリとは？</h2>

<p>Webサイトでよく使われるUI部品（スライダー、ライトボックス、モーダルなど）を簡単に実装できるライブラリです。デザインやアクセシビリティも考慮されています。</p>

<h2 class="section-title">ライブラリ比較表</h2>

<table style="width:100%; border-collapse:collapse; font-size:14px;">
<thead><tr style="background:#6c5ce7; color:#fff;">
<th style="padding:10px; text-align:left;">ライブラリ</th>
<th style="padding:10px; text-align:left;">種類</th>
<th style="padding:10px; text-align:left;">特徴</th>
</tr></thead>
<tbody>
<tr style="background:#f8f9fa;"><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Splide</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">スライダー</td><td style="padding:8px; border-bottom:1px solid #eee;">軽量（30KB）、アクセシブル、ループ・自動再生対応</td></tr>
<tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>GLightbox</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">ライトボックス</td><td style="padding:8px; border-bottom:1px solid #eee;">画像・動画のポップアップ表示、タッチ対応</td></tr>
<tr style="background:#f8f9fa;"><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Micromodal.js</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">モーダル</td><td style="padding:8px; border-bottom:1px solid #eee;">超軽量（1KB）、WAI-ARIA準拠のアクセシブルモーダル</td></tr>
<tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Masonry</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">グリッド</td><td style="padding:8px; border-bottom:1px solid #eee;">Pinterest風のレンガ状レイアウト</td></tr>
<tr style="background:#f8f9fa;"><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Floating UI</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">位置計算</td><td style="padding:8px; border-bottom:1px solid #eee;">ツールチップ・ポップオーバーの位置を正確に計算</td></tr>
</tbody></table>

<div class="info-box"><div class="info-title">目的別おすすめ</div>
<ul>
<li><strong>画像カルーセル</strong>: Splideが軽量で設定も簡単</li>
<li><strong>画像ギャラリーの拡大表示</strong>: GLightboxがモダンで使いやすい</li>
<li><strong>確認ダイアログ</strong>: Micromodal.jsが最小構成で実装できる</li>
<li><strong>カード型レイアウト</strong>: Masonryで高さの異なる要素を隙間なく配置</li>
<li><strong>独自ツールチップを作る</strong>: Floating UIで位置計算を任せる</li>
</ul></div>

<p>各ライブラリの具体的な使い方は、サイドバーから個別のサンプル記事を参照してください。</p>'''
})

# 5. エディタ・入力入門
cls = Classification.objects.get(slug='js-sample-editor')
articles.append({
    'cls': cls,
    'title': 'JSエディタ・入力ライブラリの選び方｜初心者ガイド',
    'short_title': 'エディタ・入力入門',
    'slug': 'js-editor-guide',
    'excerpt': 'Quill・Cleave.js・Tom Selectなど、エディタ・入力系ライブラリの特徴と使い分けを初心者向けに解説します。',
    'content': '''<p>フォームの入力体験を向上させるライブラリを使うと、ユーザーにとって使いやすく、開発者にとっても正しいデータを受け取れるようになります。</p>

<h2 class="section-title">エディタ・入力ライブラリとは？</h2>

<p>テキストエディタ、入力フォーマット、セレクトボックスの拡張など、<strong>フォーム入力の体験を改善</strong>するためのライブラリです。</p>

<h2 class="section-title">ライブラリ比較表</h2>

<table style="width:100%; border-collapse:collapse; font-size:14px;">
<thead><tr style="background:#6c5ce7; color:#fff;">
<th style="padding:10px; text-align:left;">ライブラリ</th>
<th style="padding:10px; text-align:left;">種類</th>
<th style="padding:10px; text-align:left;">特徴</th>
</tr></thead>
<tbody>
<tr style="background:#f8f9fa;"><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Quill</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">リッチテキストエディタ</td><td style="padding:8px; border-bottom:1px solid #eee;">WYSIWYG、太字・見出し・リスト等</td></tr>
<tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Cleave.js</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">入力フォーマット</td><td style="padding:8px; border-bottom:1px solid #eee;">電話番号・カード番号・日付を自動整形</td></tr>
<tr style="background:#f8f9fa;"><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Choices.js</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">セレクトボックス</td><td style="padding:8px; border-bottom:1px solid #eee;">検索・複数選択対応、依存ゼロ</td></tr>
<tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Tom Select</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">セレクト/タグ入力</td><td style="padding:8px; border-bottom:1px solid #eee;">自由入力タグ、カスタマイズ性が高い</td></tr>
<tr style="background:#f8f9fa;"><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Handsontable</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">スプレッドシート</td><td style="padding:8px; border-bottom:1px solid #eee;">Excel風テーブル、セル編集・ソート</td></tr>
</tbody></table>

<div class="info-box"><div class="info-title">目的別おすすめ</div>
<ul>
<li><strong>ブログエディタを作りたい</strong>: Quillが最もポピュラーで導入が簡単</li>
<li><strong>電話番号やカード番号の入力整形</strong>: Cleave.jsで自動フォーマット</li>
<li><strong>検索付きセレクトボックス</strong>: Choices.jsが軽量で依存ゼロ</li>
<li><strong>タグ入力（自由入力あり）</strong>: Tom Selectがカスタマイズ性に優れる</li>
<li><strong>Excel風のデータ入力</strong>: Handsontableで本格的なスプレッドシートUI</li>
</ul></div>

<p>各ライブラリの具体的な使い方は、サイドバーから個別のサンプル記事を参照してください。</p>'''
})

for a in articles:
    Article.objects.create(
        title=a['title'], short_title=a['short_title'], slug=a['slug'],
        content=a['content'], excerpt=a['excerpt'],
        classification=a['cls'], is_published=True
    )
    print(f"Created: {a['slug']}")
print(f"Batch done: {len(articles)} articles")
