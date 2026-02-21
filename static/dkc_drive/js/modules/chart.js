/**
 * DKCドライブ - グラフ機能モジュール
 * Chart.jsを使用したグラフ作成・シート上オーバーレイ配置
 */

import { API } from './constants.js';

// グラフの色パレット
const CHART_COLORS = [
    '#4285f4', '#ea4335', '#fbbc04', '#34a853', '#ff6d01',
    '#46bdc6', '#7baaf7', '#f07b72', '#fcd04f', '#57bb8a',
    '#ff9e80', '#80deea', '#a1c4fd', '#f5a5a5', '#ffe082'
];

/**
 * グラフ機能のミックスイン
 */
export const ChartMixin = (Base) => class extends Base {

    /**
     * グラフ機能の初期化
     */
    initChart() {
        // シート上グラフの状態管理
        this.chartState = {
            selectedChart: null,
            chartInstances: new Map(),  // chartIndex → Chart インスタンス
            isDeleting: false,
        };

        // グラフタイプ選択イベント → insertChart
        document.querySelectorAll('[data-chart-type]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const chartType = item.dataset.chartType;
                this.insertChart(chartType);
            });
        });

        // グラフ選択解除（スプレッドシートクリック時）
        this.elements.spreadsheet?.addEventListener('mousedown', e => {
            if (!e.target.closest('.sheet-chart')) {
                this.deselectChart();
            }
        });

        // キーボードショートカット（グラフ削除）
        document.addEventListener('keydown', e => {
            if (this.chartState.selectedChart && (e.key === 'Delete' || e.key === 'Backspace')) {
                if (!this.state.editingCell) {
                    e.preventDefault();
                    this.deleteChart(this.chartState.selectedChart.chartIndex);
                }
            }
        });

        // フォルダ解析モーダルの初期化（FolderAnalysisMixinで定義）
        if (this.initFolderAnalysis) this.initFolderAnalysis();
    }

    // ============================================================
    // シート上グラフ: 挿入
    // ============================================================

    /**
     * 選択範囲からグラフをシート上に挿入
     */
    async insertChart(chartType) {
        const selectedCells = this.state.selectedCells;
        if (!selectedCells || selectedCells.length === 0) {
            alert('グラフを作成するセル範囲を選択してください。');
            return;
        }

        // 選択範囲のデータを取得
        const data = this.getChartDataFromSelection();
        if (!data) {
            alert('グラフを作成できるデータがありません。\n数値データを含むセルを選択してください。');
            return;
        }

        // 選択範囲の境界を取得
        const bounds = this.getSelectionBounds();
        if (!bounds) return;

        const { minRow, maxRow, minCol, maxCol } = bounds;

        // 配置位置: 選択範囲の右隣に配置
        const placementRow = minRow;
        const placementCol = maxCol + 1;

        const chartData = {
            chartIndex: null,
            chartType,
            minRow,
            maxRow,
            minCol,
            maxCol,
            row: placementRow,
            col: placementCol,
            offsetX: 0,
            offsetY: 0,
            width: 480,
            height: 320,
            title: '',
            options: '{}',
        };

        // サーバーに保存
        const result = await this.saveChartToServer(chartData);
        if (result && result.chartIndex !== undefined) {
            chartData.chartIndex = result.chartIndex;
            this.addChartToSheet(chartData);
            this.showSaveIndicator?.('グラフを挿入しました');
        } else {
            this.showSaveIndicator?.('グラフの保存に失敗しました', true);
        }
    }

    // ============================================================
    // シート上グラフ: 描画
    // ============================================================

    /**
     * state更新＋DOM描画
     */
    addChartToSheet(chartData) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet.charts) sheet.charts = [];
        sheet.charts.push(chartData);
        this.renderSheetChart(chartData);
    }

    /**
     * canvas wrapper描画、Chart.jsインスタンス作成
     */
    renderSheetChart(chartData) {
        const container = this.getImageContainer();
        if (!container) return;

        const pos = this._getCellPosition(chartData.row, chartData.col);
        if (!pos) return;

        const left = pos.left + (chartData.offsetX || 0);
        const top = pos.top + (chartData.offsetY || 0);

        const wrapper = document.createElement('div');
        wrapper.className = 'sheet-chart';
        wrapper.dataset.chartIndex = chartData.chartIndex;
        wrapper.style.cssText = `
            left: ${left}px;
            top: ${top}px;
            width: ${chartData.width}px;
            height: ${chartData.height}px;
        `;

        const canvas = document.createElement('canvas');
        wrapper.appendChild(canvas);

        // リサイズハンドル・削除ボタン
        ['nw', 'ne', 'sw', 'se'].forEach(dir => {
            const handle = document.createElement('div');
            handle.className = `sheet-image-resize-handle ${dir}`;
            handle.dataset.dir = dir;
            wrapper.appendChild(handle);
        });
        const delBtn = document.createElement('button');
        delBtn.className = 'sheet-image-delete';
        delBtn.title = '削除';
        delBtn.innerHTML = '<i class="bi bi-x"></i>';
        wrapper.appendChild(delBtn);

        this.setupChartEvents(wrapper, chartData);
        container.appendChild(wrapper);

        // Chart.jsインスタンスを生成
        const chartJsData = this.rebuildChartFromCells(chartData);
        if (chartJsData) {
            const config = this.getChartConfig(chartData.chartType, chartJsData);
            const ctx = canvas.getContext('2d');
            const chartInstance = new Chart(ctx, config);
            this.chartState.chartInstances.set(chartData.chartIndex, chartInstance);
        }
    }

    /**
     * 指定範囲のセル値を2次元配列として取得
     */
    _extractCellValues(minRow, maxRow, minCol, maxCol) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return null;

        const rawData = [];
        for (let r = minRow; r <= maxRow; r++) {
            const row = [];
            for (let c = minCol; c <= maxCol; c++) {
                const cellData = sheet.cells[`${r},${c}`];
                const value = cellData?.value || '';
                row.push(this.calculateDisplayValue?.(value, sheet.cells) || value);
            }
            rawData.push(row);
        }
        return rawData;
    }

    /**
     * セル値からChart.jsデータを再構築
     */
    rebuildChartFromCells(chartData) {
        const rawData = this._extractCellValues(
            chartData.minRow, chartData.maxRow, chartData.minCol, chartData.maxCol
        );
        if (!rawData) return null;

        const numRows = chartData.maxRow - chartData.minRow + 1;
        const numCols = chartData.maxCol - chartData.minCol + 1;
        return this.parseChartData(rawData, numRows, numCols);
    }

    // ============================================================
    // シート上グラフ: イベント
    // ============================================================

    setupChartEvents(wrapper, chartData) {
        // 選択 + ドラッグ
        wrapper.addEventListener('mousedown', e => {
            if (e.target.closest('.sheet-image-delete')) return;
            e.stopPropagation();
            this.selectChart(wrapper, chartData);

            if (!e.target.classList.contains('sheet-image-resize-handle')) {
                this.startChartDrag(e, wrapper, chartData);
            }
        });

        // 右クリック → グラフタイプ変更メニュー
        wrapper.addEventListener('contextmenu', e => {
            e.preventDefault();
            e.stopPropagation();
            this.selectChart(wrapper, chartData);
            this.showChartContextMenu(e, wrapper, chartData);
        });

        // リサイズハンドル
        wrapper.querySelectorAll('.sheet-image-resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', e => {
                e.stopPropagation();
                this.selectChart(wrapper, chartData);
                this.startChartResize(e, wrapper, chartData, handle.dataset.dir);
            });
        });

        // 削除ボタン
        wrapper.querySelector('.sheet-image-delete').addEventListener('click', e => {
            e.stopPropagation();
            this.deleteChart(chartData.chartIndex);
        });
    }

    selectChart(wrapper, chartData) {
        this.deselectChart();
        this.deselectImage?.();
        this.deselectShape?.();
        wrapper.classList.add('selected');
        this.chartState.selectedChart = chartData;
    }

    deselectChart() {
        document.querySelectorAll('.sheet-chart.selected').forEach(el => {
            el.classList.remove('selected');
        });
        this.chartState.selectedChart = null;
    }

    // ============================================================
    // シート上グラフ: ドラッグ・リサイズ
    // ============================================================

    startChartDrag(e, wrapper, chartData) {
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = parseInt(wrapper.style.left);
        const startTop = parseInt(wrapper.style.top);

        this._trackPointer(
            ev => {
                wrapper.style.left = `${startLeft + ev.clientX - startX}px`;
                wrapper.style.top = `${startTop + ev.clientY - startY}px`;
            },
            () => this.updateChartPosition(wrapper, chartData)
        );
    }

    startChartResize(e, wrapper, chartData, direction) {
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = parseInt(wrapper.style.width);
        const startHeight = parseInt(wrapper.style.height);
        const startLeft = parseInt(wrapper.style.left);
        const startTop = parseInt(wrapper.style.top);

        this._trackPointer(
            ev => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;

                let newWidth = startWidth;
                let newHeight = startHeight;
                let newLeft = startLeft;
                let newTop = startTop;

                if (direction.includes('e')) {
                    newWidth = Math.max(200, startWidth + dx);
                } else if (direction.includes('w')) {
                    newWidth = Math.max(200, startWidth - dx);
                    newLeft = startLeft + (startWidth - newWidth);
                }

                if (direction.includes('s')) {
                    newHeight = Math.max(150, startHeight + dy);
                } else if (direction.includes('n')) {
                    newHeight = Math.max(150, startHeight - dy);
                    newTop = startTop + (startHeight - newHeight);
                }

                wrapper.style.width = `${newWidth}px`;
                wrapper.style.height = `${newHeight}px`;
                wrapper.style.left = `${newLeft}px`;
                wrapper.style.top = `${newTop}px`;
            },
            () => {
                // リサイズ後にChart.jsのresize
                const chartInstance = this.chartState.chartInstances.get(chartData.chartIndex);
                if (chartInstance) {
                    chartInstance.resize();
                }
                this.updateChartPosition(wrapper, chartData);
            }
        );
    }

    updateChartPosition(wrapper, chartData) {
        if (this.chartState.isDeleting) return;

        const chartLeft = parseInt(wrapper.style.left);
        const chartTop = parseInt(wrapper.style.top);

        const nearest = this._findNearestCell(chartLeft, chartTop);
        if (!nearest) return;

        const cellPos = this._getCellPosition(nearest.row, nearest.col);
        if (!cellPos) return;

        chartData.row = nearest.row;
        chartData.col = nearest.col;
        chartData.offsetX = chartLeft - cellPos.left;
        chartData.offsetY = chartTop - cellPos.top;
        chartData.width = parseInt(wrapper.style.width);
        chartData.height = parseInt(wrapper.style.height);

        this.saveChartToServer(chartData);
    }

    // ============================================================
    // シート上グラフ: 右クリックメニュー
    // ============================================================

    showChartContextMenu(e, wrapper, chartData) {
        document.querySelector('.chart-context-menu')?.remove();

        const chartTypes = [
            { type: 'bar', label: '棒グラフ' },
            { type: 'line', label: '折れ線グラフ' },
            { type: 'pie', label: '円グラフ' },
            { type: 'doughnut', label: 'ドーナツグラフ' },
            { type: 'radar', label: 'レーダーチャート' },
            { type: 'polarArea', label: '極座標グラフ' },
        ];

        const menu = document.createElement('div');
        menu.className = 'chart-context-menu shape-context-menu';
        menu.innerHTML = chartTypes.map(ct => `
            <div class="shape-context-menu-item chart-type-option" data-chart-type="${ct.type}">
                <input type="radio" name="chart-type" ${chartData.chartType === ct.type ? 'checked' : ''}>
                <span>${ct.label}</span>
            </div>
        `).join('') + `
            <div class="shape-context-menu-divider"></div>
            <div class="shape-context-menu-item shape-context-menu-delete" data-action="delete">
                <i class="bi bi-trash"></i> 削除
            </div>
        `;

        menu.style.left = `${e.pageX}px`;
        menu.style.top = `${e.pageY}px`;
        document.body.appendChild(menu);

        // 画面外補正
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${e.pageX - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${e.pageY - rect.height}px`;
        }

        // グラフタイプ変更
        menu.querySelectorAll('.chart-type-option').forEach(item => {
            item.addEventListener('click', () => {
                const newType = item.dataset.chartType;
                if (newType !== chartData.chartType) {
                    chartData.chartType = newType;
                    this.refreshChartInstance(wrapper, chartData);
                    this.saveChartToServer(chartData);
                }
                closeMenu();
            });
        });

        // 削除
        menu.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
            closeMenu();
            this.deleteChart(chartData.chartIndex);
        });

        // メニューを閉じるハンドラ
        const closeMenu = () => {
            menu.remove();
            document.removeEventListener('mousedown', closeHandler);
        };

        const closeHandler = ev => {
            if (!menu.isConnected) {
                document.removeEventListener('mousedown', closeHandler);
                return;
            }
            if (!menu.contains(ev.target)) {
                closeMenu();
            }
        };
        setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
    }

    /**
     * グラフタイプ変更時にChart.jsインスタンスを再生成
     */
    refreshChartInstance(wrapper, chartData) {
        // 既存インスタンスを破棄
        const existing = this.chartState.chartInstances.get(chartData.chartIndex);
        if (existing) {
            existing.destroy();
            this.chartState.chartInstances.delete(chartData.chartIndex);
        }

        const chartJsData = this.rebuildChartFromCells(chartData);
        if (chartJsData) {
            const config = this.getChartConfig(chartData.chartType, chartJsData);
            const canvas = wrapper.querySelector('canvas');
            // canvasをリセット
            canvas.style.width = '';
            canvas.style.height = '';
            canvas.removeAttribute('width');
            canvas.removeAttribute('height');
            const ctx = canvas.getContext('2d');
            const chartInstance = new Chart(ctx, config);
            this.chartState.chartInstances.set(chartData.chartIndex, chartInstance);
        }
    }

    // ============================================================
    // シート上グラフ: 削除
    // ============================================================

    async deleteChart(chartIndex) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet?.charts) return;

        this.chartState.isDeleting = true;

        const index = sheet.charts.findIndex(c => c.chartIndex === chartIndex);
        if (index === -1) {
            this.chartState.isDeleting = false;
            return;
        }

        const chartData = sheet.charts[index];

        // Chart.jsインスタンスを破棄
        const chartInstance = this.chartState.chartInstances.get(chartIndex);
        if (chartInstance) {
            chartInstance.destroy();
            this.chartState.chartInstances.delete(chartIndex);
        }

        // DOM削除
        const wrapper = document.querySelector(`.sheet-chart[data-chart-index="${chartIndex}"]`);
        if (wrapper) wrapper.remove();

        // サーバー削除
        await this.deleteChartFromServer(chartData);

        // 配列から削除
        sheet.charts.splice(index, 1);

        this.chartState.selectedChart = null;
        this.chartState.isDeleting = false;
        this.showSaveIndicator?.('グラフを削除しました');
    }

    // ============================================================
    // シート上グラフ: サーバー通信
    // ============================================================

    async saveChartToServer(chartData) {
        if (!this.state.currentFilePath) return null;

        try {
            const { chartIndex, chartType, minRow, maxRow, minCol, maxCol,
                    row, col, width, height } = chartData;
            const chart = {
                chartType, minRow, maxRow, minCol, maxCol, row, col, width, height,
                offsetX: chartData.offsetX || 0,
                offsetY: chartData.offsetY || 0,
                title: chartData.title || '',
                options: chartData.options || '{}',
            };
            if (chartIndex !== null) chart.chartIndex = chartIndex;

            return await this.apiCall(API.CHART, {
                method: 'POST',
                body: {
                    path: this.state.currentFilePath,
                    sheetName: this.currentSheet,
                    chart
                }
            });
        } catch (e) {
            console.error('グラフ保存エラー:', e);
            return null;
        }
    }

    async deleteChartFromServer(chartData) {
        if (!this.state.currentFilePath) return;
        if (chartData.chartIndex == null) return;

        try {
            await this.apiCall(API.CHART_DELETE, {
                method: 'POST',
                body: {
                    path: this.state.currentFilePath,
                    sheetName: this.currentSheet,
                    chartIndex: chartData.chartIndex
                }
            });
        } catch (e) {
            console.error('グラフ削除エラー:', e);
        }
    }

    // ============================================================
    // シート上グラフ: シート切替
    // ============================================================

    /**
     * シート切替時の全グラフ再描画
     */
    renderSheetCharts() {
        // 既存のグラフDOM要素をクリア
        document.querySelectorAll('.sheet-chart').forEach(el => el.remove());

        // 既存Chart.jsインスタンスをすべて破棄
        this.destroyAllChartInstances();

        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet?.charts) return;

        sheet.charts.forEach(chartData => {
            this.renderSheetChart(chartData);
        });
    }

    /**
     * 全Chart.jsインスタンスを破棄
     */
    destroyAllChartInstances() {
        for (const [key, instance] of this.chartState.chartInstances) {
            instance.destroy();
        }
        this.chartState.chartInstances.clear();
        this.chartState.selectedChart = null;
    }

    // ============================================================
    // データ解析（既存ロジックを保持）
    // ============================================================

    /**
     * 選択範囲からグラフ用データを抽出
     */
    getChartDataFromSelection() {
        const selectedCells = this.state.selectedCells;
        if (!selectedCells || selectedCells.length === 0) return null;

        const bounds = this.getSelectionBounds();
        if (!bounds) return null;

        const { minRow, maxRow, minCol, maxCol } = bounds;
        const rawData = this._extractCellValues(minRow, maxRow, minCol, maxCol);
        if (!rawData) return null;

        return this.parseChartData(rawData, maxRow - minRow + 1, maxCol - minCol + 1);
    }

    /**
     * 2次元データからChart.js用のデータ構造を生成
     * ルール：一番左の列を横軸（X軸ラベル）として使用
     */
    parseChartData(rawData, numRows, numCols) {
        if (rawData.length === 0) return null;

        let labels = [];
        let datasets = [];

        if (numCols === 1) {
            // 1列のみ：インデックスをラベルにして1つのデータセット
            labels = rawData.map((_, i) => `${i + 1}`);
            datasets = [{
                label: 'データ',
                data: rawData.map(row => parseFloat(row[0]) || 0),
                backgroundColor: CHART_COLORS.slice(0, rawData.length),
                borderColor: CHART_COLORS.slice(0, rawData.length),
                borderWidth: 1
            }];
        } else {
            // 2列以上：一番左の列を横軸ラベルとして使用
            // 1行目がヘッダーかどうかを判定（2列目以降が数値でなければヘッダー）
            const firstRowIsHeader = rawData[0].slice(1).some(cell =>
                isNaN(parseFloat(cell)) && cell !== ''
            );

            const dataStartRow = firstRowIsHeader ? 1 : 0;

            // 横軸ラベル（1列目、ヘッダー行を除く）
            labels = rawData.slice(dataStartRow).map(row => String(row[0] || ''));

            // 各データ系列（2列目以降）
            for (let c = 1; c < numCols; c++) {
                // 系列名：ヘッダー行があればその値、なければ「系列N」
                const seriesName = firstRowIsHeader ? (rawData[0][c] || `系列${c}`) : `系列${c}`;
                const data = rawData.slice(dataStartRow).map(row => parseFloat(row[c]) || 0);

                datasets.push({
                    label: seriesName,
                    data: data,
                    backgroundColor: CHART_COLORS[(c - 1) % CHART_COLORS.length],
                    borderColor: CHART_COLORS[(c - 1) % CHART_COLORS.length],
                    borderWidth: 2,
                    fill: false
                });
            }
        }

        // データが有効かチェック
        const hasValidData = datasets.some(ds => ds.data.some(v => v !== 0));
        if (!hasValidData) return null;

        return { labels, datasets };
    }

    /**
     * グラフタイプに応じた設定を取得
     */
    getChartConfig(chartType, data) {
        const baseConfig = {
            type: chartType,
            data: {
                labels: data.labels,
                datasets: data.datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'nearest',
                    intersect: true
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        enabled: true,
                        mode: 'nearest',
                        intersect: true
                    },
                    zoom: {
                        zoom: {
                            wheel: { enabled: true },
                            drag: {
                                enabled: true,
                                backgroundColor: 'rgba(102, 126, 234, 0.3)',
                                borderColor: 'rgba(102, 126, 234, 1)',
                                borderWidth: 2,
                                threshold: 50
                            },
                            mode: 'xy'
                        },
                        pan: {
                            enabled: true,
                            mode: 'xy',
                            modifierKey: 'shift'
                        },
                        limits: {
                            x: { min: 'original', max: 'original' },
                            y: { min: 'original', max: 'original' }
                        }
                    }
                }
            }
        };

        // 円グラフ・ドーナツグラフの場合、最初のデータセットのみ使用
        if (chartType === 'pie' || chartType === 'doughnut') {
            if (data.datasets.length > 0) {
                baseConfig.data.datasets = [{
                    data: data.datasets[0].data,
                    backgroundColor: CHART_COLORS.slice(0, data.labels.length),
                    borderColor: '#fff',
                    borderWidth: 2
                }];
            }
        }

        // 折れ線グラフの設定
        if (chartType === 'line') {
            baseConfig.data.datasets = data.datasets.map((ds, i) => ({
                ...ds,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 0
            }));
            baseConfig.options.scales = {
                y: { beginAtZero: true }
            };
        }

        // 棒グラフの設定
        if (chartType === 'bar') {
            baseConfig.options.scales = {
                y: { beginAtZero: true }
            };
        }

        // レーダーチャートの設定
        if (chartType === 'radar') {
            baseConfig.data.datasets = data.datasets.map((ds, i) => ({
                ...ds,
                fill: true,
                backgroundColor: this.hexToRgba(CHART_COLORS[i % CHART_COLORS.length], 0.2),
                borderColor: CHART_COLORS[i % CHART_COLORS.length],
                pointBackgroundColor: CHART_COLORS[i % CHART_COLORS.length]
            }));
        }

        return baseConfig;
    }

    /**
     * HEXカラーをRGBAに変換
     */
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

};
