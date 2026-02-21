/**
 * HTML編集モード ミックスイン
 * HTMLビューアに編集モード（ドラッグ移動・リサイズ・要素挿入）を追加
 */
import { API, SHAPE_TYPES, SHAPE_DEFAULTS } from './constants.js';
import { generateShapeSVG } from './shape-utils.js';

const DRAG_THRESHOLD = 3;
const MIN_RESIZE = 20;
const MAX_IMAGE_WIDTH = 400;

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META']);
const SVG_NS = 'http://www.w3.org/2000/svg';

const RESIZE_DIRS = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];

const EDIT_CSS = `
[data-dkc-draggable] {
    outline: 1px dashed transparent;
    transition: outline-color 0.15s;
}
[data-dkc-draggable]:hover {
    outline: 1px dashed #4285f4 !important;
    cursor: move !important;
}
[data-dkc-selected] {
    outline: 2px solid #4285f4 !important;
    outline-offset: 2px;
}
body { cursor: default; }
.dkc-textbox {
    min-width: 100px; min-height: 1.5em;
    padding: 8px 12px; border: 1px solid #ccc;
    border-radius: 4px; background: #fff;
    font-size: 14px; line-height: 1.5;
    margin: 10px 0; display: inline-block;
}
.dkc-textbox:focus {
    outline: 2px solid #4285f4;
    border-color: #4285f4;
}
.dkc-input-wrapper input,
.dkc-input-wrapper textarea,
.dkc-select-wrapper select {
    pointer-events: none;
}
.dkc-shape-wrapper svg { pointer-events: none; }
.dkc-resize-handle {
    position: absolute; width: 10px; height: 10px;
    background: #fff; border: 2px solid #4285f4;
    border-radius: 2px; z-index: 10; box-sizing: border-box;
}
.dkc-resize-handle.nw { top: -5px; left: -5px; cursor: nw-resize; }
.dkc-resize-handle.ne { top: -5px; right: -5px; cursor: ne-resize; }
.dkc-resize-handle.sw { bottom: -5px; left: -5px; cursor: sw-resize; }
.dkc-resize-handle.se { bottom: -5px; right: -5px; cursor: se-resize; }
.dkc-resize-handle.n  { top: -5px; left: calc(50% - 5px); cursor: n-resize; }
.dkc-resize-handle.s  { bottom: -5px; left: calc(50% - 5px); cursor: s-resize; }
.dkc-resize-handle.w  { top: calc(50% - 5px); left: -5px; cursor: w-resize; }
.dkc-resize-handle.e  { top: calc(50% - 5px); right: -5px; cursor: e-resize; }
`;

/** transform: translate(x, y) をパースして {x, y} を返す */
function getTranslateXY(el) {
    const m = (el.style.transform || '').match(/translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/);
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
}

/** rgb(r,g,b) / rgba() → #rrggbb */
function cssColorToHex(css) {
    if (!css || css === 'transparent' || css === 'rgba(0, 0, 0, 0)') return null;
    if (css.startsWith('#')) return css;
    const m = css.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(v => parseInt(v).toString(16).padStart(2, '0')).join('');
}

// ===== アクションマップ =====

const SHAPE_ACTIONS = {
    'insert-shape-rectangle': SHAPE_TYPES.RECTANGLE,
    'insert-shape-rounded_rectangle': SHAPE_TYPES.ROUNDED_RECTANGLE,
    'insert-shape-ellipse': SHAPE_TYPES.ELLIPSE,
    'insert-shape-triangle': SHAPE_TYPES.TRIANGLE,
    'insert-shape-line': SHAPE_TYPES.LINE,
    'insert-shape-arrow': SHAPE_TYPES.ARROW,
};

