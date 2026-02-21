/**
 * DKCドライブ - PowerPointビューア
 */

import { FILE_TYPES, API } from './constants.js';

/**
 * PowerPointビューアのミックスイン
 */
export const ViewerPPTMixin = (Base) => class extends Base {

    async showPPTViewer(filePath) {
        this.showViewer(FILE_TYPES.POWERPOINT);
        this.showLoading();

        try {
            const response = await fetch(`${API.PPT}?path=${encodeURIComponent(filePath)}`);
            const result = await response.json();

            if (result.status === 'success') {
                this.renderPPTSlides(result.slides);
            } else {
                alert('PowerPointの読み込みに失敗しました: ' + result.message);
            }
        } catch (e) {
            console.error('PowerPoint読み込みエラー:', e);
            alert('PowerPointの読み込みに失敗しました');
        } finally {
            this.hideLoading();
        }
    }

    renderPPTSlides(slides) {
        const container = this.elements.pptContainer;
        const slidesContainer = container.querySelector('.ppt-slides');
        const thumbnails = container.querySelector('.ppt-thumbnails');
        if (!slidesContainer || !thumbnails) return;

        // サムネイル
        thumbnails.innerHTML = slides.map((_, i) =>
            `<div class="ppt-thumbnail ${i === 0 ? 'active' : ''}" data-slide="${i}">
                <span class="ppt-slide-number">${i + 1}</span>
            </div>`
        ).join('');

        this.pptSlides = slides;
        this.currentSlideIndex = 0;
        this.renderCurrentSlide();

        // クリックイベント
        thumbnails.querySelectorAll('.ppt-thumbnail').forEach(thumb => {
            thumb.addEventListener('click', () => {
                this.currentSlideIndex = parseInt(thumb.dataset.slide);
                this.renderCurrentSlide();
                thumbnails.querySelectorAll('.ppt-thumbnail').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
        });
    }

    renderCurrentSlide() {
        const slidesContainer = this.elements.pptContainer.querySelector('.ppt-slides');
        if (!slidesContainer || !this.pptSlides) return;

        const slide = this.pptSlides[this.currentSlideIndex];
        const shapesHtml = slide.shapes.map(shape => {
            const style = `left:${shape.x}%;top:${shape.y}%;width:${shape.width}%;height:${shape.height}%;`;
            if (shape.type === 'text') {
                return `<div class="ppt-text" style="${style}">
                    <p style="font-size:${shape.fontSize || 14}px;">${this.escapeHtml(shape.text)}</p>
                </div>`;
            }
            if (shape.type === 'image') {
                return `<div class="ppt-image" style="${style}">
                    <img src="data:image/${shape.format};base64,${shape.data}" alt="">
                </div>`;
            }
            return '';
        }).join('');

        slidesContainer.innerHTML = `<div class="ppt-slide">${shapesHtml}</div>`;

        const slideInfo = this.elements.pptContainer.querySelector('.ppt-slide-info');
        if (slideInfo) {
            slideInfo.textContent = `${this.currentSlideIndex + 1} / ${this.pptSlides.length}`;
        }
    }

    nextSlide() {
        if (!this.pptSlides || this.currentSlideIndex >= this.pptSlides.length - 1) return;
        this.currentSlideIndex++;
        this.renderCurrentSlide();
        this.updatePPTThumbnailActive();
    }

    prevSlide() {
        if (!this.pptSlides || this.currentSlideIndex <= 0) return;
        this.currentSlideIndex--;
        this.renderCurrentSlide();
        this.updatePPTThumbnailActive();
    }

    updatePPTThumbnailActive() {
        const thumbnails = this.elements.pptContainer?.querySelector('.ppt-thumbnails');
        if (!thumbnails) return;
        thumbnails.querySelectorAll('.ppt-thumbnail').forEach((t, i) => {
            t.classList.toggle('active', i === this.currentSlideIndex);
        });
    }
};
