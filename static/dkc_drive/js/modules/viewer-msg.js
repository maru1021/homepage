/**
 * DKCドライブ - MSGメールビューア
 * Outlook MSG形式のメール表示・添付ファイルプレビュー
 */

import { FILE_TYPES, API } from './constants.js';

/**
 * MSGメールビューアのミックスイン
 */
export const ViewerMSGMixin = (Base) => class extends Base {

    async showMsgViewer(filePath) {
        this.showViewer(FILE_TYPES.MSG);
        this.showLoading();

        try {
            const response = await fetch(`${API.MSG}?path=${encodeURIComponent(filePath)}`);
            const result = await response.json();

            if (result.status !== 'success') {
                this.elements.msgViewerContent.innerHTML =
                    `<p class="msg-error">メールの読み込みに失敗しました: ${this.escapeHtml(result.message)}</p>`;
                return;
            }

            const attachmentsHtml = result.attachments.length > 0
                ? `<div class="msg-attachments">
                    <div class="msg-attachments-title"><i class="bi bi-paperclip"></i> 添付ファイル (${result.attachments.length})</div>
                    ${result.attachments.map(att =>
                        `<a class="msg-attachment-item" href="#" data-msg-path="${this.escapeHtml(filePath)}" data-attachment-index="${att.index}" data-attachment-name="${this.escapeHtml(att.name)}">
                            <i class="bi bi-file-earmark"></i>
                            <span class="msg-attachment-name">${this.escapeHtml(att.name)}</span>
                            <span class="msg-attachment-size">${this.formatFileSize(att.size)}</span>
                        </a>`
                    ).join('')}
                </div>`
                : '';

            this.elements.msgViewerContent.innerHTML = `
                <div class="msg-header">
                    <h3 class="msg-subject">${this.escapeHtml(result.subject || '(件名なし)')}</h3>
                    <div class="msg-meta">
                        <div class="msg-meta-row">
                            <span class="msg-label">差出人:</span>
                            <span class="msg-value">${this.escapeHtml(result.sender)}</span>
                        </div>
                        <div class="msg-meta-row">
                            <span class="msg-label">宛先:</span>
                            <span class="msg-value">${this.escapeHtml(result.to)}</span>
                        </div>
                        ${result.cc ? `<div class="msg-meta-row">
                            <span class="msg-label">CC:</span>
                            <span class="msg-value">${this.escapeHtml(result.cc)}</span>
                        </div>` : ''}
                        <div class="msg-meta-row">
                            <span class="msg-label">日付:</span>
                            <span class="msg-value">${this.escapeHtml(result.date)}</span>
                        </div>
                    </div>
                </div>
                ${attachmentsHtml}
                <div class="msg-body"><pre class="msg-body-text">${this.escapeHtml(result.body || '')}</pre></div>
            `;

            // 添付ファイルクリックイベント
            this.elements.msgViewerContent.querySelectorAll('.msg-attachment-item').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    const msgPath = el.dataset.msgPath;
                    const index = el.dataset.attachmentIndex;
                    const name = el.dataset.attachmentName;
                    this.previewMsgAttachment(msgPath, index, name);
                });
            });
        } catch (e) {
            console.error('MSG読み込みエラー:', e);
            this.elements.msgViewerContent.innerHTML =
                '<p class="msg-error">メールの読み込みに失敗しました</p>';
        } finally {
            this.hideLoading();
        }
    }

    async previewMsgAttachment(msgPath, index, name) {
        const modal = document.getElementById('attachmentPreviewModal');
        const title = document.getElementById('attachmentPreviewTitle');
        const body = document.getElementById('attachmentPreviewBody');
        const downloadBtn = document.getElementById('attachmentDownloadBtn');
        const bsModal = bootstrap.Modal.getOrCreateInstance(modal);

        title.textContent = name;
        body.innerHTML = '<div class="text-center p-5"><div class="spinner-border"></div></div>';
        downloadBtn.href = `${API.MSG}?path=${encodeURIComponent(msgPath)}&attachment=${index}`;
        downloadBtn.download = name;
        bsModal.show();

        try {
            const response = await fetch(`${API.MSG}?path=${encodeURIComponent(msgPath)}&attachment=${index}&preview=1`);
            const result = await response.json();

            if (result.status !== 'success') {
                body.innerHTML = `<p class="text-center text-danger p-4">${this.escapeHtml(result.message)}</p>`;
                return;
            }

            const ct = result.contentType || '';
            const dataUrl = `data:${ct};base64,${result.data}`;

            if (ct.startsWith('image/')) {
                body.innerHTML = `<div class="text-center p-3"><img src="${dataUrl}" style="max-width:100%;max-height:70vh;" alt="${this.escapeHtml(name)}"></div>`;
            } else if (ct === 'application/pdf') {
                body.innerHTML = `<iframe src="${dataUrl}" style="width:100%;height:70vh;border:none;"></iframe>`;
            } else if (ct.startsWith('text/') || ['application/json', 'application/xml'].includes(ct)) {
                const text = atob(result.data);
                body.innerHTML = `<pre style="padding:16px;margin:0;max-height:70vh;overflow:auto;white-space:pre-wrap;">${this.escapeHtml(text)}</pre>`;
            } else {
                body.innerHTML = `<div class="text-center p-5"><i class="bi bi-file-earmark" style="font-size:3rem;"></i><p class="mt-3">プレビュー非対応のファイル形式です。<br>ダウンロードボタンからファイルを取得してください。</p></div>`;
            }
        } catch (e) {
            console.error('添付ファイルプレビューエラー:', e);
            body.innerHTML = '<p class="text-center text-danger p-4">添付ファイルの読み込みに失敗しました</p>';
        }
    }
};
