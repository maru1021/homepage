/**
 * DKCドライブ - シート操作モジュール
 * シートタブ、追加、削除、名前変更などの操作
 */

import { API } from './constants.js';

/**
 * シート操作のミックスイン
 */
export const SheetsMixin = (Base) => class extends Base {

    renderSheetTabs() {
        const tabs = this.elements.sheetTabs;
        tabs.innerHTML = '';

        const fragment = document.createDocumentFragment();

        this.state.sheetNames.forEach(name => {
            const tab = document.createElement('span');
            tab.className = 'sheet-tab';
            if (name === this.currentSheet) tab.classList.add('active');
            tab.textContent = name;
            tab.dataset.sheet = name;
            // インラインスタイルで幅を強制
            tab.style.cssText = 'display: inline-block; width: auto; flex: 0 0 auto;';
            tab.addEventListener('click', () => this.switchSheet(name));
            tab.addEventListener('contextmenu', e => this.showSheetContextMenu(e, name));
            fragment.appendChild(tab);
        });

        const addBtn = document.createElement('span');
        addBtn.className = 'sheet-add-btn';
        addBtn.innerHTML = '+';
        addBtn.title = '新しいシートを追加';
        addBtn.style.cssText = 'display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; cursor: pointer; flex: 0 0 auto;';
        addBtn.addEventListener('click', () => this.addSheet());
        fragment.appendChild(addBtn);

        tabs.appendChild(fragment);
    }

    showSheetContextMenu(e, sheetName) {
        e.preventDefault();
        document.querySelector('.sheet-context-menu')?.remove();

        const menu = document.createElement('div');
        menu.className = 'sheet-context-menu';
        menu.innerHTML = `
            <div class="sheet-context-menu-item" data-action="rename"><i class="bi bi-pencil"></i> 名前を変更</div>
            <div class="sheet-context-menu-item delete" data-action="delete"><i class="bi bi-trash"></i> 削除</div>`;
        menu.style.left = `${e.pageX}px`;
        menu.style.top = `${e.pageY}px`;
        document.body.appendChild(menu);

        menu.querySelectorAll('.sheet-context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                action === 'delete' ? this.deleteSheet(sheetName) : this.renameSheetPrompt(sheetName);
                menu.remove();
            });
        });

        const closeHandler = ev => {
            if (!menu.contains(ev.target)) {
                menu.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    async sheetOperation(action, body, onSuccess) {
        this.showLoading();
        try {
            const data = await this.apiCall(`${API[action.toUpperCase() + '_SHEET']}`, { method: 'POST', body });
            if (data.status === 'success') {
                onSuccess(data);
                this.showSaveIndicator('保存完了');
            } else {
                alert(data.message || `シート${action}に失敗しました`);
            }
        } catch (e) {
            console.error(`シート${action}エラー:`, e);
            alert(`シート${action}に失敗しました`);
        } finally {
            this.hideLoading();
        }
    }

    async addSheet() {
        const sheetName = prompt('新しいシート名を入力してください:', `Sheet${this.state.sheetNames.length + 1}`);
        if (!sheetName) return;
        if (this.state.sheetNames.includes(sheetName)) {
            alert('同じ名前のシートが既に存在します');
            return;
        }

        await this.sheetOperation('add', { path: this.state.currentFilePath, sheetName }, () => {
            this.state.sheetNames.push(sheetName);
            this.state.sheetsData[sheetName] = { cells: {}, colWidths: {}, rowHeights: {} };
            this.renderSheetTabs();
            this.switchSheet(sheetName);
            this.sendWebSocketMessage({ type: 'sheet_add', sheetName });
        });
    }

    async deleteSheet(sheetName) {
        if (this.state.sheetNames.length <= 1) {
            alert('シートは最低1つ必要です');
            return;
        }
        if (!confirm(`シート「${sheetName}」を削除しますか？\nこの操作は元に戻せません。`)) return;

        await this.sheetOperation('delete', { path: this.state.currentFilePath, sheetName }, () => {
            const idx = this.state.sheetNames.indexOf(sheetName);
            this.state.sheetNames.splice(idx, 1);
            delete this.state.sheetsData[sheetName];
            if (this.currentSheet === sheetName) {
                this.currentSheet = this.state.sheetNames[0];
            }
            this.renderSheetTabs();
            this.switchSheet(this.currentSheet);
            this.sendWebSocketMessage({ type: 'sheet_delete', sheetName });
        });
    }

    async renameSheetPrompt(oldSheetName) {
        const newSheetName = prompt('新しいシート名を入力してください:', oldSheetName);
        if (!newSheetName || newSheetName === oldSheetName) return;
        if (this.state.sheetNames.includes(newSheetName)) {
            alert('同じ名前のシートが既に存在します');
            return;
        }

        await this.sheetOperation('rename', { path: this.state.currentFilePath, oldSheetName, newSheetName }, () => {
            const idx = this.state.sheetNames.indexOf(oldSheetName);
            this.state.sheetNames[idx] = newSheetName;
            this.state.sheetsData[newSheetName] = this.state.sheetsData[oldSheetName];
            delete this.state.sheetsData[oldSheetName];
            if (this.currentSheet === oldSheetName) {
                this.currentSheet = newSheetName;
            }
            this.renderSheetTabs();
            this.switchSheet(this.currentSheet);
            this.sendWebSocketMessage({ type: 'sheet_rename', oldSheetName, newSheetName });
        });
    }

    switchSheet(sheetName) {
        this.currentSheet = sheetName;
        document.querySelectorAll('.sheet-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.sheet === sheetName);
        });
        this.renderSpreadsheet();
        this.restoreAutoFilter?.(sheetName);
        // シート上の画像を描画
        this.renderSheetImages?.();
        // シート上の図形を描画
        this.renderSheetShapes?.();
        // シート上のグラフを描画
        this.renderSheetCharts?.();
        // スクロール位置をリセットしてA1セルを選択
        const container = this.elements.spreadsheetContainer;
        if (container) {
            container.scrollTop = 0;
            container.scrollLeft = 0;
        }
        this.clearSelection?.();
        this.selectCell?.(0, 0);
    }
};
