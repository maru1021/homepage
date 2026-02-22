import { TERRAIN_SIZE } from './constants.js';
import { getTerrainHeight } from './noise.js';
import state from './state.js';

export function initMinimap() {
    const canvas = document.getElementById('minimap-canvas');
    canvas.width = 140; canvas.height = 140;
    state.minimapCtx = canvas.getContext('2d');
    const img = state.minimapCtx.createImageData(140, 140);
    for (let py = 0; py < 140; py++) {
        for (let px = 0; px < 140; px++) {
            const wx = ((px / 140) - 0.5) * TERRAIN_SIZE;
            const wz = ((py / 140) - 0.5) * TERRAIN_SIZE;
            const h = getTerrainHeight(wx, wz);
            let r, g, b;
            if (h < -1.5) { r = 25; g = 65; b = 120; }
            else if (h < 5) { r = 50; g = 105; b = 40; }
            else if (h < 15) { r = 35; g = 80; b = 28; }
            else if (h < 26) { r = 90; g = 82; b = 70; }
            else { r = 210; g = 215; b = 220; }
            const nx = getTerrainHeight(wx + 2, wz) - h;
            const shade = Math.max(0.6, Math.min(1.2, 1.0 - nx * 0.1));
            const idx = (py * 140 + px) * 4;
            img.data[idx] = Math.min(255, r * shade);
            img.data[idx + 1] = Math.min(255, g * shade);
            img.data[idx + 2] = Math.min(255, b * shade);
            img.data[idx + 3] = 255;
        }
    }
    state.minimapCtx._baseImage = img;
}

export function updateMinimap() {
    if (!state.minimapCtx) return;
    state.minimapCtx.putImageData(state.minimapCtx._baseImage, 0, 0);
    const px = ((state.player.x / TERRAIN_SIZE) + 0.5) * 140;
    const py = ((state.player.z / TERRAIN_SIZE) + 0.5) * 140;
    // View cone
    state.minimapCtx.beginPath();
    const a1 = state.cameraTheta - 0.4;
    const a2 = state.cameraTheta + 0.4;
    state.minimapCtx.moveTo(px, py);
    state.minimapCtx.lineTo(px + Math.sin(a1) * 18, py + Math.cos(a1) * 18);
    state.minimapCtx.lineTo(px + Math.sin(a2) * 18, py + Math.cos(a2) * 18);
    state.minimapCtx.closePath();
    state.minimapCtx.fillStyle = 'rgba(255,80,80,0.25)';
    state.minimapCtx.fill();
    // Player dot
    state.minimapCtx.beginPath();
    state.minimapCtx.arc(px, py, 3.5, 0, Math.PI * 2);
    state.minimapCtx.fillStyle = '#ff4444';
    state.minimapCtx.fill();
    state.minimapCtx.strokeStyle = '#fff';
    state.minimapCtx.lineWidth = 1.5;
    state.minimapCtx.stroke();
}
