import state from './state.js';

export class Joystick {
    constructor(element, onInput) {
        this.element = element;
        this.stick = element.querySelector('.joystick-stick');
        this.onInput = onInput;
        this.active = false;
        this.touchId = null;
        this.maxDist = 35;

        element.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        window.addEventListener('touchend', (e) => this.onTouchEnd(e));
        element.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', () => this.onMouseUp());
    }

    getCenter() {
        const rect = this.element.querySelector('.joystick-base').getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    processInput(cx, cy) {
        const c = this.getCenter();
        let dx = cx - c.x, dy = cy - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.maxDist) { dx = dx / dist * this.maxDist; dy = dy / dist * this.maxDist; }
        this.stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        this.onInput(dx / this.maxDist, dy / this.maxDist);
    }

    reset() {
        this.stick.style.transform = 'translate(-50%, -50%)';
        this.onInput(0, 0);
        this.active = false;
        this.touchId = null;
    }

    onTouchStart(e) {
        e.preventDefault();
        if (this.active) return;
        const t = e.changedTouches[0];
        this.active = true;
        this.touchId = t.identifier;
        this.processInput(t.clientX, t.clientY);
    }
    onTouchMove(e) {
        if (!this.active) return;
        for (const t of e.changedTouches) {
            if (t.identifier === this.touchId) { e.preventDefault(); this.processInput(t.clientX, t.clientY); return; }
        }
    }
    onTouchEnd(e) {
        if (!this.active) return;
        for (const t of e.changedTouches) { if (t.identifier === this.touchId) { this.reset(); return; } }
    }
    onMouseDown(e) { e.preventDefault(); this.active = true; this.processInput(e.clientX, e.clientY); }
    onMouseMove(e) { if (this.active) this.processInput(e.clientX, e.clientY); }
    onMouseUp() { if (this.active) this.reset(); }
}

// Keyboard input
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

export function getKeyboardInput() {
    let mx = 0, my = 0;
    if (keys['KeyW'] || keys['ArrowUp']) my = -1;
    if (keys['KeyS'] || keys['ArrowDown']) my = 1;
    if (keys['KeyA'] || keys['ArrowLeft']) mx = -1;
    if (keys['KeyD'] || keys['ArrowRight']) mx = 1;
    const len = Math.sqrt(mx * mx + my * my);
    if (len > 1) { mx /= len; my /= len; }
    return { mx, my };
}
