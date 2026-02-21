/**
 * DKCドライブ - フォルダ解析・グラフ可視化
 * フォルダ内Excel/CSVファイルの統合分析と新しいタブでのグラフ表示
 */

import { API } from './constants.js';

// グラフの色パレット（chart.jsと共有）
const CHART_COLORS = [
    '#4285f4', '#ea4335', '#fbbc04', '#34a853', '#ff6d01',
    '#46bdc6', '#7baaf7', '#f07b72', '#fcd04f', '#57bb8a',
    '#ff9e80', '#80deea', '#a1c4fd', '#f5a5a5', '#ffe082'
];

/**
 * フォルダ解析機能のミックスイン
 */
export const FolderAnalysisMixin = (Base) => class extends Base {

    /**
     * フォルダ解析機能の初期化
     */
    initFolderAnalysis() {
        this.analysisData = null;
        this.analysisFolder = null;

        const modal = document.getElementById('folderAnalysisModal');
        if (!modal) return;

        this.analysisModal = new bootstrap.Modal(modal);

        // グラフ生成ボタン（新しいタブで表示）
        document.getElementById('btn-generate-analysis-chart')?.addEventListener('click', () => {
            this.generateAnalysisChart();
        });

        // 列選択の排他処理を設定
        this.setupColumnExclusiveInputs();
    }

    /**
     * 列選択の排他処理（アルファベット選択と列名選択）
     */
    setupColumnExclusiveInputs() {
        // アルファベット選択時に列名選択をクリア
        document.querySelectorAll('.analysis-col-alpha').forEach(select => {
            select.addEventListener('change', (e) => {
                const colNum = e.target.dataset.col;
                const nameSelect = document.getElementById(`analysis-col-${colNum}-name`);
                if (nameSelect && e.target.value) {
                    nameSelect.value = '';
                }
            });
        });

        // 列名選択時にアルファベット選択をクリア
        document.querySelectorAll('.analysis-col-name').forEach(select => {
            select.addEventListener('change', (e) => {
                const colNum = e.target.dataset.col;
                const alphaSelect = document.getElementById(`analysis-col-${colNum}-alpha`);
                if (alphaSelect && e.target.value) {
                    alphaSelect.value = '';
                }
            });
        });
    }

    /**
     * フォルダ解析モーダルを表示
     */
    async showFolderAnalysisModal(folderPath, folderName) {
        this.analysisFolder = folderPath;

        // ボタンを無効化（データ準備完了まで）
        const btn = document.getElementById('btn-generate-analysis-chart');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> データ読み込み中...';
        }

        // フォルダ名を表示
        document.getElementById('analysis-folder-name').textContent = folderName || folderPath || 'ルート';

        // ファイル一覧とグラフをリセット
        document.getElementById('analysis-files-list').innerHTML = '<small class="text-muted">ファイルを読み込み中...</small>';
        this.resetAnalysisSelects();
        this.hideAnalysisChart();

        // モーダルを表示
        this.analysisModal.show();

        // ヘッダー情報のみ取得（軽量：列名+行数のみ）
        try {
            const response = await fetch(`${API.FOLDER_ANALYSIS}?folder=${encodeURIComponent(folderPath)}`);
            const data = await response.json();

            if (data.status === 'success' && this.analysisFolder === folderPath) {
                this.analysisData = data;
                this.renderAnalysisFiles(data.files);
                this.populateColumnSelects(data.columns);
            } else {
                document.getElementById('analysis-files-list').innerHTML = `<small class="text-danger">${data.message || 'エラーが発生しました'}</small>`;
            }
        } catch (e) {
            console.error('フォルダ解析エラー:', e);
            document.getElementById('analysis-files-list').innerHTML = '<small class="text-danger">ファイルの読み込みに失敗しました</small>';
        } finally {
            if (btn && this.analysisFolder === folderPath) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-bar-chart-fill"></i> グラフを表示';
            }
        }
    }

    /**
     * 解析対象ファイル一覧を表示
     */
    renderAnalysisFiles(files) {
        const container = document.getElementById('analysis-files-list');

        if (!files || files.length === 0) {
            container.innerHTML = '<small class="text-muted">Excel/CSVファイルが見つかりません</small>';
            return;
        }

        container.innerHTML = files.map(f => `
            <div class="folder-analysis-file-item">
                <i class="bi bi-file-earmark-excel"></i>
                <span>${f.name}</span>
                <span class="file-rows">${f.rowCount}行</span>
            </div>
        `).join('');
    }

    /**
     * 列選択セレクトボックスにオプションを設定
     */
    populateColumnSelects(columns) {
        // allDataから最大列数を計算
        let maxColCount = 0;
        const allData = this.analysisData?.allData;
        if (allData) {
            Object.values(allData).forEach(fileData => {
                if (fileData.columns && fileData.columns.length > maxColCount) {
                    maxColCount = fileData.columns.length;
                }
            });
        }

        // 最初のファイルの列名を基準にする（列名(A)形式で表示）
        const firstFileData = allData ? Object.values(allData)[0] : null;
        const firstFileColumns = firstFileData?.columns || columns;

        // 列データを保存（アルファベット変換用）
        this.analysisColumns = firstFileColumns;

        // 各列のアルファベット選択と列名選択にオプションを追加
        for (let i = 1; i <= 5; i++) {
            const alphaSelect = document.getElementById(`analysis-col-${i}-alpha`);
            const nameSelect = document.getElementById(`analysis-col-${i}-name`);

            // アルファベット選択（A, B, C... 最大列数分）
            if (alphaSelect) {
                alphaSelect.innerHTML = '<option value="">-- A,B,C... --</option>';
                for (let idx = 0; idx < maxColCount; idx++) {
                    const option = document.createElement('option');
                    const colLetter = this.numberToColumnLetter(idx + 1);
                    option.value = colLetter;
                    option.textContent = colLetter;
                    alphaSelect.appendChild(option);
                }
            }

            // 列名選択（列名(A)形式で表示、最大列数分）
            if (nameSelect) {
                nameSelect.innerHTML = '<option value="">-- 列名 --</option>';
                for (let idx = 0; idx < maxColCount; idx++) {
                    const option = document.createElement('option');
                    const colLetter = this.numberToColumnLetter(idx + 1);
                    const colName = firstFileColumns[idx] || `列${idx + 1}`;
                    option.value = colLetter;  // valueはアルファベット
                    option.textContent = `${colName}(${colLetter})`;
                    nameSelect.appendChild(option);
                }
            }
        }

        // 総行数を計算して終了行のプレースホルダーを更新
        let totalRows = 0;
        const files = this.analysisData?.files || [];
        files.forEach(f => { totalRows += f.rowCount || 0; });
        const endRowInput = document.getElementById('analysis-end-row');
        if (endRowInput) {
            endRowInput.placeholder = totalRows > 0 ? `最終行 (${totalRows})` : '最終行';
            endRowInput.value = '';
        }
        const startRowInput = document.getElementById('analysis-start-row');
        if (startRowInput) {
            startRowInput.value = '1';
        }
    }

    /**
     * 列番号をアルファベット列名に変換（1 -> A, 2 -> B, ..., 27 -> AA）
     */
    numberToColumnLetter(num) {
        let result = '';
        while (num > 0) {
            num--;
            result = String.fromCharCode(65 + (num % 26)) + result;
            num = Math.floor(num / 26);
        }
        return result;
    }

    /**
     * アルファベット列名を列番号に変換（A -> 1, B -> 2, ..., AA -> 27）
     */
    columnLetterToNumber(letter) {
        let result = 0;
        for (let i = 0; i < letter.length; i++) {
            result = result * 26 + (letter.charCodeAt(i) - 64);
        }
        return result;
    }

    /**
     * 列選択セレクトボックスをリセット
     */
    resetAnalysisSelects() {
        for (let i = 1; i <= 5; i++) {
            const alphaSelect = document.getElementById(`analysis-col-${i}-alpha`);
            const nameSelect = document.getElementById(`analysis-col-${i}-name`);

            if (alphaSelect) {
                alphaSelect.innerHTML = '<option value="">-- A,B,C... --</option>';
            }
            if (nameSelect) {
                nameSelect.innerHTML = '<option value="">-- 列名 --</option>';
            }
        }
        // 行範囲もリセット
        const startRowInput = document.getElementById('analysis-start-row');
        const endRowInput = document.getElementById('analysis-end-row');
        if (startRowInput) startRowInput.value = '1';
        if (endRowInput) endRowInput.value = '';

        // 列データもリセット
        this.analysisColumns = [];
    }

    /**
     * 選択されたアルファベットから列インデックス（0ベース）を取得
     */
    getColumnIndexFromInput(colIndex) {
        const alphaSelect = document.getElementById(`analysis-col-${colIndex}-alpha`);
        const nameSelect = document.getElementById(`analysis-col-${colIndex}-name`);

        // どちらかのselectから選択されたアルファベットを取得
        const selectedLetter = alphaSelect?.value || nameSelect?.value;

        if (selectedLetter) {
            const colNum = this.columnLetterToNumber(selectedLetter);
            return colNum - 1;  // 0ベースのインデックスを返す
        }

        return null;
    }

    /**
     * 解析グラフを生成（新しいタブで表示）
     * 選択列のみをサーバーから取得し、CPU・メモリ負荷を削減
     */
    async generateAnalysisChart() {
        const col1Idx = this.getColumnIndexFromInput(1); // nullなら行番号を使用
        const col2Idx = this.getColumnIndexFromInput(2);
        const chartType = document.getElementById('analysis-chart-type')?.value || 'bar';

        // 開始行・終了行を取得
        const startRowInput = document.getElementById('analysis-start-row');
        const endRowInput = document.getElementById('analysis-end-row');
        const startRow = parseInt(startRowInput?.value) || 1;
        const endRow = endRowInput?.value ? parseInt(endRowInput.value) : null;

        if (col2Idx === null) {
            alert('列2（データ1）を選択してください');
            return;
        }

        // 選択された列インデックスを収集（col1Idxがnullの場合は含めない）
        const selectedColIndices = col1Idx !== null ? [col1Idx, col2Idx] : [col2Idx];
        for (let i = 3; i <= 5; i++) {
            const colIdx = this.getColumnIndexFromInput(i);
            if (colIdx !== null) selectedColIndices.push(colIdx);
        }

        // ボタンを無効化（連打防止）
        const btn = document.getElementById('btn-generate-analysis-chart');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> データ取得中...';
        }

        // ポップアップブロック回避：ユーザークリック直後にタブを開く
        const chartTab = window.open('about:blank', '_blank');

        try {
            // 選択列のみサーバーから取得（CPU・メモリ最適化）
            const response = await this.apiCall(API.FOLDER_ANALYSIS_DATA, {
                method: 'POST',
                body: {
                    folder: this.analysisFolder,
                    col_indices: selectedColIndices,
                    start_row: startRow,
                    end_row: endRow,
                },
            });

            if (response.status !== 'success') {
                if (chartTab) chartTab.close();
                alert(response.message || 'データの取得に失敗しました');
                return;
            }

            // APIから返ったデータでグラフ表示
            this.openAnalysisChartInNewTab(
                selectedColIndices, chartType, col1Idx, startRow, endRow,
                response.allData, response.col_indices, chartTab);
        } catch (e) {
            console.error('データ取得エラー:', e);
            if (chartTab) chartTab.close();
            alert('データの取得に失敗しました');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-bar-chart-fill"></i> グラフを表示';
            }
        }
    }

    /**
     * APIレスポンスからChart.jsデータセットを構築
     */
    _buildAnalysisDatasets(allData, selectedColIndices, fetchedColIndices, labelColIdx, startRow) {
        // 元の列インデックス → data配列内の位置マッピング
        const colIdxToDataPos = {};
        (fetchedColIndices || selectedColIndices).forEach((origIdx, pos) => {
            colIdxToDataPos[origIdx] = pos;
        });

        const dataColIndices = labelColIdx !== null ? selectedColIndices.slice(1) : selectedColIndices;
        const fileNames = Object.keys(allData).sort();
        const datasets = {};
        const labelsList = [];
        const labelsSet = new Set();
        let colorIndex = 0;

        fileNames.forEach(fileName => {
            const { columns, data = [] } = allData[fileName];
            const baseName = fileName.replace(/\.[^.]+$/, '');
            if (!columns || data.length === 0) return;

            // データセット初期化
            const seriesNameMap = {};
            dataColIndices.forEach(colIdx => {
                if (colIdx < columns.length && colIdxToDataPos[colIdx] !== undefined) {
                    const colLetter = this.numberToColumnLetter(colIdx + 1);
                    const colName = columns[colIdx] || `列${colIdx + 1}`;
                    const seriesName = `${baseName}_${colName}(${colLetter})`;
                    seriesNameMap[colIdx] = seriesName;
                    datasets[seriesName] = { data: [], colorIndex: colorIndex++ };
                }
            });

            const validColIndices = dataColIndices.filter(ci => seriesNameMap[ci] !== undefined);
            const labelDataPos = labelColIdx !== null ? colIdxToDataPos[labelColIdx] : undefined;

            data.forEach((row, i) => {
                const label = labelDataPos !== undefined && row[labelDataPos]
                    ? String(row[labelDataPos]) : `${startRow + i}`;

                if (!labelsSet.has(label)) {
                    labelsSet.add(label);
                    labelsList.push(label);
                }

                for (const colIdx of validColIndices) {
                    const raw = row[colIdxToDataPos[colIdx]];
                    datasets[seriesNameMap[colIdx]].data.push(raw ? (+raw || 0) : 0);
                }
            });
        });

        const chartDatasets = Object.entries(datasets).map(([name, ds]) => ({
            label: name,
            data: ds.data,
            backgroundColor: CHART_COLORS[ds.colorIndex % CHART_COLORS.length],
            borderColor: CHART_COLORS[ds.colorIndex % CHART_COLORS.length],
            borderWidth: 2,
            fill: false
        }));

        return { labels: labelsList, datasets: chartDatasets };
    }

    /**
     * 解析グラフを新しいタブで表示
     */
    openAnalysisChartInNewTab(selectedColIndices, chartType, labelColIdx, startRow, endRow, fetchedData, fetchedColIndices, chartTab) {
        const allData = fetchedData || this.analysisData?.allData;
        if (!allData) return;

        const chartData = this._buildAnalysisDatasets(
            allData, selectedColIndices, fetchedColIndices, labelColIdx, startRow);
        const chartConfig = this.getChartConfig(chartType, chartData);

        // HTMLを生成して事前に開いたタブに書き込み
        const folderPath = this.analysisFolder || '';
        const files = this.analysisData?.files || [];
        const baseUrl = window.location.origin;
        const html = this.generateAnalysisChartHTMLForNewTab(chartConfig, folderPath, files, baseUrl);

        if (!chartTab) return;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        chartTab.location.href = blobUrl;

        // blob:ページからのダウンロード依頼を受け取るリスナーを設定
        // (同一オリジンのこのページでAPIを叩き、結果をblob:ページへ返す)
        const downloadHandler = async (e) => {
            if (e.data?.type !== 'dkc-chart-download-request') return;

            const reqFiles = e.data.files;
            const reqFolder = e.data.folderPath;

            try {
                const fileDataArray = [];
                const errors = [];
                for (const fileName of reqFiles) {
                    const filePath = reqFolder ? reqFolder + '/' + fileName : fileName;
                    const downloadUrl = `${baseUrl}/drive/api/download/?path=${encodeURIComponent(filePath)}`;
                    console.log('DKCダウンロード:', downloadUrl);
                    const resp = await fetch(downloadUrl);
                    if (!resp.ok) {
                        const errText = await resp.text();
                        console.error('ダウンロード失敗:', fileName, resp.status, errText);
                        errors.push(`${fileName}: ${resp.status}`);
                        continue;
                    }
                    const arrayBuffer = await resp.arrayBuffer();
                    fileDataArray.push({ name: fileName, arrayBuffer: arrayBuffer });
                }

                if (fileDataArray.length === 0) {
                    chartTab.postMessage({
                        type: 'dkc-chart-download-response',
                        error: 'ファイルのダウンロードに失敗しました\n' + errors.join('\n')
                    }, '*');
                } else {
                    chartTab.postMessage({
                        type: 'dkc-chart-download-response',
                        files: fileDataArray
                    }, '*', fileDataArray.map(f => f.arrayBuffer));
                }
            } catch (err) {
                console.error('ダウンロードエラー:', err);
                chartTab.postMessage({
                    type: 'dkc-chart-download-response',
                    error: 'ダウンロード中にエラーが発生しました: ' + err.message
                }, '*');
            }

            // 一度使い切ったらリスナーを解除
            window.removeEventListener('message', downloadHandler);
        };

        window.addEventListener('message', downloadHandler);
    }

    /**
     * 解析グラフを非表示
     */
    hideAnalysisChart() {
        const placeholder = document.getElementById('analysis-chart-placeholder');
        const canvas = document.getElementById('analysis-chart-canvas');
        if (placeholder) placeholder.style.display = 'block';
        if (canvas) canvas.style.display = 'none';
    }

    /**
     * 新しいタブ表示用の解析グラフHTMLを生成
     * @param {object} chartConfig - Chart.js設定
     * @param {string} folderPath - フォルダパス
     * @param {Array} files - ファイル一覧 [{name, columns, rowCount}, ...]
     * @param {string} baseUrl - オリジンURL
     */
    generateAnalysisChartHTMLForNewTab(chartConfig, folderPath = '', files = [], baseUrl = '') {
        const title = 'グラフ解析';
        const resolvedBaseUrl = baseUrl || window.location.origin;
        const chartJsUrl = `${resolvedBaseUrl}/static/vendor/chartjs/chart.min.js`;
        const zoomPluginUrl = `${resolvedBaseUrl}/static/vendor/chartjs/chartjs-plugin-zoom.min.js`;

        // CSV/Excelファイルのみフィルタリング
        const dataFiles = files.filter(f => /\.(csv|xlsx|xls)$/i.test(f.name));
        const fileListHTML = dataFiles.map((f, i) => `
            <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;">
                <input type="checkbox" value="${i}" style="width:16px;height:16px;">
                <span style="font-size:0.9rem;">${this.escapeHtml(f.name)}</span>
                <span style="color:#888;font-size:0.75rem;margin-left:auto;">${f.rowCount}行</span>
            </label>
        `).join('');

        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="${chartJsUrl}"><\/script>
    <script src="${zoomPluginUrl}"><\/script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #fff;
            display: flex;
            flex-direction: column;
        }
        .header {
            padding: 10px 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }
        h1 {
            color: #333;
            font-size: 1.2rem;
            font-weight: 600;
        }
        .footer-text {
            color: #888;
            font-size: 0.75rem;
        }
        .chart-container {
            flex: 1;
            padding: 20px;
            position: relative;
            min-height: 0;
        }
        /* カスタムコンテキストメニュー */
        #custom-ctx-menu {
            display: none;
            position: fixed;
            z-index: 10000;
            background: #fff;
            border: 1px solid #ccc;
            border-radius: 6px;
            box-shadow: 0 4px 16px rgba(0,0,0,.18);
            min-width: 180px;
            padding: 4px 0;
        }
        #custom-ctx-menu .ctx-item {
            padding: 8px 16px;
            cursor: pointer;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        #custom-ctx-menu .ctx-item:hover {
            background: #f0f0f0;
        }
        /* ファイル選択モーダル */
        #file-select-overlay {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 10001;
            background: rgba(0,0,0,.4);
            justify-content: center;
            align-items: center;
        }
        #file-select-modal {
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 8px 32px rgba(0,0,0,.25);
            width: 420px;
            max-width: 90vw;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
        }
        #file-select-modal .modal-header {
            padding: 14px 18px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #file-select-modal .modal-header h2 {
            font-size: 1rem;
            font-weight: 600;
            margin: 0;
        }
        #file-select-modal .modal-body {
            padding: 14px 18px;
            overflow-y: auto;
            flex: 1;
        }
        #file-select-modal .modal-footer {
            padding: 10px 18px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            justify-content: flex-end;
            gap: 8px;
        }
        #file-select-modal button {
            padding: 6px 18px;
            border-radius: 6px;
            border: 1px solid #ccc;
            background: #fff;
            cursor: pointer;
            font-size: 0.85rem;
        }
        #file-select-modal button.primary {
            background: #4285f4;
            color: #fff;
            border-color: #4285f4;
        }
        #file-select-modal button.primary:hover {
            background: #3367d6;
        }
        #file-select-modal button:hover {
            background: #f5f5f5;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <span class="footer-text">Generated by DKCドライブ - ${new Date().toLocaleString('ja-JP')}</span>
    </div>
    <div class="chart-container">
        <canvas id="chart"></canvas>
    </div>

    <!-- カスタムコンテキストメニュー -->
    <div id="custom-ctx-menu">
        <div class="ctx-item" id="ctx-graph-maker">&#x1f4ca; グラフツクール君へ</div>
    </div>

    <!-- ファイル選択モーダル -->
    <div id="file-select-overlay">
        <div id="file-select-modal">
            <div class="modal-header">
                <h2>グラフツクール君へ送るファイルを選択</h2>
                <button id="modal-close-btn" style="background:none;border:none;font-size:1.2rem;cursor:pointer;">&times;</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom:8px;">
                    <label style="font-size:0.8rem;cursor:pointer;">
                        <input type="checkbox" id="select-all-files"> すべて選択
                    </label>
                </div>
                <div id="file-check-list">
                    ${fileListHTML || '<span style="color:#888;">対象ファイルがありません</span>'}
                </div>
            </div>
            <div class="modal-footer">
                <button id="modal-cancel-btn">キャンセル</button>
                <button id="modal-submit-btn" class="primary">送信</button>
            </div>
        </div>
    </div>

    <script>
        // グラフ描画
        const ctx = document.getElementById('chart').getContext('2d');
        new Chart(ctx, ${JSON.stringify(chartConfig)});

        // ---------- データ ----------
        const FOLDER_PATH = ${JSON.stringify(folderPath)};
        const DATA_FILES = ${JSON.stringify(dataFiles.map(f => f.name))};
        const BASE_URL = ${JSON.stringify(resolvedBaseUrl)};

        // ---------- コンテキストメニュー ----------
        const ctxMenu = document.getElementById('custom-ctx-menu');

        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            ctxMenu.style.display = 'block';
            ctxMenu.style.left = e.clientX + 'px';
            ctxMenu.style.top = e.clientY + 'px';
        });

        document.addEventListener('click', () => {
            ctxMenu.style.display = 'none';
        });

        // ---------- モーダル ----------
        const overlay = document.getElementById('file-select-overlay');
        const closeBtn = document.getElementById('modal-close-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const submitBtn = document.getElementById('modal-submit-btn');
        const selectAllCb = document.getElementById('select-all-files');

        function openModal() {
            overlay.style.display = 'flex';
        }
        function closeModal() {
            overlay.style.display = 'none';
        }

        document.getElementById('ctx-graph-maker').addEventListener('click', (e) => {
            e.stopPropagation();
            ctxMenu.style.display = 'none';
            openModal();
        });

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        // すべて選択
        selectAllCb.addEventListener('change', (e) => {
            document.querySelectorAll('#file-check-list input[type="checkbox"]').forEach(cb => {
                cb.checked = e.target.checked;
            });
        });

        // ---------- 送信処理 ----------
        // blob:ページからは同一オリジンのAPIにアクセスできないため、
        // window.opener（元のDKCドライブページ）にダウンロード依頼を送る
        submitBtn.addEventListener('click', () => {
            const checked = Array.from(document.querySelectorAll('#file-check-list input[type="checkbox"]:checked'));
            if (checked.length === 0) {
                alert('ファイルを選択してください');
                return;
            }

            if (!window.opener) {
                alert('元のページとの接続が切れています。DKCドライブからやり直してください。');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'ページ作成中...';

            const selectedFiles = checked.map(cb => DATA_FILES[parseInt(cb.value)]);

            // 元ページにダウンロード依頼を送信
            window.opener.postMessage({
                type: 'dkc-chart-download-request',
                files: selectedFiles,
                folderPath: FOLDER_PATH
            }, BASE_URL);
        });

        // 元ページからダウンロード結果を受信
        window.addEventListener('message', (evt) => {
            if (evt.data?.type === 'dkc-chart-download-response') {
                submitBtn.disabled = false;
                submitBtn.textContent = '送信';

                if (evt.data.error) {
                    alert(evt.data.error);
                    return;
                }

                const fileDataArray = evt.data.files;
                if (!fileDataArray || fileDataArray.length === 0) {
                    alert('ファイルのダウンロードに失敗しました');
                    return;
                }

                // graph_maker_machining ページを新しいタブで開く
                const graphMakerUrl = BASE_URL + '/tools/graph-maker/machine/';
                const newTab = window.open(graphMakerUrl, '_blank');

                if (!newTab) {
                    alert('新しいタブを開けませんでした。ポップアップブロッカーを確認してください。');
                    return;
                }

                // ページの読み込み完了を待ってからpostMessage送信
                let attempts = 0;
                const maxAttempts = 100; // 最大10秒
                const pollInterval = setInterval(() => {
                    attempts++;
                    try {
                        newTab.postMessage({ type: 'dkc-drive-files-ping' }, '*');
                    } catch (_) {}

                    if (attempts >= maxAttempts) {
                        clearInterval(pollInterval);
                        newTab.postMessage({
                            type: 'dkc-drive-files',
                            files: fileDataArray
                        }, '*', fileDataArray.map(f => f.arrayBuffer));
                    }
                }, 100);

                // 新しいタブから準備完了の応答を待つ
                window.addEventListener('message', function onReady(e2) {
                    if (e2.data?.type === 'dkc-drive-files-ready') {
                        clearInterval(pollInterval);
                        window.removeEventListener('message', onReady);
                        newTab.postMessage({
                            type: 'dkc-drive-files',
                            files: fileDataArray
                        }, '*', fileDataArray.map(f => f.arrayBuffer));
                    }
                });

                closeModal();
            }
        });
    <\/script>
</body>
</html>`;
    }

};
