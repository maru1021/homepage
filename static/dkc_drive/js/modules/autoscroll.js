/**
 * DKCドライブ - 自動スクロール（ドラッグ選択時）
 */

import { SPREADSHEET, AUTO_SCROLL } from './constants.js';

/**
 * 自動スクロールのミックスイン
 * @param {DKCDrive} Base - 基底クラス
 */
export const AutoScrollMixin = (Base) => class extends Base {

    initAutoScroll() {
        this.autoScrollInterval = null;
        this.autoScrollX = 0;
        this.autoScrollY = 0;
        this.lastMousePosition = null;

        document.addEventListener('mousemove', e => this.handleGlobalMouseMove(e));
        document.addEventListener('mouseup', () => this.stopAutoScroll());
    }

    handleGlobalMouseMove(e) {
        if (!this.state.isSelecting) return;
        this.lastMousePosition = { x: e.clientX, y: e.clientY };
        this.updateAutoScroll();
    }

    updateAutoScroll() {
        if (!this.state.isSelecting || !this.lastMousePosition) {
            this.stopAutoScroll();
            return;
        }

        const container = this.elements.spreadsheetContainer;
        if (!container || container.style.display === 'none') return;

        const rect = container.getBoundingClientRect();
        const { x, y } = this.lastMousePosition;
        const edge = AUTO_SCROLL.EDGE_THRESHOLD;
        const speed = AUTO_SCROLL.SCROLL_SPEED;
        const mult = AUTO_SCROLL.OUTSIDE_MULTIPLIER;

        let scrollX = 0, scrollY = 0;

        if (y < rect.top + edge && y >= rect.top) scrollY = -speed;
        if (y > rect.bottom - edge && y <= rect.bottom) scrollY = speed;
        if (x < rect.left + edge && x >= rect.left) scrollX = -speed;
        if (x > rect.right - edge && x <= rect.right) scrollX = speed;

        if (y < rect.top) scrollY = -speed * mult;
        if (y > rect.bottom) scrollY = speed * mult;
        if (x < rect.left) scrollX = -speed * mult;
        if (x > rect.right) scrollX = speed * mult;

        if (scrollX !== 0 || scrollY !== 0) {
            this.startAutoScroll(scrollX, scrollY);
        } else {
            this.stopAutoScroll();
        }
    }

    startAutoScroll(scrollX, scrollY) {
        if (this.autoScrollInterval) {
            if (this.autoScrollX !== scrollX || this.autoScrollY !== scrollY) {
                this.stopAutoScroll();
            } else {
                return;
            }
        }

        this.autoScrollX = scrollX;
        this.autoScrollY = scrollY;

        this.autoScrollInterval = setInterval(() => {
            if (!this.state.isSelecting) {
                this.stopAutoScroll();
                return;
            }

            const container = this.elements.spreadsheetContainer;
            if (!container) return;

            container.scrollLeft += this.autoScrollX;
            container.scrollTop += this.autoScrollY;

            this.updateSelectionFromMousePosition();
        }, AUTO_SCROLL.INTERVAL_MS);
    }

    stopAutoScroll() {
        if (this.autoScrollInterval) {
            clearInterval(this.autoScrollInterval);
            this.autoScrollInterval = null;
        }
        this.autoScrollX = 0;
        this.autoScrollY = 0;
    }

    updateSelectionFromMousePosition() {
        if (!this.state.isSelecting || !this.lastMousePosition || !this.state.selectionStart) return;

        const container = this.elements.spreadsheetContainer;
        if (!container) return;

        const { x, y } = this.lastMousePosition;
        const containerRect = container.getBoundingClientRect();

        const cellInfo = this.getCellFromPosition(x, y, containerRect);
        if (cellInfo) {
            this.checkAndExpandGrid(cellInfo.row, cellInfo.col);
            this.selectRange(this.state.selectionStart, cellInfo);
        }
    }

    getCellFromPosition(x, y, containerRect) {
        const container = this.elements.spreadsheetContainer;
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!container || !sheet) return null;

        const relativeX = x - containerRect.left + container.scrollLeft;
        const relativeY = y - containerRect.top + container.scrollTop;

        const rowHeaderWidth = SPREADSHEET.ROW_HEADER_WIDTH;
        const colHeaderHeight = SPREADSHEET.COL_HEADER_HEIGHT;

        if (relativeX < rowHeaderWidth || relativeY < colHeaderHeight) return null;

        let col = -1;
        let accumulatedWidth = rowHeaderWidth;
        for (let c = 0; c < (sheet.displayCols || SPREADSHEET.DEFAULT_COLS); c++) {
            const colWidth = sheet.colWidths?.[c] || sheet.colWidths?.default || SPREADSHEET.DEFAULT_COL_WIDTH;
            if (relativeX >= accumulatedWidth && relativeX < accumulatedWidth + colWidth) {
                col = c;
                break;
            }
            accumulatedWidth += colWidth;
        }
        if (col === -1 && relativeX >= accumulatedWidth) {
            col = sheet.displayCols || 26;
        }

        let row = -1;
        let accumulatedHeight = colHeaderHeight;
        for (let r = 0; r < (sheet.displayRows || SPREADSHEET.DEFAULT_ROWS); r++) {
            const rowHeight = sheet.rowHeights?.[r] || sheet.rowHeights?.default || SPREADSHEET.DEFAULT_ROW_HEIGHT;
            if (relativeY >= accumulatedHeight && relativeY < accumulatedHeight + rowHeight) {
                row = r;
                break;
            }
            accumulatedHeight += rowHeight;
        }
        if (row === -1 && relativeY >= accumulatedHeight) {
            row = sheet.displayRows || 50;
        }

        if (row >= 0 && col >= 0) {
            return { row, col };
        }

        if (row === -1) {
            row = y < containerRect.top ? 0 : (sheet.displayRows || SPREADSHEET.DEFAULT_ROWS) - 1;
        }
        if (col === -1) {
            col = x < containerRect.left ? 0 : (sheet.displayCols || SPREADSHEET.DEFAULT_COLS) - 1;
        }

        return { row: Math.max(0, row), col: Math.max(0, col) };
    }
};
