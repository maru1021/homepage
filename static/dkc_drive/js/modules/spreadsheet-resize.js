/**
 * DKCドライブ - リサイズモジュール
 * 列幅・行高さのリサイズ機能
 */

import { API, SPREADSHEET } from './constants.js';

/**
 * リサイズ機能のミックスイン
 */
export const ResizeMixin = (Base) => class extends Base {

    setupResizeEvents() {
        const spreadsheet = this.elements.spreadsheet;

        // 列リサイズハンドル
        spreadsheet.querySelectorAll('.col-resize-handle').forEach(handle => {
            if (handle._resizeEventSet) return;
            handle._resizeEventSet = true;

            handle.addEventListener('mousedown', e => {
                e.preventDefault();
                e.stopPropagation();

                const col = parseInt(handle.dataset.col, 10);
                if (isNaN(col)) return;

                const th = handle.closest('th.col-header');
                if (!th) return;

                this.state.isResizingColumn = true;
                this.state.resizeColumn = col;
                this.state.resizeStartX = e.clientX;
                this.state.resizeStartWidth = th.offsetWidth;

                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
            });
        });

        // 行リサイズハンドル
        spreadsheet.querySelectorAll('.row-resize-handle').forEach(handle => {
            if (handle._resizeEventSet) return;
            handle._resizeEventSet = true;

            handle.addEventListener('mousedown', e => {
                e.preventDefault();
                e.stopPropagation();

                const row = parseInt(handle.dataset.row, 10);
                if (isNaN(row)) return;

                const th = handle.closest('th.row-header');
                if (!th) return;

                this.state.isResizingRow = true;
                this.state.resizeRow = row;
                this.state.resizeStartY = e.clientY;
                this.state.resizeStartHeight = th.offsetHeight;

                document.body.style.cursor = 'row-resize';
                document.body.style.userSelect = 'none';
            });
        });
    }

    handleColumnResize(e) {
        if (!this.state.isResizingColumn) return;

        const col = this.state.resizeColumn;
        const deltaX = e.clientX - this.state.resizeStartX;
        const newWidth = Math.max(SPREADSHEET.MIN_COL_WIDTH, this.state.resizeStartWidth + deltaX);

        const th = this.elements.spreadsheet.querySelector(`th.col-header[data-col="${col}"]`);
        if (th) {
            th.style.width = `${newWidth}px`;
        }

        // 該当列の全セルの幅を変更（バッチ処理）
        this.elements.spreadsheet.querySelectorAll(`td[data-col="${col}"]`).forEach(td => {
            td.style.width = `${newWidth}px`;
        });
    }

    handleRowResize(e) {
        if (!this.state.isResizingRow) return;

        const row = this.state.resizeRow;
        const deltaY = e.clientY - this.state.resizeStartY;
        const newHeight = Math.max(SPREADSHEET.MIN_ROW_HEIGHT, this.state.resizeStartHeight + deltaY);

        const th = this.elements.spreadsheet.querySelector(`th.row-header[data-row="${row}"]`);
        if (th) {
            th.style.height = `${newHeight}px`;
            th.style.minHeight = `${newHeight}px`;
        }

        // 該当行の全セルの高さを変更（バッチ処理）
        this.elements.spreadsheet.querySelectorAll(`td[data-row="${row}"]`).forEach(td => {
            td.style.height = `${newHeight}px`;
            td.style.minHeight = `${newHeight}px`;
            const content = td.querySelector('.cell-content');
            if (content) {
                content.style.minHeight = `${newHeight - 2}px`;
            }
        });
    }

    finishResize() {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        if (this.state.isResizingColumn) {
            const col = this.state.resizeColumn;
            const th = this.elements.spreadsheet.querySelector(`th.col-header[data-col="${col}"]`);
            if (th) {
                const newWidth = th.offsetWidth;
                const oldWidth = sheet.colWidths?.[col] || sheet.colWidths?.default || SPREADSHEET.DEFAULT_COL_WIDTH;
                if (!sheet.colWidths) sheet.colWidths = {};
                sheet.colWidths[col] = newWidth;
                this.saveColumnWidth(col, newWidth);
                // テーブル幅を更新
                const currentTableWidth = parseFloat(this.elements.spreadsheet.style.width) || 0;
                if (currentTableWidth) {
                    this.elements.spreadsheet.style.width = `${currentTableWidth + (newWidth - oldWidth)}px`;
                }
            }
        }

        if (this.state.isResizingRow) {
            const row = this.state.resizeRow;
            const th = this.elements.spreadsheet.querySelector(`th.row-header[data-row="${row}"]`);
            if (th) {
                const newHeight = th.offsetHeight;
                if (!sheet.rowHeights) sheet.rowHeights = {};
                sheet.rowHeights[row] = newHeight;
                this.saveRowHeight(row, newHeight);
            }
        }

        // 状態をリセット
        this.state.isResizingColumn = false;
        this.state.isResizingRow = false;
        this.state.resizeColumn = null;
        this.state.resizeRow = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }

    async saveColumnWidth(col, width) {
        if (!this.state.currentFilePath) return;

        try {
            await this.apiCall(API.COLUMN_WIDTH, {
                method: 'POST',
                body: {
                    path: this.state.currentFilePath,
                    sheetName: this.currentSheet,
                    col,
                    width
                }
            });
            this.showSaveIndicator('保存完了');
        } catch (e) {
            console.error('列幅保存エラー:', e);
        }
    }

    async saveRowHeight(row, height) {
        if (!this.state.currentFilePath) return;

        try {
            await this.apiCall(API.ROW_HEIGHT, {
                method: 'POST',
                body: {
                    path: this.state.currentFilePath,
                    sheetName: this.currentSheet,
                    row,
                    height
                }
            });
            this.showSaveIndicator('保存完了');
        } catch (e) {
            console.error('行高さ保存エラー:', e);
        }
    }
};
