/**
 * DKCドライブ - 検索・置換モジュール
 * Ctrl+F で検索、Ctrl+H で置換
 */

/**
 * 検索・置換のミックスイン
 */
export const SearchMixin = (Base) => class extends Base {

    initSearch() {
        this.state.search = {
            results: [],
            currentIndex: -1,
            query: '',
            caseSensitive: false,
            wholeCell: false
        };

        this._setupSearchEvents();
    }

    _setupSearchEvents() {
        const panel = document.getElementById('search-replace-panel');
        if (!panel) return;

        // タブ切り替え
        panel.querySelectorAll('.search-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this._switchSearchTab(tab.dataset.tab);
            });
        });

        // 閉じるボタン
        document.getElementById('search-replace-close')?.addEventListener('click', () => {
            this.closeSearchPanel();
        });

        // 検索入力
        const searchInput = document.getElementById('search-input');
        searchInput?.addEventListener('input', () => {
            this._performSearch();
        });

        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.findPrevious();
                } else {
                    this.findNext();
                }
            } else if (e.key === 'Escape') {
                this.closeSearchPanel();
            }
        });

        // 置換入力でのEnterキー
        document.getElementById('replace-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.replaceOne();
            } else if (e.key === 'Escape') {
                this.closeSearchPanel();
            }
        });

        // ナビゲーションボタン
        document.getElementById('search-prev')?.addEventListener('click', () => {
            this.findPrevious();
        });

        document.getElementById('search-next')?.addEventListener('click', () => {
            this.findNext();
        });

        // 置換ボタン
        document.getElementById('replace-one')?.addEventListener('click', () => {
            this.replaceOne();
        });

        document.getElementById('replace-all')?.addEventListener('click', () => {
            this.replaceAll();
        });

        // オプション
        document.getElementById('search-case-sensitive')?.addEventListener('change', (e) => {
            this.state.search.caseSensitive = e.target.checked;
            this._performSearch();
        });

        document.getElementById('search-whole-cell')?.addEventListener('change', (e) => {
            this.state.search.wholeCell = e.target.checked;
            this._performSearch();
        });
    }

    openSearchPanel(mode = 'search') {
        const panel = document.getElementById('search-replace-panel');
        if (!panel) return;

        panel.style.display = 'block';
        this._switchSearchTab(mode);

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }

        // 選択中のセルの値を検索欄に入れる
        const selectedCells = this.state.selectedCells;
        if (selectedCells?.length === 1) {
            const cell = selectedCells[0].cell;
            const content = cell?.querySelector('.cell-content')?.textContent || '';
            if (content && searchInput) {
                searchInput.value = content;
                this._performSearch();
            }
        }
    }

    closeSearchPanel() {
        const panel = document.getElementById('search-replace-panel');
        if (panel) {
            panel.style.display = 'none';
        }
        this._clearSearchHighlights();
        this.state.search.results = [];
        this.state.search.currentIndex = -1;
        this._updateSearchCount();
    }

    _switchSearchTab(tab) {
        const tabs = document.querySelectorAll('.search-tab');
        const replaceRow = document.getElementById('replace-row');

        tabs.forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });

        if (replaceRow) {
            replaceRow.style.display = tab === 'replace' ? 'flex' : 'none';
        }
    }

    /**
     * 指定行がフィルターで非表示かをデータレベルで判定
     */
    _isRowFilteredOut(row) {
        const fs = this.state.filterState;
        if (!fs?.enabled || !fs.filters) return false;

        const filterKeys = Object.keys(fs.filters);
        if (filterKeys.length === 0) return false;

        // ヘッダー行はフィルター対象外
        if (row <= fs.headerRow) return false;

        const sheet = this.state.sheetsData[this.currentSheet];
        for (const colStr of filterKeys) {
            const col = parseInt(colStr);
            const key = `${row},${col}`;
            const cellValue = String(sheet?.cells?.[key]?.value ?? '');
            if (!fs.filters[col].has(cellValue)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 対象行・列までDOMを拡張し、フィルターを再適用する
     */
    _ensureCellRendered(row, col) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        let expanded = false;
        if (row >= sheet.displayRows) {
            const needed = row - sheet.displayRows + 1;
            this.addRowsToTable(sheet.displayRows, needed);
            expanded = true;
        }
        if (col >= sheet.displayCols) {
            const needed = col - sheet.displayCols + 1;
            this.addColsToTable(sheet.displayCols, needed);
            expanded = true;
        }
        // DOM拡張した場合、フィルター状態を新しい行にも適用
        if (expanded && this.state.filterState?.enabled) {
            this.applyAllFilters();
        }
    }

    _performSearch() {
        const query = document.getElementById('search-input')?.value || '';
        this.state.search.query = query;

        this._clearSearchHighlights();
        this.state.search.results = [];
        this.state.search.currentIndex = -1;

        if (!query) {
            this._updateSearchCount();
            return;
        }

        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet?.cells) {
            this._updateSearchCount();
            return;
        }

        const { caseSensitive, wholeCell } = this.state.search;
        const searchQuery = caseSensitive ? query : query.toLowerCase();

        // 全セルを検索（表示値を対象にする）
        const results = [];
        for (const key in sheet.cells) {
            const cellData = sheet.cells[key];
            if (!cellData?.value) continue;

            const [row, col] = key.split(',').map(Number);

            // フィルターで非表示の行はスキップ
            if (this._isRowFilteredOut(row)) continue;

            // 表示値（計算結果）を取得して検索対象にする
            const rawValue = String(cellData.value);
            const displayValue = this.calculateDisplayValue(rawValue, sheet.cells);

            // エラー表示（#ERROR!, #VALUE!など）はスキップ
            if (displayValue.startsWith('#')) continue;

            const compareValue = caseSensitive ? displayValue : displayValue.toLowerCase();

            let matches = false;
            if (wholeCell) {
                matches = compareValue === searchQuery;
            } else {
                matches = compareValue.includes(searchQuery);
            }

            if (matches) {
                results.push({ row, col, key });
            }
        }

        // 行・列順でソート
        results.sort((a, b) => {
            if (a.row !== b.row) return a.row - b.row;
            return a.col - b.col;
        });

        this.state.search.results = results;

        // ハイライト表示（DOM上に存在するセルのみ）
        results.forEach(result => {
            const cell = this.getCell(result.row, result.col);
            if (cell) {
                cell.classList.add('search-highlight');
            }
        });

        // 最初の結果を選択
        if (results.length > 0) {
            this.state.search.currentIndex = 0;
            this._highlightCurrentResult();
        }

        this._updateSearchCount();
    }

    findNext() {
        const { results, currentIndex } = this.state.search;
        if (results.length === 0) return;

        const newIndex = (currentIndex + 1) % results.length;
        this.state.search.currentIndex = newIndex;
        this._highlightCurrentResult();
        this._updateSearchCount();
    }

    findPrevious() {
        const { results, currentIndex } = this.state.search;
        if (results.length === 0) return;

        const newIndex = currentIndex <= 0 ? results.length - 1 : currentIndex - 1;
        this.state.search.currentIndex = newIndex;
        this._highlightCurrentResult();
        this._updateSearchCount();
    }

    _highlightCurrentResult() {
        const { results, currentIndex } = this.state.search;
        if (currentIndex < 0 || currentIndex >= results.length) return;

        // 以前のカレントハイライトを削除
        document.querySelectorAll('.search-highlight-current').forEach(el => {
            el.classList.remove('search-highlight-current');
        });

        const current = results[currentIndex];

        // 対象セルがDOMに無い場合、行・列を拡張する
        this._ensureCellRendered(current.row, current.col);

        // DOM拡張後、既存の検索結果ハイライトを再適用
        results.forEach(result => {
            const c = this.getCell(result.row, result.col);
            if (c) c.classList.add('search-highlight');
        });

        const cell = this.getCell(current.row, current.col);
        if (cell) {
            cell.classList.add('search-highlight-current');
            this.selectCell(current.row, current.col);
            this.scrollToCell(current.row, current.col);
        }
    }

    _clearSearchHighlights() {
        document.querySelectorAll('.search-highlight, .search-highlight-current').forEach(el => {
            el.classList.remove('search-highlight', 'search-highlight-current');
        });
    }

    _updateSearchCount() {
        const countEl = document.getElementById('search-count');
        if (!countEl) return;

        const { results, currentIndex } = this.state.search;
        if (results.length === 0) {
            countEl.textContent = this.state.search.query ? '0 件' : '';
        } else {
            countEl.textContent = `${currentIndex + 1} / ${results.length} 件`;
        }
    }

    replaceOne() {
        const { results, currentIndex } = this.state.search;
        if (results.length === 0 || currentIndex < 0) return;

        const replaceValue = document.getElementById('replace-input')?.value || '';
        const current = results[currentIndex];

        this._replaceCellValue(current.row, current.col, replaceValue);

        // 検索結果を更新
        this._performSearch();

        // 次の結果へ移動
        if (this.state.search.results.length > 0) {
            // currentIndexが範囲外になっていないか確認
            if (this.state.search.currentIndex >= this.state.search.results.length) {
                this.state.search.currentIndex = 0;
            }
            this._highlightCurrentResult();
        }
    }

    replaceAll() {
        const { results, query } = this.state.search;
        if (results.length === 0) return;

        const replaceValue = document.getElementById('replace-input')?.value || '';
        const count = results.length;

        // Undo用に保存
        this.saveToUndoStack(results.map(r => ({ row: r.row, col: r.col })));

        // 全置換
        const changes = [];
        results.forEach(result => {
            const newValue = this._getReplacedValue(result.row, result.col, query, replaceValue);
            if (newValue !== null) {
                this.ensureCellData(result.row, result.col).value = newValue;

                const cell = this.getCell(result.row, result.col);
                if (cell) {
                    cell.dataset.formula = newValue;
                    const content = cell.querySelector('.cell-content');
                    if (content) {
                        const sheet = this.state.sheetsData[this.currentSheet];
                        content.textContent = this.calculateDisplayValue(newValue, sheet?.cells || {});
                    }
                }

                changes.push({ row: result.row, col: result.col, value: newValue });
            }
        });

        if (changes.length > 0) {
            this.sendChangesToServer(changes);
            this.recalculateAllFormulas();
        }

        // 検索結果をクリア
        this._clearSearchHighlights();
        this.state.search.results = [];
        this.state.search.currentIndex = -1;
        this._updateSearchCount();

        // 通知
        this.showToast?.(`${count} 件を置換しました`);
    }

    _replaceCellValue(row, col, replaceValue) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet?.cells) return;

        const { query, caseSensitive, wholeCell } = this.state.search;
        const newValue = this._getReplacedValue(row, col, query, replaceValue);

        if (newValue === null) return;

        // Undo用に保存
        this.saveToUndoStack([{ row, col }]);

        this.ensureCellData(row, col).value = newValue;

        const cell = this.getCell(row, col);
        if (cell) {
            cell.dataset.formula = newValue;
            const content = cell.querySelector('.cell-content');
            if (content) {
                content.textContent = this.calculateDisplayValue(newValue, sheet.cells);
            }
        }

        this.sendChangesToServer([{ row, col, value: newValue }]);
        this.recalculateAllFormulas();
    }

    _getReplacedValue(row, col, query, replaceValue) {
        const sheet = this.state.sheetsData[this.currentSheet];
        const key = `${row},${col}`;
        const cellData = sheet?.cells?.[key];
        if (!cellData?.value) return null;

        const { caseSensitive, wholeCell } = this.state.search;
        let cellValue = String(cellData.value);

        if (wholeCell) {
            return replaceValue;
        } else {
            if (caseSensitive) {
                return cellValue.split(query).join(replaceValue);
            } else {
                // 大文字小文字を無視して置換
                const regex = new RegExp(this._escapeRegex(query), 'gi');
                return cellValue.replace(regex, replaceValue);
            }
        }
    }

    _escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
};
