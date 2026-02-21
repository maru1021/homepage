/**
 * DKCドライブ - スプレッドシート図形挿入機能
 * SVGベースの図形をシート上にオーバーレイ表示
 */

import { API, SHAPE_TYPES, SHAPE_DEFAULTS } from './constants.js';
import { generateShapeSVG } from './shape-utils.js';

/**
 * 図形挿入機能のミックスイン
 * @param {DKCDrive} Base - 基底クラス
 */
export const ShapeMixin = (Base) => class extends Base {

    initShape() {
        this.shapeState = {
            selectedShape: null,
            isDeleting: false,
        };

        this.initShapeEvents();
    }

    initShapeEvents() {
        // 図形ドロップダウンのクリックイベント
        document.querySelectorAll('[data-shape-type]').forEach(item => {
            item.addEventListener('click', e => {
                e.preventDefault();
                this.insertShape(item.dataset.shapeType);
            });
        });

        // 図形選択解除（スプレッドシートクリック時）
        this.elements.spreadsheet?.addEventListener('mousedown', e => {
            if (!e.target.closest('.sheet-shape')) {
                this.deselectShape();
            }
        });

        // キーボードショートカット（図形削除）
        document.addEventListener('keydown', e => {
            if (this.shapeState.selectedShape && (e.key === 'Delete' || e.key === 'Backspace')) {
                if (!this.state.editingCell) {
                    e.preventDefault();
                    this.deleteShape(this.shapeState.selectedShape.shapeIndex);
                }
            }
        });
    }

    // ============================================================
    // SVG生成
    // ============================================================

    /**
     * 図形タイプに応じたSVGを生成
     */
    generateShapeSVG(shapeData) {
        return generateShapeSVG(shapeData);
    }

    // ============================================================
    // 挿入
    // ============================================================

    /**
     * 選択セル位置に図形を挿入
     */
    async insertShape(shapeType) {
        const cells = this.state.selectedCells;
        if (cells.length === 0) {
            this.showSaveIndicator('セルを選択してください', true);
            return;
        }

        const { row, col } = cells[0];
        const isLine = (shapeType === SHAPE_TYPES.LINE || shapeType === SHAPE_TYPES.ARROW);

        const shapeData = {
            shapeIndex: null,
            shapeType,
            row,
            col,
            offsetX: 0,
            offsetY: 0,
            width: isLine ? 160 : SHAPE_DEFAULTS.width,
            height: isLine ? 40 : SHAPE_DEFAULTS.height,
            fillColor: SHAPE_DEFAULTS.fillColor,
            strokeColor: SHAPE_DEFAULTS.strokeColor,
            strokeWidth: SHAPE_DEFAULTS.strokeWidth,
            opacity: SHAPE_DEFAULTS.opacity,
            rotation: 0,
        };

        // サーバーに保存
        const result = await this.saveShapeToServer(shapeData);
        if (result && result.shapeIndex !== undefined) {
            shapeData.shapeIndex = result.shapeIndex;
            this.addShapeToSheet(shapeData);
            this.showSaveIndicator('図形を挿入しました');
        } else {
            this.showSaveIndicator('図形の保存に失敗しました', true);
        }
    }

    // ============================================================
    // 描画
    // ============================================================

    /**
     * state更新＋DOM描画
     */
    addShapeToSheet(shapeData) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet.shapes) sheet.shapes = [];
        sheet.shapes.push(shapeData);
        this.renderSheetShape(shapeData);
    }

    /**
     * SVGオーバーレイ描画（リサイズハンドル・削除ボタン付き）
     */
    renderSheetShape(shapeData) {
        const container = this.getImageContainer();
        if (!container) return;

        const pos = this._getCellPosition(shapeData.row, shapeData.col);
        if (!pos) return;

        const left = pos.left + (shapeData.offsetX || 0);
        const top = pos.top + (shapeData.offsetY || 0);

        const wrapper = document.createElement('div');
        wrapper.className = 'sheet-shape';
        wrapper.dataset.shapeIndex = shapeData.shapeIndex;
        const rotation = shapeData.rotation || 0;
        wrapper.style.cssText = `
            left: ${left}px;
            top: ${top}px;
            width: ${shapeData.width}px;
            height: ${shapeData.height}px;
            ${rotation ? `transform: rotate(${rotation}deg);` : ''}
        `;

        const svgHtml = this.generateShapeSVG(shapeData);

        wrapper.innerHTML = `
            ${svgHtml}
            <div class="sheet-image-resize-handle nw" data-dir="nw"></div>
            <div class="sheet-image-resize-handle ne" data-dir="ne"></div>
            <div class="sheet-image-resize-handle sw" data-dir="sw"></div>
            <div class="sheet-image-resize-handle se" data-dir="se"></div>
            <div class="sheet-image-rotate-line"></div>
            <div class="sheet-image-rotate-handle" title="回転"></div>
            <button class="sheet-image-delete" title="削除"><i class="bi bi-x"></i></button>
        `;

        this.setupShapeEvents(wrapper, shapeData);
        container.appendChild(wrapper);
    }

    // ============================================================
    // イベント
    // ============================================================

    setupShapeEvents(wrapper, shapeData) {
        // 選択 + ドラッグ
        wrapper.addEventListener('mousedown', e => {
            if (e.target.closest('.sheet-image-delete')) return;
            if (e.target.closest('.sheet-image-rotate-handle')) return;
            e.stopPropagation();
            this.selectShape(wrapper, shapeData);

            if (!e.target.classList.contains('sheet-image-resize-handle')) {
                this.startShapeDrag(e, wrapper, shapeData);
            }
        });

        // 右クリック → 色変更メニュー
        wrapper.addEventListener('contextmenu', e => {
            e.preventDefault();
            e.stopPropagation();
            this.selectShape(wrapper, shapeData);
            this.showShapeContextMenu(e, wrapper, shapeData);
        });

        // リサイズハンドル
        wrapper.querySelectorAll('.sheet-image-resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', e => {
                e.stopPropagation();
                this.selectShape(wrapper, shapeData);
                this.startShapeResize(e, wrapper, shapeData, handle.dataset.dir);
            });
        });

        // 回転ハンドル
        wrapper.querySelector('.sheet-image-rotate-handle')?.addEventListener('mousedown', e => {
            e.stopPropagation();
            this.selectShape(wrapper, shapeData);
            this.startRotation(e, wrapper, shapeData);
        });

        // 削除ボタン
        wrapper.querySelector('.sheet-image-delete').addEventListener('click', e => {
            e.stopPropagation();
            this.deleteShape(shapeData.shapeIndex);
        });
    }

    selectShape(wrapper, shapeData) {
        this.deselectShape();
        // 画像の選択も解除
        this.deselectImage?.();
        wrapper.classList.add('selected');
        this.shapeState.selectedShape = shapeData;
    }

    deselectShape() {
        document.querySelectorAll('.sheet-shape.selected').forEach(el => {
            el.classList.remove('selected');
        });
        this.shapeState.selectedShape = null;
    }

    // ============================================================
    // 右クリックメニュー（色変更）
    // ============================================================

    showShapeContextMenu(e, wrapper, shapeData) {
        // 既存メニューを削除
        document.querySelector('.shape-context-menu')?.remove();

        const isLine = (shapeData.shapeType === SHAPE_TYPES.LINE || shapeData.shapeType === SHAPE_TYPES.ARROW);
        const hasFill = shapeData.fillColor && shapeData.fillColor !== 'none';
        // カラーピッカーの初期値（noneの場合はデフォルト色をセット）
        const fillValue = hasFill ? shapeData.fillColor : SHAPE_DEFAULTS.fillColor;

        const menu = document.createElement('div');
        menu.className = 'shape-context-menu';
        menu.innerHTML = `
            ${isLine ? '' : `
            <label class="shape-context-menu-item">
                <span class="shape-context-menu-label"><i class="bi bi-paint-bucket"></i> 塗りつぶし</span>
                <input type="color" class="shape-color-input" data-prop="fillColor" value="${fillValue}"${hasFill ? '' : ' disabled'}>
            </label>
            <label class="shape-context-menu-item shape-context-menu-nofill">
                <input type="checkbox" class="form-check-input shape-nofill-check"${hasFill ? '' : ' checked'}> 塗りつぶしなし
            </label>
            <div class="shape-context-menu-divider"></div>
            `}
            <label class="shape-context-menu-item">
                <span class="shape-context-menu-label"><i class="bi bi-border-style"></i> 枠線の色</span>
                <input type="color" class="shape-color-input" data-prop="strokeColor" value="${shapeData.strokeColor || SHAPE_DEFAULTS.strokeColor}">
            </label>
            <div class="shape-context-menu-divider"></div>
            <div class="shape-context-menu-item shape-context-menu-delete" data-action="delete">
                <i class="bi bi-trash"></i> 削除
            </div>
        `;

        menu.style.left = `${e.pageX}px`;
        menu.style.top = `${e.pageY}px`;
        document.body.appendChild(menu);

        // 画面外にはみ出す場合の補正
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${e.pageX - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${e.pageY - rect.height}px`;
        }

        // 塗りつぶしなしチェックボックス
        const noFillCheck = menu.querySelector('.shape-nofill-check');
        const fillInput = menu.querySelector('[data-prop="fillColor"]');
        if (noFillCheck && fillInput) {
            noFillCheck.addEventListener('change', () => {
                if (noFillCheck.checked) {
                    shapeData.fillColor = 'none';
                    fillInput.disabled = true;
                } else {
                    shapeData.fillColor = fillInput.value;
                    fillInput.disabled = false;
                }
                this.refreshShapeSVG(wrapper, shapeData);
                this.saveShapeToServer(shapeData);
            });
        }

        // カラーピッカー変更イベント
        menu.querySelectorAll('.shape-color-input').forEach(input => {
            input.addEventListener('input', () => {
                const prop = input.dataset.prop;
                shapeData[prop] = input.value;
                this.refreshShapeSVG(wrapper, shapeData);
            });
            input.addEventListener('change', () => {
                this.saveShapeToServer(shapeData);
            });
        });

        // メニューを閉じるハンドラ（リスナー除去を一元管理）
        const closeMenu = () => {
            menu.remove();
            document.removeEventListener('mousedown', closeHandler);
        };

        // 削除ボタン
        menu.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
            closeMenu();
            this.deleteShape(shapeData.shapeIndex);
        });

        // メニュー外クリックで閉じる
        const closeHandler = ev => {
            if (!menu.isConnected) {
                document.removeEventListener('mousedown', closeHandler);
                return;
            }
            if (!menu.contains(ev.target)) {
                closeMenu();
            }
        };
        setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
    }

    /**
     * 図形のSVGを現在のshapeDataで再描画
     */
    refreshShapeSVG(wrapper, shapeData) {
        const svg = wrapper.querySelector('svg');
        if (!svg) return;
        const newSvg = this.generateShapeSVG(shapeData);
        const temp = document.createElement('div');
        temp.innerHTML = newSvg;
        svg.replaceWith(temp.firstElementChild);
    }

    // ============================================================
    // ドラッグ（ImageMixinの_trackPointerを再利用）
    // ============================================================

    startShapeDrag(e, wrapper, shapeData) {
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = parseInt(wrapper.style.left);
        const startTop = parseInt(wrapper.style.top);

        this._trackPointer(
            ev => {
                wrapper.style.left = `${startLeft + ev.clientX - startX}px`;
                wrapper.style.top = `${startTop + ev.clientY - startY}px`;
            },
            () => this.updateShapePosition(wrapper, shapeData)
        );
    }

    // ============================================================
    // リサイズ（SVGを再生成してクリスプ表示）
    // ============================================================

    startShapeResize(e, wrapper, shapeData, direction) {
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = parseInt(wrapper.style.width);
        const startHeight = parseInt(wrapper.style.height);
        const startLeft = parseInt(wrapper.style.left);
        const startTop = parseInt(wrapper.style.top);

        this._trackPointer(
            ev => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;

                let newWidth = startWidth;
                let newHeight = startHeight;
                let newLeft = startLeft;
                let newTop = startTop;

                if (direction.includes('e')) {
                    newWidth = Math.max(30, startWidth + dx);
                } else if (direction.includes('w')) {
                    newWidth = Math.max(30, startWidth - dx);
                    newLeft = startLeft + (startWidth - newWidth);
                }

                if (direction.includes('s')) {
                    newHeight = Math.max(20, startHeight + dy);
                } else if (direction.includes('n')) {
                    newHeight = Math.max(20, startHeight - dy);
                    newTop = startTop + (startHeight - newHeight);
                }

                wrapper.style.width = `${newWidth}px`;
                wrapper.style.height = `${newHeight}px`;
                wrapper.style.left = `${newLeft}px`;
                wrapper.style.top = `${newTop}px`;

                // SVGを再生成（ベクターなのでリサイズ時も常にクリスプ表示）
                shapeData.width = newWidth;
                shapeData.height = newHeight;
                this.refreshShapeSVG(wrapper, shapeData);
            },
            () => this.updateShapePosition(wrapper, shapeData)
        );
    }

    // ============================================================
    // 位置更新
    // ============================================================

    updateShapePosition(wrapper, shapeData) {
        if (this.shapeState.isDeleting) return;

        const shapeLeft = parseInt(wrapper.style.left);
        const shapeTop = parseInt(wrapper.style.top);

        const nearest = this._findNearestCell(shapeLeft, shapeTop);
        if (!nearest) return;

        const cellPos = this._getCellPosition(nearest.row, nearest.col);
        if (!cellPos) return;

        shapeData.row = nearest.row;
        shapeData.col = nearest.col;
        shapeData.offsetX = shapeLeft - cellPos.left;
        shapeData.offsetY = shapeTop - cellPos.top;
        shapeData.width = parseInt(wrapper.style.width);
        shapeData.height = parseInt(wrapper.style.height);
        shapeData.rotation = shapeData.rotation || 0;

        this.saveShapeToServer(shapeData);
    }

    // ============================================================
    // 削除
    // ============================================================

    async deleteShape(shapeIndex) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet?.shapes) return;

        this.shapeState.isDeleting = true;

        const index = sheet.shapes.findIndex(s => s.shapeIndex === shapeIndex);
        if (index === -1) {
            this.shapeState.isDeleting = false;
            return;
        }

        const shapeData = sheet.shapes[index];

        // DOM削除
        const wrapper = document.querySelector(`.sheet-shape[data-shape-index="${shapeIndex}"]`);
        if (wrapper) wrapper.remove();

        // サーバー削除
        await this.deleteShapeFromServer(shapeData);

        // 配列から削除
        sheet.shapes.splice(index, 1);

        this.shapeState.selectedShape = null;
        this.shapeState.isDeleting = false;
        this.showSaveIndicator('図形を削除しました');
    }

    // ============================================================
    // サーバー通信
    // ============================================================

    async saveShapeToServer(shapeData) {
        if (!this.state.currentFilePath) return null;

        try {
            const shape = {
                shapeType: shapeData.shapeType,
                row: shapeData.row,
                col: shapeData.col,
                offsetX: shapeData.offsetX || 0,
                offsetY: shapeData.offsetY || 0,
                width: shapeData.width,
                height: shapeData.height,
                fillColor: shapeData.fillColor,
                strokeColor: shapeData.strokeColor,
                strokeWidth: shapeData.strokeWidth,
                opacity: shapeData.opacity,
                rotation: shapeData.rotation || 0,
            };

            if (shapeData.shapeIndex !== null) {
                shape.shapeIndex = shapeData.shapeIndex;
            }

            return await this.apiCall(API.SHAPE, {
                method: 'POST',
                body: {
                    path: this.state.currentFilePath,
                    sheetName: this.currentSheet,
                    shape
                }
            });
        } catch (e) {
            console.error('図形保存エラー:', e);
            return null;
        }
    }

    async deleteShapeFromServer(shapeData) {
        if (!this.state.currentFilePath) return;
        if (shapeData.shapeIndex == null) return;

        try {
            await this.apiCall(API.SHAPE_DELETE, {
                method: 'POST',
                body: {
                    path: this.state.currentFilePath,
                    sheetName: this.currentSheet,
                    shapeIndex: shapeData.shapeIndex
                }
            });
        } catch (e) {
            console.error('図形削除エラー:', e);
        }
    }

    // ============================================================
    // シート切替時の全図形再描画
    // ============================================================

    renderSheetShapes() {
        // 既存の図形要素をクリア
        document.querySelectorAll('.sheet-shape').forEach(el => el.remove());

        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet?.shapes) return;

        sheet.shapes.forEach(shapeData => {
            this.renderSheetShape(shapeData);
        });
    }

};
