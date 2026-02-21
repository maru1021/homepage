/**
 * DKCドライブ - ファイルストレージ & ビューア
 * Excel, 画像, 3Dモデル, PDF対応
 */

// 定数・ユーティリティ
import { FILE_TYPES, FILE_TYPE_MAP } from './modules/constants.js';

// ミックスイン
import { ViewersMixin } from './modules/viewers.js';
import { Viewer3DMixin } from './modules/viewer-3d.js';
import { ViewerPPTMixin } from './modules/viewer-ppt.js';
import { ViewerMSGMixin } from './modules/viewer-msg.js';
import { AutoScrollMixin } from './modules/autoscroll.js';
import { WebSocketMixin } from './modules/websocket.js';
import { FileManagerMixin } from './modules/file-manager.js';
import { SpreadsheetMixin } from './modules/spreadsheet.js';
import { StyleMixin } from './modules/style.js';
import { ClipboardMixin } from './modules/clipboard.js';
import { KeyboardMixin } from './modules/keyboard.js';
import { ChartMixin } from './modules/chart.js';
import { FolderAnalysisMixin } from './modules/folder-analysis.js';
import { SearchMixin } from './modules/spreadsheet-search.js';
import { ImageMixin } from './modules/spreadsheet-image.js';
import { ShapeMixin } from './modules/spreadsheet-shape.js';
import { MergeMixin } from './modules/spreadsheet-merge.js';
import { SealMixin } from './modules/seal.js';
import { HtmlEditorMixin } from './modules/html-editor.js';

/**
 * DKCDrive 基底クラス
 */
class DKCDriveBase {
    constructor() {
        const initial = window.DKC_DRIVE_INITIAL || {};

        this.state = {
            currentFile: null,
            currentFilePath: null,
            currentFileType: null,
            currentSheet: null,
            currentFolder: initial.file ? this.extractFolderFromPath(initial.file) : (initial.folder || ''),
            sheetsData: {},
            sheetNames: [],
            selectedCells: [],
            selectionStart: null,
            isSelecting: false,
            clipboard: null,
            clipboardStartCell: null,
            isCut: false,
            imageZoom: 1,
            fileListOffset: 0,
            fileListTotal: 0,
            isLoadingMore: false,
            fileSearchQuery: ''
        };

        this.initialFilePath = initial.file || '';

        this.initElements();
        this.initModules();
        this.initEventListeners();
        this.loadFileList();
    }

    // ===== 初期化 =====

    initModules() {
        // 各ミックスインの初期化メソッドを呼び出し
        if (this.initViewers) this.initViewers();
        if (this.initAutoScroll) this.initAutoScroll();
        if (this.initWebSocket) this.initWebSocket();
        if (this.initFileManager) this.initFileManager();
        if (this.initClipboard) this.initClipboard();
        if (this.initStyle) this.initStyle();
        if (this.initKeyboard) this.initKeyboard();
        if (this.initChart) this.initChart();
        if (this.initSearch) this.initSearch();
        if (this.initImage) this.initImage();
        if (this.initShape) this.initShape();
        if (this.initSeal) this.initSeal();
        if (this.initHtmlEditor) this.initHtmlEditor();
        this.initFormulaBar();
        this.initHistoryNavigation();
    }

