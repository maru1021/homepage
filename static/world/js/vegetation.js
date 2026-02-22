import * as THREE from '/static/vendor/three/three.module.js';
import { TERRAIN_SIZE, WATER_LEVEL } from './constants.js';
import { noise, getTerrainHeight, getTerrainNormal } from './noise.js';
import state from './state.js';

// ============================================================
// Grass blades with wind shader
// ============================================================

function buildGrassBladeGeo(bladeWidth, bladeHeight, segments) {
    const vertices = [], normals = [], indices = [], uvs = [];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const w = bladeWidth * (1 - t * t);
        const y = bladeHeight * t;
        vertices.push(-w, y, 0);  normals.push(0, 0, 1);  uvs.push(0, t);
        vertices.push(w, y, 0);   normals.push(0, 0, 1);  uvs.push(1, t);
    }
    for (let i = 0; i < segments; i++) {
        const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
        indices.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
}

function makeGrassMaterial(curveStrength, windMultX, windMultZ) {
    return new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            sunDirection: { value: new THREE.Vector3(0.3, 0.45, 0.5).normalize() },
            fogColor: { value: new THREE.Color(0x9dc4e0) },
            fogDensity: { value: 0.0012 },
            windStrength: { value: 1.0 },
        },
        vertexShader: `
            uniform float time;
            uniform float windStrength;
            attribute vec3 instanceOffset;
            attribute float instanceScale;
            attribute float instancePhase;
            attribute float instanceRotation;
            attribute vec3 instanceColor;
            varying float vHeight;
            varying vec3 vWorldPos;
            varying vec3 vColor;

            void main() {
                vec3 pos = position;
                float t = uv.y;

                pos.z += t * t * ${curveStrength.toFixed(1)} * instanceScale;

                float windFactor = t * t * t;
                float wx = instanceOffset.x * 0.02 + instanceOffset.z * 0.015;
                float windMain = sin(time * 1.5 + instancePhase + wx) * windStrength;
                float windGust = sin(time * 4.0 + instancePhase * 2.0 + instanceOffset.x * 0.08) * 0.35 * windStrength;
                float windTurbulence = sin(time * 8.0 + pos.y * 5.0 + instancePhase * 3.0) * 0.08;
                float windTotal = (windMain + windGust + windTurbulence) * windFactor;

                pos.x += windTotal * ${windMultX.toFixed(1)};
                pos.z += windTotal * ${windMultZ.toFixed(1)};
                pos.y *= 1.0 - abs(windTotal) * 0.15;

                float c2 = cos(instanceRotation);
                float s2 = sin(instanceRotation);
                vec3 rotated = vec3(
                    pos.x * c2 - pos.z * s2,
                    pos.y,
                    pos.x * s2 + pos.z * c2
                );

                rotated *= instanceScale;
                rotated += instanceOffset;

                vec4 wp = modelMatrix * vec4(rotated, 1.0);
                vWorldPos = wp.xyz;
                vHeight = t;
                vColor = instanceColor;

                gl_Position = projectionMatrix * viewMatrix * wp;
            }
        `,
        fragmentShader: `
            uniform vec3 sunDirection;
            uniform vec3 fogColor;
            uniform float fogDensity;
            varying float vHeight;
            varying vec3 vWorldPos;
            varying vec3 vColor;

            void main() {
                vec3 baseColor = vColor * 0.5;
                vec3 tipColor = vColor * 1.3;
                vec3 color = mix(baseColor, tipColor, vHeight);

                float NdotL = max(dot(vec3(0, 1, 0), sunDirection), 0.0);
                float ambient = 0.3;
                float diffuse = NdotL * 0.55;

                vec3 viewDir = normalize(cameraPosition - vWorldPos);
                float backLight = pow(max(dot(viewDir, -sunDirection), 0.0), 4.0);
                vec3 sss = vec3(0.2, 0.45, 0.05) * backLight * vHeight * 0.6;

                float spec = pow(max(dot(reflect(-sunDirection, vec3(0,1,0)), viewDir), 0.0), 16.0);
                vec3 lit = color * (ambient + diffuse) + sss + vec3(0.8, 0.9, 0.6) * spec * vHeight * 0.15;

                lit *= smoothstep(0.0, 0.15, vHeight) * 0.5 + 0.5;

                float dist = length(vWorldPos - cameraPosition);
                float fog = 1.0 - exp(-fogDensity * dist * fogDensity * dist);
                lit = mix(lit, fogColor, clamp(fog, 0.0, 1.0));

                float alpha = smoothstep(1.0, 0.85, vHeight);
                gl_FragColor = vec4(lit, mix(0.9, alpha, vHeight));
            }
        `,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: true,
    });
}

