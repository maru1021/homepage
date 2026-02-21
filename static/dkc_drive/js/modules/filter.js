/**
 * DKCドライブ - スプレッドシートフィルター機能
 */

import { API } from './constants.js';

/**
 * フィルター機能のミックスイン
 * @param {DKCDrive} Base - 基底クラス
 */
export const FilterMixin = (Base) => class extends Base {

    // ===== 初期化 =====

    initFilter() {
        if (!this.state.filterState) {
            this.state.filterState = {
                enabled: false,
                headerRow: 0,
                startCol: 0,
                endCol: 0,
                filters: {},  // { col: Set<allowedValues> }
            };
        }
    }

    // ===== フィルター ON/OFF =====

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
        const selectedCells = this.state.selectedCells;

        if (selectedCells && selectedCells.length > 0) {
            const rows = selectedCells.map(c => c.row);
            const cols = selectedCells.map(c => c.col);
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

    // ===== フィルターアイコン =====

    renderFilterIcons() {
        const fs = this.state.filterState;
        const headerRow = fs.headerRow;

        for (let col = fs.startCol; col <= fs.endCol; col++) {
            const cell = this.getCell(headerRow, col);
            if (!cell) continue;

            cell.classList.add('has-filter');
            cell.style.position = 'relative';

            const icon = document.createElement('span');
            icon.className = 'filter-icon';
            icon.innerHTML = '<i class="bi bi-caret-down-fill"></i>';
            icon.dataset.col = col;
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showFilterDropdown(col, cell);
            });
            cell.appendChild(icon);
        }
    }

    removeFilterIcons() {
        this.elements.spreadsheet.querySelectorAll('.filter-icon').forEach(icon => icon.remove());
        this.elements.spreadsheet.querySelectorAll('td.has-filter').forEach(cell => {
            cell.classList.remove('has-filter', 'filter-active');
        });
    }

    updateFilterIconStates() {
        const fs = this.state.filterState;
        this.elements.spreadsheet.querySelectorAll('.filter-icon').forEach(icon => {
            const col = parseInt(icon.dataset.col);
            const hasFilter = fs.filters[col] !== undefined;
            icon.classList.toggle('active', hasFilter);

            const parentCell = icon.closest('td');
            if (parentCell) {
                parentCell.classList.toggle('filter-active', hasFilter);
            }
        });
    }

    // ===== フィルタードロップダウン =====

    showFilterDropdown(col, cell) {
        this.closeFilterDropdown();

        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        const values = this.getColumnValues(col);
        const fs = this.state.filterState;
        const currentFilter = fs.filters[col];
        const colName = this.getColumnName(col);

        const allSelected = !currentFilter || currentFilter.size === values.length;
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
                <input type="checkbox" id="filter-select-all" ${allSelected ? 'checked' : ''}>
                <label for="filter-select-all">(すべて選択)</label>
            </div>
            <div class="filter-options"></div>
            <div class="filter-actions">
                <button class="filter-btn-clear">クリア</button>
                <button class="filter-btn-apply">適用</button>
            </div>
        `;

        const optionsContainer = dropdown.querySelector('.filter-options');
        this.populateFilterOptions(optionsContainer, values, currentFilter);

        cell.appendChild(dropdown);
        this.bindFilterDropdownEvents(dropdown, col, optionsContainer);
    }

    populateFilterOptions(container, values, currentFilter) {
        values.forEach(value => {
            const isChecked = !currentFilter || currentFilter.has(value);
            const displayValue = value === '' ? '(空白)' : value;
            const emptyClass = value === '' ? 'filter-option-empty' : '';

            const option = document.createElement('label');
            option.className = 'filter-option';
            option.innerHTML = `
                <input type="checkbox" value="${this.escapeHtml(value)}" ${isChecked ? 'checked' : ''}>
                <span class="filter-option-label ${emptyClass}">${this.escapeHtml(displayValue)}</span>
            `;
            container.appendChild(option);
        });
    }

    bindFilterDropdownEvents(dropdown, col, optionsContainer) {
        dropdown.querySelector('.filter-dropdown-close').addEventListener('click', () => this.closeFilterDropdown());
        dropdown.querySelector('.filter-search').addEventListener('input', (e) => this.filterDropdownOptions(e.target.value, optionsContainer));
        dropdown.querySelector('#filter-select-all').addEventListener('change', (e) => this.toggleAllFilterOptions(e.target.checked, optionsContainer));
        dropdown.querySelector('.filter-btn-clear').addEventListener('click', () => this.clearColumnFilter(col));
        dropdown.querySelector('.filter-btn-apply').addEventListener('click', () => this.applyFilter(col, optionsContainer));

        // 個別チェックボックスの変更で「すべて選択」を同期
        const selectAllCb = dropdown.querySelector('#filter-select-all');
        optionsContainer.addEventListener('change', () => {
            const all = optionsContainer.querySelectorAll('input[type="checkbox"]');
            const checked = optionsContainer.querySelectorAll('input[type="checkbox"]:checked');
            selectAllCb.checked = all.length === checked.length;
        });

        const closeHandler = (e) => {
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

    // ===== フィルター値の収集・操作 =====

    getColumnValues(col) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return [];

        const values = new Set();
        const headerRow = this.state.filterState.headerRow;
        const maxRow = sheet.displayRows || 50;

        for (const key in sheet.cells) {
            const [r, c] = key.split(',').map(Number);
            if (c === col && r > headerRow) {
                values.add(String(sheet.cells[key]?.value ?? ''));
            }
        }

        for (let r = headerRow + 1; r < maxRow; r++) {
            const key = `${r},${col}`;
            if (!sheet.cells[key] || !sheet.cells[key].value) {
                values.add('');
            }
        }

        return Array.from(values).sort((a, b) => {
            if (a === '') return -1;
            if (b === '') return 1;
            return a.localeCompare(b, 'ja');
        });
    }

    filterDropdownOptions(searchText, container) {
        const search = searchText.toLowerCase();
        container.querySelectorAll('.filter-option').forEach(option => {
            const label = option.querySelector('.filter-option-label').textContent.toLowerCase();
            option.style.display = label.includes(search) ? '' : 'none';
        });
    }

    toggleAllFilterOptions(checked, container) {
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb.closest('.filter-option').style.display !== 'none') {
                cb.checked = checked;
            }
        });
    }

    // ===== フィルター適用・解除 =====

    applyFilter(col, container) {
        const checkedValues = new Set();
        container.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            checkedValues.add(cb.value);
        });

        const fs = this.state.filterState;
        const allValues = this.getColumnValues(col);

        if (checkedValues.size === allValues.length) {
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

    applyAllFilters() {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet) return;

        const fs = this.state.filterState;
        const tbody = this.elements.spreadsheet.querySelector('tbody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        rows.forEach((tr, index) => {
            if (index <= fs.headerRow) {
                tr.classList.remove('filtered-out');
                return;
            }

            let visible = true;
            for (const [colStr, allowedValues] of Object.entries(fs.filters)) {
                const col = parseInt(colStr);
                const key = `${index},${col}`;
                const cellValue = String(sheet.cells[key]?.value ?? '');

                if (!allowedValues.has(cellValue)) {
                    visible = false;
                    break;
                }
            }
            tr.classList.toggle('filtered-out', !visible);
        });
    }

    // ===== Excel連携（保存・復元） =====

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
        this.initFilter();

        const btn = document.getElementById('btn-filter');

        if (!sheet?.autoFilter?.ref) {
            if (btn) btn.classList.remove('active');
            return;
        }

        const [startRef, endRef] = sheet.autoFilter.ref.split(':');
        const start = this.parseCellRef(startRef);
        const end = endRef ? this.parseCellRef(endRef) : start;

        if (!start) return;

        const fs = this.state.filterState;
        fs.enabled = true;
        fs.headerRow = start.row;
        fs.startCol = start.col;
        fs.endCol = end?.col ?? start.col;
        fs.filters = {};

        if (btn) btn.classList.add('active');
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
