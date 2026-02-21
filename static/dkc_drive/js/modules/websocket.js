/**
 * DKCドライブ - WebSocket通信
 */

import { API } from './constants.js';

/**
 * WebSocket通信のミックスイン
 * @param {DKCDrive} Base - 基底クラス
 */
export const WebSocketMixin = (Base) => class extends Base {

    initWebSocket() {
        this.ws = {
            socket: null,
            reconnectAttempts: 0,
            maxReconnectAttempts: 5,
            reconnectDelay: 1000
        };
    }

    connectWebSocket(filePath) {
        if (this.ws.socket?.readyState === WebSocket.OPEN) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/dkc-drive/${encodeURIComponent(filePath)}/`;

        try {
            this.ws.socket = new WebSocket(wsUrl);

            this.ws.socket.onopen = () => {
                this.ws.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
            };

            this.ws.socket.onmessage = e => this.handleWebSocketMessage(JSON.parse(e.data));

            this.ws.socket.onclose = () => {
                this.updateConnectionStatus(false);
                if (this.ws.reconnectAttempts < this.ws.maxReconnectAttempts) {
                    const maxDelay = 30000;
                    const delay = Math.min(this.ws.reconnectDelay * Math.pow(2, this.ws.reconnectAttempts), maxDelay);
                    setTimeout(() => {
                        this.ws.reconnectAttempts++;
                        this.connectWebSocket(filePath);
                    }, delay);
                }
            };

            this.ws.socket.onerror = e => console.error('WebSocket error:', e);
        } catch (e) {
            console.error('WebSocket接続エラー:', e);
        }
    }

    disconnectWebSocket() {
        if (this.ws.socket) {
            this.ws.socket.close();
            this.ws.socket = null;
        }
        this.updateConnectionStatus(false);
    }

    sendWebSocketMessage(message) {
        if (this.ws.socket?.readyState === WebSocket.OPEN) {
            this.ws.socket.send(JSON.stringify(message));
        }
    }

    handleWebSocketMessage(data) {
        if (data.type === 'cell_update') {
            this.applyRemoteChanges(data.changes, data.sheetName);
        } else if (data.type === 'save_complete') {
            this.showSaveIndicator('保存完了');
        } else if (data.type === 'save_error') {
            this.showSaveIndicator('保存エラー', true);
        } else if (data.type === 'merge_update') {
            this.applyRemoteMergeUpdate?.(data.sheetName, data.merges, data.action);
        }
    }

    applyRemoteChanges(changes, sheetName) {
        if (sheetName !== this.currentSheet) return;

        changes.forEach(change => {
            const cell = this.getCell(change.row, change.col);
            if (cell) {
                if (change.value !== undefined) {
                    cell.querySelector('.cell-content').textContent = change.value;
                    cell.querySelector('.cell-input').value = change.value;
                    const data = this.ensureCellData(change.row, change.col);
                    data.value = change.value;
                }
                if (change.style) {
                    this.applyCellStyle(cell, change.style);
                    const data = this.ensureCellData(change.row, change.col);
                    data.style = { ...data.style, ...change.style };
                }
                this.updateTextOverflowForRow?.(change.row, change.col);
            }
        });
    }

    updateConnectionStatus(connected) {
        const el = this.elements.connectionStatus;
        if (!el) return;
        el.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
        el.innerHTML = connected ? '<i class="bi bi-wifi"></i> 接続中' : '<i class="bi bi-wifi-off"></i> 未接続';
    }

    // ===== 保存 =====

    sendChangesToServer(changes) {
        // ファイル変更時はETagキャッシュを破棄
        if (this._etagCache && this.state.currentFilePath) {
            delete this._etagCache[this.state.currentFilePath];
        }
        if (this.ws.socket?.readyState === WebSocket.OPEN) {
            this.sendWebSocketMessage({ type: 'cell_change', sheetName: this.currentSheet, changes });
        } else {
            this.saveChangesViaHttp(changes);
        }

        // テキストオーバーフローを更新
        this._updateTextOverflowForChanges(changes);
    }

    /**
     * 変更されたセルに対してテキストオーバーフローを再計算する
     */
    _updateTextOverflowForChanges(changes) {
        if (!changes?.length || !this.updateTextOverflowForRow) return;
        const updated = new Set();
        for (const { row, col } of changes) {
            const key = `${row},${col}`;
            if (!updated.has(key)) {
                updated.add(key);
                this.updateTextOverflowForRow(row, col);
            }
        }
    }

    async saveChangesViaHttp(changes) {
        try {
            const data = await this.apiCall(API.SAVE, {
                method: 'POST',
                body: { path: this.state.currentFilePath, sheetName: this.currentSheet, changes }
            });
            this.showSaveIndicator(data.status === 'success' ? '保存完了' : '保存エラー', data.status !== 'success');
        } catch (e) {
            this.showSaveIndicator('保存エラー', true);
        }
    }
};