function populateInstanceAttributes(geo, bladeCount, placeFn) {
    const offsets = new Float32Array(bladeCount * 3);
    const scales = new Float32Array(bladeCount);
    const phases = new Float32Array(bladeCount);
    const rotations = new Float32Array(bladeCount);
    const colors = new Float32Array(bladeCount * 3);
    let placed = 0;

    placeFn(offsets, scales, phases, rotations, colors, () => placed, (n) => { placed = n; });

    geo.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(scales, 1));
    geo.setAttribute('instancePhase', new THREE.InstancedBufferAttribute(phases, 1));
    geo.setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(rotations, 1));
    geo.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colors, 3));

    return placed;
}

export function createGrass() {
    const bladeCount = 15000;
    const geo = buildGrassBladeGeo(0.12, 1.0, 5);
    const mat = makeGrassMaterial(0.4, 0.8, 0.4);

    state.grassInstanced = new THREE.InstancedMesh(geo, mat, bladeCount);

    const grassColors = [
        [0.22, 0.48, 0.10], [0.28, 0.55, 0.14], [0.15, 0.38, 0.06],
        [0.32, 0.50, 0.18], [0.18, 0.42, 0.08],
    ];

    let rng = 77777;
    const rand = () => { rng = (rng * 16807) % 2147483647; return (rng - 1) / 2147483646; };

    const offsets = new Float32Array(bladeCount * 3);
    const scales = new Float32Array(bladeCount);
    const phases = new Float32Array(bladeCount);
    const rotations = new Float32Array(bladeCount);
    const colors = new Float32Array(bladeCount * 3);
    let placed = 0;

    for (let attempt = 0; attempt < bladeCount * 4 && placed < bladeCount; attempt++) {
        const x = (rand() - 0.5) * TERRAIN_SIZE * 0.72;
        const z = (rand() - 0.5) * TERRAIN_SIZE * 0.72;
        const h = getTerrainHeight(x, z);
        const n = getTerrainNormal(x, z);
        if (h < WATER_LEVEL + 0.3 || h > 22 || n.y < 0.7) continue;

        offsets[placed * 3] = x;
        offsets[placed * 3 + 1] = h;
        offsets[placed * 3 + 2] = z;
        scales[placed] = 0.5 + rand() * 1.2;
        phases[placed] = rand() * Math.PI * 2;
        rotations[placed] = rand() * Math.PI * 2;

        const ci = Math.floor(rand() * grassColors.length);
        const variation = (rand() - 0.5) * 0.06;
        colors[placed * 3] = grassColors[ci][0] + variation;
        colors[placed * 3 + 1] = grassColors[ci][1] + variation;
        colors[placed * 3 + 2] = grassColors[ci][2] + variation;
        placed++;
    }

    geo.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(scales, 1));
    geo.setAttribute('instancePhase', new THREE.InstancedBufferAttribute(phases, 1));
    geo.setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(rotations, 1));
    geo.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colors, 3));

    state.grassInstanced.count = placed;
    state.scene.add(state.grassInstanced);
}

// ============================================================
// Meadow — dense tall thin grass in flatland areas
// ============================================================

