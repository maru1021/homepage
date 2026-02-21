/**
 * DKCドライブ - ファイル操作・ナビゲーション
 */

import { FILE_TYPES, isSpreadsheetType, API, FILE_MANAGER } from './constants.js';

const PAGE_SIZE = FILE_MANAGER.PAGE_SIZE;

// コンテキストメニュー設定
const CONTEXT_MENUS = {
    folder: 'folder-context-menu',
    file:   'file-context-menu',
    blank:  'blank-context-menu',
    multi:  'multi-context-menu',
};

/**
 * ファイル操作のミックスイン
 * @param {DKCDrive} Base - 基底クラス
 */
export const FileManagerMixin = (Base) => class extends Base {

    initFileManager() {
        this.renameTarget = null;
        this.deleteTarget = null;
        this.contextMenuTarget = null;
        this.moveTarget = null;
        this.moveDestFolder = '';
        this.selectedItems = [];
        this.lastClickedItem = null;

        // コンテキストメニュー一括初期化
        const actionHandlers = {
            folder: a => this.handleFolderContextAction(a),
            file:   a => this.handleFileContextAction(a),
            blank:  a => this.handleBlankContextAction(a),
            multi:  a => this.handleMultiContextAction(a),
        };
        for (const [name, elementId] of Object.entries(CONTEXT_MENUS)) {
            const menu = document.getElementById(elementId);
            this[`${name}ContextMenu`] = menu;
            this._initContextMenuItems(menu, actionHandlers[name]);
        }
        const hideAll = () => this._hideAllMenus();
        document.addEventListener('click', hideAll);
        document.addEventListener('contextmenu', hideAll);

        this.initFileListEvents();
        this.initMoveModal();
        this.initImageAnalysisModal();
    }

    _hideAllMenus() {
        for (const name of Object.keys(CONTEXT_MENUS)) {
            this._hideContextMenu(this[`${name}ContextMenu`]);
        }
    }

    // ===== プライベートヘルパー =====

    _initContextMenuItems(menu, actionHandler) {
        if (!menu) return;
        menu.querySelectorAll('.folder-context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                actionHandler(item.dataset.action);
            });
        });
    }

    _showContextMenu(menu, e, hideMenus = []) {
        e.preventDefault();
        e.stopPropagation();
        hideMenus.forEach(m => this._hideContextMenu(m));

        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.classList.add('visible');

        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${e.clientX - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${e.clientY - rect.height}px`;
        }
    }

    _hideContextMenu(menu) {
        if (menu) menu.classList.remove('visible');
    }

    _handleError(operation, error) {
        console.error(`${operation}に失敗:`, error);
        alert(`${operation}に失敗しました`);
    }

    _resetCurrentFileState() {
        this.disconnectWebSocket();
        if (this.closeChartPanel) this.closeChartPanel();
        Object.assign(this.state, {
            currentFile: null,
            currentFilePath: null,
            currentFileType: null,
            sheetsData: {},
            sheetNames: []
        });
        this.elements.currentFileName.textContent = 'ファイルを選択してください';
        this.elements.btnDownload.disabled = true;
        this.hideAllViewers();
        this.elements.placeholder.style.display = 'block';
    }

    _loadSheetAndConnect(sheets, sheetNames, viewerType, filePath) {
        Object.assign(this.state, { sheetsData: sheets, sheetNames });
        this.showViewer(viewerType);
        this.renderSheetTabs();
        if (sheetNames.length > 0) {
            this.switchSheet(sheetNames[0]);
        }
        requestAnimationFrame(() => this.connectWebSocket(filePath));
    }

    _buildBreadcrumb(container, folderPath, onNavigate) {
        container.innerHTML = '';

        const createItem = (path, text, isActive, icon) => {
            const item = document.createElement('span');
            item.className = `breadcrumb-item${isActive ? ' active' : ''}`;
            item.dataset.path = path;
            item.innerHTML = icon ? `<i class="bi ${icon}"></i> ${text}` : text;
            if (!isActive) {
                item.style.cursor = 'pointer';
                item.addEventListener('click', () => onNavigate(path));
            }
            return item;
        };

        container.appendChild(createItem('', 'ルート', !folderPath, 'bi-folder2'));

        if (folderPath) {
            let currentPath = '';
            folderPath.split('/').filter(Boolean).forEach((part, i, arr) => {
                currentPath += (currentPath ? '/' : '') + part;
                const sep = document.createElement('span');
                sep.className = 'breadcrumb-separator';
                sep.textContent = '/';
                container.appendChild(sep);
                container.appendChild(createItem(currentPath, part, i === arr.length - 1));
            });
        }
    }

    // ===== フォルダコンテキストメニュー =====

    showFolderContextMenu(e, folderPath, folderName) {
        this.contextMenuTarget = { path: folderPath, name: folderName };
        this._showContextMenu(this.folderContextMenu, e, [this.blankContextMenu, this.fileContextMenu]);
    }

    hideFolderContextMenu() {
        this._hideContextMenu(this.folderContextMenu);
    }

    handleFolderContextAction(action) {
        this.hideFolderContextMenu();

        if (!this.contextMenuTarget) return;
        const { path, name, type } = this.contextMenuTarget;

        switch (action) {
            case 'open':
                this.navigateToFolder(path);
                break;
            case 'analyze':
                this.openFolderAnalysis(path, name);
                break;
            case 'image-analysis':
                this.startImageAnalysis(path, name);
                break;
            case 'move':
                this.showMoveModal(path, name, type || 'folder');
                break;
            case 'rename':
                this.showRenameModal(path, name, 'folder');
                break;
            case 'delete':
                this.showDeleteConfirm(path, name, 'folder');
                break;
        }

        this.contextMenuTarget = null;
    }

    openFolderAnalysis(folderPath, folderName) {
        // chart.jsのフォルダ解析機能を呼び出す
        if (this.showFolderAnalysisModal) {
            this.showFolderAnalysisModal(folderPath, folderName);
        }
    }

    initImageAnalysisModal() {
        const el = document.getElementById('imageAnalysisModal');
        if (!el) return;
        this._ia = {
            modal:      new bootstrap.Modal(el),
            loading:    document.getElementById('imageAnalysisLoading'),
            result:     document.getElementById('imageAnalysisResult'),
            error:      document.getElementById('imageAnalysisError'),
            errorMsg:   document.getElementById('imageAnalysisErrorMsg'),
            summary:    document.getElementById('imageAnalysisSummary'),
            table:      document.getElementById('imageAnalysisTable'),
            folderName: document.getElementById('imageAnalysisFolderName'),
            btnOpen:    document.getElementById('btnOpenResultFolder'),
        };
    }

    async startImageAnalysis(folderPath, folderName) {
        const ia = this._ia;

        // 初期化
        ia.loading.style.display = '';
        ia.result.style.display = 'none';
        ia.error.style.display = 'none';
        ia.btnOpen.style.display = 'none';
        ia.folderName.textContent = folderName;
        ia.modal.show();

        try {
            const data = await this.apiCall(API.IMAGE_ANALYSIS, {
                method: 'POST',
                body: { folder: folderPath },
            });

            ia.loading.style.display = 'none';

            if (data.status === 'success') {
                this._renderImageAnalysisResult(data);
            } else {
                ia.errorMsg.textContent = data.message || '判定に失敗しました';
                ia.error.style.display = '';
            }
        } catch (e) {
            ia.loading.style.display = 'none';
            ia.errorMsg.textContent = e.message || '通信エラーが発生しました';
            ia.error.style.display = '';
        }
    }

    _renderImageAnalysisResult(data) {
        const ia = this._ia;
        const BADGE = { 'OK': 'bg-success', 'NG': 'bg-danger' };
        const ICON  = { 'OK': 'bi-check-circle-fill text-success', 'NG': 'bi-x-circle-fill text-danger' };

        // サマリーカード（OK / NG / 合計）
        ia.summary.innerHTML = data.summary.map(g => `
            <div class="col text-center">
                <div class="border rounded p-2">
                    <i class="bi ${ICON[g.label] || 'bi-folder-fill text-secondary'}" style="font-size:1.5rem"></i>
                    <div class="fw-bold fs-4">${g.count}</div>
                    <small class="text-muted">${this.escapeHtml(g.label)}</small>
                </div>
            </div>`).join('') + `
            <div class="col text-center">
                <div class="border rounded p-2">
                    <i class="bi bi-images text-dark" style="font-size:1.5rem"></i>
                    <div class="fw-bold fs-4">${data.total}</div>
                    <small class="text-muted">合計</small>
                </div>
            </div>`;

        // 詳細テーブル（行クリックで画像を新しいタブに表示）
        ia.table.innerHTML = data.results.map(r => {
            const badge = BADGE[r.judgment] || 'bg-secondary';
            const label = r.error ? 'エラー' : r.judgment;
            const viewFile = r.defectImage || r.name;
            const imgPath = r.error ? '' : `${data.resultFolder}/${r.judgment}/${viewFile}`;
            const rowAttr = imgPath ? ` class="image-judge-row" style="cursor:pointer" data-img-path="${this.escapeHtml(imgPath)}"` : '';
            const icon = r.defectImage ? ' <i class="bi bi-search text-danger" title="欠陥箇所マーキング"></i>' : '';
            return `<tr${rowAttr}>
                <td>${this.escapeHtml(r.name)}${icon}</td>
                <td><span class="badge ${badge}">${label}</span></td>
                <td>${r.confidence}%</td>
            </tr>`;
        }).join('');

        ia.table.addEventListener('click', e => {
            const row = e.target.closest('.image-judge-row');
            if (row?.dataset.imgPath) {
                window.open(`${API.SERVE}${encodeURI(row.dataset.imgPath)}`, '_blank');
            }
        });

        ia.result.style.display = '';

        // 結果フォルダを開くボタン
        ia.btnOpen.style.display = '';
        ia.btnOpen.onclick = () => {
            ia.modal.hide();
            this.navigateToFolder(data.resultFolder);
        };
    }

    // ===== ファイルコンテキストメニュー =====

    showFileContextMenu(e, filePath, fileName, fileType) {
        this.contextMenuTarget = { path: filePath, name: fileName, type: 'file', fileType };
        this._showContextMenu(this.fileContextMenu, e, [this.blankContextMenu, this.folderContextMenu]);
    }

    hideFileContextMenu() {
        this._hideContextMenu(this.fileContextMenu);
    }

    handleFileContextAction(action) {
        this.hideFileContextMenu();

        if (!this.contextMenuTarget) return;
        const { path, name, fileType } = this.contextMenuTarget;

        switch (action) {
            case 'open':
                this.openFile(path, name, fileType);
                break;
            case 'move':
                this.showMoveModal(path, name, 'file');
                break;
            case 'rename':
                this.showRenameModal(path, name, 'file');
                break;
            case 'delete':
                this.showDeleteConfirm(path, name, 'file');
                break;
        }

        this.contextMenuTarget = null;
    }

    // ===== 空白エリアコンテキストメニュー =====

    showBlankContextMenu(e) {
        this._showContextMenu(this.blankContextMenu, e, [this.folderContextMenu, this.fileContextMenu]);
    }

    hideBlankContextMenu() {
        this._hideContextMenu(this.blankContextMenu);
    }

    handleBlankContextAction(action) {
        this.hideBlankContextMenu();

        switch (action) {
            case 'upload':
                this.elements.fileUpload.click();
                break;
            case 'upload-folder':
                this.elements.folderUpload.click();
                break;
            case 'new-file':
                this.elements.newFileModal.show();
                break;
            case 'new-folder':
                this.elements.newFolderModal.show();
                break;
        }
    }

    // ===== 複数選択 =====

    clearFileSelection() {
        this.selectedItems = [];
        this.elements.fileList.querySelectorAll('.file-item.selected').forEach(el => el.classList.remove('selected'));
    }

    toggleSelectItem(el) {
        const path = el.dataset.path;
        const idx = this.selectedItems.findIndex(item => item.path === path);
        if (idx >= 0) {
            this.selectedItems.splice(idx, 1);
            el.classList.remove('selected');
        } else {
            this.selectedItems.push({ path: el.dataset.path, name: el.dataset.name, type: el.dataset.type });
            el.classList.add('selected');
        }
    }

    selectRange(targetEl) {
        const items = [...this.elements.fileList.querySelectorAll('.file-item')];
        const lastIdx = this.lastClickedItem ? items.indexOf(this.lastClickedItem) : 0;
        const curIdx = items.indexOf(targetEl);
        if (lastIdx < 0 || curIdx < 0) return;

        const start = Math.min(lastIdx, curIdx);
        const end = Math.max(lastIdx, curIdx);

        // 前の選択をクリアしてから範囲選択
        this.clearFileSelection();
        for (let i = start; i <= end; i++) {
            const el = items[i];
            if (!el.classList.contains('selected')) {
                this.selectedItems.push({ path: el.dataset.path, name: el.dataset.name, type: el.dataset.type });
                el.classList.add('selected');
            }
        }
    }

    // ===== 複数選択コンテキストメニュー =====

    showMultiContextMenu(e) {
        this._showContextMenu(this.multiContextMenu, e, [this.folderContextMenu, this.fileContextMenu, this.blankContextMenu]);
    }

    hideMultiContextMenu() {
        this._hideContextMenu(this.multiContextMenu);
    }

    handleMultiContextAction(action) {
        this.hideMultiContextMenu();
        if (!this.selectedItems.length) return;

        switch (action) {
            case 'move':
                this.showMultiMoveModal();
                break;
            case 'delete':
                this.showMultiDeleteConfirm();
                break;
        }
    }

    showMultiDeleteConfirm() {
        const count = this.selectedItems.length;
        this.elements.deleteFilename.textContent = `${count}件のアイテム`;
        this.deleteTarget = { multi: true, items: [...this.selectedItems] };
        this.elements.deleteModal.show();
    }

    showMultiMoveModal() {
        this.moveTarget = { multi: true, items: [...this.selectedItems] };
        this.moveDestFolder = '';

        const names = this.moveTarget.items.map(i => {
            const icon = i.type === 'folder' ? 'bi-folder-fill' : 'bi-file-earmark';
            return `<div><i class="bi ${icon}"></i> ${i.name}</div>`;
        }).join('');
        this.moveItemName.innerHTML = names;

        this.loadMoveFolderList('');
        this.moveModal.show();
    }

    // ===== 移動モーダル =====

    initMoveModal() {
        this.moveModal = new bootstrap.Modal(document.getElementById('moveModal'));
        this.moveItemName = document.getElementById('move-item-name');
        this.moveBreadcrumb = document.getElementById('move-breadcrumb');
        this.moveFolderList = document.getElementById('move-folder-list');

        // 移動確定ボタン
        document.getElementById('btn-confirm-move')?.addEventListener('click', () => this.confirmMove());
    }

    async showMoveModal(path, name, type) {
        this.moveTarget = { path, name, type };
        this.moveDestFolder = '';

        // 移動するアイテム名を表示
        const icon = type === 'folder' ? 'bi-folder-fill' : 'bi-file-earmark';
        this.moveItemName.innerHTML = `<i class="bi ${icon}"></i> ${name}`;

        // フォルダ一覧を読み込み
        await this.loadMoveFolderList('');

        this.moveModal.show();
    }

    async loadMoveFolderList(folderPath) {
        this.moveDestFolder = folderPath;

        // パンくずリストを更新
        this.updateMoveBreadcrumb(folderPath);

        try {
            const params = new URLSearchParams({ limit: '10000' });
            if (folderPath) params.set('folder', folderPath);
            const url = `${API.LIST}?${params}`;
            const data = await fetch(url).then(r => r.json());

            this.moveFolderList.innerHTML = '';

            // フォルダのみ表示（移動対象自身は除外）
            const excludePaths = this.moveTarget?.multi
                ? new Set(this.moveTarget.items.map(i => i.path))
                : new Set(this.moveTarget?.path ? [this.moveTarget.path] : []);
            const folders = data.items.filter(item =>
                item.type === 'folder' && !excludePaths.has(item.path)
            );

            if (folders.length === 0) {
                this.moveFolderList.innerHTML = `
                    <div class="text-center text-muted p-3">
                        <i class="bi bi-folder2-open"></i>
                        <small>サブフォルダがありません</small>
                    </div>`;
                return;
            }

            folders.forEach(folder => {
                const el = document.createElement('div');
                el.className = 'move-folder-item';
                el.innerHTML = `<i class="bi bi-folder-fill"></i> ${folder.name}`;
                el.addEventListener('click', () => this.loadMoveFolderList(folder.path));
                this.moveFolderList.appendChild(el);
            });
        } catch (e) {
            console.error('フォルダ一覧の取得に失敗:', e);
            this.moveFolderList.innerHTML = `
                <div class="text-center text-danger p-3">
                    <i class="bi bi-exclamation-triangle"></i>
                    <small>読み込みに失敗しました</small>
                </div>`;
        }
    }

    updateMoveBreadcrumb(folderPath) {
        this._buildBreadcrumb(this.moveBreadcrumb, folderPath, path => this.loadMoveFolderList(path));
    }

    async confirmMove() {
        if (!this.moveTarget) return;

        // 複数選択移動
        if (this.moveTarget.multi) {
            const items = this.moveTarget.items;
            this.showLoading();
            this.moveModal.hide();

            try {
                let movedCount = 0;
                for (const item of items) {
                    const currentFolder = item.path.includes('/') ? item.path.substring(0, item.path.lastIndexOf('/')) : '';
                    if (currentFolder === this.moveDestFolder) continue;
                    if (item.type === 'folder' && this.moveDestFolder.startsWith(item.path + '/')) continue;

                    const data = await this.apiCall(API.MOVE, {
                        method: 'POST',
                        body: { path: item.path, destFolder: this.moveDestFolder, type: item.type }
                    });
                    if (data.status === 'success') {
                        if (this.state.currentFilePath === item.path) {
                            this.state.currentFilePath = data.newPath;
                        }
                        movedCount++;
                    }
                }
                this.clearFileSelection();
                await this.loadFileList();
                if (movedCount > 0) this.showSaveIndicator(`${movedCount}件を移動しました`);
            } catch (e) {
                this._handleError('移動', e);
            } finally {
                this.hideLoading();
                this.moveTarget = null;
            }
            return;
        }

        const { path, name, type } = this.moveTarget;

        // 同じ場所への移動はスキップ
        const currentFolder = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
        if (currentFolder === this.moveDestFolder) {
            this.moveModal.hide();
            return;
        }

        // フォルダを自分自身のサブフォルダに移動しようとしている場合はエラー
        if (type === 'folder' && this.moveDestFolder.startsWith(path + '/')) {
            alert('フォルダを自分自身のサブフォルダに移動することはできません');
            return;
        }

        this.showLoading();
        this.moveModal.hide();

        try {
            const data = await this.apiCall(API.MOVE, {
                method: 'POST',
                body: {
                    path: path,
                    destFolder: this.moveDestFolder,
                    type: type
                }
            });

            if (data.status === 'success') {
                // 現在開いているファイルが移動された場合
                if (this.state.currentFilePath === path) {
                    this.state.currentFilePath = data.newPath;
                }
                await this.loadFileList();
                this.showSaveIndicator(`${name} を移動しました`);
            } else {
                alert(data.message);
            }
        } catch (e) {
            console.error('移動に失敗:', e);
            alert('移動に失敗しました');
        } finally {
            this.hideLoading();
            this.moveTarget = null;
        }
    }

    // ===== ファイルリスト イベント委譲・無限スクロール =====

    initFileListEvents() {
        const fileList = this.elements.fileList;
        if (!fileList) return;

        this._initFileClickEvents(fileList);
        this._initFileContextMenuEvents(fileList);
        this._initInfiniteScroll(fileList);
        this._initFileSearch();
        this.initDragSelect(fileList);
    }

    _initFileClickEvents(fileList) {
        // mousedown: Ctrl/Shift なしの左クリックで選択解除（clickより先に確実に発火する）
        fileList.addEventListener('mousedown', e => {
            if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
            if (e.target.closest('.btn-rename') || e.target.closest('.btn-delete')) return;
            this.clearFileSelection();
        });

        // クリック: イベント委譲（アイテムクリック・リネーム・削除を一括処理）
        fileList.addEventListener('click', e => {
            if (this._dragJustEnded) return;

            const btnRename = e.target.closest('.btn-rename');
            if (btnRename) {
                e.stopPropagation();
                const el = btnRename.closest('.file-item');
                if (el) this.showRenameModal(el.dataset.path, el.dataset.name, el.dataset.type);
                return;
            }
            const btnDelete = e.target.closest('.btn-delete');
            if (btnDelete) {
                e.stopPropagation();
                const el = btnDelete.closest('.file-item');
                if (el) this.showDeleteConfirm(el.dataset.path, el.dataset.name, el.dataset.type);
                return;
            }
            const el = e.target.closest('.file-item');
            if (!el) return;

            if (e.ctrlKey || e.metaKey) {
                this.toggleSelectItem(el);
                this.lastClickedItem = el;
                return;
            }
            if (e.shiftKey) {
                this.selectRange(el);
                return;
            }

            this.lastClickedItem = el;
            const { path, type, name, fileType } = el.dataset;
            if (type === 'folder') {
                this.navigateToFolder(path);
            } else {
                this.openFile(path, name, fileType);
            }
        });
    }

    _initFileContextMenuEvents(fileList) {
        fileList.addEventListener('contextmenu', e => {
            const el = e.target.closest('.file-item');
            if (!el) {
                this.clearFileSelection();
                this.showBlankContextMenu(e);
                return;
            }

            if (this.selectedItems.length > 1) {
                const path = el.dataset.path;
                if (this.selectedItems.some(item => item.path === path)) {
                    this.showMultiContextMenu(e);
                    return;
                }
            }

            this.clearFileSelection();
            const { path, type, name, fileType } = el.dataset;
            if (type === 'folder') {
                this.showFolderContextMenu(e, path, name);
            } else {
                this.showFileContextMenu(e, path, name, fileType);
            }
        });
    }

    _initInfiniteScroll(fileList) {
        fileList.addEventListener('scroll', () => {
            if (this.state.isLoadingMore) return;
            if (this.state.fileListOffset >= this.state.fileListTotal) return;

            const { scrollTop, scrollHeight, clientHeight } = fileList;
            if (scrollTop + clientHeight >= scrollHeight - 100) {
                this.state.isLoadingMore = true;
                this.loadFileList(true).finally(() => {
                    this.state.isLoadingMore = false;
                });
            }
        });
    }

    _initFileSearch() {
        const searchInput = this.elements.fileSearchInput;
        const searchClear = this.elements.fileSearchClear;
        if (searchInput) {
            let searchTimer = null;
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    this.state.fileSearchQuery = searchInput.value.trim();
                    searchClear.style.display = this.state.fileSearchQuery ? '' : 'none';
                    this.loadFileList();
                }, 300);
            });
        }
        if (searchClear) {
            searchClear.addEventListener('click', () => {
                searchInput.value = '';
                this.state.fileSearchQuery = '';
                searchClear.style.display = 'none';
                this.loadFileList();
            });
        }
    }

    initDragSelect(fileList) {
        const rect = document.createElement('div');
        rect.className = 'drag-select-rect';
        fileList.appendChild(rect);

        let dragging = false;
        let dragActive = false;
        let startX = 0;
        let startY = 0;
        this._dragJustEnded = false;

        fileList.addEventListener('mousedown', e => {
            // file-item上やボタン上では開始しない（空白エリアのみ）
            if (e.target.closest('.file-item') || e.button !== 0) return;

            dragging = true;
            dragActive = false;
            const listRect = fileList.getBoundingClientRect();
            startX = e.clientX - listRect.left + fileList.scrollLeft;
            startY = e.clientY - listRect.top + fileList.scrollTop;

            rect.style.left = `${startX}px`;
            rect.style.top = `${startY}px`;
            rect.style.width = '0';
            rect.style.height = '0';
            rect.style.display = 'none';

            e.preventDefault();
        });

        document.addEventListener('mousemove', e => {
            if (!dragging) return;

            const listRect = fileList.getBoundingClientRect();
            const curX = e.clientX - listRect.left + fileList.scrollLeft;
            const curY = e.clientY - listRect.top + fileList.scrollTop;

            const w = Math.abs(curX - startX);
            const h = Math.abs(curY - startY);

            // 一定距離以上動いたらドラッグ開始
            if (!dragActive && (w > 5 || h > 5)) {
                dragActive = true;
                if (!e.ctrlKey && !e.metaKey) this.clearFileSelection();
            }

            if (!dragActive) return;

            const x = Math.min(startX, curX);
            const y = Math.min(startY, curY);

            rect.style.left = `${x}px`;
            rect.style.top = `${y}px`;
            rect.style.width = `${w}px`;
            rect.style.height = `${h}px`;
            rect.style.display = 'block';
            this.updateDragSelection(fileList, x, y, w, h);
        });

        document.addEventListener('mouseup', () => {
            if (!dragging) return;
            const wasDragActive = dragActive;
            dragging = false;
            dragActive = false;
            rect.style.display = 'none';
            if (wasDragActive) {
                // ドラッグ直後のclickイベントを無視するためフラグを短時間立てる
                this._dragJustEnded = true;
                setTimeout(() => { this._dragJustEnded = false; }, 50);
            }
        });
    }

    updateDragSelection(fileList, rx, ry, rw, rh) {
        const items = fileList.querySelectorAll('.file-item');
        this.selectedItems = [];
        items.forEach(el => {
            const elTop = el.offsetTop;
            const elLeft = el.offsetLeft;
            const elBottom = elTop + el.offsetHeight;
            const elRight = elLeft + el.offsetWidth;

            const intersects = !(elRight < rx || elLeft > rx + rw || elBottom < ry || elTop > ry + rh);

            if (intersects) {
                el.classList.add('selected');
                this.selectedItems.push({ path: el.dataset.path, name: el.dataset.name, type: el.dataset.type });
            } else {
                el.classList.remove('selected');
            }
        });
    }

    // ===== ナビゲーション =====

    updateBreadcrumb() {
        const bc = this.elements.breadcrumb;
        this._buildBreadcrumb(bc, this.state.currentFolder, path => this.navigateToFolder(path));
        requestAnimationFrame(() => { bc.scrollLeft = bc.scrollWidth; });
    }

    async navigateToFolder(path) {
        this.state.currentFolder = path;
        // 検索クエリをクリア
        this.state.fileSearchQuery = '';
        if (this.elements.fileSearchInput) this.elements.fileSearchInput.value = '';
        if (this.elements.fileSearchClear) this.elements.fileSearchClear.style.display = 'none';
        if (this.state.currentFilePath) {
            this._resetCurrentFileState();
        }
        await this.loadFileList();
        this.updateURL();
    }

    async loadFileList(append = false) {
        try {
            if (!append) {
                this.state.fileListOffset = 0;
            }

            let data;
            const initial = window.DKC_DRIVE_INITIAL;
            if (!append && initial?.fileList && !this.state.fileSearchQuery) {
                data = initial.fileList;
                initial.fileList = null;
            } else {
                const params = new URLSearchParams();
                if (this.state.currentFolder) params.set('folder', this.state.currentFolder);
                if (this.state.fileSearchQuery) params.set('search', this.state.fileSearchQuery);
                params.set('offset', this.state.fileListOffset);
                params.set('limit', PAGE_SIZE);

                const url = `${API.LIST}?${params}`;
                data = await fetch(url).then(r => r.json());
            }

            if (!append) {
                this.updateBreadcrumb();
                this.elements.fileList.innerHTML = '';
            }

            this.state.fileListTotal = data.totalCount;

            if (data.totalCount === 0 && !append) {
                if (this.state.fileSearchQuery) {
                    this.elements.fileList.innerHTML = `<div class="text-center text-muted p-4"><i class="bi bi-search d-block mb-2" style="font-size: 2rem;"></i><small>「${this.escapeHtml(this.state.fileSearchQuery)}」に一致するファイルがありません</small></div>`;
                } else {
                    this.elements.fileList.innerHTML = `<div class="text-center text-muted p-4"><i class="bi bi-folder2-open d-block mb-2" style="font-size: 2rem;"></i><small>ファイルがありません</small></div>`;
                }
                return;
            }

            const fragment = document.createDocumentFragment();
            data.items.forEach(item => this.renderFileItem(item, fragment));
            this.elements.fileList.appendChild(fragment);

            this.state.fileListOffset += data.items.length;

            if (!append && this.initialFilePath) {
                const fileName = this.initialFilePath.split('/').pop();
                const fileType = this.getFileType(fileName);
                await this.openFile(this.initialFilePath, fileName, fileType);
                this.initialFilePath = '';
            }
        } catch (e) {
            console.error('ファイル一覧の取得に失敗:', e);
        }
    }

    renderFileItem(item, container) {
        const el = document.createElement('div');
        el.className = 'file-item';
        Object.assign(el.dataset, { path: item.path, type: item.type, name: item.name });
        if (item.fileType) el.dataset.fileType = item.fileType;

        const isFolder = item.type === 'folder';
        const icon = isFolder ? 'bi-folder-fill file-item-icon folder-icon' : (item.icon || 'bi-file-earmark') + ' file-item-icon';
        let meta = isFolder ? 'フォルダ' : `${this.formatFileSize(item.size)} · ${this.formatDate(item.modified)}`;
        // 検索結果でlocationがある場合、所在パスを表示
        if (item.location != null) {
            const loc = item.location || 'ルート';
            meta = `<i class="bi bi-folder2" style="font-size:0.7rem"></i> ${this.escapeHtml(loc)}` + (isFolder ? '' : ` · ${meta}`);
        }

        el.innerHTML = `
            <i class="bi ${icon}"></i>
            <div class="file-item-info"><div class="file-item-name">${item.name}</div><div class="file-item-meta">${meta}</div></div>
            <div class="file-item-actions">
                <button class="btn-rename" title="名前を変更"><i class="bi bi-pencil"></i></button>
                <button class="btn-delete" title="削除"><i class="bi bi-trash"></i></button>
            </div>`;

        (container || this.elements.fileList).appendChild(el);
    }

    // ===== ファイル操作 =====

    async handleUpload(e) {
        const files = e.target.files;
        if (!files?.length) return;

        this.showLoading();
        const formData = new FormData();
        for (const file of files) formData.append('file', file);
        formData.append('folder', this.state.currentFolder);

        try {
            const response = await fetch(API.UPLOAD, {
                method: 'POST',
                headers: { 'X-CSRFToken': this.getCSRFToken() },
                body: formData
            });
            const data = await response.json();
            if (data.status === 'success') {
                await this.loadFileList();
                if (data.path) await this.openFile(data.path, data.filename, data.fileType);
            } else {
                alert(data.message);
            }
        } catch (e) {
            this._handleError('アップロード', e);
        } finally {
            this.hideLoading();
            e.target.value = '';
        }
    }

    async handleFolderUpload(e) {
        const fileList = e.target.files;
        if (!fileList?.length) return;

        // ファイルを配列にコピー（inputリセット前に実行必須）
        const files = Array.from(fileList);
        const totalFiles = files.length;

        // フォルダ名を取得（最初のファイルのパスから）
        const firstPath = files[0].webkitRelativePath;
        const folderName = firstPath.split('/')[0];

        // 入力をリセット（連続アップロード可能に）
        e.target.value = '';

        // 楽観的にフォルダを表示（プレースホルダー）
        this.showUploadingFolder(folderName, totalFiles);

        // プログレスモーダルを表示
        this.showUploadProgress(folderName, totalFiles);

        // バックグラウンドでアップロード開始（バッチ分割版）
        this.startBatchUpload(files, folderName, totalFiles);
    }

    /**
     * アップロード中のフォルダをプレースホルダーとして表示
     */
    showUploadingFolder(folderName, totalFiles) {
        // 既存のプレースホルダーがあれば削除
        const existingEl = document.getElementById(`uploading-${CSS.escape(folderName)}`);
        if (existingEl) existingEl.remove();

        const el = document.createElement('div');
        el.className = 'file-item uploading-folder';
        el.id = `uploading-${folderName}`;
        el.innerHTML = `
            <i class="bi bi-folder-fill file-item-icon folder-icon uploading"></i>
            <div class="file-item-info">
                <div class="file-item-name">${this.escapeHtml(folderName)}</div>
                <div class="file-item-meta uploading-status">
                    <span class="spinner-border spinner-border-sm me-1"></span>
                    準備中... (${totalFiles}ファイル)
                </div>
            </div>`;

        // ファイルリストの先頭に挿入
        const firstItem = this.elements.fileList.querySelector('.file-item');
        if (firstItem) {
            this.elements.fileList.insertBefore(el, firstItem);
        } else {
            this.elements.fileList.appendChild(el);
        }
    }

    /**
     * アップロード進捗モーダルを表示
     */
    showUploadProgress(folderName, totalFiles) {
        // 既存のモーダルがあれば削除
        let modal = document.getElementById('upload-progress-modal');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = 'upload-progress-modal';
        modal.className = 'upload-progress-modal';
        modal.innerHTML = `
            <div class="upload-progress-content">
                <div class="upload-progress-header">
                    <i class="bi bi-cloud-upload"></i>
                    <span>フォルダをアップロード中</span>
                    <button class="btn-close-progress" onclick="this.closest('.upload-progress-modal').classList.add('minimized')">
                        <i class="bi bi-dash"></i>
                    </button>
                </div>
                <div class="upload-progress-body">
                    <div class="upload-folder-name">${this.escapeHtml(folderName)}</div>
                    <div class="upload-progress-bar">
                        <div class="upload-progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="upload-progress-text">
                        <span class="uploaded-count">0</span> / <span class="total-count">${totalFiles}</span> ファイル
                    </div>
                    <div class="upload-speed"></div>
                </div>
            </div>`;

        document.body.appendChild(modal);

        // 最小化されている場合は復元できるようにする
        modal.addEventListener('click', (e) => {
            if (modal.classList.contains('minimized')) {
                modal.classList.remove('minimized');
            }
        });
    }

    /**
     * 進捗を更新
     */
    updateUploadProgress(uploaded, total, folderName) {
        const modal = document.getElementById('upload-progress-modal');
        if (!modal) return;

        const percent = Math.round((uploaded / total) * 100);
        const fill = modal.querySelector('.upload-progress-fill');
        const uploadedCount = modal.querySelector('.uploaded-count');

        if (fill) fill.style.width = `${percent}%`;
        if (uploadedCount) uploadedCount.textContent = uploaded;

        // プレースホルダーの状態も更新
        const placeholder = document.getElementById(`uploading-${folderName}`);
        if (placeholder) {
            const status = placeholder.querySelector('.uploading-status');
            if (status) {
                status.innerHTML = `
                    <span class="spinner-border spinner-border-sm me-1"></span>
                    アップロード中... ${uploaded}/${total} (${percent}%)`;
            }
        }
    }

    /**
     * バッチ分割アップロードを開始
     * ファイルをバッチに分割し、並列でサーバーに送信
     */
    async startBatchUpload(files, folderName, totalFiles) {
        const BATCH_SIZE = 50;
        const PARALLEL_BATCHES = 3;

        let uploadedCount = 0;
        let rejectedCount = 0;
        const startTime = Date.now();

        // ファイルをバッチに分割
        const batches = [];
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            batches.push(files.slice(i, i + BATCH_SIZE));
        }

        // バッチを処理する関数
        const processBatch = async (batch) => {
            const formData = new FormData();
            for (const file of batch) {
                formData.append('file', file);
                formData.append('relativePath', file.webkitRelativePath);
            }
            formData.append('folder', this.state.currentFolder);

            try {
                const response = await fetch(API.UPLOAD_FOLDER, {
                    method: 'POST',
                    headers: { 'X-CSRFToken': this.getCSRFToken() },
                    body: formData
                });
                const data = await response.json();
                if (data.status === 'success') {
                    return { uploaded: data.uploadedCount || batch.length, rejected: data.rejectedCount || 0 };
                }
                return { uploaded: 0, rejected: batch.length };
            } catch {
                return { uploaded: 0, rejected: batch.length };
            }
        };

        // 並列でバッチを処理（同時実行数を制限）
        const queue = [...batches];
        const running = new Set();

        const runNext = async () => {
            if (queue.length === 0) return;
            const batch = queue.shift();
            const promise = processBatch(batch).then(result => {
                uploadedCount += result.uploaded;
                rejectedCount += result.rejected;
                this.updateUploadProgress(uploadedCount, totalFiles, folderName);
                running.delete(promise);
            });
            running.add(promise);
            return promise;
        };

        // 初期ワーカーを起動
        const initialPromises = [];
        for (let i = 0; i < Math.min(PARALLEL_BATCHES, batches.length); i++) {
            initialPromises.push(runNext());
        }

        // キューが空になるまで処理
        while (queue.length > 0 || running.size > 0) {
            await Promise.race([...running]);
            while (running.size < PARALLEL_BATCHES && queue.length > 0) {
                runNext();
            }
        }

        // 全完了を待機
        await Promise.all([...running]);

        const elapsed = (Date.now() - startTime) / 1000;
        this.completeUpload(folderName, uploadedCount, rejectedCount, elapsed);
    }

    /**
     * アップロード完了処理
     */
    async completeUpload(folderName, uploadedCount, rejectedCount, elapsed) {
        // プレースホルダーを削除
        const placeholder = document.getElementById(`uploading-${folderName}`);
        if (placeholder) placeholder.remove();

        // 進捗モーダルを完了状態に
        const modal = document.getElementById('upload-progress-modal');
        if (modal) {
            const body = modal.querySelector('.upload-progress-body');
            const header = modal.querySelector('.upload-progress-header span');
            if (header) header.textContent = 'アップロード完了';
            if (body) {
                body.innerHTML = `
                    <div class="upload-complete">
                        <i class="bi bi-check-circle-fill text-success"></i>
                        <div class="upload-complete-text">
                            ${uploadedCount}件のファイルをアップロードしました
                            ${rejectedCount > 0 ? `<br><small class="text-warning">${rejectedCount}件がスキップされました</small>` : ''}
                            <br><small class="text-muted">(${elapsed.toFixed(1)}秒)</small>
                        </div>
                    </div>`;
            }

            // 3秒後に自動で閉じる
            setTimeout(() => {
                modal.classList.add('fade-out');
                setTimeout(() => modal.remove(), 300);
            }, 3000);
        }

        // ファイルリストを更新
        await this.loadFileList();
        this.showSaveIndicator(`${uploadedCount}件のファイルをアップロードしました`);
    }

    async createNewFile() {
        const filename = this.elements.newFilename.value.trim() || '新規ファイル';
        const ext = this.elements.newFileExt.value;
        this.showLoading();
        this.elements.newFileModal.hide();

        try {
            const data = await this.apiCall(API.CREATE, {
                method: 'POST',
                body: { filename, ext, folder: this.state.currentFolder }
            });
            if (data.status === 'success') {
                await this.loadFileList();
                // スプレッドシート系のみ開く
                const extToType = {
                    '.xlsx': FILE_TYPES.EXCEL,
                    '.csv': FILE_TYPES.CSV,
                    '.txt': FILE_TYPES.TEXT,
                    '.html': FILE_TYPES.HTML
                };
                const fileType = extToType[ext] || FILE_TYPES.OTHER;
                await this.openFile(data.path, data.filename, fileType);
            } else {
                alert(data.message);
            }
        } catch (e) {
            this._handleError('ファイル作成', e);
        } finally {
            this.hideLoading();
        }
    }

    async createNewFolder() {
        const name = this.elements.newFoldername.value.trim() || '新規フォルダ';
        this.showLoading();
        this.elements.newFolderModal.hide();

        try {
            const data = await this.apiCall(API.FOLDER, {
                method: 'POST',
                body: { name, parent: this.state.currentFolder }
            });
            if (data.status === 'success') await this.loadFileList();
            else alert(data.message);
        } catch (e) {
            this._handleError('フォルダ作成', e);
        } finally {
            this.hideLoading();
        }
    }

    async openFile(filePath, fileName, fileType = null) {
        this.disconnectWebSocket();
        this.clearUndoStack();
        // グラフパネルを閉じる
        if (this.closeChartPanel) this.closeChartPanel();
        Object.assign(this.state, {
            currentFile: fileName,
            currentFilePath: filePath,
            currentFileType: fileType || this.getFileType(fileName)
        });

        this.elements.currentFileName.textContent = fileName;
        this.elements.btnDownload.disabled = false;
        document.querySelectorAll('.file-item').forEach(el => el.classList.toggle('active', el.dataset.path === filePath));

        const handlers = {
            [FILE_TYPES.EXCEL]: () => this.openExcelFile(filePath),
            [FILE_TYPES.CSV]: () => this.openExcelFile(filePath, true),
            [FILE_TYPES.POWERPOINT]: () => this.showPPTViewer(filePath),
            [FILE_TYPES.IMAGE]: () => this.showImagePreview(filePath),
            [FILE_TYPES.MODEL3D]: () => this.load3DModel(filePath),
            [FILE_TYPES.PDF]: () => this.showPDFViewer(filePath),
            [FILE_TYPES.TEXT]: () => this.showTextViewer(filePath),
            [FILE_TYPES.HTML]: () => this.showHTMLViewer(filePath),
            [FILE_TYPES.MSG]: () => this.showMsgViewer(filePath)
        };
        await (handlers[this.state.currentFileType] || (() => this.showViewer(FILE_TYPES.OTHER)))();

        this.updateURL();
    }

    async openExcelFile(filePath, isCSV = false) {
        const viewerType = isCSV ? FILE_TYPES.CSV : FILE_TYPES.EXCEL;
        this.showLoading();
        try {
            const headers = {};
            if (!this._etagCache) this._etagCache = {};
            const cached = this._etagCache[filePath];
            if (cached?.etag) {
                headers['If-None-Match'] = cached.etag;
            }

            const response = await fetch(`${API.DATA}?path=${encodeURIComponent(filePath)}`, { headers });

            // 304 Not Modified: 同一ファイルのキャッシュ済みデータを再利用
            if (response.status === 304 && cached?.sheets) {
                this._loadSheetAndConnect(cached.sheets, cached.sheetNames, viewerType, filePath);
                return;
            }

            const data = await response.json();
            if (data.status === 'success') {
                const etag = response.headers.get('ETag');
                if (etag) {
                    this._etagCache[filePath] = { etag, sheets: data.sheets, sheetNames: data.sheetNames };
                }
                this._loadSheetAndConnect(data.sheets, data.sheetNames, viewerType, filePath);
            } else {
                alert(data.message);
            }
        } catch (e) {
            this._handleError('ファイルの読み込み', e);
        } finally {
            this.hideLoading();
        }
    }

    showRenameModal(path, name, type) {
        this.renameTarget = { path, name, type };
        const displayName = type === 'file' && name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;
        this.elements.renameInput.value = displayName;
        this.elements.renameModal.show();
        setTimeout(() => { this.elements.renameInput.focus(); this.elements.renameInput.select(); }, 200);
    }

    async confirmRename() {
        if (!this.renameTarget) return;
        const newName = this.elements.renameInput.value.trim();
        if (!newName) { alert('名前を入力してください'); return; }

        this.showLoading();
        this.elements.renameModal.hide();

        try {
            const data = await this.apiCall(API.RENAME, {
                method: 'POST',
                body: { path: this.renameTarget.path, newName, type: this.renameTarget.type }
            });
            if (data.status === 'success') {
                if (this.state.currentFilePath === this.renameTarget.path) {
                    Object.assign(this.state, { currentFile: data.name, currentFilePath: data.path });
                    this.elements.currentFileName.textContent = data.name;
                    if (isSpreadsheetType(this.state.currentFileType)) this.connectWebSocket();
                }
                await this.loadFileList();
            } else {
                alert(data.message);
            }
        } catch (e) {
            this._handleError('名前変更', e);
        } finally {
            this.hideLoading();
            this.renameTarget = null;
        }
    }

    showDeleteConfirm(path, name, type) {
        this.deleteTarget = { path, name, type };
        this.elements.deleteFilename.textContent = name + (type === 'folder' ? '（フォルダ）' : '');
        this.elements.deleteModal.show();
    }

    async confirmDelete() {
        if (!this.deleteTarget) return;
        this.showLoading();
        this.elements.deleteModal.hide();

        try {
            // 複数選択削除
            if (this.deleteTarget.multi) {
                const items = this.deleteTarget.items;
                for (const item of items) {
                    await this.apiCall(API.DELETE, {
                        method: 'POST',
                        body: { path: item.path, type: item.type }
                    });
                    if (this.state.currentFilePath === item.path) {
                        this._resetCurrentFileState();
                        this.updateURL();
                    }
                }
                this.clearFileSelection();
                await this.loadFileList();
            } else {
                // 単体削除
                const data = await this.apiCall(API.DELETE, {
                    method: 'POST',
                    body: { path: this.deleteTarget.path, type: this.deleteTarget.type }
                });
                if (data.status === 'success') {
                    if (this.state.currentFilePath === this.deleteTarget.path) {
                        this._resetCurrentFileState();
                        this.updateURL();
                    }
                    await this.loadFileList();
                } else {
                    alert(data.message);
                }
            }
        } catch (e) {
            this._handleError('削除', e);
        } finally {
            this.hideLoading();
            this.deleteTarget = null;
        }
    }

    downloadFile() {
        if (this.state.currentFilePath) {
            location.href = `${API.DOWNLOAD}?path=${encodeURIComponent(this.state.currentFilePath)}`;
        }
    }
};
