import * as THREE from '/static/vendor/three/three.module.js';
import state from './state.js';

export function createParticles() {
    const count = 500;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 1] = Math.random() * 30 + 2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
        sizes[i] = 0.5 + Math.random() * 1.5;
        phases[i] = Math.random() * Math.PI * 2;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            playerPos: { value: new THREE.Vector3() },
        },
        vertexShader: `
            attribute float size;
            attribute float phase;
            uniform float time;
            uniform vec3 playerPos;
            varying float vAlpha;
            void main() {
                vec3 pos = position;
                pos.x += playerPos.x;
                pos.z += playerPos.z;
                pos.y += sin(time * 0.5 + phase) * 2.0;
                pos.x += sin(time * 0.3 + phase * 2.0) * 1.5;

                vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = size * (200.0 / -mvPos.z);
                gl_Position = projectionMatrix * mvPos;

                float dist = length(pos - cameraPosition);
                vAlpha = smoothstep(100.0, 10.0, dist) * 0.6;
            }
        `,
        fragmentShader: `
            varying float vAlpha;
            void main() {
                float d = length(gl_PointCoord - 0.5) * 2.0;
                if (d > 1.0) discard;
                float alpha = (1.0 - d * d) * vAlpha;
                gl_FragColor = vec4(1.0, 1.0, 0.9, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    state.particleSystem = new THREE.Points(geo, mat);
    state.scene.add(state.particleSystem);
}