export function createMeadow() {
    const bladeCount = 20000;
    const geo = buildGrassBladeGeo(0.04, 1.8, 6);

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            sunDirection: { value: new THREE.Vector3(0.3, 0.45, 0.5).normalize() },
            fogColor: { value: new THREE.Color(0x9dc4e0) },
            fogDensity: { value: 0.0012 },
            windStrength: { value: 1.0 },
        },
        vertexShader: `
            uniform float time;
            uniform float windStrength;
            attribute vec3 instanceOffset;
            attribute float instanceScale;
            attribute float instancePhase;
            attribute float instanceRotation;
            attribute vec3 instanceColor;
            varying float vHeight;
            varying vec3 vWorldPos;
            varying vec3 vColor;

            void main() {
                vec3 pos = position;
                float t = uv.y;

                pos.z += t * t * 0.7 * instanceScale;

                float wf = t * t * t;
                float wx = instanceOffset.x * 0.015 + instanceOffset.z * 0.012;
                float windMain = sin(time * 1.8 + instancePhase + wx) * windStrength;
                float windSlow = sin(time * 0.4 + instanceOffset.x * 0.005) * 0.6 * windStrength;
                float windGust = sin(time * 5.0 + instancePhase * 3.0 + instanceOffset.z * 0.1) * 0.15;
                float wTotal = (windMain + windSlow + windGust) * wf;

                pos.x += wTotal * 1.2;
                pos.z += wTotal * 0.5;
                pos.y *= 1.0 - abs(wTotal) * 0.1;

                float c2 = cos(instanceRotation), s2 = sin(instanceRotation);
                vec3 r = vec3(pos.x * c2 - pos.z * s2, pos.y, pos.x * s2 + pos.z * c2);

                r *= instanceScale;
                r += instanceOffset;

                vec4 wp = modelMatrix * vec4(r, 1.0);
                vWorldPos = wp.xyz;
                vHeight = t;
                vColor = instanceColor;
                gl_Position = projectionMatrix * viewMatrix * wp;
            }
        `,
        fragmentShader: `
            uniform vec3 sunDirection;
            uniform vec3 fogColor;
            uniform float fogDensity;
            varying float vHeight;
            varying vec3 vWorldPos;
            varying vec3 vColor;

            void main() {
                vec3 base = vColor * 0.45;
                vec3 tip = vColor * 1.4;
                tip += vec3(0.1, 0.08, -0.02) * vHeight;
                vec3 color = mix(base, tip, vHeight);

                float NdotL = max(dot(vec3(0, 1, 0), sunDirection), 0.0);
                color *= 0.3 + NdotL * 0.55;

                vec3 V = normalize(cameraPosition - vWorldPos);
                float sss = pow(max(dot(V, -sunDirection), 0.0), 3.0);
                color += vec3(0.25, 0.35, 0.05) * sss * vHeight * 0.7;

                float spec = pow(max(dot(reflect(-sunDirection, vec3(0,1,0)), V), 0.0), 12.0);
                color += vec3(0.6, 0.7, 0.3) * spec * vHeight * 0.2;

                color *= smoothstep(0.0, 0.1, vHeight) * 0.5 + 0.5;

                float d = length(vWorldPos - cameraPosition);
                float fog = 1.0 - exp(-fogDensity * d * fogDensity * d);
                color = mix(color, fogColor, clamp(fog, 0.0, 1.0));

                gl_FragColor = vec4(color, 1.0);
            }
        `,
        side: THREE.DoubleSide,
        transparent: false,
    });

    state.meadowInstanced = new THREE.InstancedMesh(geo, mat, bladeCount);

    const offsets = new Float32Array(bladeCount * 3);
    const scales = new Float32Array(bladeCount);
    const phases = new Float32Array(bladeCount);
    const rotations = new Float32Array(bladeCount);
    const colors = new Float32Array(bladeCount * 3);

    let rng2 = 55555;
    const rand = () => { rng2 = (rng2 * 16807) % 2147483647; return (rng2 - 1) / 2147483646; };
    let placed = 0;

    const meadowColors = [
        [0.35, 0.50, 0.12], [0.42, 0.48, 0.15], [0.50, 0.45, 0.18],
        [0.30, 0.45, 0.10], [0.55, 0.50, 0.22],
    ];

    for (let att = 0; att < bladeCount * 5 && placed < bladeCount; att++) {
        const x = (rand() - 0.5) * TERRAIN_SIZE * 0.75;
        const z = (rand() - 0.5) * TERRAIN_SIZE * 0.75;
        const h = getTerrainHeight(x, z);
        const n = getTerrainNormal(x, z);
        if (h < WATER_LEVEL + 0.8 || h > 12 || n.y < 0.85) continue;

        const meadowNoise = noise.fbm(x * 0.008, z * 0.008, 3, 2, 0.5);
        if (meadowNoise < 0.1 || meadowNoise > 0.6) continue;

        offsets[placed * 3] = x;
        offsets[placed * 3 + 1] = h;
        offsets[placed * 3 + 2] = z;
        scales[placed] = 0.8 + rand() * 1.5;
        phases[placed] = rand() * Math.PI * 2;
        rotations[placed] = rand() * Math.PI * 2;

        const ci = Math.floor(rand() * meadowColors.length);
        const v = (rand() - 0.5) * 0.06;
        colors[placed * 3] = meadowColors[ci][0] + v;
        colors[placed * 3 + 1] = meadowColors[ci][1] + v;
        colors[placed * 3 + 2] = meadowColors[ci][2] + v;
        placed++;
    }

    geo.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(scales, 1));
    geo.setAttribute('instancePhase', new THREE.InstancedBufferAttribute(phases, 1));
    geo.setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(rotations, 1));
    geo.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colors, 3));

    state.meadowInstanced.count = placed;
    state.scene.add(state.meadowInstanced);
}