    initElements() {
        const $ = id => document.getElementById(id);
        this.elements = {
            fileList: $('file-list'),
            breadcrumb: $('breadcrumb'),
            spreadsheet: $('spreadsheet'),
            spreadsheetContainer: $('spreadsheet-container'),
            spreadsheetWrapper: $('spreadsheet-wrapper'),
            sheetTabs: $('sheet-tabs'),
            placeholder: $('placeholder'),
            loading: $('loading'),
            currentFileName: $('current-file-name'),
            connectionStatus: $('connection-status'),
            btnDownload: $('btn-download'),
            btnNew: $('btn-new'),
            btnNewFolder: $('btn-new-folder'),
            fileUpload: $('file-upload'),
            folderUpload: $('folder-upload'),
            newFilename: $('new-filename'),
            newFileExt: $('new-file-ext'),
            newFoldername: $('new-foldername'),
            renameInput: $('rename-input'),
            deleteFilename: $('delete-filename'),
            imagePreview: $('image-preview'),
            imagePreviewContainer: $('image-preview-container'),
            modelViewerContainer: $('model-viewer-container'),
            threeViewer: $('three-viewer'),
            pdfViewerContainer: $('pdf-viewer-container'),
            pdfViewer: $('pdf-viewer'),
            pptContainer: $('ppt-container'),
            textViewerContainer: $('text-viewer-container'),
            textViewerContent: $('text-viewer-content'),
            htmlViewerContainer: $('html-viewer-container'),
            htmlViewer: $('html-viewer'),
            msgViewerContainer: $('msg-viewer-container'),
            msgViewerContent: $('msg-viewer-content'),
            unsupportedContainer: $('unsupported-container'),
            bgColorPicker: $('bg-color-picker'),
            textColorPicker: $('text-color-picker'),
            btnBgColor: $('btn-bg-color'),
            btnTextColor: $('btn-text-color'),
            btnBold: $('btn-bold'),
            btnAlignLeft: $('btn-align-left'),
            btnAlignCenter: $('btn-align-center'),
            btnAlignRight: $('btn-align-right'),
            btnFilter: $('btn-filter'),
            fontSizeSelect: $('font-size-select'),
            btnFontSizeUp: $('btn-font-size-up'),
            btnFontSizeDown: $('btn-font-size-down'),
            // 数式バー
            formulaBar: $('formula-bar'),
            formulaInput: $('formula-input'),
            // ファイル検索
            fileSearchInput: $('file-search-input'),
            fileSearchClear: $('file-search-clear'),
            // セル結合
            btnMergeCells: $('btn-merge-cells'),
            btnUnmergeCells: $('btn-unmerge-cells')
        };

        // Bootstrap モーダル
        this.elements.deleteModal = new bootstrap.Modal($('deleteModal'));
        this.elements.newFileModal = new bootstrap.Modal($('newFileModal'));
        this.elements.newFolderModal = new bootstrap.Modal($('newFolderModal'));
        this.elements.renameModal = new bootstrap.Modal($('renameModal'));
    }

    initEventListeners() {
        const el = this.elements;

        // ファイル操作
        el.btnNew.addEventListener('click', () => el.newFileModal.show());
        el.btnNewFolder.addEventListener('click', () => el.newFolderModal.show());
        $('newFileModal').addEventListener('shown.bs.modal', () => el.newFilename.focus());
        $('newFolderModal').addEventListener('shown.bs.modal', () => el.newFoldername.focus());
        el.fileUpload.addEventListener('change', e => this.handleUpload(e));
        el.folderUpload.addEventListener('change', e => this.handleFolderUpload(e));
        $('btn-confirm-new').addEventListener('click', () => this.createNewFile());
        $('btn-confirm-new-folder').addEventListener('click', () => this.createNewFolder());
        $('btn-confirm-delete').addEventListener('click', () => this.confirmDelete());
        $('btn-confirm-rename').addEventListener('click', () => this.confirmRename());
        el.btnDownload.addEventListener('click', () => this.downloadFile());

        // 画像操作
        $('btn-zoom-in')?.addEventListener('click', () => this.zoomImage(1.25));
        $('btn-zoom-out')?.addEventListener('click', () => this.zoomImage(0.8));
        $('btn-zoom-reset')?.addEventListener('click', () => this.resetImageZoom());
        $('btn-download-unsupported')?.addEventListener('click', () => this.downloadFile());

        // スタイル操作
        el.btnBgColor.addEventListener('click', () => {
            const currentColor = this.getSelectedCellColor('backgroundColor');
            if (currentColor) el.bgColorPicker.value = currentColor;
            el.bgColorPicker.click();
        });
        el.btnTextColor.addEventListener('click', () => {
            const currentColor = this.getSelectedCellColor('color');
            if (currentColor) el.textColorPicker.value = currentColor;
            el.textColorPicker.click();
        });
        el.btnBold.addEventListener('click', () => this.toggleStyle('fontWeight', 'bold'));
        el.btnAlignLeft.addEventListener('click', () => this.applyStyleToSelection({ textAlign: 'left' }));
        el.btnAlignCenter.addEventListener('click', () => this.applyStyleToSelection({ textAlign: 'center' }));
        el.btnAlignRight.addEventListener('click', () => this.applyStyleToSelection({ textAlign: 'right' }));

        // フォントサイズ
        el.fontSizeSelect?.addEventListener('change', e => {
            const size = parseInt(e.target.value, 10);
            if (size) this.applyStyleToSelection({ fontSize: size });
        });
        el.btnFontSizeUp?.addEventListener('click', () => this.changeFontSize(1));
        el.btnFontSizeDown?.addEventListener('click', () => this.changeFontSize(-1));

        // カラーピッカー
        el.bgColorPicker.addEventListener('input', e => this.previewStyleToSelection({ backgroundColor: e.target.value }));
        el.bgColorPicker.addEventListener('change', e => this.applyColorToPreviewCells({ backgroundColor: e.target.value }));
        el.textColorPicker.addEventListener('input', e => this.previewStyleToSelection({ color: e.target.value }));
        el.textColorPicker.addEventListener('change', e => this.applyColorToPreviewCells({ color: e.target.value }));

        // 罫線
        document.querySelectorAll('[data-border]').forEach(item => {
            item.addEventListener('click', e => {
                e.preventDefault();
                this.applyBorder(item.dataset.border);
            });
        });

        // フィルター
        el.btnFilter?.addEventListener('click', () => this.toggleFilter());

        // セル結合
        el.btnMergeCells?.addEventListener('click', () => this.mergeCells());
        el.btnUnmergeCells?.addEventListener('click', () => this.unmergeCells());

        // 3Dビューアリサイズ
        window.addEventListener('resize', () => this.resizeRenderer && this.resizeRenderer());

        // PowerPointナビゲーション
        $('btn-prev-slide')?.addEventListener('click', () => this.prevSlide());
        $('btn-next-slide')?.addEventListener('click', () => this.nextSlide());

        function $(id) { return document.getElementById(id); }
    }

