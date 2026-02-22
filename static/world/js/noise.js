import * as THREE from '/static/vendor/three/three.module.js';
import { WATER_LEVEL } from './constants.js';

class SimplexNoise {
    constructor(seed = 0) {
        this.grad3 = [
            [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
            [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
            [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
        ];
        this.perm = new Uint8Array(512);
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        let s = seed;
        for (let i = 255; i > 0; i--) {
            s = (s * 16807 + 0) % 2147483647;
            const j = s % (i + 1);
            [p[i], p[j]] = [p[j], p[i]];
        }
        for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }

    noise2D(x, y) {
        const F2 = 0.5 * (Math.sqrt(3) - 1);
        const G2 = (3 - Math.sqrt(3)) / 6;
        const s = (x + y) * F2;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);
        const t = (i + j) * G2;
        const X0 = i - t, Y0 = j - t;
        const x0 = x - X0, y0 = y - Y0;
        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
        const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
        const ii = i & 255, jj = j & 255;
        const dot = (g, x, y) => g[0] * x + g[1] * y;
        let n0 = 0, n1 = 0, n2 = 0;
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * dot(this.grad3[this.perm[ii + this.perm[jj]] % 12], x0, y0); }
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * dot(this.grad3[this.perm[ii + i1 + this.perm[jj + j1]] % 12], x1, y1); }
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * dot(this.grad3[this.perm[ii + 1 + this.perm[jj + 1]] % 12], x2, y2); }
        return 70 * (n0 + n1 + n2);
    }

    fbm(x, y, octaves = 6, lacunarity = 2, gain = 0.5) {
        let value = 0, amplitude = 1, frequency = 1, max = 0;
        for (let i = 0; i < octaves; i++) {
            value += amplitude * this.noise2D(x * frequency, y * frequency);
            max += amplitude;
            amplitude *= gain;
            frequency *= lacunarity;
        }
        return value / max;
    }
}

export const noise = new SimplexNoise(42);
export const noise2 = new SimplexNoise(137);

export function getTerrainHeight(x, z) {
    const s = 0.003;
    let h = noise.fbm(x * s * 0.25, z * s * 0.25, 3, 2.0, 0.55) * 45;
    h += noise.fbm(x * s * 0.8, z * s * 0.8, 5, 2.0, 0.48) * 22;
    h += noise2.fbm(x * s * 3, z * s * 3, 4, 2.2, 0.45) * 4;
    const ridge = Math.abs(noise.fbm(x * s * 0.6 + 100, z * s * 0.6 + 100, 4, 2.0, 0.5));
    h += ridge * 18;
    const distFromCenter = Math.sqrt(x * x + z * z);
    if (distFromCenter < 150) {
        const t = 1 - distFromCenter / 150;
        h -= t * t * 30;
    }
    const riverDist = Math.abs(z - Math.sin(x * 0.008) * 80 - 40);
    if (riverDist < 15 && h < 8) {
        const riverDepth = (1 - riverDist / 15);
        h -= riverDepth * riverDepth * 6;
    }
    return h;
}

export function getTerrainNormal(x, z) {
    const e = 0.5;
    const hL = getTerrainHeight(x - e, z);
    const hR = getTerrainHeight(x + e, z);
    const hD = getTerrainHeight(x, z - e);
    const hU = getTerrainHeight(x, z + e);
    return new THREE.Vector3(hL - hR, 2 * e, hD - hU).normalize();
}