// ============================================================
// Flowers with stems
// ============================================================

export function createFlowers() {
    const flowerDefs = [
        { color: 0xff6b8a, stem: 0x3a7a2a },
        { color: 0xffdd44, stem: 0x3a7a2a },
        { color: 0xffffff, stem: 0x3a7a2a },
        { color: 0xbb88ff, stem: 0x3a7a2a },
        { color: 0xff6633, stem: 0x3a7a2a },
    ];
    const perColor = 300;

    flowerDefs.forEach(def => {
        const headGeo = new THREE.SphereGeometry(0.25, 6, 5);
        const headPos = headGeo.attributes.position;
        for (let i = 0; i < headPos.count; i++) {
            headPos.setY(i, headPos.getY(i) * 0.6);
        }
        headGeo.computeVertexNormals();

        const headMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.6 });
        const headInst = new THREE.InstancedMesh(headGeo, headMat, perColor);

        const stemGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.8, 4);
        stemGeo.translate(0, 0.4, 0);
        const stemMat = new THREE.MeshStandardMaterial({ color: def.stem, roughness: 0.85 });
        const stemInst = new THREE.InstancedMesh(stemGeo, stemMat, perColor);

        const dummy = new THREE.Object3D();
        let rng = def.color;
        const rand = () => { rng = (rng * 16807 + 1) % 2147483647; return (rng - 1) / 2147483646; };
        let placed = 0;

        for (let attempt = 0; attempt < perColor * 5 && placed < perColor; attempt++) {
            const x = (rand() - 0.5) * TERRAIN_SIZE * 0.55;
            const z = (rand() - 0.5) * TERRAIN_SIZE * 0.55;
            const h = getTerrainHeight(x, z);
            if (h < WATER_LEVEL + 1 || h > 14) continue;

            const s = 0.6 + rand() * 0.8;

            dummy.position.set(x, h, z);
            dummy.scale.set(s, s, s);
            dummy.rotation.set((rand() - 0.5) * 0.2, rand() * Math.PI * 2, (rand() - 0.5) * 0.2);
            dummy.updateMatrix();
            stemInst.setMatrixAt(placed, dummy.matrix);

            dummy.position.set(x, h + 0.8 * s, z);
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            headInst.setMatrixAt(placed, dummy.matrix);

            placed++;
        }

        headInst.count = placed;
        stemInst.count = placed;
        headInst.instanceMatrix.needsUpdate = true;
        stemInst.instanceMatrix.needsUpdate = true;
        state.scene.add(stemInst);
        state.scene.add(headInst);
    });
}