    // ===== ユーティリティ =====

    get currentSheet() { return this.state.currentSheet; }
    set currentSheet(val) { this.state.currentSheet = val; }

    getCell(row, col) {
        const tbody = this.elements.spreadsheet?.tBodies?.[0];
        if (!tbody) return null;
        const tr = tbody.rows[row];
        if (!tr) return null;
        const candidate = tr.cells[col + 1];
        if (candidate && +candidate.dataset.col === col) return candidate;
        return tr.querySelector(`td[data-col="${col}"]`);
    }

    ensureCellData(row, col) {
        const key = `${row},${col}`;
        const cells = this.state.sheetsData[this.currentSheet].cells;
        if (!cells[key]) cells[key] = { value: '', style: {} };
        return cells[key];
    }

    getSelectionBounds() {
        const cells = this.state.selectedCells;
        if (cells.length === 0) return null;
        return {
            minRow: Math.min(...cells.map(c => c.row)),
            maxRow: Math.max(...cells.map(c => c.row)),
            minCol: Math.min(...cells.map(c => c.col)),
            maxCol: Math.max(...cells.map(c => c.col))
        };
    }

    getSelectedCellColor(type) {
        const cells = this.state.selectedCells;
        if (cells.length === 0) return null;

        const { row, col, cell } = cells[0];
        const cellData = this.state.sheetsData[this.currentSheet]?.cells[`${row},${col}`];
        if (cellData?.style) {
            if (type === 'backgroundColor' && cellData.style.backgroundColor) {
                return cellData.style.backgroundColor;
            }
            if (type === 'color' && cellData.style.color) {
                return cellData.style.color;
            }
        }

        const element = type === 'color' ? cell.querySelector('.cell-content') : cell;
        const computedColor = getComputedStyle(element)[type];
        return this.rgbToHex(computedColor);
    }

    rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
        if (rgb.startsWith('#')) return rgb;

