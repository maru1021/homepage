/**
 * DKCドライブ - スプレッドシート画像挿入機能（図形モード）
 * 画像をセル内ではなく、シート上のオーバーレイとして配置
 */

import { API } from './constants.js';

/**
 * 画像挿入機能のミックスイン
 * @param {DKCDrive} Base - 基底クラス
 */
export const ImageMixin = (Base) => class extends Base {

    initImage() {
        this.imageState = {
            selectedFile: null,          // アップロード用選択ファイル
            selectedDrivePath: null,     // ドライブ選択パス
            driveCurrentFolder: '',      // ドライブブラウズ現在フォルダ
            imageDataUrl: null,          // 挿入する画像のDataURL
            selectedImage: null,         // 選択中の画像
            isDeleting: false,           // 削除中フラグ
        };

        this.initImageModal();
        this.initImageEvents();
    }

    initImageModal() {
        const $ = id => document.getElementById(id);
        this.imageElements = {
            modal: new bootstrap.Modal($('insertImageModal')),
            btnInsertImage: $('btn-insert-image'),
            btnConfirmInsert: $('btn-confirm-insert-image'),
            dropZone: $('image-drop-zone'),
            fileInput: $('image-file-input'),
            uploadPreview: $('upload-preview'),
            uploadPreviewImg: $('upload-preview-img'),
            btnClearPreview: $('btn-clear-preview'),
            driveList: $('drive-image-list'),
            driveBreadcrumb: $('drive-image-breadcrumb'),
            drivePreview: $('drive-image-preview'),
            drivePreviewImg: $('drive-preview-img')
        };
    }

    initImageEvents() {
        const el = this.imageElements;
        if (!el.btnInsertImage) return;

        // 画像挿入ボタン
        el.btnInsertImage.addEventListener('click', () => this.openImageModal());

        // ドロップゾーン
        el.dropZone.addEventListener('click', () => el.fileInput.click());
        el.dropZone.addEventListener('dragover', e => {
            e.preventDefault();
            el.dropZone.classList.add('dragover');
        });
        el.dropZone.addEventListener('dragleave', () => {
            el.dropZone.classList.remove('dragover');
        });
        el.dropZone.addEventListener('drop', e => {
            e.preventDefault();
            el.dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.handleImageFile(files[0]);
            }
        });

        // ファイル選択
        el.fileInput.addEventListener('change', e => {
            if (e.target.files.length > 0) {
                this.handleImageFile(e.target.files[0]);
            }
        });

        // プレビュークリア
        el.btnClearPreview.addEventListener('click', () => this.clearUploadPreview());

        // 挿入確定
        el.btnConfirmInsert.addEventListener('click', () => this.confirmInsertImage());

        // タブ切り替え時にドライブリストを読み込む
        document.querySelector('[data-bs-target="#tab-drive"]')?.addEventListener('shown.bs.tab', () => {
            this.loadDriveImageList('');
        });

        // モーダルが閉じられた時にリセット
        document.getElementById('insertImageModal').addEventListener('hidden.bs.modal', () => {
            this.resetImageModal();
        });

        // 画像選択解除（スプレッドシートクリック時）
        this.elements.spreadsheet?.addEventListener('mousedown', e => {
            if (!e.target.closest('.sheet-image')) {
                this.deselectImage();
            }
        });

        // キーボードショートカット（画像削除）
        document.addEventListener('keydown', e => {
            if (this.imageState.selectedImage && (e.key === 'Delete' || e.key === 'Backspace')) {
                if (!this.state.editingCell) {
                    e.preventDefault();
                    this.deleteSelectedImage();
                }
            }
        });
    }

    openImageModal() {
        if (this.state.selectedCells.length === 0) {
            this.showSaveIndicator('セルを選択してください', true);
            return;
        }
        this.resetImageModal();
        this.imageElements.modal.show();
    }

    resetImageModal() {
        this.imageState.selectedFile = null;
        this.imageState.selectedDrivePath = null;
        this.imageState.imageDataUrl = null;
        this.imageState.driveCurrentFolder = '';

        const el = this.imageElements;
        el.uploadPreview.style.display = 'none';
        el.dropZone.style.display = 'block';
        el.drivePreview.style.display = 'none';
        el.btnConfirmInsert.disabled = true;
        el.fileInput.value = '';

        // ドライブリストをクリア
        el.driveList.innerHTML = '';
    }

    handleImageFile(file) {
        if (!file.type.startsWith('image/')) {
            this.showSaveIndicator('画像ファイルを選択してください', true);
            return;
        }

        this.imageState.selectedFile = file;
        this.imageState.selectedDrivePath = null;

        const reader = new FileReader();
        reader.onload = e => {
            this.imageState.imageDataUrl = e.target.result;
            this.imageElements.uploadPreviewImg.src = e.target.result;
            this.imageElements.uploadPreview.style.display = 'block';
            this.imageElements.dropZone.style.display = 'none';
            this.imageElements.btnConfirmInsert.disabled = false;
        };
        reader.readAsDataURL(file);
    }

    clearUploadPreview() {
        this.imageState.selectedFile = null;
        this.imageState.imageDataUrl = null;
        this.imageElements.uploadPreview.style.display = 'none';
        this.imageElements.dropZone.style.display = 'block';
        this.imageElements.fileInput.value = '';
        this.imageElements.btnConfirmInsert.disabled = true;
    }

    async loadDriveImageList(folderPath) {
        this.imageState.driveCurrentFolder = folderPath;
        const el = this.imageElements;

        try {
            const response = await this.apiCall(`${API.LIST}?folder=${encodeURIComponent(folderPath)}`);
            if (!response.items) {
                el.driveList.innerHTML = '<div class="drive-image-empty"><i class="bi bi-exclamation-circle"></i><p>読み込みエラー</p></div>';
                return;
            }

            // パンくずリスト更新
            this.updateDriveImageBreadcrumb(folderPath);

            // フォルダと画像ファイルをフィルタ
            const folders = response.items.filter(item => item.type === 'folder');
            const images = response.items.filter(item =>
                item.type === 'file' && /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(item.name)
            );

            if (folders.length === 0 && images.length === 0) {
                el.driveList.innerHTML = '<div class="drive-image-empty"><i class="bi bi-image"></i><p>画像ファイルがありません</p></div>';
                return;
            }

            let html = '';

            // フォルダ
            folders.forEach(folder => {
                const path = folderPath ? `${folderPath}/${folder.name}` : folder.name;
                html += `
                    <div class="drive-image-item" data-type="folder" data-path="${this.escapeHtml(path)}">
                        <i class="bi bi-folder-fill"></i>
                        <span class="drive-image-item-name">${this.escapeHtml(folder.name)}</span>
                    </div>
                `;
            });

            // 画像ファイル
            images.forEach(image => {
                const path = folderPath ? `${folderPath}/${image.name}` : image.name;
                html += `
                    <div class="drive-image-item" data-type="image" data-path="${this.escapeHtml(path)}">
                        <i class="bi bi-file-earmark-image"></i>
                        <span class="drive-image-item-name">${this.escapeHtml(image.name)}</span>
                    </div>
                `;
            });

            el.driveList.innerHTML = html;

            // イベント設定
            el.driveList.querySelectorAll('.drive-image-item').forEach(item => {
                item.addEventListener('click', () => this.handleDriveItemClick(item));
            });

        } catch (e) {
            console.error('ドライブリスト読み込みエラー:', e);
            el.driveList.innerHTML = '<div class="drive-image-empty"><i class="bi bi-exclamation-circle"></i><p>読み込みエラー</p></div>';
        }
    }

    updateDriveImageBreadcrumb(folderPath) {
        const el = this.imageElements.driveBreadcrumb;
        const parts = folderPath ? folderPath.split('/') : [];

        let html = `
            <span class="breadcrumb-item ${parts.length === 0 ? 'active' : ''}" data-path="">
                <i class="bi bi-folder2"></i> ルート
            </span>
        `;

        let currentPath = '';
        parts.forEach((part, index) => {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const isLast = index === parts.length - 1;
            html += `
                <span class="breadcrumb-separator">/</span>
                <span class="breadcrumb-item ${isLast ? 'active' : ''}" data-path="${this.escapeHtml(currentPath)}">
                    ${this.escapeHtml(part)}
                </span>
            `;
        });

        el.innerHTML = html;

        // イベント設定
        el.querySelectorAll('.breadcrumb-item:not(.active)').forEach(item => {
            item.addEventListener('click', () => {
                this.loadDriveImageList(item.dataset.path);
            });
        });
    }

    handleDriveItemClick(item) {
        const type = item.dataset.type;
        const path = item.dataset.path;

        if (type === 'folder') {
            this.loadDriveImageList(path);
        } else {
            // 画像選択
            this.imageElements.driveList.querySelectorAll('.drive-image-item').forEach(i => {
                i.classList.remove('selected');
            });
            item.classList.add('selected');

            this.imageState.selectedDrivePath = path;
            this.imageState.selectedFile = null;

            // プレビュー表示
            const imageUrl = `${API.SERVE}${encodeURIComponent(path)}`;
            this.imageElements.drivePreviewImg.src = imageUrl;
            this.imageElements.drivePreview.style.display = 'block';
            this.imageElements.btnConfirmInsert.disabled = false;

            // 画像をDataURLとして読み込む
            this.loadImageAsDataUrl(imageUrl);
        }
    }

    async loadImageAsDataUrl(url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            this.imageState.imageDataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error('画像読み込みエラー:', e);
        }
    }

    async confirmInsertImage() {
        if (!this.imageState.imageDataUrl) {
            this.showSaveIndicator('画像が選択されていません', true);
            return;
        }

        const cells = this.state.selectedCells;
        if (cells.length === 0) {
            this.showSaveIndicator('セルを選択してください', true);
            return;
        }

        // 選択範囲の左上のセルを基準位置とする
        const targetCell = cells[0];
        const { row, col } = targetCell;

        // セルの位置を取得
        const cellElement = this.getCell(row, col);
        if (!cellElement) {
            this.showSaveIndicator('セルが見つかりません', true);
            return;
        }

        // 画像の自然サイズを取得
        const img = new Image();
        img.src = this.imageState.imageDataUrl;
        await new Promise(resolve => {
            if (img.complete) resolve();
            else img.onload = resolve;
        });

        // 適切なサイズに調整（最大300px）
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        const maxSize = 300;
        if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
        }

        // 画像オブジェクトを作成
        const imageData = {
            imageIndex: null,  // サーバー保存後に設定される
            row,
            col,
            offsetX: 0,
            offsetY: 0,
            width,
            height,
            dataUrl: this.imageState.imageDataUrl
        };

        // サーバーに保存してからシートに追加（保存成功時のみ）
        this.imageElements.modal.hide();
        const result = await this.saveImageToServer(imageData);
        if (result && result.imageIndex !== undefined) {
            imageData.imageIndex = result.imageIndex;
            this.addImageToSheet(imageData);
            delete imageData.dataUrl;
            this.showSaveIndicator('画像を挿入しました');
        } else {
            this.showSaveIndicator('画像の保存に失敗しました', true);
        }
    }

    /**
     * 画像をシート上に配置
     */
    addImageToSheet(imageData) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet.images) sheet.images = [];
        sheet.images.push(imageData);

        this.renderSheetImage(imageData);
    }

    /**
     * セルのテーブル相対位置を取得（スクロールに依存しない安定した座標）
     */
    _getCellPosition(row, col) {
        const cellElement = this.getCell(row, col);
        if (!cellElement) return null;

        // テーブル先頭からの累積オフセットを計算
        const table = this.elements.spreadsheet;
        let left = cellElement.offsetLeft;
        let top = cellElement.offsetTop;
        let el = cellElement.offsetParent;
        while (el && el !== table.parentElement) {
            left += el.offsetLeft;
            top += el.offsetTop;
            el = el.offsetParent;
        }
        return { left, top };
    }

    renderSheetImage(imageData) {
        const container = this.getImageContainer();
        if (!container) return;

        const pos = this._getCellPosition(imageData.row, imageData.col);
        if (!pos) return;

        const left = pos.left + (imageData.offsetX || 0);
        const top = pos.top + (imageData.offsetY || 0);

        // 画像URLを決定（dataUrlがあればそれを使用、なければAPIから遅延取得）
        let imgSrc;
        if (imageData.dataUrl) {
            imgSrc = imageData.dataUrl;
        } else {
            const params = new URLSearchParams({
                path: this.state.currentFilePath,
                sheetName: this.currentSheet,
                imageIndex: imageData.imageIndex
            });
            imgSrc = `${API.IMAGE_DATA}?${params}`;
        }

        const isSeal = imageData.imageType === 'seal';

        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'sheet-image' + (isSeal ? ' sheet-image--seal' : '');
        imgWrapper.dataset.imageIndex = imageData.imageIndex;
        const rotation = imageData.rotation || 0;
        imgWrapper.style.cssText = `
            left: ${left}px;
            top: ${top}px;
            width: ${imageData.width}px;
            height: ${imageData.height}px;
            ${rotation ? `transform: rotate(${rotation}deg);` : ''}
        `;

        let tooltipHtml = '';
        if (isSeal && (imageData.stampedBy || imageData.stampedAt)) {
            const by = imageData.stampedBy || '';
            const at = imageData.stampedAt
                ? new Date(imageData.stampedAt).toLocaleString('ja-JP')
                : '';
            tooltipHtml = `<div class="seal-tooltip">${this.escapeHtml(by)}<br>${this.escapeHtml(at)}</div>`;
        }

        imgWrapper.innerHTML = `
            <img src="${imgSrc}" alt="画像" draggable="false" loading="lazy">
            ${tooltipHtml}
            <div class="sheet-image-resize-handle nw" data-dir="nw"></div>
            <div class="sheet-image-resize-handle ne" data-dir="ne"></div>
            <div class="sheet-image-resize-handle sw" data-dir="sw"></div>
            <div class="sheet-image-resize-handle se" data-dir="se"></div>
            <div class="sheet-image-rotate-line"></div>
            <div class="sheet-image-rotate-handle" title="回転"></div>
            <button class="sheet-image-delete" title="削除"><i class="bi bi-x"></i></button>
        `;

        // イベント設定
        this.setupImageEvents(imgWrapper, imageData);

        container.appendChild(imgWrapper);
    }

    /**
     * 画像コンテナを取得（なければ作成）
     */
    getImageContainer() {
        let container = document.getElementById('sheet-images-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'sheet-images-container';
            container.className = 'sheet-images-container';
            this.elements.spreadsheet.parentElement.appendChild(container);
        }
        return container;
    }

    /**
     * 画像イベントを設定
     */
    setupImageEvents(imgWrapper, imageData) {
        // 選択
        imgWrapper.addEventListener('mousedown', e => {
            // 削除ボタンまたはその子要素の場合は何もしない
            if (e.target.closest('.sheet-image-delete')) return;
            if (e.target.closest('.sheet-image-rotate-handle')) return;
            e.stopPropagation();
            this.selectImage(imgWrapper, imageData);

            // ドラッグ開始
            if (!e.target.classList.contains('sheet-image-resize-handle')) {
                this.startImageDrag(e, imgWrapper, imageData);
            }
        });

        // リサイズハンドル
        imgWrapper.querySelectorAll('.sheet-image-resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', e => {
                e.stopPropagation();
                this.startImageResize(e, imgWrapper, imageData, handle.dataset.dir);
            });
        });

        // 回転ハンドル
        imgWrapper.querySelector('.sheet-image-rotate-handle')?.addEventListener('mousedown', e => {
            e.stopPropagation();
            this.selectImage(imgWrapper, imageData);
            this.startRotation(e, imgWrapper, imageData);
        });

        // 削除ボタン
        imgWrapper.querySelector('.sheet-image-delete').addEventListener('click', e => {
            e.stopPropagation();
            this.deleteImage(imageData.imageIndex);
        });
    }

    /**
     * 画像を選択
     */
    selectImage(imgWrapper, imageData) {
        this.deselectImage();
        // 図形の選択も解除
        this.deselectShape?.();
        imgWrapper.classList.add('selected');
        this.imageState.selectedImage = imageData;
    }

    /**
     * 画像の選択を解除
     */
    deselectImage() {
        document.querySelectorAll('.sheet-image.selected').forEach(el => {
            el.classList.remove('selected');
        });
        this.imageState.selectedImage = null;
    }

    /**
     * ドラッグ/リサイズ共通: mousemove + mouseup リスナーを管理
     */
    _trackPointer(onMove, onEnd) {
        const onMouseMove = e => onMove(e);
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            onEnd();
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    /**
     * 画像ドラッグ開始
     */
    startImageDrag(e, imgWrapper, imageData) {
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = parseInt(imgWrapper.style.left);
        const startTop = parseInt(imgWrapper.style.top);

        this._trackPointer(
            e => {
                imgWrapper.style.left = `${startLeft + e.clientX - startX}px`;
                imgWrapper.style.top = `${startTop + e.clientY - startY}px`;
            },
            () => this.updateImagePosition(imgWrapper, imageData)
        );
    }

    /**
     * 画像リサイズ開始
     */
    startImageResize(e, imgWrapper, imageData, direction) {
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = parseInt(imgWrapper.style.width);
        const startHeight = parseInt(imgWrapper.style.height);
        const startLeft = parseInt(imgWrapper.style.left);
        const startTop = parseInt(imgWrapper.style.top);
        const aspectRatio = startWidth / startHeight;

        this._trackPointer(
            e => {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                let newWidth = startWidth;
                let newHeight = startHeight;
                let newLeft = startLeft;
                let newTop = startTop;

                if (direction.includes('e')) {
                    newWidth = Math.max(50, startWidth + dx);
                    newHeight = newWidth / aspectRatio;
                } else if (direction.includes('w')) {
                    newWidth = Math.max(50, startWidth - dx);
                    newHeight = newWidth / aspectRatio;
                    newLeft = startLeft + (startWidth - newWidth);
                }

                if (direction.includes('s')) {
                    newHeight = Math.max(50, startHeight + dy);
                    newWidth = newHeight * aspectRatio;
                } else if (direction.includes('n')) {
                    newHeight = Math.max(50, startHeight - dy);
                    newWidth = newHeight * aspectRatio;
                    newTop = startTop + (startHeight - newHeight);
                }

                imgWrapper.style.width = `${newWidth}px`;
                imgWrapper.style.height = `${newHeight}px`;
                imgWrapper.style.left = `${newLeft}px`;
                imgWrapper.style.top = `${newTop}px`;
            },
            () => this.updateImagePosition(imgWrapper, imageData)
        );
    }

    /**
     * 回転操作開始（画像・図形共通）
     */
    startRotation(e, wrapper, data) {
        e.preventDefault();
        const rect = wrapper.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const startRotation = data.rotation || 0;

        this._trackPointer(
            ev => {
                const angle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX);
                let degrees = startRotation + (angle - startAngle) * (180 / Math.PI);

                // Shiftキーで15度刻みにスナップ
                if (ev.shiftKey) {
                    degrees = Math.round(degrees / 15) * 15;
                }

                data.rotation = Math.round(degrees);
                wrapper.style.transform = `rotate(${data.rotation}deg)`;
            },
            () => {
                if (data.imageIndex !== undefined) {
                    this.updateImagePosition(wrapper, data);
                } else if (data.shapeIndex !== undefined) {
                    this.updateShapePosition(wrapper, data);
                }
            }
        );
    }

    /**
     * 画像の左上座標から最寄りのセル(row, col)を特定する
     */
    _findNearestCell(x, y) {
        const tbody = this.elements.spreadsheet?.tBodies?.[0];
        if (!tbody || tbody.rows.length === 0) return null;

        // 行を二分探索（累積offsetTopで比較）
        let lo = 0, hi = tbody.rows.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (tbody.rows[mid].offsetTop <= y) lo = mid;
            else hi = mid - 1;
        }
        const row = lo;

        // 列を二分探索（c=1からスタート: 行ヘッダースキップ）
        const tr = tbody.rows[row];
        if (!tr || tr.cells.length <= 1) return null;
        lo = 1; hi = tr.cells.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (tr.cells[mid].offsetLeft <= x) lo = mid;
            else hi = mid - 1;
        }
        const col = lo - 1;  // -1: 行ヘッダー分

        return { row, col };
    }

    /**
     * 画像位置を更新
     */
    updateImagePosition(imgWrapper, imageData) {
        if (this.imageState.isDeleting) return;

        const imgLeft = parseInt(imgWrapper.style.left);
        const imgTop = parseInt(imgWrapper.style.top);

        const nearest = this._findNearestCell(imgLeft, imgTop);
        if (!nearest) return;

        const cellPos = this._getCellPosition(nearest.row, nearest.col);
        if (!cellPos) return;

        imageData.row = nearest.row;
        imageData.col = nearest.col;
        imageData.offsetX = imgLeft - cellPos.left;
        imageData.offsetY = imgTop - cellPos.top;
        imageData.width = parseInt(imgWrapper.style.width);
        imageData.height = parseInt(imgWrapper.style.height);
        imageData.rotation = imageData.rotation || 0;

        this.saveImageToServer(imageData);
    }

    /**
     * 画像を削除
     */
    async deleteImage(imageIndex) {
        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet.images) return;

        // 削除中フラグを設定（ドラッグ中の保存を防ぐ）
        this.imageState.isDeleting = true;

        // 配列から画像データを取得
        const index = sheet.images.findIndex(img => img.imageIndex === imageIndex);
        if (index === -1) {
            this.imageState.isDeleting = false;
            return;
        }

        const imageData = sheet.images[index];

        // DOM要素を削除
        const imgWrapper = document.querySelector(`.sheet-image[data-image-index="${imageIndex}"]`);
        if (imgWrapper) {
            imgWrapper.remove();
        }

        // サーバーに削除を通知
        await this.deleteImageFromServer(imageData);

        // クライアント側の配列から削除（IDは安定しているので再番不要）
        sheet.images.splice(index, 1);

        this.imageState.selectedImage = null;
        this.imageState.isDeleting = false;
        this.showSaveIndicator('画像を削除しました');
    }

    /**
     * 選択中の画像を削除
     */
    deleteSelectedImage() {
        if (this.imageState.selectedImage) {
            this.deleteImage(this.imageState.selectedImage.imageIndex);
        }
    }

    /**
     * サーバーに画像を保存
     * @param {Object} imageData - 画像データ
     * @returns {Object} サーバーレスポンス
     */
    async saveImageToServer(imageData) {
        if (!this.state.currentFilePath) return null;

        try {
            const image = {
                row: imageData.row,
                col: imageData.col,
                offsetX: imageData.offsetX || 0,
                offsetY: imageData.offsetY || 0,
                width: imageData.width,
                height: imageData.height,
                rotation: imageData.rotation || 0,
            };

            // dataUrlがあれば新規保存、なければ位置・サイズのみ更新
            if (imageData.dataUrl) {
                image.dataUrl = imageData.dataUrl;
                // 押印メタデータ
                if (imageData.imageType) image.imageType = imageData.imageType;
                if (imageData.stampedAt) image.stampedAt = imageData.stampedAt;
                if (imageData.stampedBy) image.stampedBy = imageData.stampedBy;
            } else {
                image.imageIndex = imageData.imageIndex;
            }

            const body = {
                path: this.state.currentFilePath,
                sheetName: this.currentSheet,
                image
            };

            const result = await this.apiCall(API.IMAGE, {
                method: 'POST',
                body
            });
            return result;
        } catch (e) {
            console.error('画像保存エラー:', e);
            return null;
        }
    }

    /**
     * サーバーから画像を削除
     */
    async deleteImageFromServer(imageData) {
        if (!this.state.currentFilePath) return;
        if (imageData.imageIndex === null || imageData.imageIndex === undefined) {
            console.error('画像削除エラー: imageIndexが設定されていません', imageData);
            return;
        }

        try {
            await this.apiCall(API.IMAGE_DELETE, {
                method: 'POST',
                body: {
                    path: this.state.currentFilePath,
                    sheetName: this.currentSheet,
                    imageIndex: imageData.imageIndex
                }
            });
        } catch (e) {
            console.error('画像削除エラー:', e);
        }
    }

    /**
     * シート読み込み時に画像を表示
     */
    renderSheetImages() {
        // 既存の画像コンテナをクリア
        const container = document.getElementById('sheet-images-container');
        if (container) {
            container.innerHTML = '';
        }

        const sheet = this.state.sheetsData[this.currentSheet];
        if (!sheet?.images) return;

        sheet.images.forEach(imageData => {
            this.renderSheetImage(imageData);
        });
    }

};