export const HtmlEditorMixin = (Base) => class extends Base {

    initHtmlEditor() {
        this.htmlEditorState = {
            isEditMode: false,
            hasChanges: false,
            // ドラッグ
            dragTarget: null, isDragging: false,
            dragStartX: 0, dragStartY: 0,
            elemStartX: 0, elemStartY: 0,
            // リサイズ
            resizeTarget: null, resizeDir: null,
            resizeStartX: 0, resizeStartY: 0,
            resizeStartW: 0, resizeStartH: 0,
        };

        this.htmlEditorContextMenu = document.getElementById('html-editor-context-menu');
        this._initHtmlEditorContextMenu();
        this._initHtmlPropertyListeners();
    }

    // ===== iframe contentDocument取得 =====

    _getIframeDoc() {
        try {
            const doc = this.elements.htmlViewer.contentDocument;
            return doc?.body ? doc : null;
        } catch {
            return null;
        }
    }

    // ===== コンテキストメニュー =====

    _initHtmlEditorContextMenu() {
        const menu = this.htmlEditorContextMenu;
        if (!menu) return;

        menu.querySelectorAll('.folder-context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this._hideHtmlEditorContextMenu();
                this._handleHtmlEditorAction(item.dataset.action);
            });
        });
        document.addEventListener('click', () => this._hideHtmlEditorContextMenu());
    }

    _attachHtmlIframeContextMenu(iframe) {
        const doc = this._getIframeDoc();
        if (!doc) return;

        if (this._htmlViewerContextHandler) {
            try { doc.removeEventListener('contextmenu', this._htmlViewerContextHandler); } catch { /* ignore */ }
        }

        this._htmlViewerContextHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.htmlEditorState.contextTarget = e.target;
            // iframe内の右クリック座標を記録（挿入位置に使用）
            this.htmlEditorState.contextX = e.clientX;
            this.htmlEditorState.contextY = e.clientY;

            // 右クリック対象のドラッグ可能要素を自動選択
            if (this.htmlEditorState.isEditMode) {
                const doc = this._getIframeDoc();
                if (doc) {
                    const draggable = this._findDraggableElement(e.target, doc);
                    if (draggable) {
                        this._selectHtmlElement(draggable, doc);
                    } else {
                        this._deselectHtmlElement(doc);
                    }
                }
            }

            const r = iframe.getBoundingClientRect();
            this._showHtmlEditorContextMenu({ clientX: r.left + e.clientX, clientY: r.top + e.clientY });
        };
        doc.addEventListener('contextmenu', this._htmlViewerContextHandler);
        doc.addEventListener('click', () => this._hideHtmlEditorContextMenu());
    }

    _showHtmlEditorContextMenu(pos) {
        const menu = this.htmlEditorContextMenu;
        if (!menu) return;

        const isEdit = this.htmlEditorState.isEditMode;

        // 編集モード専用項目の表示切替
        menu.querySelectorAll('.html-edit-only').forEach(el => {
            el.style.display = isEdit ? '' : 'none';
        });

        // トグルボタン更新
        const label = document.getElementById('html-edit-mode-label');
        if (label) label.textContent = isEdit ? '表示モードに戻る' : '編集モード';
        const icon = document.getElementById('html-edit-mode-icon');
        if (icon) icon.className = isEdit ? 'bi bi-eye' : 'bi bi-pencil-square';

        // 選択要素に応じたプロパティ表示
        const sel = this._getSelectedHtmlElement();
        const isTextbox = sel?.classList?.contains('dkc-textbox');
        const isShape = sel?.classList?.contains('dkc-shape-wrapper');
        const hasSel = !!sel;

        // 挿入系: 編集モード かつ 要素未選択時のみ表示
        menu.querySelectorAll('.html-insert-only').forEach(el => { el.style.display = (isEdit && !hasSel) ? '' : 'none'; });
        menu.querySelectorAll('.html-text-prop').forEach(el => { el.style.display = (isEdit && isTextbox) ? '' : 'none'; });
        menu.querySelectorAll('.html-shape-prop').forEach(el => { el.style.display = (isEdit && isShape) ? '' : 'none'; });
        menu.querySelectorAll('.html-elem-prop').forEach(el => { el.style.display = (isEdit && hasSel) ? '' : 'none'; });

        if (isTextbox) this._syncTextPropertyInputs(sel);
        else if (isShape) this._syncShapePropertyInputs(sel);

        menu.style.left = `${pos.clientX}px`;
        menu.style.top = `${pos.clientY}px`;
        menu.classList.add('visible');

        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) menu.style.left = `${pos.clientX - rect.width}px`;
            if (rect.bottom > window.innerHeight) menu.style.top = `${pos.clientY - rect.height}px`;
        });
    }

    _hideHtmlEditorContextMenu() {
        this.htmlEditorContextMenu?.classList.remove('visible');
    }

    _getSelectedHtmlElement() {
        try {
            return this.elements.htmlViewer.contentDocument?.querySelector('[data-dkc-selected]') || null;
        } catch { return null; }
    }

    _handleHtmlEditorAction(action) {
        if (action === 'toggle-edit') return this._toggleHtmlEditMode();
        if (action === 'insert-image') return this._insertImageIntoHtml();
        if (action === 'insert-text') return this._insertTextIntoHtml();
        if (action === 'insert-input') return this._insertInputIntoHtml();
        if (action === 'insert-select') return this._insertSelectIntoHtml();
        if (action === 'delete-element') return this._deleteSelectedHtmlElement();
        if (action === 'save') return this._saveEditedHtml();
        if (action?.startsWith('order-')) return this._changeElementOrder(action.replace('order-', ''));
        if (SHAPE_ACTIONS[action]) return this._insertShapeIntoHtml(SHAPE_ACTIONS[action]);
    }

    // ===== 編集モード切替 =====

    _toggleHtmlEditMode() {
        this.htmlEditorState.isEditMode ? this._exitHtmlEditMode() : this._enterHtmlEditMode();
    }

    _enterHtmlEditMode() {
        const doc = this._getIframeDoc();
        if (!doc) { alert('このHTMLファイルは編集できません'); return; }

        this.htmlEditorState.isEditMode = true;
        this.htmlEditorState.hasChanges = false;
        this.elements.htmlViewerContainer.classList.add('html-edit-mode');

        this._injectEditStyles(doc);
        this._migrateLegacyPositioning(doc);
        this._enableHtmlDragging(doc);
    }

    async _exitHtmlEditMode() {
        const shouldSave = this.htmlEditorState.hasChanges && confirm('未保存の変更があります。保存しますか？');

        this.htmlEditorState.isEditMode = false;
        this.htmlEditorState.hasChanges = false;
        this.elements.htmlViewerContainer.classList.remove('html-edit-mode');

        if (shouldSave) await this._saveEditedHtml();

        // iframeを再読み込みして編集モードのDOM変更を完全にリセット
        const iframe = this.elements.htmlViewer;
        iframe.src = `${iframe.src.split('?')[0]}?_=${Date.now()}`;
    }

    // ===== レガシー移行 =====

    _migrateLegacyPositioning(doc) {
        doc.querySelectorAll('.dkc-shape-wrapper, .dkc-textbox, .dkc-input-wrapper, .dkc-select-wrapper, img[style*="position"]').forEach(el => {
            const left = parseInt(el.style.left || '0', 10);
            const top = parseInt(el.style.top || '0', 10);
            if ((left !== 0 || top !== 0) && el.style.position === 'relative') {
                el.style.transform = `translate(${left}px, ${top}px)`;
                el.style.left = '';
                el.style.top = '';
                el.style.position = '';
            }
        });
    }

    // ===== スタイル注入 =====

    /** iframe内にBootstrap CSSを注入（未注入時のみ） */
    _ensureBootstrapCSS(doc) {
        if (doc.getElementById('dkc-bootstrap-css')) return;
        const link = doc.createElement('link');
        link.id = 'dkc-bootstrap-css';
        link.rel = 'stylesheet';
        link.href = '/static/vendor/bootstrap.min.css';
        doc.head.appendChild(link);
    }

    _injectEditStyles(doc) {
        if (doc.getElementById('dkc-html-edit-styles')) return;

        const style = doc.createElement('style');
        style.id = 'dkc-html-edit-styles';
        style.textContent = EDIT_CSS;
        doc.head.appendChild(style);

        doc.querySelectorAll('body > *, body > * *').forEach(el => {
            if (SKIP_TAGS.has(el.tagName) || el.namespaceURI === SVG_NS) return;
            el.setAttribute('data-dkc-draggable', '');
        });
    }

    // ===== ドラッグ処理 =====

    _enableHtmlDragging(doc) {
        this._iframeMouseDown = (e) => this._handleIframeMouseDown(e, doc);
        this._iframeMouseMove = (e) => this._handleIframeMouseMove(e, doc);
        this._iframeMouseUp   = ()  => this._handleIframeMouseUp();
        this._iframeDblClick  = (e) => this._handleIframeDblClick(e, doc);

        doc.addEventListener('mousedown', this._iframeMouseDown);
        doc.addEventListener('mousemove', this._iframeMouseMove);
        doc.addEventListener('mouseup', this._iframeMouseUp);
        doc.addEventListener('dblclick', this._iframeDblClick);
    }

    _disableHtmlDragging(doc) {
        const events = {
            _iframeMouseDown: 'mousedown', _iframeMouseMove: 'mousemove',
            _iframeMouseUp: 'mouseup', _iframeDblClick: 'dblclick',
        };
        for (const [key, event] of Object.entries(events)) {
            if (this[key]) doc.removeEventListener(event, this[key]);
            this[key] = null;
        }
    }

    _findDraggableElement(target, doc) {
        let el = target;
        while (el && el !== doc.body && el !== doc.documentElement) {
            if (el.hasAttribute('data-dkc-draggable')) return el;
            el = el.parentElement;
        }
        return null;
    }

    _selectHtmlElement(el, doc) {
        this._deselectHtmlElement(doc);
        if (!el) return;
        el.setAttribute('data-dkc-selected', '');
        this._addResizeHandles(el, doc);
    }

    _deselectHtmlElement(doc) {
        if (!doc) return;
        doc.querySelectorAll('[data-dkc-selected]').forEach(el => {
            el.removeAttribute('data-dkc-selected');
            this._removeResizeHandles(el);
        });
    }

    // ===== リサイズハンドル =====

    _addResizeHandles(el, doc) {
        this._removeResizeHandles(el);
        const computed = doc.defaultView.getComputedStyle(el);
        if (computed.position === 'static') {
            el.dataset.dkcEditPosition = 'true';
            el.style.position = 'relative';
        }
        RESIZE_DIRS.forEach(dir => {
            const handle = doc.createElement('div');
            handle.className = `dkc-resize-handle ${dir}`;
            handle.dataset.dkcResizeDir = dir;
            el.appendChild(handle);
        });
    }

    _removeResizeHandles(el) {
        if (!el) return;
        el.querySelectorAll('.dkc-resize-handle').forEach(h => h.remove());
        if (el.dataset.dkcEditPosition) {
            el.style.position = '';
            delete el.dataset.dkcEditPosition;
        }
    }

    // ===== マウスイベント =====

    _handleIframeMouseDown(e, doc) {
        if (!this.htmlEditorState.isEditMode || e.button !== 0) return;

        // リサイズハンドル
        const resizeDir = e.target.dataset?.dkcResizeDir;
        if (resizeDir) {
            e.preventDefault();
            e.stopPropagation();
            const target = e.target.parentElement;
            const t = getTranslateXY(target);
            Object.assign(this.htmlEditorState, {
                resizeDir,
                resizeTarget: target,
                resizeStartX: e.clientX,
                resizeStartY: e.clientY,
                resizeStartW: target.offsetWidth,
                resizeStartH: target.offsetHeight,
                resizeStartTX: t.x,
                resizeStartTY: t.y,
            });
            return;
        }

        // ドラッグ対象
        const target = this._findDraggableElement(e.target, doc);
        if (!target) { this._deselectHtmlElement(doc); return; }

        e.preventDefault();
        const t = getTranslateXY(target);
        Object.assign(this.htmlEditorState, {
            dragTarget: target,
            dragStartX: e.clientX,
            dragStartY: e.clientY,
            elemStartX: t.x,
            elemStartY: t.y,
            isDragging: false,
        });
        this._selectHtmlElement(target, doc);
    }

    _handleIframeMouseMove(e) {
        const st = this.htmlEditorState;

        if (st.resizeTarget) {
            e.preventDefault();
            this._handleResize(e);
            return;
        }
        if (!st.dragTarget) return;

        const dx = e.clientX - st.dragStartX;
        const dy = e.clientY - st.dragStartY;

        if (!st.isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
            st.isDragging = true;
        }
        if (st.isDragging) {
            st.dragTarget.style.transform = `translate(${st.elemStartX + dx}px, ${st.elemStartY + dy}px)`;
        }
    }

    _handleIframeMouseUp() {
        const st = this.htmlEditorState;
        if (st.resizeTarget) {
            st.hasChanges = true;
            st.resizeTarget = null;
            st.resizeDir = null;
        } else if (st.isDragging) {
            st.hasChanges = true;
        }
        st.dragTarget = null;
        st.isDragging = false;
    }

    _handleResize(e) {
        const st = this.htmlEditorState;
        const el = st.resizeTarget;
        const dir = st.resizeDir;
        const dx = e.clientX - st.resizeStartX;
        const dy = e.clientY - st.resizeStartY;

        let newW = st.resizeStartW, newH = st.resizeStartH;
        let tx = st.resizeStartTX, ty = st.resizeStartTY;

        if (dir.includes('e')) newW = Math.max(MIN_RESIZE, st.resizeStartW + dx);
        else if (dir.includes('w')) { newW = Math.max(MIN_RESIZE, st.resizeStartW - dx); tx = st.resizeStartTX + (st.resizeStartW - newW); }

        if (dir.includes('s')) newH = Math.max(MIN_RESIZE, st.resizeStartH + dy);
        else if (dir.includes('n')) { newH = Math.max(MIN_RESIZE, st.resizeStartH - dy); ty = st.resizeStartTY + (st.resizeStartH - newH); }

        el.style.width = `${newW}px`;
        el.style.height = `${newH}px`;
        el.style.transform = `translate(${tx}px, ${ty}px)`;

        if (el.classList.contains('dkc-shape-wrapper') && el.dataset.dkcShapeType) {
            this._refreshHtmlShapeSVG(el, newW, newH);
        }
    }

    // ===== ダブルクリックでテキスト作成 =====

    _handleIframeDblClick(e, doc) {
        if (!this.htmlEditorState.isEditMode) return;

        const target = e.target;
        // 既存の編集可能要素上のダブルクリックは無視
        if (target.closest?.('.dkc-textbox, .dkc-input-wrapper, .dkc-select-wrapper, .dkc-shape-wrapper')) return;

        e.preventDefault();
        e.stopPropagation();

        // クリック位置にテキストボックスを作成
        const textbox = this._createTextbox(doc);
        doc.body.appendChild(textbox);

        // クリック位置へのtransformを計算（bodyからの相対座標）
        const bodyRect = doc.body.getBoundingClientRect();
        const x = e.clientX - bodyRect.left + doc.body.scrollLeft;
        const y = e.clientY - bodyRect.top + doc.body.scrollTop;
        // テキストボックスの通常フロー位置からのオフセットを算出
        const boxRect = textbox.getBoundingClientRect();
        const flowX = boxRect.left - bodyRect.left + doc.body.scrollLeft;
        const flowY = boxRect.top - bodyRect.top + doc.body.scrollTop;
        textbox.style.transform = `translate(${x - flowX}px, ${y - flowY}px)`;

        this.htmlEditorState.hasChanges = true;
        this._selectHtmlElement(textbox, doc);

        // テキスト編集状態にする
        textbox.focus();
        const range = doc.createRange();
        range.selectNodeContents(textbox);
        const sel = doc.defaultView.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    // ===== 要素挿入 =====

    /**
     * 挿入した要素を右クリック位置（またはコンテキスト座標）へ配置
     * bodyに appendChild した後に呼ぶこと
     */
    _placeAtContextPosition(el, doc) {
        const cx = this.htmlEditorState.contextX;
        const cy = this.htmlEditorState.contextY;
        if (cx == null || cy == null) return;

        const bodyRect = doc.body.getBoundingClientRect();
        const targetX = cx - bodyRect.left + doc.body.scrollLeft;
        const targetY = cy - bodyRect.top + doc.body.scrollTop;

        const elRect = el.getBoundingClientRect();
        const flowX = elRect.left - bodyRect.left + doc.body.scrollLeft;
        const flowY = elRect.top - bodyRect.top + doc.body.scrollTop;

        el.style.transform = `translate(${targetX - flowX}px, ${targetY - flowY}px)`;
    }

    _insertImageIntoHtml() {
        if (!this.htmlEditorState.isEditMode) return;
        const doc = this._getIframeDoc();
        if (!doc) return;

        const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
        input.style.display = 'none';
        document.body.appendChild(input);

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) { input.remove(); return; }

            const reader = new FileReader();
            reader.onload = (ev) => {
                const tempImg = new Image();
                tempImg.onload = () => {
                    const scale = tempImg.naturalWidth > MAX_IMAGE_WIDTH ? MAX_IMAGE_WIDTH / tempImg.naturalWidth : 1;
                    const img = doc.createElement('img');
                    img.src = ev.target.result;
                    img.style.width = `${Math.round(tempImg.naturalWidth * scale)}px`;
                    img.style.height = `${Math.round(tempImg.naturalHeight * scale)}px`;
                    img.style.display = 'block';
                    img.style.margin = '10px 0';
                    img.setAttribute('data-dkc-draggable', '');
                    doc.body.appendChild(img);
                    this._placeAtContextPosition(img, doc);
                    this.htmlEditorState.hasChanges = true;
                    this._selectHtmlElement(img, doc);
                };
                tempImg.src = ev.target.result;
                input.remove();
            };
            reader.readAsDataURL(file);
        });
        input.click();
    }

    /** テキストボックス要素を作成（共通） */
    _createTextbox(doc) {
        const textbox = doc.createElement('div');
        textbox.className = 'dkc-textbox';
        textbox.contentEditable = 'true';
        textbox.textContent = 'テキストを入力';
        textbox.setAttribute('data-dkc-draggable', '');

        textbox.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            textbox.focus();
            const range = doc.createRange();
            range.selectNodeContents(textbox);
            const sel = doc.defaultView.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        });
        textbox.addEventListener('mousedown', (e) => {
            if (doc.activeElement === textbox) e.stopPropagation();
        });
        textbox.addEventListener('input', () => { this.htmlEditorState.hasChanges = true; });
        return textbox;
    }

    _insertTextIntoHtml() {
        if (!this.htmlEditorState.isEditMode) return;
        const doc = this._getIframeDoc();
        if (!doc) return;

        const textbox = this._createTextbox(doc);
        doc.body.appendChild(textbox);
        this._placeAtContextPosition(textbox, doc);
        this.htmlEditorState.hasChanges = true;
        this._selectHtmlElement(textbox, doc);
    }

    _insertInputIntoHtml() {
        if (!this.htmlEditorState.isEditMode) return;
        const doc = this._getIframeDoc();
        if (!doc) return;

        this._ensureBootstrapCSS(doc);

        const wrapper = doc.createElement('div');
        wrapper.className = 'dkc-input-wrapper';
        wrapper.setAttribute('data-dkc-draggable', '');
        wrapper.style.display = 'inline-block';
        wrapper.style.margin = '10px 0';

        const input = doc.createElement('input');
        input.type = 'text';
        input.className = 'form-control';
        input.placeholder = 'テキストを入力';
        input.style.minWidth = '200px';

        wrapper.appendChild(input);
        doc.body.appendChild(wrapper);
        this._placeAtContextPosition(wrapper, doc);
        this.htmlEditorState.hasChanges = true;
        this._selectHtmlElement(wrapper, doc);
    }

    _insertSelectIntoHtml() {
        if (!this.htmlEditorState.isEditMode) return;
        const doc = this._getIframeDoc();
        if (!doc) return;

        this._ensureBootstrapCSS(doc);

        const wrapper = doc.createElement('div');
        wrapper.className = 'dkc-select-wrapper';
        wrapper.setAttribute('data-dkc-draggable', '');
        wrapper.style.display = 'inline-block';
        wrapper.style.margin = '10px 0';

        const select = doc.createElement('select');
        select.className = 'form-select';
        select.style.minWidth = '200px';
        ['選択肢1', '選択肢2', '選択肢3'].forEach(text => {
            const option = doc.createElement('option');
            option.textContent = text;
            select.appendChild(option);
        });

        wrapper.appendChild(select);
        doc.body.appendChild(wrapper);
        this._placeAtContextPosition(wrapper, doc);
        this.htmlEditorState.hasChanges = true;
        this._selectHtmlElement(wrapper, doc);
    }

    _insertShapeIntoHtml(shapeType) {
        if (!this.htmlEditorState.isEditMode) return;
        const doc = this._getIframeDoc();
        if (!doc) return;

        const isLine = shapeType === SHAPE_TYPES.LINE || shapeType === SHAPE_TYPES.ARROW;
        const shapeData = {
            shapeType,
            width: isLine ? 200 : SHAPE_DEFAULTS.width,
            height: isLine ? 20 : SHAPE_DEFAULTS.height,
            fillColor: SHAPE_DEFAULTS.fillColor,
            strokeColor: SHAPE_DEFAULTS.strokeColor,
            strokeWidth: SHAPE_DEFAULTS.strokeWidth,
            opacity: SHAPE_DEFAULTS.opacity,
        };

        const wrapper = doc.createElement('div');
        wrapper.className = 'dkc-shape-wrapper';
        wrapper.setAttribute('data-dkc-draggable', '');
        wrapper.dataset.dkcShapeType = shapeType;
        wrapper.dataset.dkcFillColor = shapeData.fillColor;
        wrapper.dataset.dkcStrokeColor = shapeData.strokeColor;
        wrapper.dataset.dkcStrokeWidth = shapeData.strokeWidth;
        wrapper.dataset.dkcOpacity = shapeData.opacity;
        wrapper.style.display = 'inline-block';
        wrapper.style.width = `${shapeData.width}px`;
        wrapper.style.height = `${shapeData.height}px`;
        wrapper.innerHTML = generateShapeSVG(shapeData);

        const svg = wrapper.querySelector('svg');
        if (svg) svg.style.display = 'block';

        doc.body.appendChild(wrapper);
        this._placeAtContextPosition(wrapper, doc);
        this.htmlEditorState.hasChanges = true;
        this._selectHtmlElement(wrapper, doc);
    }

    _refreshHtmlShapeSVG(wrapper, newW, newH) {
        const svg = wrapper.querySelector('svg');
        if (!svg) return;
        const shapeData = {
            shapeType: wrapper.dataset.dkcShapeType,
            width: newW,
            height: newH,
            fillColor: wrapper.dataset.dkcFillColor || SHAPE_DEFAULTS.fillColor,
            strokeColor: wrapper.dataset.dkcStrokeColor || SHAPE_DEFAULTS.strokeColor,
            strokeWidth: parseFloat(wrapper.dataset.dkcStrokeWidth) || SHAPE_DEFAULTS.strokeWidth,
            opacity: parseFloat(wrapper.dataset.dkcOpacity) || SHAPE_DEFAULTS.opacity,
        };
        const tmp = wrapper.ownerDocument.createElement('div');
        tmp.innerHTML = generateShapeSVG(shapeData);
        tmp.firstChild.style.display = 'block';
        svg.replaceWith(tmp.firstChild);
    }

    _deleteSelectedHtmlElement() {
        try {
            const selected = this.elements.htmlViewer.contentDocument?.querySelector('[data-dkc-selected]');
            if (selected) { selected.remove(); this.htmlEditorState.hasChanges = true; }
        } catch { /* ignore */ }
    }

    // ===== 重ね順 =====

    /**
     * body直下の要素をz-indexでソートしたリストを返す
     * （リサイズハンドル等の編集用要素は除外）
     */
    _getSortedElements(doc) {
        const els = [];
        doc.body.querySelectorAll(':scope > *').forEach(el => {
            if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') return;
            if (el.classList.contains('dkc-resize-handle')) return;
            els.push({ el, z: parseInt(el.style.zIndex || '0', 10) });
        });
        els.sort((a, b) => a.z - b.z);
        return els;
    }

    _changeElementOrder(direction) {
        const el = this._getSelectedHtmlElement();
        if (!el) return;
        const doc = this._getIframeDoc();
        if (!doc) return;

        const sorted = this._getSortedElements(doc);
        const idx = sorted.findIndex(item => item.el === el || item.el.contains(el) || el.contains(item.el));
        if (idx === -1) return;

        const setZ = (target, value) => {
            target.style.zIndex = value;
            // z-indexを効かせるためposition:relativeが必要
            if (!target.style.transform && !target.style.position) {
                target.style.position = 'relative';
            }
        };

        switch (direction) {
            case 'front': {
                const maxZ = sorted[sorted.length - 1].z;
                if (sorted[idx].z < maxZ) setZ(el, maxZ + 1);
                break;
            }
            case 'forward': {
                // 自分より上にある最も近い要素とz-indexをスワップ
                const above = sorted.find((item, i) => i > idx && item.el !== el);
                if (above) {
                    const myZ = sorted[idx].z;
                    const aboveZ = above.z;
                    setZ(el, aboveZ);
                    // 同じz-indexの場合は上を1下げて確実に入れ替え
                    setZ(above.el, myZ === aboveZ ? aboveZ - 1 : myZ);
                }
                break;
            }
            case 'backward': {
                // 自分より下にある最も近い要素とz-indexをスワップ
                const belowArr = sorted.filter((item, i) => i < idx && item.el !== el);
                const below = belowArr.length ? belowArr[belowArr.length - 1] : null;
                if (below) {
                    const myZ = sorted[idx].z;
                    const belowZ = below.z;
                    setZ(el, belowZ);
                    setZ(below.el, myZ === belowZ ? belowZ + 1 : myZ);
                }
                break;
            }
            case 'back': {
                const minZ = sorted[0].z;
                if (sorted[idx].z > minZ) setZ(el, minZ - 1);
                break;
            }
        }

        this.htmlEditorState.hasChanges = true;
    }

    // ===== 保存 =====

    async _saveEditedHtml() {
        const doc = this._getIframeDoc();
        if (!doc) { alert('HTMLの保存に失敗しました'); return; }

        this._stripEditAttributes(doc);
        this._ensurePermanentStyles(doc);
        const content = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;

        if (this.htmlEditorState.isEditMode) {
            this._restoreEditMode(doc);
        }

        this.showLoading();
        try {
            const result = await this.apiCall(API.SAVE_HTML, {
                method: 'POST',
                body: { path: this.state.currentFilePath, content },
            });
            if (result.status === 'success') {
                this.htmlEditorState.hasChanges = false;
                this.showSaveIndicator('保存しました');
            } else {
                alert(result.message || '保存に失敗しました');
            }
        } catch (e) {
            console.error('HTML保存エラー:', e);
            alert('保存に失敗しました');
        } finally {
            this.hideLoading();
        }
    }

    /** 編集用の属性・スタイルを除去 */
    _stripEditAttributes(doc) {
        // 編集用CSS除去
        doc.getElementById('dkc-html-edit-styles')?.remove();

        // data属性除去
        doc.querySelectorAll('[data-dkc-draggable]').forEach(el => {
            el.removeAttribute('data-dkc-draggable');
            el.removeAttribute('data-dkc-selected');
        });

        // リサイズハンドル用のposition除去
        doc.querySelectorAll('[data-dkc-edit-position]').forEach(el => {
            el.style.position = '';
            delete el.dataset.dkcEditPosition;
        });

        // 未移動要素からtranslate(0,0)を除去（挿入要素は除外）
        const insertedClasses = ['dkc-shape-wrapper', 'dkc-textbox', 'dkc-input-wrapper', 'dkc-select-wrapper'];
        doc.querySelectorAll('[style]').forEach(el => {
            if (insertedClasses.some(c => el.classList.contains(c))) return;
            const t = getTranslateXY(el);
            if (el.style.transform && t.x === 0 && t.y === 0) el.style.transform = '';
        });

        // テキストボックスのcontentEditable除去
        doc.querySelectorAll('.dkc-textbox').forEach(el => el.removeAttribute('contenteditable'));

        // リサイズハンドル除去
        doc.querySelectorAll('.dkc-resize-handle').forEach(h => h.remove());

        // SVG内部の編集属性除去
        doc.querySelectorAll('.dkc-shape-wrapper *').forEach(child => {
            child.removeAttribute('data-dkc-draggable');
            child.removeAttribute('data-dkc-selected');
            if (child.dataset.dkcEditPosition) delete child.dataset.dkcEditPosition;
            if (child.namespaceURI === SVG_NS) child.style.transform = '';
        });
    }

    /** 挿入要素の永続スタイルを確保 */
    _ensurePermanentStyles(doc) {
        const hasShapes = doc.querySelector('.dkc-shape-wrapper');
        const hasTextboxes = doc.querySelector('.dkc-textbox');
        const hasInputs = doc.querySelector('.dkc-input-wrapper');
        const hasSelects = doc.querySelector('.dkc-select-wrapper');
        const hasFormElements = hasInputs || hasSelects;

        if (!hasShapes && !hasTextboxes && !hasFormElements) {
            doc.getElementById('dkc-permanent-styles')?.remove();
            doc.getElementById('dkc-bootstrap-css')?.remove();
            return;
        }

        // input/selectがある場合はBootstrap CSSを永続化
        if (hasFormElements) {
            this._ensureBootstrapCSS(doc);
        } else {
            doc.getElementById('dkc-bootstrap-css')?.remove();
        }

        let permStyle = doc.getElementById('dkc-permanent-styles');
        if (!permStyle) {
            permStyle = doc.createElement('style');
            permStyle.id = 'dkc-permanent-styles';
            doc.head.appendChild(permStyle);
        }

        let css = '';
        if (hasShapes) {
            css += '.dkc-shape-wrapper { display: inline-block; }\n';
            css += '.dkc-shape-wrapper svg { display: block; }\n';
        }
        if (hasTextboxes) {
            css += '.dkc-textbox { display: inline-block; min-width: 100px; min-height: 1.5em; ';
            css += 'padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; ';
            css += 'background: #fff; font-size: 14px; line-height: 1.5; }\n';
        }
        if (hasFormElements) {
            css += '.dkc-input-wrapper, .dkc-select-wrapper { display: inline-block; margin: 10px 0; }\n';
            css += '.dkc-input-wrapper .form-control, .dkc-select-wrapper .form-select { min-width: 200px; }\n';
        }
        permStyle.textContent = css;
    }

    /** 保存後に編集モードを復元 */
    _restoreEditMode(doc) {
        this._injectEditStyles(doc);
        doc.querySelectorAll('.dkc-textbox').forEach(el => { el.contentEditable = 'true'; });
        doc.querySelectorAll('[data-dkc-selected]').forEach(el => this._addResizeHandles(el, doc));
    }

    // ===== プロパティ編集 =====

    _initHtmlPropertyListeners() {
        // テキストプロパティ
        this._bindPropertyInput('html-text-fontsize', 'change', 'dkc-textbox', (el, val) => { el.style.fontSize = `${val}px`; });
        this._bindPropertyInput('html-text-color', 'input', 'dkc-textbox', (el, val) => { el.style.color = val; });
        this._bindPropertyInput('html-text-bgcolor', 'input', 'dkc-textbox', (el, val) => { el.style.backgroundColor = val; });

        // 図形プロパティ
        const shapeFill = document.getElementById('html-shape-fill');
        const shapeNoFill = document.getElementById('html-shape-nofill');
        const shapeStroke = document.getElementById('html-shape-stroke');
        const shapeNoStroke = document.getElementById('html-shape-nostroke');

        this._bindShapeInput(shapeFill, 'input', (el, val) => {
            el.dataset.dkcFillColor = val;
            if (shapeNoFill) shapeNoFill.checked = false;
        });
        this._bindShapeInput(shapeNoFill, 'change', (el, val, checked) => {
            el.dataset.dkcFillColor = checked ? 'none' : (shapeFill?.value || '#4285f4');
        });
        this._bindShapeInput(shapeStroke, 'input', (el, val) => {
            el.dataset.dkcStrokeColor = val;
            if (shapeNoStroke) shapeNoStroke.checked = false;
            if (el.dataset.dkcStrokeWidth === '0') el.dataset.dkcStrokeWidth = '2';
        });
        this._bindShapeInput(shapeNoStroke, 'change', (el, val, checked) => {
            el.dataset.dkcStrokeWidth = checked ? '0' : '2';
        });

        // メニュー内クリックの伝播阻止
        [shapeFill, shapeNoFill, shapeStroke, shapeNoStroke,
         document.getElementById('html-text-fontsize'),
         document.getElementById('html-text-color'),
         document.getElementById('html-text-bgcolor'),
        ].forEach(el => el?.addEventListener('click', (e) => e.stopPropagation()));
    }

    /** テキスト系プロパティのバインドヘルパー */
    _bindPropertyInput(id, event, className, applyFn) {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener(event, (e) => {
            e.stopPropagation();
            const el = this._getSelectedHtmlElement();
            if (el?.classList?.contains(className)) {
                applyFn(el, e.target.value);
                this.htmlEditorState.hasChanges = true;
            }
        });
    }

    /** 図形プロパティのバインドヘルパー */
    _bindShapeInput(input, event, applyFn) {
        if (!input) return;
        input.addEventListener(event, (e) => {
            e.stopPropagation();
            const el = this._getSelectedHtmlElement();
            if (el?.classList?.contains('dkc-shape-wrapper')) {
                applyFn(el, e.target.value, e.target.checked);
                this._refreshHtmlShapeSVG(el, el.offsetWidth, el.offsetHeight);
                this.htmlEditorState.hasChanges = true;
            }
        });
    }

    _syncTextPropertyInputs(el) {
        const computed = el.ownerDocument.defaultView.getComputedStyle(el);
        const set = (id, val) => { const e = document.getElementById(id); if (e) e.value = val; };
        set('html-text-fontsize', parseInt(computed.fontSize, 10) || 14);
        set('html-text-color', cssColorToHex(computed.color) || '#333333');
        set('html-text-bgcolor', cssColorToHex(computed.backgroundColor) || '#ffffff');
    }

    _syncShapePropertyInputs(el) {
        const fillColor = el.dataset.dkcFillColor || '#4285f4';
        const strokeColor = el.dataset.dkcStrokeColor || '#333333';
        const strokeWidth = parseFloat(el.dataset.dkcStrokeWidth ?? 2);

        const set = (id, val) => { const e = document.getElementById(id); if (e) e.value = val; };
        const check = (id, val) => { const e = document.getElementById(id); if (e) e.checked = val; };

        set('html-shape-fill', fillColor === 'none' ? '#4285f4' : fillColor);
        check('html-shape-nofill', fillColor === 'none');
        set('html-shape-stroke', strokeColor);
        check('html-shape-nostroke', strokeWidth === 0);
    }

    // ===== クリーンアップ =====

    _cleanupHtmlEditor() {
        if (!this.htmlEditorState?.isEditMode) return;
        this.htmlEditorState.isEditMode = false;
        this.htmlEditorState.hasChanges = false;
        this.elements.htmlViewerContainer?.classList.remove('html-edit-mode');
    }
};