        const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return null;

        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    getFileType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        return FILE_TYPE_MAP[ext] || FILE_TYPES.OTHER;
    }

    getColumnName(col) {
        let name = '';
        col++;
        while (col > 0) {
            col--;
            name = String.fromCharCode(65 + (col % 26)) + name;
            col = Math.floor(col / 26);
        }
        return name;
    }

    escapeHtml(text) {
        if (text == null) return '';
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    formatDate(timestamp) {
        const d = new Date(timestamp * 1000);
        return d.toLocaleDateString('ja-JP') + ' ' + d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    }

    showLoading() { this.elements.loading.classList.add('visible'); }
    hideLoading() { this.elements.loading.classList.remove('visible'); }
    getCSRFToken() { return document.querySelector('meta[name="csrf-token"]').content; }

    showSaveIndicator(message, isError = false) {
        const el = document.getElementById('save-indicator');
        if (!el) return;
        el.textContent = message;
        el.className = `save-indicator ${isError ? 'error' : 'success'} visible`;
        setTimeout(() => el.classList.remove('visible'), 2000);
    }

    // ===== 数式バー =====

    /**
     * 数式バーを更新
     * @param {number} row - 行番号
     * @param {number} col - 列番号
     */
    updateFormulaBar(row, col) {
        const { formulaInput } = this.elements;
        if (!formulaInput) return;

        // セルの値（数式または値）を取得
        const sheet = this.state.sheetsData[this.currentSheet];
        const cellData = sheet?.cells[`${row},${col}`];
        const value = cellData?.value || '';
        formulaInput.value = value;

        // 現在のフォーカスセルを記録
        this.state.formulaBarCell = { row, col };
    }

    /**
     * 数式バーの初期化（イベントリスナー設定）
     */
    initFormulaBar() {
        const { formulaInput } = this.elements;
        if (!formulaInput) return;

        // フォーカス状態の追跡
        formulaInput.addEventListener('focus', () => {
            this.state.isFormulaBarFocused = true;
            // 数式の場合、参照セルをハイライト
            if (formulaInput.value.startsWith('=')) {
                this.highlightFormulaReferences?.(formulaInput.value);
            }
        });

        // 数式バーでの入力イベント（ハイライト更新）
        formulaInput.addEventListener('input', () => {
            // 数式の場合、参照セルをハイライト
            if (formulaInput.value.startsWith('=')) {
                this.highlightFormulaReferences?.(formulaInput.value);
            } else {
                this.clearFormulaHighlights?.();
            }
        });

        // 数式バーでのキー処理
        formulaInput.addEventListener('keydown', (e) => {
            // documentレベルのkeydownイベント（keyboard.js）に伝播させない
            e.stopPropagation();

            // オートコンプリートが表示中の場合は、そちらで処理
            if (this.state.autocomplete?.visible) return;

            const { row, col } = this.state.formulaBarCell || { row: 0, col: 0 };

            switch (e.key) {
                case 'Enter':
                    e.preventDefault();
                    // blurイベントでの再処理を防ぐ
                    this.state.isFormulaBarFocused = false;
                    this.state.formulaBarCommitted = true;
                    this.applyFormulaBarValue();
                    this.closeFormulaAssist?.();
                    this.selectCell(row + 1, col);
                    this.ensureVisibleCell(row + 1, col);
                    // スプレッドシートにフォーカスを移す
                    formulaInput.blur();
                    this.elements.spreadsheet.focus();
                    break;
                case 'Tab':
                    e.preventDefault();
                    // blurイベントでの再処理を防ぐ
                    this.state.isFormulaBarFocused = false;
                    this.state.formulaBarCommitted = true;
                    this.applyFormulaBarValue();
                    this.closeFormulaAssist?.();
                    this.selectCell(row, col + 1);
                    this.ensureVisibleCell(row, col + 1);
                    // スプレッドシートにフォーカスを移す
                    formulaInput.blur();
                    this.elements.spreadsheet.focus();
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.state.isFormulaBarFocused = false;
                    this.state.formulaBarCommitted = true;
                    this.closeFormulaAssist?.();
                    this.updateFormulaBar(row, col);
                    formulaInput.blur();
                    this.elements.spreadsheet.focus();
                    break;
            }
        });

        // フォーカスが外れたときに値を適用
        formulaInput.addEventListener('blur', () => {
            // Enter/Tab/Escapeで既に処理済みの場合はスキップ
            if (this.state.formulaBarCommitted) {
                this.state.formulaBarCommitted = false;
                return;
            }
            this.state.isFormulaBarFocused = false;
            this.applyFormulaBarValue();
            if (!this.state.isSelectingFormulaRange) {
                this.closeFormulaAssist?.();
            }
        });

        // 数式オートコンプリートの初期化
        if (this.initFormulaAutocomplete) {
            this.initFormulaAutocomplete();
        }
    }

    /**
     * 数式バーの値をセルに適用
     */
    applyFormulaBarValue() {
        const { formulaInput } = this.elements;
        if (!formulaInput || !this.state.formulaBarCell) return;

        const { row, col } = this.state.formulaBarCell;
        let newValue = formulaInput.value;
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        // 数式の場合、閉じていない括弧を自動で閉じる
        if (newValue.startsWith('=') && this.autoCloseParentheses) {
            newValue = this.autoCloseParentheses(newValue);
            formulaInput.value = newValue;
        }

        const cellData = sheet.cells[`${row},${col}`];
        const oldValue = cellData?.value || '';

        if (newValue !== oldValue) {
            // Undoスタックに保存
            this.saveToUndoStack?.([{ row, col }]);

            // データを更新
            this.ensureCellData(row, col).value = newValue;

            // DOM更新
            const cell = this.getCell(row, col);
            if (cell) {
                cell.dataset.formula = newValue;
                const content = cell.querySelector('.cell-content');
                const input = cell.querySelector('.cell-input');
                const displayValue = this.calculateDisplayValue?.(newValue, sheet.cells);
                if (content) {
                    content.textContent = displayValue || newValue;
                }
                if (input) {
                    input.value = newValue;
                }
            }

            // サーバーに保存
            this.sendChangesToServer?.([{ row, col, value: newValue }]);

            // 他の数式を再計算
            this.recalculateAllFormulas?.();
        }
    }

    /**
     * 数式バーの入力をリアルタイムでプレビュー
     */
    previewFormulaBarValue() {
        const { formulaInput } = this.elements;
        if (!formulaInput || !this.state.formulaBarCell) return;

        const { row, col } = this.state.formulaBarCell;
        const newValue = formulaInput.value;
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        // セルの表示をプレビュー
        const cell = this.getCell(row, col);
        if (cell) {
            const content = cell.querySelector('.cell-content');
            if (content) {
                content.textContent = this.calculateDisplayValue?.(newValue, sheet.cells) || newValue;
            }
        }
    }

    /**
     * 指定セルが見えるようにスクロール
     */
    ensureVisibleCell(row, col) {
        const cell = this.getCell(row, col);
        if (cell) {
            cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }

    async apiCall(url, options = {}) {
        const defaultHeaders = { 'Content-Type': 'application/json', 'X-CSRFToken': this.getCSRFToken() };
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: { ...defaultHeaders, ...options.headers },
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        return response.json();
    }

    extractFolderFromPath(filePath) {
        if (!filePath) return '';
        const parts = filePath.split('/');
        if (parts.length <= 1) return '';
        return parts.slice(0, -1).join('/');
    }

    updateURL(usePushState = true) {
        const baseUrl = '/drive';
        let newUrl;

        const encodePath = (path) => path.split('/').map(part => encodeURIComponent(part)).join('/');

        if (this.state.currentFilePath) {
            newUrl = `${baseUrl}/file/${encodePath(this.state.currentFilePath)}/`;
        } else if (this.state.currentFolder) {
            newUrl = `${baseUrl}/folder/${encodePath(this.state.currentFolder)}/`;
        } else {
            newUrl = `${baseUrl}/`;
        }

        if (window.location.pathname !== newUrl) {
            const stateData = { folder: this.state.currentFolder, file: this.state.currentFilePath };
            if (usePushState) {
                history.pushState(stateData, '', newUrl);
            } else {
                history.replaceState(stateData, '', newUrl);
            }
        }
    }

    initHistoryNavigation() {
        // ブラウザの戻る/進むボタンでフォルダ間を移動
        window.addEventListener('popstate', (e) => {
            if (e.state) {
                this.handlePopState(e.state);
            } else {
                // stateがない場合はルートフォルダへ
                this.handlePopState({ folder: '', file: null });
            }
        });

        // 初期状態を履歴に記録（replaceStateを使用）
        const initialState = { folder: this.state.currentFolder, file: this.state.currentFilePath };
        history.replaceState(initialState, '', window.location.pathname);
    }

    async handlePopState(state) {
        const { folder, file } = state;

        if (file) {
            // ファイルが指定されている場合
            const fileName = file.split('/').pop();
            const fileType = this.getFileType(fileName);
            this.state.currentFolder = this.extractFolderFromPath(file);
            await this.loadFileList();
            await this.openFile(file, fileName, fileType);
            // popstateによる遷移なのでpushStateは不要
            this.updateURL(false);
        } else {
            // フォルダのみの場合
            this.state.currentFolder = folder || '';
            if (this.state.currentFilePath) {
                this._resetCurrentFileState();
            }
            await this.loadFileList();
            // popstateによる遷移なのでpushStateは不要
            this.updateURL(false);
        }
    }
}

// ミックスインを適用してDKCDriveクラスを構築
const DKCDrive = HtmlEditorMixin(SealMixin(
    ShapeMixin(
        ImageMixin(
            SearchMixin(
                FolderAnalysisMixin(
                    ChartMixin(
                        KeyboardMixin(
                            ClipboardMixin(
                                MergeMixin(
                                    StyleMixin(
                                        SpreadsheetMixin(
                                            FileManagerMixin(
                                                WebSocketMixin(
                                                    AutoScrollMixin(
                                                        ViewerMSGMixin(
                                                            ViewerPPTMixin(
                                                                Viewer3DMixin(
                                                                    ViewersMixin(DKCDriveBase)
                                                                )
                                                            )
                                                        )
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
    )
));

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
    window.dkcDrive = new DKCDrive();
});
