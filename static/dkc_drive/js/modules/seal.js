/**
 * DKCドライブ - スプレッドシート押印機能
 * セル上の右クリックメニューから印鑑画像を挿入
 */

/**
 * 押印機能のミックスイン
 * @param {DKCDrive} Base - 基底クラス
 */
export const SealMixin = (Base) => class extends Base {

    initSeal() {
        const initial = window.DKC_DRIVE_INITIAL || {};
        this.sealState = {
            userSeal: initial.userSeal || '',
            userName: initial.userName || '',
            contextMenu: null,
        };

        this._createCellContextMenu();
        this._initSealEvents();
    }

    /**
     * セル用コンテキストメニューのDOM要素を作成
     */
    _createCellContextMenu() {
        const menu = document.createElement('div');
        menu.className = 'cell-context-menu';
        menu.innerHTML = `
            <div class="cell-context-menu-item" data-action="seal">
                <i class="bi bi-stamp"></i> 押印
            </div>
        `;
        document.body.appendChild(menu);
        this.sealState.contextMenu = menu;

        // メニュー項目のクリック
        menu.querySelector('[data-action="seal"]').addEventListener('click', () => {
            this._closeCellContextMenu();
            this._insertSeal();
        });
    }

    /**
     * イベントリスナーを設定
     */
    _initSealEvents() {
        // スプレッドシートセル上の右クリック
        this.elements.spreadsheet?.addEventListener('contextmenu', e => {
            const td = e.target.closest('td');
            if (!td) return;

            e.preventDefault();

            // 右クリックしたセルの行・列を取得
            const row = td.parentElement.rowIndex - 1;  // thead分を引く
            const col = td.cellIndex - 1;               // 行番号列分を引く
            if (row < 0 || col < 0) return;

            // クリックしたセルを選択状態にする
            this.selectCell(row, col);

            this._showCellContextMenu(e.clientX, e.clientY);
        });

        // クリック外で閉じる
        document.addEventListener('mousedown', e => {
            if (this.sealState.contextMenu && !this.sealState.contextMenu.contains(e.target)) {
                this._closeCellContextMenu();
            }
        });
    }

    /**
     * コンテキストメニューを表示
     */
    _showCellContextMenu(x, y) {
        const menu = this.sealState.contextMenu;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.add('visible');

        // 画面外にはみ出さないよう調整
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - rect.width - 4}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${window.innerHeight - rect.height - 4}px`;
        }
    }

    /**
     * コンテキストメニューを閉じる
     */
    _closeCellContextMenu() {
        this.sealState.contextMenu?.classList.remove('visible');
    }

    /**
     * 押印に使用する名前を取得
     * 優先順位: Employee.seal > ユーザー名から苗字のみ
     */
    _getSealName() {
        // Employee.seal が設定されていればそのまま使う
        if (this.sealState.userSeal) {
            return this.sealState.userSeal;
        }
        // 設定されていなければユーザー名から苗字のみを取り出す
        const userName = this.sealState.userName;
        if (!userName) return '';
        return userName.split(/[\s\u3000]+/)[0] || '';
    }

    /**
     * Canvas で印鑑画像を生成しシートに挿入
     */
    async _insertSeal() {
        const sealName = this._getSealName();
        if (!sealName) {
            this.showSaveIndicator('印鑑名が設定されていません', true);
            return;
        }

        const cells = this.state.selectedCells;
        if (cells.length === 0) {
            this.showSaveIndicator('セルを選択してください', true);
            return;
        }

        const { row, col } = cells[0];

        // Canvas で印鑑画像を生成
        const dataUrl = this._renderSealCanvas(sealName);

        // 画像データを作成（押印メタデータ付き）
        const imageData = {
            imageIndex: null,
            row,
            col,
            offsetX: 0,
            offsetY: 0,
            width: 50,
            height: 50,
            dataUrl,
            imageType: 'seal',
            stampedAt: new Date().toISOString(),
            stampedBy: this.sealState.userName || sealName,
        };

        // 既存の画像挿入パイプラインで保存
        const result = await this.saveImageToServer(imageData);
        if (result && result.imageIndex !== undefined) {
            imageData.imageIndex = result.imageIndex;
            this.addImageToSheet(imageData);
            delete imageData.dataUrl;
            this.showSaveIndicator('押印しました');
        } else {
            this.showSaveIndicator('押印に失敗しました', true);
        }
    }

    /**
     * Canvas API で赤い丸印鑑を描画し DataURL を返す
     * @param {string} sealName - 印鑑に表示する名前
     * @returns {string} PNG DataURL
     */
    _renderSealCanvas(sealName) {
        const logical = 100;   // 論理サイズ（描画座標系）
        const scale = 4;       // 高解像度スケール
        const canvas = document.createElement('canvas');
        canvas.width = logical * scale;
        canvas.height = logical * scale;
        const ctx = canvas.getContext('2d');

        // スケーリングで高解像度化（座標系は logical のまま）
        ctx.scale(scale, scale);

        const cx = logical / 2;
        const cy = logical / 2;
        const radius = 42;
        const sealColor = '#d32f2f';

        // 赤い円（外枠）
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = sealColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        // 名前を姓と名に分割
        const { familyName, givenName } = this._parseSealName(sealName);

        ctx.fillStyle = sealColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 姓を縦書きで描画
        this._drawFamilyName(ctx, cx, cy, familyName, givenName);

        // 名がある場合は右下に小さく描画
        if (givenName) {
            this._drawGivenName(ctx, cx, cy, givenName);
        }

        return canvas.toDataURL('image/png');
    }

    /**
     * 名前を姓と名に分割（半角・全角スペース両対応）
     */
    _parseSealName(name) {
        const parts = name.split(/[\s\u3000]+/);
        return { familyName: parts[0] || '', givenName: parts[1] || '' };
    }

    /**
     * 姓を縦書きで描画
     * seal.css の配置に準拠:
     *   - 名前なし → 中央 (top: 50%)
     *   - 名前あり → やや上 (top: 40%) + 左寄せ
     */
    _drawFamilyName(ctx, cx, cy, familyName, givenName) {
        const len = familyName.length;
        // 名がある場合: CSS の top:40% に相当 → cy を上に10%シフト, 左に少しオフセット
        const baseY = givenName ? cy - 8 : cy;
        const baseX = givenName ? cx - 4 : cx;

        if (len === 1) {
            ctx.font = 'bold 32px sans-serif';
            ctx.fillText(familyName, baseX, baseY);
        } else if (len === 2) {
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText(familyName[0], baseX, baseY - 14);
            ctx.fillText(familyName[1], baseX, baseY + 14);
        } else if (len === 3) {
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText(familyName[0], baseX, baseY - 18);
            ctx.fillText(familyName[1], baseX, baseY);
            ctx.fillText(familyName[2], baseX, baseY + 18);
        } else {
            ctx.font = 'bold 16px sans-serif';
            const step = 16;
            const startY = baseY - ((len - 1) * step) / 2;
            for (let i = 0; i < len; i++) {
                ctx.fillText(familyName[i], baseX, startY + i * step);
            }
        }
    }

    /**
     * 名を小さく右下に描画
     * seal.css: margin-left:100%, margin-top:110% → 苗字の右下
     */
    _drawGivenName(ctx, cx, cy, givenName) {
        ctx.font = 'bold 12px sans-serif';
        const len = Math.min(givenName.length, 2);
        const x = cx + 14;

        if (len === 1) {
            ctx.fillText(givenName[0], x, cy + 16);
        } else {
            ctx.fillText(givenName[0], x, cy + 8);
            ctx.fillText(givenName[1], x, cy + 22);
        }
    }
};
