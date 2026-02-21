/**
 * DKCドライブ - ビューア基盤（画像、PDF、テキスト、HTML）
 * 大型ビューア（3D, PPT, MSG）は個別モジュールに分割済み
 */

import { FILE_TYPES, isSpreadsheetType, API } from './constants.js';

/**
 * ビューアのミックスイン
 * @param {DKCDrive} Base - 基底クラス
 */
export const ViewersMixin = (Base) => class extends Base {

    initViewers() {
        this.three = {
            scene: null,
            camera: null,
            renderer: null,
            controls: null,
            currentModel: null
        };
    }

    hideAllViewers() {
        const containers = [
            'placeholder', 'spreadsheetContainer', 'pptContainer',
            'imagePreviewContainer', 'modelViewerContainer', 'pdfViewerContainer',
            'textViewerContainer', 'htmlViewerContainer', 'msgViewerContainer',
            'unsupportedContainer'
        ];
        containers.forEach(name => this.elements[name] && (this.elements[name].style.display = 'none'));
        this.elements.sheetTabs.innerHTML = '';
        this.cleanup3DViewer();
        if (this._cleanupHtmlEditor) this._cleanupHtmlEditor();
    }

    showViewer(fileType) {
        this.hideAllViewers();
        const styleGroup = document.querySelector('.toolbar-style');
        const chartGroup = document.querySelector('.toolbar-chart');

        // CSV も Excel と同じスプレッドシートビューアを使用
        const viewerMap = {
            [FILE_TYPES.EXCEL]: ['spreadsheetContainer', 'block', true, true],
            [FILE_TYPES.CSV]: ['spreadsheetContainer', 'block', false, true],
            [FILE_TYPES.POWERPOINT]: ['pptContainer', 'block', false, false],
            [FILE_TYPES.IMAGE]: ['imagePreviewContainer', 'flex', false, false],
            [FILE_TYPES.MODEL3D]: ['modelViewerContainer', 'block', false, false],
            [FILE_TYPES.PDF]: ['pdfViewerContainer', 'block', false, false],
            [FILE_TYPES.TEXT]: ['textViewerContainer', 'block', false, false],
            [FILE_TYPES.HTML]: ['htmlViewerContainer', 'block', false, false],
            [FILE_TYPES.MSG]: ['msgViewerContainer', 'block', false, false]
        };

        const [container, display, showStyle, showChart] = viewerMap[fileType] || ['unsupportedContainer', 'flex', false, false];
        this.elements[container].style.display = display;
        styleGroup?.classList.toggle('visible', showStyle);
        chartGroup?.classList.toggle('visible', showChart);

        const isSpreadsheet = isSpreadsheetType(fileType);
        this.elements.formulaBar?.classList.toggle('visible', isSpreadsheet);
        this.elements.sheetTabs?.classList.toggle('visible', isSpreadsheet);
    }

    // ===== 画像プレビュー =====

    showImagePreview(filePath) {
        this.showViewer(FILE_TYPES.IMAGE);
        this.state.imageZoom = 1;
        this.elements.imagePreview.src = `/media/dkc_drive/${encodeURIComponent(filePath)}`;
        this.elements.imagePreview.style.transform = 'scale(1)';
    }

    zoomImage(factor) {
        this.state.imageZoom = Math.max(0.1, Math.min(5, this.state.imageZoom * factor));
        this.elements.imagePreview.style.transform = `scale(${this.state.imageZoom})`;
    }

    resetImageZoom() {
        this.state.imageZoom = 1;
        this.elements.imagePreview.style.transform = 'scale(1)';
    }

    // ===== PDFビューア =====

    showPDFViewer(filePath) {
        this.showViewer(FILE_TYPES.PDF);
        this.elements.pdfViewer.src = `${API.SERVE}${encodeURIComponent(filePath)}`;
    }

    // ===== テキストビューア =====

    async showTextViewer(filePath) {
        this.showViewer(FILE_TYPES.TEXT);
        this.showLoading();

        try {
            const response = await fetch(`${API.TEXT}?path=${encodeURIComponent(filePath)}`);
            const result = await response.json();
            this.elements.textViewerContent.textContent = result.status === 'success'
                ? result.content
                : 'テキストの読み込みに失敗しました: ' + result.message;
        } catch (e) {
            console.error('テキスト読み込みエラー:', e);
            this.elements.textViewerContent.textContent = 'テキストの読み込みに失敗しました';
        } finally {
            this.hideLoading();
        }
    }

    // ===== HTMLビューア =====

    showHTMLViewer(filePath) {
        this.showViewer(FILE_TYPES.HTML);
        const iframe = this.elements.htmlViewer;
        iframe.src = `${API.SERVE}${encodeURIComponent(filePath)}`;

        // iframe読み込み完了後にコンテキストメニューハンドラを登録
        iframe.onload = () => {
            if (this._attachHtmlIframeContextMenu) {
                this._attachHtmlIframeContextMenu(iframe);
            }
        };
    }
};
