/**
 * DKCドライブ - セル選択モジュール
 * セル、行、列の選択機能
 */

import { SPREADSHEET } from './constants.js';

/**
 * セル選択のミックスイン
 */
export const SelectionMixin = (Base) => class extends Base {

    selectCell(row, col) {
        if (this.resolveToMergeOrigin) {
            const resolved = this.resolveToMergeOrigin(row, col);
            row = resolved.row;
            col = resolved.col;
        }
        this.clearSelection();
        const cell = this.getCell(row, col);
        if (cell) {
            cell.classList.add('selected');
            this.state.selectedCells = [{ row, col, cell }];
            this.state.selectionStart = { row, col };
            this.updateToolbarFromSelection?.();
            this.updateFormulaBar?.(row, col);
        }
    }

    selectRange(start, end) {
        let minR = Math.min(start.row, end.row);
        let maxR = Math.max(start.row, end.row);
        let minC = Math.min(start.col, end.col);
        let maxC = Math.max(start.col, end.col);

        // マージが部分選択された場合、範囲を拡張して全体を含める
        if (this.getMergeForCell) {
            let changed = true;
            while (changed) {
                changed = false;
                const sheet = this.state.sheetsData[this.currentSheet];
                for (const m of (sheet?.merges || [])) {
                    if (!(m.endRow < minR || m.startRow > maxR ||
                          m.endCol < minC || m.startCol > maxC)) {
                        if (m.startRow < minR) { minR = m.startRow; changed = true; }
                        if (m.endRow > maxR) { maxR = m.endRow; changed = true; }
                        if (m.startCol < minC) { minC = m.startCol; changed = true; }
                        if (m.endCol > maxC) { maxC = m.endCol; changed = true; }
                    }
                }
            }
        }

        this.clearSelection();
        this.state.selectedCells = [];

        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                if (this.isMergedSlave?.(r, c)) continue;
                const cell = this.getCell(r, c);
                if (cell) {
                    const isStart = r === start.row && c === start.col;
                    cell.classList.add(isStart ? 'selected' : 'in-selection');
                    this.state.selectedCells.push({ row: r, col: c, cell });
                }
            }
        }
        this.updateToolbarFromSelection?.();
        this.updateFormulaBar?.(start.row, start.col);
    }

    selectColumn(col) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        const maxRow = sheet.displayRows || SPREADSHEET.DEFAULT_ROWS;
        this.clearSelection();
        this.state.selectedCells = [];

        for (let r = 0; r < maxRow; r++) {
            const cell = this.getCell(r, col);
            if (cell) {
                cell.classList.add('in-selection');
                this.state.selectedCells.push({ row: r, col, cell });
            }
        }

        this._markFirstAsSelected();
        this.highlightColumnHeaders([col]);
        this.state.selectionStart = { row: 0, col };
        this.updateToolbarFromSelection?.();
        this.updateFormulaBar?.(0, col);
    }

    selectColumnRange(startCol, endCol) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);
        const maxRow = sheet.displayRows || SPREADSHEET.DEFAULT_ROWS;

        this.clearSelection();
        this.state.selectedCells = [];

        for (let c = minCol; c <= maxCol; c++) {
            for (let r = 0; r < maxRow; r++) {
                const cell = this.getCell(r, c);
                if (cell) {
                    cell.classList.add('in-selection');
                    this.state.selectedCells.push({ row: r, col: c, cell });
                }
            }
        }

        this._markFirstAsSelected();
        const cols = Array.from({ length: maxCol - minCol + 1 }, (_, i) => minCol + i);
        this.highlightColumnHeaders(cols);
        this.state.selectionStart = { row: 0, col: startCol };
        this.updateToolbarFromSelection?.();
        this.updateFormulaBar?.(0, minCol);
    }

    selectRow(row) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        const maxCol = sheet.displayCols || SPREADSHEET.DEFAULT_COLS;
        this.clearSelection();
        this.state.selectedCells = [];

        for (let c = 0; c < maxCol; c++) {
            const cell = this.getCell(row, c);
            if (cell) {
                cell.classList.add('in-selection');
                this.state.selectedCells.push({ row, col: c, cell });
            }
        }

        this._markFirstAsSelected();
        this.highlightRowHeaders([row]);
        this.state.selectionStart = { row, col: 0 };
        this.updateToolbarFromSelection?.();
        this.updateFormulaBar?.(row, 0);
    }

    selectRowRange(startRow, endRow) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        const minRow = Math.min(startRow, endRow);
        const maxRowIdx = Math.max(startRow, endRow);
        const maxCol = sheet.displayCols || SPREADSHEET.DEFAULT_COLS;

        this.clearSelection();
        this.state.selectedCells = [];

        for (let r = minRow; r <= maxRowIdx; r++) {
            for (let c = 0; c < maxCol; c++) {
                const cell = this.getCell(r, c);
                if (cell) {
                    cell.classList.add('in-selection');
                    this.state.selectedCells.push({ row: r, col: c, cell });
                }
            }
        }

        this._markFirstAsSelected();
        const rows = Array.from({ length: maxRowIdx - minRow + 1 }, (_, i) => minRow + i);
        this.highlightRowHeaders(rows);
        this.state.selectionStart = { row: startRow, col: 0 };
        this.updateToolbarFromSelection?.();
        this.updateFormulaBar?.(minRow, 0);
    }

    selectAll() {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        const maxRow = sheet.displayRows || SPREADSHEET.DEFAULT_ROWS;
        const maxCol = sheet.displayCols || SPREADSHEET.DEFAULT_COLS;

        this.clearSelection();
        this.state.selectedCells = [];

        for (let r = 0; r < maxRow; r++) {
            for (let c = 0; c < maxCol; c++) {
                const cell = this.getCell(r, c);
                if (cell) {
                    cell.classList.add('in-selection');
                    this.state.selectedCells.push({ row: r, col: c, cell });
                }
            }
        }

        this._markFirstAsSelected();
        const cols = Array.from({ length: maxCol }, (_, i) => i);
        const rows = Array.from({ length: maxRow }, (_, i) => i);
        this.highlightColumnHeaders(cols);
        this.highlightRowHeaders(rows);
        this.state.selectionStart = { row: 0, col: 0 };
        this.updateToolbarFromSelection?.();
        this.updateFormulaBar?.(0, 0);
    }

    clearSelection() {
        // 追跡中のセルから直接クリア（querySelectorAll全走査を回避）
        if (this.state.selectedCells?.length > 0) {
            for (const { cell } of this.state.selectedCells) {
                if (cell) cell.classList.remove('selected', 'in-selection');
            }
        }
        // ヘッダーのクリア
        const spreadsheet = this.elements.spreadsheet;
        spreadsheet.querySelectorAll('th.col-header.selected, th.row-header.selected').forEach(th => {
            th.classList.remove('selected');
        });
    }

    highlightColumnHeaders(cols) {
        const spreadsheet = this.elements.spreadsheet;
        spreadsheet.querySelectorAll('th.col-header').forEach(th => {
            th.classList.remove('selected');
        });
        cols.forEach(col => {
            const th = spreadsheet.querySelector(`th.col-header[data-col="${col}"]`);
            if (th) th.classList.add('selected');
        });
    }

    highlightRowHeaders(rows) {
        const spreadsheet = this.elements.spreadsheet;
        spreadsheet.querySelectorAll('th.row-header').forEach(th => {
            th.classList.remove('selected');
        });
        rows.forEach(row => {
            const th = spreadsheet.querySelector(`th.row-header[data-row="${row}"]`);
            if (th) th.classList.add('selected');
        });
    }

    /** @private 最初のセルをselectedに変更 */
    _markFirstAsSelected() {
        if (this.state.selectedCells.length > 0) {
            const first = this.state.selectedCells[0];
            first.cell.classList.remove('in-selection');
            first.cell.classList.add('selected');
        }
    }
};
