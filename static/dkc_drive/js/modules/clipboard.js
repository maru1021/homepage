/**
 * DKCドライブ - クリップボード・Undo/Redo操作
 */

import { FILE_TYPES } from './constants.js';

/**
 * クリップボード・履歴管理のミックスイン
 * @param {DKCDrive} Base - 基底クラス
 */
export const ClipboardMixin = (Base) => class extends Base {

    initClipboard() {
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoHistory = 50;
    }

    // ===== Undo/Redo履歴管理 =====

    saveToUndoStack(cells) {
        const snapshot = cells.map(({ row, col }) => {
            const data = this.state.sheetsData[this.currentSheet]?.cells[`${row},${col}`];
            return {
                row,
                col,
                value: data?.value || '',
                style: data?.style ? JSON.parse(JSON.stringify(data.style)) : {}
            };
        });

        this.undoStack.push({
            sheetName: this.currentSheet,
            cells: snapshot
        });

        this.redoStack = [];

        if (this.undoStack.length > this.maxUndoHistory) {
            this.undoStack.shift();
        }
    }

    undo() {
        if (this.undoStack.length === 0) {
            this.showSaveIndicator('元に戻す履歴がありません');
            return;
        }

        const lastAction = this.undoStack.pop();

        if (lastAction.sheetName !== this.currentSheet) {
            this.switchSheet(lastAction.sheetName);
        }

        const redoSnapshot = lastAction.cells.map(({ row, col }) => {
            const data = this.state.sheetsData[this.currentSheet]?.cells[`${row},${col}`];
            return {
                row,
                col,
                value: data?.value || '',
                style: data?.style ? JSON.parse(JSON.stringify(data.style)) : {}
            };
        });
        this.redoStack.push({
            sheetName: this.currentSheet,
            cells: redoSnapshot
        });

        const changes = [];

        lastAction.cells.forEach(({ row, col, value, style }) => {
            const cell = this.getCell(row, col);
            if (cell) {
                const content = cell.querySelector('.cell-content');
                const input = cell.querySelector('.cell-input');

                content.textContent = value;
                input.value = value;

                if (style) {
                    this.applyCellStyle(cell, style);
                }

                const data = this.ensureCellData(row, col);
                data.value = value;
                data.style = style;

                changes.push({ row, col, value, style });
            }
        });

        this.sendChangesToServer(changes);
        this.showSaveIndicator('元に戻しました');
    }

    redo() {
        if (this.redoStack.length === 0) {
            this.showSaveIndicator('やり直す履歴がありません');
            return;
        }

        const redoAction = this.redoStack.pop();

        if (redoAction.sheetName !== this.currentSheet) {
            this.switchSheet(redoAction.sheetName);
        }

        const undoSnapshot = redoAction.cells.map(({ row, col }) => {
            const data = this.state.sheetsData[this.currentSheet]?.cells[`${row},${col}`];
            return {
                row,
                col,
                value: data?.value || '',
                style: data?.style ? JSON.parse(JSON.stringify(data.style)) : {}
            };
        });
        this.undoStack.push({
            sheetName: this.currentSheet,
            cells: undoSnapshot
        });

        const changes = [];

        redoAction.cells.forEach(({ row, col, value, style }) => {
            const cell = this.getCell(row, col);
            if (cell) {
                const content = cell.querySelector('.cell-content');
                const input = cell.querySelector('.cell-input');

                content.textContent = value;
                input.value = value;

                if (style) {
                    this.applyCellStyle(cell, style);
                }

                const data = this.ensureCellData(row, col);
                data.value = value;
                data.style = style;

                changes.push({ row, col, value, style });
            }
        });

        this.sendChangesToServer(changes);
        this.showSaveIndicator('やり直しました');
    }

    clearUndoStack() {
        this.undoStack = [];
        this.redoStack = [];
    }

    // ===== コピー・ペースト =====

    copySelection() {
        const cells = this.state.selectedCells;
        if (cells.length === 0) return;

        const bounds = this.getSelectionBounds();
        this.state.clipboard = [];
        this.state.clipboardStartCell = { row: bounds.minRow, col: bounds.minCol };
        this.state.isCut = false;

        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            const row = [];
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                const data = this.state.sheetsData[this.currentSheet].cells[`${r},${c}`];
                row.push({ value: data?.value || '', style: data?.style ? { ...data.style } : {} });
            }
            this.state.clipboard.push(row);
        }

        this.highlightCopiedCells(bounds);
        this.copyToSystemClipboard(bounds);
        this.showSaveIndicator('コピーしました');
    }

    cutSelection() {
        if (this.state.selectedCells.length === 0) return;
        this.copySelection();
        this.state.isCut = true;
        this.elements.spreadsheet.querySelectorAll('td.copied').forEach(c => {
            c.classList.remove('copied');
            c.classList.add('cut');
        });
        this.showSaveIndicator('切り取りました');
    }

    pasteFromClipboard() {
        const { clipboard, selectedCells, clipboardStartCell, isCut, sheetsData } = this.state;
        if (!clipboard || selectedCells.length === 0) return;

        const startRow = selectedCells[0].row, startCol = selectedCells[0].col;
        const changes = [];

        const requiredRows = startRow + clipboard.length;
        const requiredCols = startCol + (clipboard[0]?.length || 0);

        this.ensureGridSize(requiredRows, requiredCols);

        // Undo用に貼り付け先の変更前の状態を保存
        const affectedCells = [];
        clipboard.forEach((rowData, ri) => {
            rowData.forEach((_, ci) => {
                affectedCells.push({ row: startRow + ri, col: startCol + ci });
            });
        });
        if (isCut && clipboardStartCell) {
            clipboard.forEach((rowData, ri) => {
                rowData.forEach((_, ci) => {
                    const sr = clipboardStartCell.row + ri, sc = clipboardStartCell.col + ci;
                    const overlap = sr >= startRow && sr < startRow + clipboard.length && sc >= startCol && sc < startCol + rowData.length;
                    if (!overlap) {
                        affectedCells.push({ row: sr, col: sc });
                    }
                });
            });
        }
        this.saveToUndoStack(affectedCells);

        clipboard.forEach((rowData, ri) => {
            rowData.forEach((cellData, ci) => {
                const tr = startRow + ri, tc = startCol + ci;
                const cell = this.getCell(tr, tc);
                if (cell) {
                    cell.querySelector('.cell-content').textContent = cellData.value;
                    cell.querySelector('.cell-input').value = cellData.value;
                    if (cellData.style) this.applyCellStyle(cell, cellData.style);

                    const data = this.ensureCellData(tr, tc);
                    data.value = cellData.value;
                    data.style = { ...cellData.style };
                    changes.push({ row: tr, col: tc, value: cellData.value, style: cellData.style });
                }
            });
        });

        if (isCut && clipboardStartCell) {
            clipboard.forEach((rowData, ri) => {
                rowData.forEach((_, ci) => {
                    const sr = clipboardStartCell.row + ri, sc = clipboardStartCell.col + ci;
                    const overlap = sr >= startRow && sr < startRow + clipboard.length && sc >= startCol && sc < startCol + rowData.length;
                    if (!overlap) {
                        const cell = this.getCell(sr, sc);
                        if (cell) {
                            cell.querySelector('.cell-content').textContent = '';
                            cell.querySelector('.cell-input').value = '';
                            const d = sheetsData[this.currentSheet].cells[`${sr},${sc}`];
                            if (d) d.value = '';
                            changes.push({ row: sr, col: sc, value: '' });
                        }
                    }
                });
            });
            this.state.clipboard = null;
            this.state.isCut = false;
        }

        this.elements.spreadsheet.querySelectorAll('td.copied, td.cut').forEach(c => c.classList.remove('copied', 'cut'));
        this.sendChangesToServer(changes);
        this.showSaveIndicator('貼り付けました');
    }

    async pasteFromSystemClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            if (!text || this.state.selectedCells.length === 0) return;

            const startRow = this.state.selectedCells[0].row;
            const startCol = this.state.selectedCells[0].col;
            const rows = text.split('\n').filter(r => r.length > 0);
            const changes = [];

            const requiredRows = startRow + rows.length;
            const maxCols = Math.max(...rows.map(r => r.split('\t').length));
            const requiredCols = startCol + maxCols;

            this.ensureGridSize(requiredRows, requiredCols);

            // Undo用に変更前の状態を保存
            const affectedCells = [];
            rows.forEach((_, ri) => {
                rows[ri].split('\t').forEach((_, ci) => {
                    affectedCells.push({ row: startRow + ri, col: startCol + ci });
                });
            });
            this.saveToUndoStack(affectedCells);

            rows.forEach((row, ri) => {
                row.split('\t').forEach((value, ci) => {
                    const tr = startRow + ri, tc = startCol + ci;
                    const cell = this.getCell(tr, tc);
                    if (cell) {
                        cell.querySelector('.cell-content').textContent = value;
                        cell.querySelector('.cell-input').value = value;
                        this.ensureCellData(tr, tc).value = value;
                        changes.push({ row: tr, col: tc, value });
                    }
                });
            });

            this.sendChangesToServer(changes);
            this.showSaveIndicator('貼り付けました');
        } catch (e) {
            console.warn('クリップボード読み取りエラー:', e);
        }
    }

    highlightCopiedCells(bounds) {
        this.elements.spreadsheet.querySelectorAll('td.copied, td.cut').forEach(c => c.classList.remove('copied', 'cut'));
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                this.getCell(r, c)?.classList.add('copied');
            }
        }
    }

    copyToSystemClipboard(bounds) {
        const rows = [];
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            const cols = [];
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                const data = this.state.sheetsData[this.currentSheet].cells[`${r},${c}`];
                cols.push(data?.value || '');
            }
            rows.push(cols.join('\t'));
        }
        navigator.clipboard.writeText(rows.join('\n')).catch(e => console.warn('クリップボードコピー失敗:', e));
    }

    // ===== Fill操作 =====

    clearSelectedCells() {
        this.saveToUndoStack(this.state.selectedCells);

        const changes = this.state.selectedCells.map(({ row, col, cell }) => {
            cell.querySelector('.cell-content').textContent = '';
            cell.querySelector('.cell-input').value = '';
            const data = this.state.sheetsData[this.currentSheet].cells[`${row},${col}`];
            if (data) data.value = '';
            return { row, col, value: '' };
        });
        this.sendChangesToServer(changes);
    }

    /**
     * セルにソースの値・スタイルを適用し、changesに追加
     */
    _applyCellFill(row, col, sourceValue, sourceStyle, changes) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        cell.querySelector('.cell-content').textContent = sourceValue;
        cell.querySelector('.cell-input').value = sourceValue;
        if (sourceStyle) this.applyCellStyle(cell, sourceStyle);

        const data = this.ensureCellData(row, col);
        data.value = sourceValue;
        data.style = { ...sourceStyle };

        changes.push({ row, col, value: sourceValue, style: sourceStyle });
    }

    /**
     * 共通のフィル処理（down/right）
     * @param {'down'|'right'} direction
     */
    _fillCells(direction) {
        const cells = this.state.selectedCells;
        if (cells.length === 0) return;

        const bounds = this.getSelectionBounds();
        const changes = [];
        const isDown = direction === 'down';

        // 主軸: down→row, right→col
        const minPrimary = isDown ? bounds.minRow : bounds.minCol;
        const maxPrimary = isDown ? bounds.maxRow : bounds.maxCol;
        const minSecondary = isDown ? bounds.minCol : bounds.minRow;
        const maxSecondary = isDown ? bounds.maxCol : bounds.maxRow;

        // 単一行/列の場合、直前の行/列からコピー
        if (minPrimary === maxPrimary) {
            if (minPrimary === 0) {
                this.showSaveIndicator(isDown ? 'コピー元の行がありません' : 'コピー元の列がありません');
                return;
            }

            this.saveToUndoStack(cells);

            for (let s = minSecondary; s <= maxSecondary; s++) {
                const srcKey = isDown ? `${minPrimary - 1},${s}` : `${s},${minPrimary - 1}`;
                const srcData = this.state.sheetsData[this.currentSheet].cells[srcKey];
                const val = srcData?.value || '';
                const sty = srcData?.style ? JSON.parse(JSON.stringify(srcData.style)) : {};

                const [r, c] = isDown ? [minPrimary, s] : [s, minPrimary];
                this._applyCellFill(r, c, val, sty, changes);
            }
        } else {
            this.saveToUndoStack(cells);

            for (let s = minSecondary; s <= maxSecondary; s++) {
                const srcKey = isDown ? `${minPrimary},${s}` : `${s},${minPrimary}`;
                const srcData = this.state.sheetsData[this.currentSheet].cells[srcKey];
                const val = srcData?.value || '';
                const sty = srcData?.style ? JSON.parse(JSON.stringify(srcData.style)) : {};

                for (let p = minPrimary + 1; p <= maxPrimary; p++) {
                    const [r, c] = isDown ? [p, s] : [s, p];
                    this._applyCellFill(r, c, val, sty, changes);
                }
            }
        }

        this.sendChangesToServer(changes);
        this.showSaveIndicator(isDown ? '上からコピーしました' : '左からコピーしました');
    }

    fillDown() {
        this._fillCells('down');
    }

    fillRight() {
        this._fillCells('right');
    }
};
