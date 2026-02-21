/**
 * DKCドライブ - スプレッドシートモジュール
 * 描画、編集、数式計算のメインモジュール
 */

import { BORDER_STYLE, DEFAULT_BORDER, SPREADSHEET, API } from './constants.js';
import { evaluateFormula } from './functions/index.js';
import { SheetsMixin } from './spreadsheet-sheets.js';
import { SelectionMixin } from './spreadsheet-selection.js';
import { ResizeMixin } from './spreadsheet-resize.js';
import { EventsMixin } from './spreadsheet-events.js';
import { FormulaInputMixin } from './spreadsheet-formula-input.js';

/**
 * スプレッドシートのミックスイン（メイン）
 */
const SpreadsheetCoreMixin = (Base) => class extends Base {

    // ===== スプレッドシート描画 =====

    renderSpreadsheet() {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        // データの最大範囲を計算（サーバー提供値を優先、CSVはフォールバック）
        let dataMaxRow, dataMaxCol;
        if (sheet.maxRow != null && sheet.maxCol != null) {
            dataMaxRow = Math.max(sheet.maxRow, SPREADSHEET.DEFAULT_ROWS);
            dataMaxCol = Math.max(sheet.maxCol, SPREADSHEET.DEFAULT_COLS);
        } else {
            dataMaxRow = SPREADSHEET.DEFAULT_ROWS;
            dataMaxCol = SPREADSHEET.DEFAULT_COLS;
            for (const key in sheet.cells) {
                const [r, c] = key.split(',').map(Number);
                if (r >= dataMaxRow) dataMaxRow = r + 1;
                if (c >= dataMaxCol) dataMaxCol = c + 1;
            }
        }

        // データ範囲を保存（スクロール拡張で使用）
        sheet.dataMaxRow = dataMaxRow;
        sheet.dataMaxCol = dataMaxCol;

        // 初期レンダリングは表示可能な行数に制限（列は全て表示）
        const maxRow = Math.min(dataMaxRow, SPREADSHEET.INITIAL_RENDER_ROWS);
        const maxCol = dataMaxCol;
        sheet.displayRows = maxRow;
        sheet.displayCols = maxCol;

        // HTMLを生成
        const parts = ['<thead><tr><th class="corner" data-select-all></th>'];

        // 列ヘッダー
        const defaultW = sheet.colWidths?.default || SPREADSHEET.DEFAULT_COL_WIDTH;
        const defaultH = sheet.rowHeights?.default || SPREADSHEET.DEFAULT_ROW_HEIGHT;
        let totalWidth = SPREADSHEET.ROW_HEADER_WIDTH;
        for (let c = 0; c < maxCol; c++) {
            const w = sheet.colWidths?.[c] || sheet.colWidths?.[String(c)] || defaultW;
            totalWidth += w;
            parts.push(`<th class="col-header" data-col="${c}" style="width:${w}px">${this.getColumnName(c)}<div class="col-resize-handle" data-col="${c}"></div></th>`);
        }
        parts.push('</tr></thead><tbody>');

        // テーブル幅を明示的に設定（table-layout: fixedを正しく機能させる）
        this.elements.spreadsheet.style.width = `${totalWidth}px`;

        // セル
        const { cells, rowHeights } = sheet;
        for (let r = 0; r < maxRow; r++) {
            const h = rowHeights?.[r] || rowHeights?.[String(r)] || defaultH;
            parts.push(`<tr><th class="row-header" data-row="${r}" style="height:${h}px;min-height:${h}px">${r + 1}<div class="row-resize-handle" data-row="${r}"></div></th>`);

            for (let c = 0; c < maxCol; c++) {
                const cell = cells[`${r},${c}`];
                const w = sheet.colWidths?.[c] || sheet.colWidths?.[String(c)] || defaultW;

                const formulaAttr = cell?.value ? ` data-formula="${this.escapeHtml(cell.value)}"` : '';
                const cellStyle = this.buildCellStyle(cell?.style);
                parts.push(`<td data-row="${r}" data-col="${c}"${formulaAttr} style="width:${w}px;${cellStyle}">${this._buildCellInnerHtml(cell, cells)}</td>`);
            }
            parts.push('</tr>');
        }
        parts.push('</tbody>');

        this.elements.spreadsheet.innerHTML = parts.join('');
        this.setupCellEvents();
        this.applyAdjacentBordersOnLoad();
        this.buildMergeLookup?.();
        this.applyMergesToDOM?.();
        this.applyTextOverflow();
    }

    /**
     * セル内部のHTML（.cell-content + .cell-input）を生成
     */
    _buildCellInnerHtml(cellData, cells) {
        if (cellData && (cellData.value || cellData.style)) {
            const raw = cellData.value || '';
            const display = this.calculateDisplayValue(raw, cells);
            const contentStyle = this.buildContentStyle(cellData.style);
            return `<div class="cell-content" style="${contentStyle}">${this.escapeHtml(display)}</div><input type="text" class="cell-input" value="${this.escapeHtml(raw)}">`;
        }
        return '<div class="cell-content"></div><input type="text" class="cell-input" value="">';
    }

    // ===== 数式計算 =====

    calculateDisplayValue(rawValue, cells) {
        if (!rawValue || typeof rawValue !== 'string') return rawValue || '';

        if (rawValue.startsWith('=')) {
            try {
                const result = evaluateFormula(rawValue, cells);
                if (typeof result === 'number') {
                    return Number.isInteger(result) ? String(result) : parseFloat(result.toFixed(10)).toString();
                }
                return String(result);
            } catch (e) {
                console.error('数式計算エラー:', e);
                return '#ERROR!';
            }
        }
        return rawValue;
    }

    recalculateAllFormulas() {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        const { cells } = sheet;
        for (const key in cells) {
            const cell = cells[key];
            if (cell?.value && String(cell.value).startsWith('=')) {
                const [r, c] = key.split(',').map(Number);
                const domCell = this.getCell(r, c);
                if (domCell) {
                    const content = domCell.querySelector('.cell-content');
                    if (content) {
                        content.textContent = this.calculateDisplayValue(cell.value, cells);
                    }
                }
            }
        }
    }

    // ===== スタイル構築 =====

    buildCellStyle(style) {
        if (!style) return '';
        const css = [];
        if (style.backgroundColor) css.push(`background-color:${style.backgroundColor}`);
        if (style.border) {
            ['top', 'right', 'bottom', 'left'].forEach(side => {
                const b = style.border[side];
                if (b) {
                    const w = b.style === 'medium' ? '2px' : b.style === 'thick' ? '3px' : '1px';
                    css.push(`border-${side}:${w} solid ${b.color || '#000'}`);
                }
            });
        }
        return css.join(';');
    }

    buildContentStyle(style) {
        if (!style) return '';
        const css = [];
        if (style.color) css.push(`color:${style.color}`);
        if (style.fontWeight) css.push(`font-weight:${style.fontWeight}`);
        if (style.fontSize) css.push(`font-size:${style.fontSize}px`);
        if (style.textAlign) {
            const justify = { left: 'flex-start', center: 'center', right: 'flex-end' }[style.textAlign] || 'flex-start';
            css.push(`justify-content:${justify}`);
        }
        return css.join(';');
    }

    applyCellStyle(cell, style) {
        if (!cell || !style) return;
        if (style.backgroundColor) cell.style.backgroundColor = style.backgroundColor;
        const content = cell.querySelector('.cell-content');
        if (content) {
            if (style.color) content.style.color = style.color;
            if (style.fontWeight) content.style.fontWeight = style.fontWeight;
            if (style.fontSize) content.style.fontSize = style.fontSize + 'px';
            if (style.textAlign) {
                const map = { left: 'flex-start', center: 'center', right: 'flex-end' };
                content.style.justifyContent = map[style.textAlign] || 'flex-start';
            }
        }
        if (style.border) this.applyBorderToCell(cell, style.border);
    }

    applyBorderToCell(cell, border) {
        if (!cell) return;
        cell.style.borderTop = border?.top ? BORDER_STYLE : DEFAULT_BORDER;
        cell.style.borderRight = border?.right ? BORDER_STYLE : DEFAULT_BORDER;
        cell.style.borderBottom = border?.bottom ? BORDER_STYLE : DEFAULT_BORDER;
        cell.style.borderLeft = border?.left ? BORDER_STYLE : DEFAULT_BORDER;
    }

    applyAdjacentBordersOnLoad() {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        for (const key in sheet.cells) {
            const cell = sheet.cells[key];
            if (cell?.style?.border) {
                const [r, c] = key.split(',').map(Number);
                const domCell = this.getCell(r, c);
                this.applyBorderToCell(domCell, cell.style.border);
            }
        }
    }

    // ===== テキストオーバーフロー（Excel風はみ出し表示） =====

    /**
     * テキストオーバーフローを計算・適用する（Excel風はみ出し表示）
     * 右隣のセルが空白の場合、テキストをはみ出して表示する
     * @param {number} [startRow] - 開始行（省略時は全行）
     * @param {number} [endRow] - 終了行（省略時は全行）
     */
    applyTextOverflow(startRow, endRow) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        const tbody = this.elements.spreadsheet?.tBodies?.[0];
        if (!tbody) return;

        const { cells } = sheet;
        const maxCol = sheet.displayCols || SPREADSHEET.DEFAULT_COLS;
        const defaultW = sheet.colWidths?.default || SPREADSHEET.DEFAULT_COL_WIDTH;
        const from = startRow ?? 0;
        const to = endRow ?? (sheet.displayRows || SPREADSHEET.DEFAULT_ROWS) - 1;

        for (let r = from; r <= to; r++) {
            const tr = tbody.rows[r];
            if (!tr) continue;
            for (let c = 0; c < maxCol; c++) {
                const td = tr.cells[c + 1];
                if (td) this._applyCellOverflow(td, r, c, cells, maxCol, sheet, defaultW);
            }
        }
    }

    /**
     * 単一セルのテキストオーバーフローを計算・適用する
     */
    _applyCellOverflow(td, row, col, cells, maxCol, sheet, defaultW) {
        td.classList.remove('text-overflow');
        const content = td.querySelector('.cell-content');
        if (!content) return;
        content.style.maxWidth = '';

        const cellData = cells[`${row},${col}`];
        const value = cellData?.value;
        if (!value || String(value).startsWith('=') && content.textContent.startsWith('#')) return;

        const cellWidth = sheet.colWidths?.[col] || sheet.colWidths?.[String(col)] || defaultW;
        const padding = 8;
        const textWidth = this._measureTextWidth(content.textContent, content);
        if (textWidth <= cellWidth - padding) return;

        // 右隣の空白セル分の幅を加算
        let availableWidth = cellWidth;
        for (let nc = col + 1; nc < maxCol; nc++) {
            if (cells[`${row},${nc}`]?.value) break;
            availableWidth += sheet.colWidths?.[nc] || sheet.colWidths?.[String(nc)] || defaultW;
            if (availableWidth >= textWidth + padding) break;
        }

        if (availableWidth > cellWidth) {
            td.classList.add('text-overflow');
            content.style.maxWidth = `${availableWidth - padding}px`;
        }
    }

    /**
     * テキストの描画幅をCanvas APIで測定する
     */
    _measureTextWidth(text, element) {
        if (!this._measureCanvas) {
            this._measureCanvas = document.createElement('canvas');
        }
        const ctx = this._measureCanvas.getContext('2d');
        const style = getComputedStyle(element);
        ctx.font = `${style.fontWeight || 'normal'} ${style.fontSize || '13.6px'} ${style.fontFamily || 'sans-serif'}`;
        return ctx.measureText(text).width;
    }

    /**
     * 指定セルとその左側セルのオーバーフローを更新する
     */
    updateTextOverflowForRow(row, col) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        const { cells } = sheet;
        const maxCol = sheet.displayCols || SPREADSHEET.DEFAULT_COLS;
        const defaultW = sheet.colWidths?.default || SPREADSHEET.DEFAULT_COL_WIDTH;

        for (let c = 0; c <= Math.min(col, maxCol - 1); c++) {
            const td = this.getCell(row, c);
            if (td) this._applyCellOverflow(td, row, c, cells, maxCol, sheet, defaultW);
        }
    }

    // ===== 行・列追加 =====

    addRowsToTable(startRow, count) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        const tbody = this.elements.spreadsheet.querySelector('tbody');
        if (!tbody) return;

        const maxCol = sheet.displayCols || SPREADSHEET.DEFAULT_COLS;
        const { cells, rowHeights = {} } = sheet;
        const fragment = document.createDocumentFragment();

        // フィルター状態を取得
        const fs = this.state.filterState;
        const hasActiveFilters = fs?.enabled && Object.keys(fs.filters).length > 0;
        const filterEntries = hasActiveFilters ? Object.entries(fs.filters) : [];

        for (let i = 0; i < count; i++) {
            const r = startRow + i;

            // フィルターが有効な場合、非一致行のDOMを作成しない
            if (hasActiveFilters && r > fs.headerRow) {
                let visible = true;
                for (let f = 0; f < filterEntries.length; f++) {
                    const col = parseInt(filterEntries[f][0]);
                    const cellValue = String(cells[`${r},${col}`]?.value ?? '');
                    if (!filterEntries[f][1].has(cellValue)) {
                        visible = false;
                        break;
                    }
                }
                if (!visible) continue;
            }

            const h = rowHeights[r] || rowHeights.default || SPREADSHEET.DEFAULT_ROW_HEIGHT;
            const tr = document.createElement('tr');
            tr.innerHTML = `<th class="row-header" data-row="${r}" style="height:${h}px">${r + 1}<div class="row-resize-handle" data-row="${r}"></div></th>`;

            for (let c = 0; c < maxCol; c++) {
                const cell = cells[`${r},${c}`];
                const td = document.createElement('td');
                td.dataset.row = r;
                td.dataset.col = c;

                if (cell?.value) td.dataset.formula = cell.value;
                if (cell?.style) td.style.cssText = this.buildCellStyle(cell.style);
                td.innerHTML = this._buildCellInnerHtml(cell, cells);
                tr.appendChild(td);
            }

            fragment.appendChild(tr);
        }

        tbody.appendChild(fragment);
        this.setupNewCellEvents(startRow, startRow + count - 1, 0, maxCol - 1);
        this.setupHeaderEvents();
        this.setupResizeEvents();
        sheet.displayRows = startRow + count;
        this.applyMergesToDOM?.();
        this.applyTextOverflow(startRow, startRow + count - 1);
    }

    addColsToTable(startCol, count) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        const thead = this.elements.spreadsheet.querySelector('thead tr');
        const tbody = this.elements.spreadsheet.querySelector('tbody');
        if (!thead || !tbody) return;

        const maxRow = sheet.displayRows || SPREADSHEET.DEFAULT_ROWS;
        const { cells, colWidths = {} } = sheet;
        const defaultW = colWidths.default || SPREADSHEET.DEFAULT_COL_WIDTH;

        // 列ヘッダーを追加
        const headerFragment = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const c = startCol + i;
            const w = colWidths[c] || colWidths[String(c)] || defaultW;
            const th = document.createElement('th');
            th.className = 'col-header';
            th.dataset.col = c;
            th.style.width = `${w}px`;
            th.innerHTML = `${this.getColumnName(c)}<div class="col-resize-handle" data-col="${c}"></div>`;
            headerFragment.appendChild(th);
        }
        thead.appendChild(headerFragment);
        this.setupHeaderEvents();
        this.setupResizeEvents();

        // 各行にセルを追加
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((tr, r) => {
            for (let i = 0; i < count; i++) {
                const c = startCol + i;
                const w = colWidths[c] || colWidths[String(c)] || defaultW;
                const cell = cells[`${r},${c}`];
                const td = document.createElement('td');
                td.dataset.row = r;
                td.dataset.col = c;
                td.style.width = `${w}px`;

                if (cell?.value) td.dataset.formula = cell.value;
                if (cell?.style) td.style.cssText += this.buildCellStyle(cell.style);
                td.innerHTML = this._buildCellInnerHtml(cell, cells);
                tr.appendChild(td);
            }
        });

        this.setupNewCellEvents(0, maxRow - 1, startCol, startCol + count - 1);
        sheet.displayCols = startCol + count;

        // テーブル幅を更新
        let addedWidth = 0;
        for (let i = 0; i < count; i++) {
            const c = startCol + i;
            addedWidth += colWidths[c] || colWidths[String(c)] || defaultW;
        }
        const currentWidth = parseFloat(this.elements.spreadsheet.style.width) || 0;
        this.elements.spreadsheet.style.width = `${currentWidth + addedWidth}px`;
    }

    // ===== 編集 =====

    startEditing(cell) {
        if (this.state.editingCell && this.state.editingCell !== cell) {
            this.finishEditing(this.state.editingCell);
        }

        cell.classList.add('editing');
        this.state.editingCell = cell;

        const input = cell.querySelector('.cell-input');
        input.focus();
        input.select();

        // 数式の場合、参照セルをハイライト
        if (input.value.startsWith('=')) {
            this.highlightFormulaReferences?.(input.value);
        }
    }

    finishEditing(cell) {
        if (!cell.classList.contains('editing')) return;
        cell.classList.remove('editing');

        if (this.state.editingCell === cell) {
            this.state.editingCell = null;
        }
        this.state.isSelectingFormulaRange = false;
        this.state.formulaRangeStart = null;

        // 数式参照のハイライトをクリア
        this.clearFormulaHighlights?.();

        const input = cell.querySelector('.cell-input');
        const content = cell.querySelector('.cell-content');
        let newValue = input.value;

        // 数式の場合、閉じていない括弧を自動で閉じる
        if (newValue.startsWith('=')) {
            newValue = this.autoCloseParentheses(newValue);
            input.value = newValue;
        }

        const oldFormula = cell.dataset.formula || '';

        if (newValue !== oldFormula) {
            const row = +cell.dataset.row;
            const col = +cell.dataset.col;
            this.saveToUndoStack([{ row, col }]);

            this.ensureCellData(row, col).value = newValue;
            cell.dataset.formula = newValue;

            const sheet = this.state.sheetsData[this.currentSheet];
            const displayValue = this.calculateDisplayValue(newValue, sheet?.cells || {});
            content.textContent = displayValue;

            this.sendChangesToServer([{ row, col, value: newValue }]);
            this.recalculateAllFormulas();
        }

        // オーバーフロー表示を更新（値変更の有無に関わらず、編集モード解除後に復元）
        this.updateTextOverflowForRow(+cell.dataset.row, +cell.dataset.col);
    }

    /**
     * 数式の閉じていない括弧を自動で閉じる
     */
    autoCloseParentheses(formula) {
        let openCount = 0;
        let inString = false;

        for (const char of formula) {
            if (char === '"' && !inString) {
                inString = true;
            } else if (char === '"' && inString) {
                inString = false;
            } else if (!inString) {
                if (char === '(') openCount++;
                else if (char === ')') openCount--;
            }
        }

        // 不足している閉じ括弧を追加
        if (openCount > 0) {
            formula += ')'.repeat(openCount);
        }

        return formula;
    }

    // ===== ユーティリティ =====

    getColumnName(col) {
        let name = '';
        let n = col + 1;
        while (n > 0) {
            n--;
            name = String.fromCharCode(65 + (n % 26)) + name;
            n = Math.floor(n / 26);
        }
        return name;
    }

    getCell(row, col) {
        const tbody = this.elements.spreadsheet?.tBodies?.[0];
        if (!tbody) return null;
        const tr = tbody.rows[row];
        if (!tr) return null;
        // tr.cells[0] は行ヘッダー（th）、tr.cells[col+1] がデータセル（td）
        return tr.cells[col + 1] || null;
    }

    escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    ensureCellData(row, col) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return {};
        const key = `${row},${col}`;
        if (!sheet.cells[key]) sheet.cells[key] = {};
        return sheet.cells[key];
    }

    // ===== フィルター機能 =====

    initFilter() {
        if (!this.state.filterState) {
            this.state.filterState = {
                enabled: false,
                headerRow: 0,
                startCol: 0,
                endCol: 0,
                filters: {},
            };
        }
    }

    toggleFilter() {
        this.initFilter();
        const fs = this.state.filterState;
        fs.enabled = !fs.enabled;

        const btn = document.getElementById('btn-filter');
        if (btn) btn.classList.toggle('active', fs.enabled);

        if (fs.enabled) {
            this.determineFilterRange();
            this.renderFilterIcons();
        } else {
            this.removeFilterIcons();
            this.clearAllFilters();
        }
        this.saveAutoFilter();
    }

    determineFilterRange() {
        const fs = this.state.filterState;
        const sel = this.state.selectedCells;

        if (sel?.length > 0) {
            const rows = sel.map(c => c.row);
            const cols = sel.map(c => c.col);
            fs.headerRow = Math.min(...rows);
            fs.startCol = Math.min(...cols);
            fs.endCol = Math.max(...cols);
        } else {
            const sheet = this.state.sheetsData[this.currentSheet];
            fs.headerRow = 0;
            fs.startCol = 0;
            fs.endCol = (sheet?.displayCols || 26) - 1;
        }
    }

    renderFilterIcons() {
        const fs = this.state.filterState;
        for (let col = fs.startCol; col <= fs.endCol; col++) {
            const cell = this.getCell(fs.headerRow, col);
            if (!cell) continue;

            cell.classList.add('has-filter');
            cell.style.position = 'relative';

            const icon = document.createElement('span');
            icon.className = 'filter-icon';
            icon.innerHTML = '<i class="bi bi-caret-down-fill"></i>';
            icon.dataset.col = col;
            icon.addEventListener('click', e => {
                e.stopPropagation();
                this.showFilterDropdown(col, cell);
            });
            cell.appendChild(icon);
        }
    }

    removeFilterIcons() {
        this.elements.spreadsheet.querySelectorAll('.filter-icon').forEach(i => i.remove());
        this.elements.spreadsheet.querySelectorAll('td.has-filter').forEach(c => {
            c.classList.remove('has-filter', 'filter-active');
        });
    }

    showFilterDropdown(col, headerTh) {
        this.closeFilterDropdown();

        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        const values = this.getColumnValues(col);
        const fs = this.state.filterState;
        const currentFilter = fs.filters[col];
        const colName = this.getColumnName(col);

        const dropdown = document.createElement('div');
        dropdown.className = 'filter-dropdown';
        dropdown.id = 'filter-dropdown';
        dropdown.innerHTML = `
            <div class="filter-dropdown-header">
                <span>${colName}列 フィルター</span>
                <button class="filter-dropdown-close"><i class="bi bi-x-lg"></i></button>
            </div>
            <input type="text" class="filter-search" placeholder="検索...">
            <div class="filter-select-all">
                <input type="checkbox" id="filter-select-all" ${!currentFilter ? 'checked' : ''}>
                <label for="filter-select-all">(すべて選択)</label>
            </div>
            <div class="filter-options"></div>
            <div class="filter-actions">
                <button class="filter-btn-clear">クリア</button>
                <button class="filter-btn-apply">適用</button>
            </div>`;

        const optionsContainer = dropdown.querySelector('.filter-options');
        values.forEach(value => {
            const isChecked = !currentFilter || currentFilter.has(value);
            const displayValue = value === '' ? '(空白)' : value;
            const option = document.createElement('label');
            option.className = 'filter-option';
            option.innerHTML = `<input type="checkbox" value="${this.escapeHtml(value)}" ${isChecked ? 'checked' : ''}><span class="filter-option-label ${value === '' ? 'filter-option-empty' : ''}">${this.escapeHtml(displayValue)}</span>`;
            optionsContainer.appendChild(option);
        });

        headerTh.appendChild(dropdown);

        const selectAllCb = dropdown.querySelector('#filter-select-all');

        dropdown.querySelector('.filter-dropdown-close').addEventListener('click', () => this.closeFilterDropdown());
        dropdown.querySelector('.filter-search').addEventListener('input', e => this.filterDropdownOptions(e.target.value, optionsContainer));
        selectAllCb.addEventListener('change', e => this.toggleAllFilterOptions(e.target.checked, optionsContainer));
        dropdown.querySelector('.filter-btn-clear').addEventListener('click', () => this.clearColumnFilter(col));
        dropdown.querySelector('.filter-btn-apply').addEventListener('click', () => this.applyFilter(col, optionsContainer));

        // 個別チェックボックス変更時に「すべて選択」の状態を連動
        optionsContainer.addEventListener('change', () => {
            const cbs = optionsContainer.querySelectorAll('input[type="checkbox"]');
            const allChecked = Array.prototype.every.call(cbs, cb => cb.checked);
            selectAllCb.checked = allChecked;
        });

        const closeHandler = e => {
            if (!dropdown.contains(e.target)) {
                this.closeFilterDropdown();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    closeFilterDropdown() {
        document.getElementById('filter-dropdown')?.remove();
    }

    getColumnValues(col) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return [];

        const values = new Set();
        const headerRow = this.state.filterState.headerRow;
        // dataMaxRow（実データの最大行）を使用。displayRowsはスクロール拡張で膨らむため含めない
        const maxRow = sheet.dataMaxRow || SPREADSHEET.DEFAULT_ROWS;
        let hasEmpty = false;

        for (let r = headerRow + 1; r < maxRow; r++) {
            const val = sheet.cells[`${r},${col}`]?.value;
            if (val != null && val !== '') {
                values.add(String(val));
            } else {
                hasEmpty = true;
            }
        }

        const sorted = Array.from(values).sort((a, b) => a.localeCompare(b, 'ja'));
        if (hasEmpty) sorted.unshift('');
        return sorted;
    }

    filterDropdownOptions(searchText, optionsContainer) {
        const search = searchText.toLowerCase();
        optionsContainer.querySelectorAll('.filter-option').forEach(option => {
            const label = option.querySelector('.filter-option-label').textContent.toLowerCase();
            option.style.display = label.includes(search) ? '' : 'none';
        });
    }

    toggleAllFilterOptions(checked, optionsContainer) {
        optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb.closest('.filter-option').style.display !== 'none') {
                cb.checked = checked;
            }
        });
    }

    applyFilter(col, optionsContainer) {
        const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]');
        const checkedValues = new Set();
        let allChecked = true;

        checkboxes.forEach(cb => {
            if (cb.checked) {
                checkedValues.add(cb.value);
            } else {
                allChecked = false;
            }
        });

        const fs = this.state.filterState;

        // 全チェック = フィルター無し（getColumnValues再呼び出しを回避）
        if (allChecked) {
            delete fs.filters[col];
        } else {
            fs.filters[col] = checkedValues;
        }

        this.closeFilterDropdown();
        this.applyAllFilters();
        this.updateFilterIconStates();
    }

    clearColumnFilter(col) {
        delete this.state.filterState.filters[col];
        this.closeFilterDropdown();
        this.applyAllFilters();
        this.updateFilterIconStates();
    }

    clearAllFilters() {
        this.state.filterState.filters = {};
        this.applyAllFilters();
        this.updateFilterIconStates();
    }

    _buildFilteredRowHtml(r, sheet) {
        const { cells, rowHeights = {}, colWidths = {} } = sheet;
        const maxCol = sheet.displayCols || SPREADSHEET.DEFAULT_COLS;
        const defaultW = colWidths.default || SPREADSHEET.DEFAULT_COL_WIDTH;
        const defaultH = rowHeights.default || SPREADSHEET.DEFAULT_ROW_HEIGHT;
        const h = rowHeights[r] || rowHeights[String(r)] || defaultH;
        const parts = [`<tr><th class="row-header" data-row="${r}" style="height:${h}px;min-height:${h}px">${r + 1}<div class="row-resize-handle" data-row="${r}"></div></th>`];
        for (let c = 0; c < maxCol; c++) {
            const cell = cells[`${r},${c}`];
            const w = colWidths[c] || colWidths[String(c)] || defaultW;
            const formulaAttr = cell?.value ? ` data-formula="${this.escapeHtml(cell.value)}"` : '';
            const cellStyle = this.buildCellStyle(cell?.style);
            parts.push(`<td data-row="${r}" data-col="${c}"${formulaAttr} style="width:${w}px;${cellStyle}">${this._buildCellInnerHtml(cell, cells)}</td>`);
        }
        parts.push('</tr>');
        return parts.join('');
    }

    _isRowVisible(r, filterEntries, cells) {
        for (let f = 0; f < filterEntries.length; f++) {
            const col = parseInt(filterEntries[f][0]);
            const cellValue = String(cells[`${r},${col}`]?.value ?? '');
            if (!filterEntries[f][1].has(cellValue)) return false;
        }
        return true;
    }

    applyAllFilters() {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        // 前回のバックグラウンド描画をキャンセル
        if (this._filterRenderTimer) {
            cancelAnimationFrame(this._filterRenderTimer);
            this._filterRenderTimer = null;
        }

        const fs = this.state.filterState;
        const tbody = this.elements.spreadsheet.querySelector('tbody');
        if (!tbody) return;

        const filterEntries = Object.entries(fs.filters);
        const hasFilters = filterEntries.length > 0;
        const maxRow = sheet.displayRows || SPREADSHEET.DEFAULT_ROWS;
        const { cells } = sheet;

        // ① 一致行のインデックスを収集（データのみ、DOM操作なし → 高速）
        const matchingRows = [];
        for (let r = 0; r < maxRow; r++) {
            if (!hasFilters || r <= fs.headerRow || this._isRowVisible(r, filterEntries, cells)) {
                matchingRows.push(r);
            }
        }

        // ② 最初の50行を即座に描画
        const FIRST_BATCH = SPREADSHEET.INITIAL_RENDER_ROWS;
        const firstRows = matchingRows.slice(0, FIRST_BATCH);
        const parts = [];
        for (let i = 0; i < firstRows.length; i++) {
            parts.push(this._buildFilteredRowHtml(firstRows[i], sheet));
        }
        tbody.innerHTML = parts.join('');
        this.setupHeaderEvents();
        this.setupResizeEvents();
        if (fs.enabled) this.renderFilterIcons();

        // ③ 残りをバックグラウンドでバッチ追加
        if (matchingRows.length > FIRST_BATCH) {
            let offset = FIRST_BATCH;
            const BATCH_SIZE = SPREADSHEET.INITIAL_RENDER_ROWS;

            const renderNextBatch = () => {
                const batch = matchingRows.slice(offset, offset + BATCH_SIZE);
                if (batch.length === 0) {
                    this._filterRenderTimer = null;
                    return;
                }

                const batchHtml = [];
                for (let i = 0; i < batch.length; i++) {
                    batchHtml.push(this._buildFilteredRowHtml(batch[i], sheet));
                }
                const temp = document.createElement('tbody');
                temp.innerHTML = batchHtml.join('');
                while (temp.firstChild) {
                    tbody.appendChild(temp.firstChild);
                }
                this.setupHeaderEvents();
                this.setupResizeEvents();

                offset += BATCH_SIZE;
                if (offset < matchingRows.length) {
                    this._filterRenderTimer = requestAnimationFrame(renderNextBatch);
                } else {
                    this._filterRenderTimer = null;
                }
            };
            this._filterRenderTimer = requestAnimationFrame(renderNextBatch);
        }
    }

    updateFilterIconStates() {
        const fs = this.state.filterState;
        this.elements.spreadsheet.querySelectorAll('.filter-icon').forEach(icon => {
            const col = parseInt(icon.dataset.col);
            const hasFilter = fs.filters[col] !== undefined;
            icon.classList.toggle('active', hasFilter);
            icon.closest('td')?.classList.toggle('filter-active', hasFilter);
        });
    }

    parseCellRef(ref) {
        const match = ref.match(/^([A-Z]+)(\d+)$/i);
        if (!match) return null;
        const colStr = match[1].toUpperCase();
        const row = parseInt(match[2]) - 1;
        let col = 0;
        for (let i = 0; i < colStr.length; i++) {
            col = col * 26 + (colStr.charCodeAt(i) - 64);
        }
        return { row, col: col - 1 };
    }

    toCellRef(row, col) {
        return this.getColumnName(col) + (row + 1);
    }

    restoreAutoFilter(sheetName) {
        const sheet = this.state.sheetsData[sheetName];
        if (!sheet?.autoFilter) {
            this.initFilter();
            document.getElementById('btn-filter')?.classList.remove('active');
            return;
        }

        const autoFilter = sheet.autoFilter;
        if (!autoFilter.ref) return;

        const [startRef, endRef] = autoFilter.ref.split(':');
        const start = this.parseCellRef(startRef);
        const end = endRef ? this.parseCellRef(endRef) : start;
        if (!start) return;

        this.initFilter();
        const fs = this.state.filterState;
        fs.enabled = true;
        fs.headerRow = start.row;
        fs.startCol = start.col;
        fs.endCol = end?.col ?? start.col;
        fs.filters = {};

        document.getElementById('btn-filter')?.classList.add('active');
        this.renderFilterIcons();
    }

    async saveAutoFilter() {
        if (!this.state.currentFilePath) return;

        const fs = this.state.filterState;
        let filterRef = null;

        if (fs.enabled) {
            const startRef = this.toCellRef(fs.headerRow, fs.startCol);
            const endRef = this.toCellRef(fs.headerRow, fs.endCol);
            filterRef = startRef === endRef ? startRef : `${startRef}:${endRef}`;
        }

        try {
            await this.apiCall(API.AUTO_FILTER, {
                method: 'POST',
                body: {
                    path: this.state.currentFilePath,
                    sheetName: this.currentSheet,
                    filterRef
                }
            });
        } catch (e) {
            console.error('フィルター保存エラー:', e);
        }
    }
};

/**
 * 全ミックスインを合成してエクスポート
 */
export const SpreadsheetMixin = (Base) =>
    SpreadsheetCoreMixin(
        SheetsMixin(
            SelectionMixin(
                ResizeMixin(
                    EventsMixin(
                        FormulaInputMixin(Base)
                    )
                )
            )
        )
    );
