/**
 * DKCドライブ - キーボード操作
 * Excelライクなショートカット実装
 */

import { isSpreadsheetType, SPREADSHEET } from './constants.js';

/**
 * キーボード操作のミックスイン
 * @param {DKCDrive} Base - 基底クラス
 */
export const KeyboardMixin = (Base) => class extends Base {

    initKeyboard() {
        document.addEventListener('keydown', e => this.handleKeydown(e));
    }

    handleKeydown(e) {
        // スプレッドシート以外のファイルを開いている時、上下キーで前後のファイルを開く
        if (!isSpreadsheetType(this.state.currentFileType)) {
            if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && this.state.currentFilePath) {
                const activeEl = document.activeElement;
                if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable) return;
                e.preventDefault();
                this.openAdjacentFile(e.key === 'ArrowDown' ? 1 : -1);
            }
            return;
        }

        const activeElement = document.activeElement;
        const isEditingCell = activeElement.classList.contains('cell-input');
        const isEditingFormulaBar = activeElement.id === 'formula-input';
        const isSearchInput = activeElement.id === 'search-input' || activeElement.id === 'replace-input' || activeElement.closest('.filter-dropdown');
        const isModalInput = activeElement.closest('.modal');
        const isEditing = isEditingCell || isEditingFormulaBar;
        const cells = this.state.selectedCells;
        const isCtrl = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;

        // Escapeキーで検索パネルを閉じる
        if (e.key === 'Escape') {
            const searchPanel = document.getElementById('search-replace-panel');
            if (searchPanel && searchPanel.style.display !== 'none') {
                this.closeSearchPanel?.();
                e.preventDefault();
                return;
            }
        }

        // モーダル表示中はスプレッドシートのショートカットを無効化
        if (isModalInput) return;

        // Ctrl+F/H は常に有効（検索パネル操作）
        if (isCtrl && (e.key === 'f' || e.key === 'h')) {
            e.preventDefault();
            this.openSearchPanel?.(e.key === 'f' ? 'search' : 'replace');
            return;
        }

        // Ctrl + キー（編集中でない場合）
        if (isCtrl && !isEditing && !isSearchInput) {
            // Ctrl+Shift+Z: Redo
            if ((e.key === 'z' || e.key === 'Z') && isShift) {
                e.preventDefault();
                this.redo();
                return;
            }

            // Ctrl+Shift+R: ブラウザの強制リロードを許可（デフォルト動作を妨げない）
            if ((e.key === 'r' || e.key === 'R') && isShift) {
                return;
            }

            const shortcuts = {
                s: () => this.saveChangesManually(),
                c: () => this.copySelection(),
                x: () => this.cutSelection(),
                v: () => this.state.clipboard ? this.pasteFromClipboard() : this.pasteFromSystemClipboard(),
                a: () => this.selectAll(),
                z: () => this.undo(),
                d: () => this.fillDown(),
                r: () => this.fillRight()
            };
            if (shortcuts[e.key]) { e.preventDefault(); shortcuts[e.key](); return; }

            // Ctrl + Home: A1セルへ移動
            if (e.key === 'Home') {
                e.preventDefault();
                if (isShift) {
                    this.extendSelectionTo(0, 0);
                } else {
                    this.selectCell(0, 0);
                }
                this.scrollToCell(0, 0);
                return;
            }

            // Ctrl + End: データの最後のセルへ移動
            if (e.key === 'End') {
                e.preventDefault();
                const { maxRow, maxCol } = this.getDataBounds();
                if (isShift) {
                    this.extendSelectionTo(maxRow, maxCol);
                } else {
                    this.selectCell(maxRow, maxCol);
                }
                this.scrollToCell(maxRow, maxCol);
                return;
            }
        }

        if (cells.length === 0 || isEditing || isSearchInput || isModalInput) return;

        const activeCell = this.getActiveCell();
        const { row, col } = activeCell;

        const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

        if (moves[e.key]) {
            e.preventDefault();
            const [dr, dc] = moves[e.key];

            if (isCtrl && isShift) {
                // Ctrl + Shift + 矢印: データの端まで選択範囲を拡張
                const targetPos = this.findDataEdge(row, col, dr, dc);
                this.extendSelectionTo(targetPos.row, targetPos.col);
                this.scrollToCell(targetPos.row, targetPos.col);
            } else if (isCtrl) {
                // Ctrl + 矢印: データの端までジャンプ
                const targetPos = this.findDataEdge(row, col, dr, dc);
                this.checkAndExpandGrid(targetPos.row, targetPos.col);
                this.selectCell(targetPos.row, targetPos.col);
                this.scrollToCell(targetPos.row, targetPos.col);
            } else if (isShift) {
                // Shift + 矢印: 選択範囲を1セル拡張
                const newRow = Math.max(0, row + dr);
                const newCol = Math.max(0, col + dc);
                this.checkAndExpandGrid(newRow, newCol);
                this.extendSelectionTo(newRow, newCol);
                this.scrollToCell(newRow, newCol);
            } else {
                // 通常の矢印: 1セル移動
                const newRow = Math.max(0, row + dr);
                const newCol = Math.max(0, col + dc);
                this.checkAndExpandGrid(newRow, newCol);
                this.selectCell(newRow, newCol);
                this.scrollToCell(newRow, newCol);
            }
        } else if (e.key === 'Home') {
            e.preventDefault();
            if (isShift) {
                this.extendSelectionTo(row, 0);
            } else {
                this.selectCell(row, 0);
            }
            this.scrollToCell(row, 0);
        } else if (e.key === 'End') {
            e.preventDefault();
            const { maxCol } = this.getDataBoundsForRow(row);
            if (isShift) {
                this.extendSelectionTo(row, maxCol);
            } else {
                this.selectCell(row, maxCol);
            }
            this.scrollToCell(row, maxCol);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            // 下のセルに移動
            const newRow = row + 1;
            this.checkAndExpandGrid(newRow, col);
            this.selectCell(newRow, col);
            this.scrollToCell(newRow, col);
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this.clearSelectedCells();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const newCol = isShift ? Math.max(0, col - 1) : col + 1;
            this.checkAndExpandGrid(row, newCol);
            this.selectCell(row, newCol);
            this.scrollToCell(row, newCol);
        } else if (e.key === 'F2') {
            // F2: 編集モードに入る（セル内容を維持して編集）
            e.preventDefault();
            this.startEditing(cells[0].cell);
        } else if (e.key.length === 1 && !isCtrl) {
            cells[0].cell.querySelector('.cell-input').value = '';
            this.startEditing(cells[0].cell);
        }
    }

    // 現在のアクティブセル（選択範囲の移動端）を取得
    getActiveCell() {
        const cells = this.state.selectedCells;
        if (cells.length === 0) return { row: 0, col: 0 };
        if (cells.length === 1) return cells[0];

        const start = this.state.selectionStart;
        const bounds = this.getSelectionBounds();
        if (!start || !bounds) return cells[0];

        return {
            row: start.row === bounds.minRow ? bounds.maxRow : bounds.minRow,
            col: start.col === bounds.minCol ? bounds.maxCol : bounds.minCol
        };
    }

    // 選択範囲を指定位置まで拡張
    extendSelectionTo(targetRow, targetCol) {
        const anchor = this.state.selectionStart;
        if (!anchor) {
            this.selectCell(targetRow, targetCol);
            return;
        }
        this.checkAndExpandGrid(targetRow, targetCol);
        this.selectRange(anchor, { row: targetRow, col: targetCol });
    }

    // 全セル選択（Ctrl+A）
    selectAll() {
        const { maxRow, maxCol } = this.getDataBounds();
        this.state.selectionStart = { row: 0, col: 0 };
        this.selectRange({ row: 0, col: 0 }, { row: maxRow, col: maxCol });
    }

    // データが存在する範囲を取得
    getDataBounds() {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet?.cells) return { maxRow: 0, maxCol: 0 };

        let maxRow = 0, maxCol = 0;
        Object.keys(sheet.cells).forEach(key => {
            const cellData = sheet.cells[key];
            if (cellData?.value) {
                const [r, c] = key.split(',').map(Number);
                maxRow = Math.max(maxRow, r);
                maxCol = Math.max(maxCol, c);
            }
        });
        return { maxRow, maxCol };
    }

    // 特定行のデータ範囲を取得
    getDataBoundsForRow(row) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet?.cells) return { maxCol: 0 };

        let maxCol = 0;
        Object.keys(sheet.cells).forEach(key => {
            const [r, c] = key.split(',').map(Number);
            if (r === row && sheet.cells[key]?.value) {
                maxCol = Math.max(maxCol, c);
            }
        });
        return { maxCol };
    }

    // Ctrl+矢印用: データの端を見つける（Excelと同じ挙動）
    findDataEdge(startRow, startCol, dr, dc) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return { row: startRow, col: startCol };

        const getCellValue = (r, c) => sheet.cells?.[`${r},${c}`]?.value || '';
        const maxRow = (sheet.displayRows || SPREADSHEET.DEFAULT_ROWS) - 1;
        const maxCol = (sheet.displayCols || SPREADSHEET.DEFAULT_COLS) - 1;

        let row = startRow, col = startCol;
        const currentValue = getCellValue(row, col);

        if (!currentValue) {
            // 空セルから開始: 次のデータセルを探す
            while (true) {
                const nextRow = row + dr;
                const nextCol = col + dc;

                if (nextRow < 0 || nextCol < 0) break;
                if (dr !== 0 && nextRow > maxRow) { row = maxRow; break; }
                if (dc !== 0 && nextCol > maxCol) { col = maxCol; break; }

                row = nextRow;
                col = nextCol;

                if (getCellValue(row, col)) break;
            }
        } else {
            const nextRow = row + dr;
            const nextCol = col + dc;
            const nextValue = getCellValue(nextRow, nextCol);

            if (!nextValue) {
                // 隣が空: 次のデータセルを探す
                row = nextRow;
                col = nextCol;
                while (true) {
                    const nr = row + dr;
                    const nc = col + dc;

                    if (nr < 0 || nc < 0) break;
                    if (dr !== 0 && nr > maxRow) { row = maxRow; break; }
                    if (dc !== 0 && nc > maxCol) { col = maxCol; break; }

                    row = nr;
                    col = nc;

                    if (getCellValue(row, col)) break;
                }
            } else {
                // 隣にデータあり: 連続するデータの端を探す
                while (true) {
                    const nr = row + dr;
                    const nc = col + dc;

                    if (nr < 0 || nc < 0) break;
                    if (dr !== 0 && nr > maxRow) { row = maxRow; break; }
                    if (dc !== 0 && nc > maxCol) { col = maxCol; break; }

                    if (!getCellValue(nr, nc)) break;

                    row = nr;
                    col = nc;
                }
            }
        }

        return { row: Math.max(0, row), col: Math.max(0, col) };
    }

    // 上下キーで隣接するファイルを開く（direction: 1=次, -1=前）
    openAdjacentFile(direction) {
        const fileItems = Array.from(document.querySelectorAll('.file-item[data-type="file"]'));
        if (fileItems.length === 0) return;

        const currentIndex = fileItems.findIndex(el => el.dataset.path === this.state.currentFilePath);
        const nextIndex = currentIndex + direction;

        if (nextIndex < 0 || nextIndex >= fileItems.length) return;

        const nextItem = fileItems[nextIndex];
        const path = nextItem.dataset.path;
        const name = nextItem.dataset.name;
        const fileType = nextItem.dataset.fileType || null;

        this.openFile(path, name, fileType);
        nextItem.scrollIntoView({ block: 'nearest' });
    }

    // 指定セルが表示されるようにスクロール
    scrollToCell(row, col) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        const container = this.elements.spreadsheetContainer;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();

        if (cellRect.top < containerRect.top + 24) {
            container.scrollTop -= (containerRect.top + 24 - cellRect.top);
        }
        if (cellRect.bottom > containerRect.bottom) {
            container.scrollTop += (cellRect.bottom - containerRect.bottom);
        }
        if (cellRect.left < containerRect.left + 40) {
            container.scrollLeft -= (containerRect.left + 40 - cellRect.left);
        }
        if (cellRect.right > containerRect.right) {
            container.scrollLeft += (cellRect.right - containerRect.right);
        }
    }
};
