/**
 * DKCドライブ - セル結合モジュール
 * マージ/アンマージ、レンダリング、選択との連携
 */

import { API } from './constants.js';

export const MergeMixin = (Base) => class extends Base {

    // ============================================================
    // マージルックアップマップ（O(1)検索）
    // ============================================================

    buildMergeLookup(sheetName) {
        const sheet = this.state.sheetsData[sheetName || this.currentSheet];
        if (!sheet) return;

        const map = {};
        const merges = sheet.merges || [];
        for (const m of merges) {
            for (let r = m.startRow; r <= m.endRow; r++) {
                for (let c = m.startCol; c <= m.endCol; c++) {
                    map[`${r},${c}`] = m;
                }
            }
        }
        sheet._mergeMap = map;
    }

    getMergeForCell(row, col) {
        const sheet = this.state.sheetsData[this.currentSheet];
        return sheet?._mergeMap?.[`${row},${col}`];
    }

    isMergeOrigin(row, col) {
        const m = this.getMergeForCell(row, col);
        return m && m.startRow === row && m.startCol === col;
    }

    isMergedSlave(row, col) {
        const m = this.getMergeForCell(row, col);
        return m && !(m.startRow === row && m.startCol === col);
    }

    // ============================================================
    // DOM描画
    // ============================================================

    applyMergesToDOM() {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet?.merges) return;
        for (const m of sheet.merges) {
            this._applyMergeToDOM(m);
        }
    }

    _applyMergeToDOM(m) {
        const origin = this.getCell(m.startRow, m.startCol);
        if (!origin) return;

        origin.colSpan = m.endCol - m.startCol + 1;
        origin.rowSpan = m.endRow - m.startRow + 1;
        origin.classList.add('merged-origin');

        for (let r = m.startRow; r <= m.endRow; r++) {
            for (let c = m.startCol; c <= m.endCol; c++) {
                if (r === m.startRow && c === m.startCol) continue;
                const cell = this.getCell(r, c);
                if (cell) {
                    cell.style.display = 'none';
                    cell.classList.add('merged-hidden');
                }
            }
        }
    }

    _removeMergeFromDOM(m) {
        const origin = this.getCell(m.startRow, m.startCol);
        if (origin) {
            origin.colSpan = 1;
            origin.rowSpan = 1;
            origin.classList.remove('merged-origin');
        }

        for (let r = m.startRow; r <= m.endRow; r++) {
            for (let c = m.startCol; c <= m.endCol; c++) {
                if (r === m.startRow && c === m.startCol) continue;
                const cell = this.getCell(r, c);
                if (cell) {
                    cell.style.display = '';
                    cell.classList.remove('merged-hidden');
                }
            }
        }
    }

    // ============================================================
    // ユーザー操作
    // ============================================================

    mergeCells() {
        const bounds = this.getSelectionBounds();
        if (!bounds) return;

        const { minRow, maxRow, minCol, maxCol } = bounds;

        if (minRow === maxRow && minCol === maxCol) {
            this.showSaveIndicator('2つ以上のセルを選択してください');
            return;
        }

        const newMerge = {
            startRow: minRow, startCol: minCol,
            endRow: maxRow, endCol: maxCol
        };

        const sheet = this.state.sheetsData[this.currentSheet];
        for (const existing of (sheet.merges || [])) {
            if (this._mergesOverlap(newMerge, existing)) {
                this.showSaveIndicator('既存の結合セルと重複しています');
                return;
            }
        }

        // Undo用: slaveセルの値を保存
        const clearedCells = [];
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                if (r === minRow && c === minCol) continue;
                const data = sheet.cells[`${r},${c}`];
                clearedCells.push({
                    row: r, col: c,
                    value: data?.value || '',
                    style: data?.style ? JSON.parse(JSON.stringify(data.style)) : {}
                });
            }
        }

        this.undoStack.push({
            sheetName: this.currentSheet,
            type: 'merge',
            action: 'merge',
            merges: [newMerge],
            clearedCells
        });
        this.redoStack = [];

        this._doMerge(newMerge);
        this._sendMergeToServer([newMerge], 'merge');
        this.showSaveIndicator('セルを結合しました');
    }

    unmergeCells() {
        const cells = this.state.selectedCells;
        if (cells.length === 0) return;

        const sheet = this.state.sheetsData[this.currentSheet];
        const toRemove = [];
        const seen = new Set();

        for (const { row, col } of cells) {
            const m = this.getMergeForCell(row, col);
            if (m) {
                const key = `${m.startRow},${m.startCol}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    toRemove.push(m);
                }
            }
        }

        if (toRemove.length === 0) {
            this.showSaveIndicator('結合セルがありません');
            return;
        }

        this.undoStack.push({
            sheetName: this.currentSheet,
            type: 'merge',
            action: 'unmerge',
            merges: toRemove.map(m => ({ ...m })),
            clearedCells: []
        });
        this.redoStack = [];

        for (const m of toRemove) {
            this._doUnmerge(m);
        }

        this._sendMergeToServer(toRemove, 'unmerge');
        this.showSaveIndicator('セル結合を解除しました');
    }

    // ============================================================
    // 内部ロジック
    // ============================================================

    _doMerge(merge) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet.merges) sheet.merges = [];
        sheet.merges.push(merge);

        // slaveセルの値をクリア
        const changes = [];
        for (let r = merge.startRow; r <= merge.endRow; r++) {
            for (let c = merge.startCol; c <= merge.endCol; c++) {
                if (r === merge.startRow && c === merge.startCol) continue;
                const key = `${r},${c}`;
                if (sheet.cells[key]) {
                    sheet.cells[key].value = '';
                }
                const cell = this.getCell(r, c);
                if (cell) {
                    const content = cell.querySelector('.cell-content');
                    const input = cell.querySelector('.cell-input');
                    if (content) content.textContent = '';
                    if (input) input.value = '';
                }
                changes.push({ row: r, col: c, value: '' });
            }
        }

        if (changes.length > 0) {
            this.sendChangesToServer(changes);
        }

        this.buildMergeLookup();
        this._applyMergeToDOM(merge);
    }

    _doUnmerge(merge) {
        const sheet = this.state.sheetsData[this.currentSheet];
        sheet.merges = (sheet.merges || []).filter(m =>
            !(m.startRow === merge.startRow && m.startCol === merge.startCol &&
              m.endRow === merge.endRow && m.endCol === merge.endCol)
        );

        this._removeMergeFromDOM(merge);
        this.buildMergeLookup();
    }

    // ============================================================
    // サーバー通信
    // ============================================================

    _sendMergeToServer(merges, action) {
        if (this.ws.socket?.readyState === WebSocket.OPEN) {
            this.sendWebSocketMessage({
                type: action === 'merge' ? 'merge_cells' : 'unmerge_cells',
                sheetName: this.currentSheet,
                merges
            });
        } else {
            const url = action === 'merge' ? API.MERGE_CELLS : API.UNMERGE_CELLS;
            this.apiCall(url, {
                method: 'POST',
                body: {
                    path: this.state.currentFilePath,
                    sheetName: this.currentSheet,
                    merges
                }
            }).catch(e => console.error('マージ保存エラー:', e));
        }
    }

    // ============================================================
    // リモート同期（WebSocket受信）
    // ============================================================

    applyRemoteMergeUpdate(sheetName, merges, action) {
        if (sheetName !== this.currentSheet) {
            const sheet = this.state.sheetsData[sheetName];
            if (!sheet) return;
            if (action === 'merge') {
                if (!sheet.merges) sheet.merges = [];
                sheet.merges.push(...merges);
            } else {
                sheet.merges = (sheet.merges || []).filter(m =>
                    !merges.some(rm =>
                        rm.startRow === m.startRow && rm.startCol === m.startCol &&
                        rm.endRow === m.endRow && rm.endCol === m.endCol
                    )
                );
            }
            return;
        }

        for (const m of merges) {
            if (action === 'merge') {
                this._doMerge(m);
            } else {
                this._doUnmerge(m);
            }
        }
    }

    // ============================================================
    // ユーティリティ
    // ============================================================

    _mergesOverlap(a, b) {
        return !(a.endRow < b.startRow || a.startRow > b.endRow ||
                 a.endCol < b.startCol || a.startCol > b.endCol);
    }

    resolveToMergeOrigin(row, col) {
        const m = this.getMergeForCell(row, col);
        if (m) return { row: m.startRow, col: m.startCol };
        return { row, col };
    }
};
