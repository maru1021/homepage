/**
 * DKCドライブ - スタイル適用（罫線・色・フォント）
 */

import { BORDER_STYLE, BORDER_CONFIG, FONT_SIZES, DEFAULT_FONT_SIZE } from './constants.js';

/**
 * スタイル適用のミックスイン
 * @param {DKCDrive} Base - 基底クラス
 */
export const StyleMixin = (Base) => class extends Base {

    initStyle() {
        this.colorPreviewCells = null;
        this.initFontSizeSelect();
    }

    // プレビュー用（UIのみ更新、サーバー送信なし）
    previewStyleToSelection(style) {
        if (!this.colorPreviewCells) {
            this.colorPreviewCells = [...this.state.selectedCells];
        }

        const cells = this.colorPreviewCells;
        if (cells.length === 0) return;

        cells.forEach(({ cell }) => {
            const content = cell.querySelector('.cell-content');
            cell.classList.add('color-preview');
            cell.classList.remove('in-selection');
            if (style.backgroundColor) cell.style.backgroundColor = style.backgroundColor;
            if (style.color) content.style.color = style.color;
        });
    }

    // プレビュー状態をクリア
    clearColorPreview() {
        if (this.colorPreviewCells) {
            this.colorPreviewCells.forEach(({ cell }) => {
                cell.classList.remove('color-preview');
            });
            this.colorPreviewCells = null;
        }
    }

    // 色確定用（プレビューしたセルに対してデータ更新 + サーバー送信）
    applyColorToPreviewCells(style) {
        const cells = this.colorPreviewCells || this.state.selectedCells;
        if (cells.length === 0) return;

        const changes = cells.map(({ row, col, cell }) => {
            const content = cell.querySelector('.cell-content');
            if (style.backgroundColor) cell.style.backgroundColor = style.backgroundColor;
            if (style.color) content.style.color = style.color;

            const data = this.ensureCellData(row, col);
            data.style = { ...data.style, ...style };
            return { row, col, style };
        });

        this.sendChangesToServer(changes);
        this.clearColorPreview();
    }

    // 確定用（データ更新 + サーバー送信）
    applyStyleToSelection(style) {
        const cells = this.state.selectedCells;
        if (cells.length === 0) return;

        this.saveToUndoStack(cells);

        const changes = cells.map(({ row, col, cell }) => {
            const content = cell.querySelector('.cell-content');
            if (style.backgroundColor) cell.style.backgroundColor = style.backgroundColor;
            if (style.color) content.style.color = style.color;
            if (style.fontWeight) content.style.fontWeight = style.fontWeight;
            if (style.fontSize) content.style.fontSize = style.fontSize + 'px';
            if (style.textAlign) {
                const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
                content.style.justifyContent = justifyMap[style.textAlign] || 'flex-start';
            }

            const data = this.ensureCellData(row, col);
            data.style = { ...data.style, ...style };
            return { row, col, style };
        });

        this.sendChangesToServer(changes);
    }

    toggleStyle(prop, value) {
        const cells = this.state.selectedCells;
        if (cells.length === 0) return;
        const { row, col } = cells[0];
        const current = this.state.sheetsData[this.currentSheet].cells[`${row},${col}`]?.style || {};
        this.applyStyleToSelection({ [prop]: current[prop] === value ? 'normal' : value });
    }

    // フォントサイズ増減（+1/-1）
    changeFontSize(delta) {
        const cells = this.state.selectedCells;
        if (cells.length === 0) return;

        const { row, col } = cells[0];
        const currentSize = this.state.sheetsData[this.currentSheet]?.cells[`${row},${col}`]?.style?.fontSize || DEFAULT_FONT_SIZE;

        let newSize;
        if (delta > 0) {
            newSize = FONT_SIZES.find(s => s > currentSize) || FONT_SIZES[FONT_SIZES.length - 1];
        } else {
            newSize = [...FONT_SIZES].reverse().find(s => s < currentSize) || FONT_SIZES[0];
        }

        this.applyStyleToSelection({ fontSize: newSize });
        this.updateToolbarFontSize(newSize);
    }

    // 選択セルのフォントサイズを取得
    getSelectedCellFontSize() {
        const cells = this.state.selectedCells;
        if (cells.length === 0) return DEFAULT_FONT_SIZE;

        const { row, col } = cells[0];
        return this.state.sheetsData[this.currentSheet]?.cells[`${row},${col}`]?.style?.fontSize || DEFAULT_FONT_SIZE;
    }

    // ツールバーのフォントサイズセレクタを更新
    updateToolbarFontSize(size) {
        const select = this.elements.fontSizeSelect;
        if (!select) return;
        select.value = FONT_SIZES.includes(size) ? size : DEFAULT_FONT_SIZE;
    }

    // セル選択時にツールバーを更新
    updateToolbarFromSelection() {
        this.updateToolbarFontSize(this.getSelectedCellFontSize());
    }

    // フォントサイズセレクタを初期化（動的にオプション生成）
    initFontSizeSelect() {
        const select = this.elements.fontSizeSelect;
        if (!select) return;

        select.innerHTML = FONT_SIZES.map(size =>
            `<option value="${size}"${size === DEFAULT_FONT_SIZE ? ' selected' : ''}>${size}</option>`
        ).join('');
    }

    applyBorder(type) {
        const cells = this.state.selectedCells;
        if (cells.length === 0) return;

        this.saveToUndoStack(cells);

        const bounds = this.getSelectionBounds();
        const changes = [];

        cells.forEach(({ row, col, cell }) => {
            let border = {};
            if (type === 'all') border = { top: BORDER_CONFIG, right: BORDER_CONFIG, bottom: BORDER_CONFIG, left: BORDER_CONFIG };
            else if (type === 'outer') {
                if (row === bounds.minRow) border.top = BORDER_CONFIG;
                if (row === bounds.maxRow) border.bottom = BORDER_CONFIG;
                if (col === bounds.minCol) border.left = BORDER_CONFIG;
                if (col === bounds.maxCol) border.right = BORDER_CONFIG;
            } else if (type === 'none') border = {};
            else border[type] = BORDER_CONFIG;

            this.applyBorderToCell(cell, border);
            this.ensureCellData(row, col).style.border = border;
            changes.push({ row, col, style: { border } });
        });

        this.updateAdjacentBorders(bounds, type);
        this.sendChangesToServer(changes);
    }

    updateAdjacentBorders(bounds, type) {
        const { minRow, maxRow, minCol, maxCol } = bounds;
        if (minRow > 0 && ['all', 'outer', 'top'].includes(type)) {
            for (let c = minCol; c <= maxCol; c++) this.getCell(minRow - 1, c)?.style && (this.getCell(minRow - 1, c).style.borderBottom = BORDER_STYLE);
        }
        if (minCol > 0 && ['all', 'outer', 'left'].includes(type)) {
            for (let r = minRow; r <= maxRow; r++) this.getCell(r, minCol - 1)?.style && (this.getCell(r, minCol - 1).style.borderRight = BORDER_STYLE);
        }
    }
};
