/**
 * DKCドライブ - セルイベントモジュール
 * イベント委任によるセルのマウス・キーボードイベント処理
 */

import { isSpreadsheetType, SPREADSHEET, SCROLL_EXPAND } from './constants.js';

/**
 * セルイベントのミックスイン
 */
export const EventsMixin = (Base) => class extends Base {

    setupCellEvents() {
        // ヘッダーとリサイズは要素再生成のため毎回設定
        this.setupHeaderEvents();
        this.setupResizeEvents();

        // イベント委任とグローバルイベントは初回のみ（テーブル要素は維持されるため）
        if (!this._cellEventsInitialized) {
            this._cellEventsInitialized = true;
            this._initDelegatedCellEvents();
            this._initGlobalEvents();
        }
    }

    /**
     * テーブル要素にイベント委任を設定
     * 個別セルへのリスナー登録を不要にし、大量セルでも高速
     */
    _initDelegatedCellEvents() {
        const table = this.elements.spreadsheet;
        let lastHoveredCell = null;

        // mousedown 委任
        table.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            const cell = e.target.closest('td[data-row][data-col]');
            if (!cell) return;

            const row = +cell.dataset.row;
            const col = +cell.dataset.col;

            // 数式入力モードの場合、セル参照を挿入
            if (this.isFormulaInputMode?.()) {
                e.preventDefault();
                e.stopPropagation();
                this.insertCellReference(row, col);
                this.state.formulaRangeStart = { row, col };
                this.state.isSelectingFormulaRange = true;
                this.highlightCurrentFormulaRef?.(row, col);
                return;
            }

            if (e.shiftKey && this.state.selectionStart) {
                this.selectRange(this.state.selectionStart, { row, col });
            } else {
                this.selectCell(row, col);
                this.state.selectionStart = { row, col };
                this.state.isSelecting = true;
            }
        });

        // mouseover 委任（mouseenterはバブルしないためmouseoverを使用）
        table.addEventListener('mouseover', e => {
            const cell = e.target.closest('td[data-row][data-col]');
            if (!cell || cell === lastHoveredCell) return;
            lastHoveredCell = cell;

            const row = +cell.dataset.row;
            const col = +cell.dataset.col;

            if (this.state.isSelectingFormulaRange && this.state.formulaRangeStart) {
                this.updateFormulaRangeReference?.(this.state.formulaRangeStart, { row, col });
                this.highlightFormulaRangeSelection?.(this.state.formulaRangeStart, { row, col });
                return;
            }

            if (this.state.isSelecting && this.state.selectionStart) {
                this.selectRange(this.state.selectionStart, { row, col });
                this.checkAndExpandGrid(row, col);
            }
        });

        // mouseup 委任
        table.addEventListener('mouseup', e => {
            const cell = e.target.closest('td[data-row][data-col]');
            if (!cell) return;

            if (this.state.isSelectingFormulaRange) {
                this.state.isSelectingFormulaRange = false;
                this.state.formulaRangeStart = null;
            }
        });

        // dblclick 委任
        table.addEventListener('dblclick', e => {
            const cell = e.target.closest('td[data-row][data-col]');
            if (cell) this.startEditing(cell);
        });

        // focusout 委任（blurはバブルしないためfocusoutを使用）
        table.addEventListener('focusout', e => {
            if (!e.target.classList.contains('cell-input')) return;
            const cell = e.target.closest('td[data-row][data-col]');
            if (!cell) return;

            if (this.state.isSelectingFormulaRange) {
                e.preventDefault();
                return;
            }
            this.finishEditing(cell);
        });

        // input 委任
        table.addEventListener('input', e => {
            if (!e.target.classList.contains('cell-input')) return;
            const input = e.target;

            if (this.elements.formulaInput) {
                this.elements.formulaInput.value = input.value;
            }
            if (input.value.startsWith('=')) {
                this.highlightFormulaReferences?.(input.value);
            } else {
                this.clearFormulaHighlights?.();
            }
            this._handleFormulaInput?.();
        });

        // keydown 委任
        table.addEventListener('keydown', e => {
            if (!e.target.classList.contains('cell-input')) return;
            const cell = e.target.closest('td[data-row][data-col]');
            if (!cell) return;

            const row = +cell.dataset.row;
            const col = +cell.dataset.col;
            const input = e.target;

            // オートコンプリートが表示中の場合は、そちらで処理
            if (this.state.autocomplete?.visible) {
                this._handleAutocompleteKeydown?.(e);
                return;
            }

            switch (e.key) {
                case 'Enter':
                    e.preventDefault();
                    this.finishEditing(cell);
                    this.closeFormulaAssist?.();
                    this.checkAndExpandGrid(row + 1, col);
                    this.selectCell(row + 1, col);
                    this.scrollToCell?.(row + 1, col);
                    this.elements.spreadsheet.focus();
                    break;
                case 'Tab':
                    e.preventDefault();
                    this.finishEditing(cell);
                    this.closeFormulaAssist?.();
                    this.checkAndExpandGrid(row, col + 1);
                    this.selectCell(row, col + 1);
                    this.scrollToCell?.(row, col + 1);
                    this.elements.spreadsheet.focus();
                    break;
                case 'Escape':
                    this.state.editingCell = null;
                    cell.classList.remove('editing');
                    input.value = cell.dataset.formula || cell.querySelector('.cell-content').textContent;
                    if (this.elements.formulaInput) {
                        this.elements.formulaInput.value = input.value;
                    }
                    this.closeFormulaAssist?.();
                    break;
            }
        });
    }

    _initGlobalEvents() {
        document.addEventListener('mouseup', () => {
            this.state.isSelecting = false;
            this.state.isSelectingColumn = false;
            this.state.isSelectingRow = false;
            this.stopAutoScroll?.();

            if (this.state.isSelectingFormulaRange) {
                this.state.isSelectingFormulaRange = false;
                this.state.formulaRangeStart = null;
            }

            // 数式入力での列/行範囲選択もクリア
            if (this.state.isSelectingFormulaColumn) {
                this.state.isSelectingFormulaColumn = false;
                this.state.formulaColumnStart = undefined;
            }
            if (this.state.isSelectingFormulaRow) {
                this.state.isSelectingFormulaRow = false;
                this.state.formulaRowStart = undefined;
            }

            if (this.state.isResizingColumn || this.state.isResizingRow) {
                this.finishResize();
            }
        });

        document.addEventListener('mousemove', e => {
            if (this.state.isResizingColumn) {
                this.handleColumnResize(e);
            } else if (this.state.isResizingRow) {
                this.handleRowResize(e);
            }
        });

        this.elements.spreadsheetContainer?.addEventListener('scroll', () => {
            this.handleSpreadsheetScroll();
        });
    }

    // setupSingleCellEvents は後方互換のため残すが、通常の描画では使用しない
    setupSingleCellEvents(cell) {
        // イベント委任により個別セルへのリスナー登録は不要
        // addRowsToTable/addColsToTable から呼ばれる setupNewCellEvents 用
    }

    setupHeaderEvents() {
        const spreadsheet = this.elements.spreadsheet;

        // 列ヘッダー
        spreadsheet.querySelectorAll('th.col-header').forEach(th => {
            if (th._headerEventSet) return;
            th._headerEventSet = true;

            th.addEventListener('mousedown', e => {
                if (e.button !== 0) return;
                const col = parseInt(th.dataset.col, 10);
                if (isNaN(col)) return;

                // 数式入力モードの場合、列参照を挿入
                if (this.isFormulaInputMode?.()) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.insertColumnReference?.(col);
                    this.state.formulaColumnStart = col;
                    this.state.isSelectingFormulaColumn = true;
                    return;
                }

                if (e.shiftKey && this.state.columnSelectionStart !== undefined) {
                    this.selectColumnRange(this.state.columnSelectionStart, col);
                } else {
                    this.selectColumn(col);
                    this.state.columnSelectionStart = col;
                    this.state.isSelectingColumn = true;
                }
                e.preventDefault();
            });

            th.addEventListener('mouseenter', () => {
                const col = parseInt(th.dataset.col, 10);
                if (isNaN(col)) return;

                // 数式入力で列範囲選択中
                if (this.state.isSelectingFormulaColumn && this.state.formulaColumnStart !== undefined) {
                    this.updateColumnRangeReference?.(this.state.formulaColumnStart, col);
                    return;
                }

                if (this.state.isSelectingColumn && this.state.columnSelectionStart !== undefined) {
                    this.selectColumnRange(this.state.columnSelectionStart, col);
                }
            });

            th.addEventListener('mouseup', () => {
                if (this.state.isSelectingFormulaColumn) {
                    this.state.isSelectingFormulaColumn = false;
                    this.state.formulaColumnStart = undefined;
                }
            });
        });

        // 行ヘッダー
        spreadsheet.querySelectorAll('th.row-header').forEach(th => {
            if (th._headerEventSet) return;
            th._headerEventSet = true;

            th.addEventListener('mousedown', e => {
                if (e.button !== 0) return;
                const row = parseInt(th.dataset.row, 10);
                if (isNaN(row)) return;

                // 数式入力モードの場合、行参照を挿入
                if (this.isFormulaInputMode?.()) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.insertRowReference?.(row);
                    this.state.formulaRowStart = row;
                    this.state.isSelectingFormulaRow = true;
                    return;
                }

                if (e.shiftKey && this.state.rowSelectionStart !== undefined) {
                    this.selectRowRange(this.state.rowSelectionStart, row);
                } else {
                    this.selectRow(row);
                    this.state.rowSelectionStart = row;
                    this.state.isSelectingRow = true;
                }
                e.preventDefault();
            });

            th.addEventListener('mouseenter', () => {
                const row = parseInt(th.dataset.row, 10);
                if (isNaN(row)) return;

                // 数式入力で行範囲選択中
                if (this.state.isSelectingFormulaRow && this.state.formulaRowStart !== undefined) {
                    this.updateRowRangeReference?.(this.state.formulaRowStart, row);
                    return;
                }

                if (this.state.isSelectingRow && this.state.rowSelectionStart !== undefined) {
                    this.selectRowRange(this.state.rowSelectionStart, row);
                }
            });

            th.addEventListener('mouseup', () => {
                if (this.state.isSelectingFormulaRow) {
                    this.state.isSelectingFormulaRow = false;
                    this.state.formulaRowStart = undefined;
                }
            });
        });

        // コーナーセル
        const corner = spreadsheet.querySelector('th.corner');
        if (corner && !corner._headerEventSet) {
            corner._headerEventSet = true;
            corner.addEventListener('click', () => this.selectAll());
        }
    }

    setupNewCellEvents(minRow, maxRow, minCol, maxCol) {
        // セルのイベントはテーブルへの委任で自動的に処理される
        // ヘッダーとリサイズは addRowsToTable/addColsToTable で個別に呼ばれる
    }

    handleSpreadsheetScroll() {
        if (!isSpreadsheetType(this.state.currentFileType)) return;

        const container = this.elements.spreadsheetContainer;
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!container || !sheet) return;

        if (!sheet.displayRows) sheet.displayRows = SPREADSHEET.DEFAULT_ROWS;
        if (!sheet.displayCols) sheet.displayCols = SPREADSHEET.DEFAULT_COLS;

        const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (scrollBottom < SCROLL_EXPAND.THRESHOLD) {
            const dataMaxRow = sheet.dataMaxRow || sheet.displayRows;
            const expandAmount = sheet.displayRows < dataMaxRow ? SCROLL_EXPAND.DATA_BATCH_ROWS : SCROLL_EXPAND.EMPTY_BATCH;
            this.addRowsToTable(sheet.displayRows, expandAmount);
        }

        const scrollRight = container.scrollWidth - container.scrollLeft - container.clientWidth;
        if (scrollRight < SCROLL_EXPAND.THRESHOLD) {
            const dataMaxCol = sheet.dataMaxCol || sheet.displayCols;
            const expandAmount = sheet.displayCols < dataMaxCol ? SCROLL_EXPAND.DATA_BATCH_COLS : SCROLL_EXPAND.EMPTY_BATCH;
            this.addColsToTable(sheet.displayCols, expandAmount);
        }
    }

    checkAndExpandGrid(row, col) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        const threshold = SCROLL_EXPAND.GRID_EDGE_THRESHOLD;
        const expandAmount = SCROLL_EXPAND.EMPTY_BATCH;

        if (row >= sheet.displayRows - threshold) {
            this.addRowsToTable(sheet.displayRows, expandAmount);
        }
        if (col >= sheet.displayCols - threshold) {
            this.addColsToTable(sheet.displayCols, expandAmount);
        }
    }
};
