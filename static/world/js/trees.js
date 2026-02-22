import * as THREE from '/static/vendor/three/three.module.js';
import { TERRAIN_SIZE, WATER_LEVEL } from './constants.js';
import { getTerrainHeight, getTerrainNormal } from './noise.js';
import state from './state.js';

// Merge multiple BufferGeometry into one
function mergeGeos(geos) {
    let vc = 0, ic = 0;
    geos.forEach(g => { vc += g.attributes.position.count; ic += g.index ? g.index.count : g.attributes.position.count; });
    const pos = new Float32Array(vc * 3);
    const norm = new Float32Array(vc * 3);
    const idx = [];
    let vo = 0;
    geos.forEach(g => {
        const p = g.attributes.position, n = g.attributes.normal;
        for (let i = 0; i < p.count; i++) {
            pos[(vo + i) * 3] = p.getX(i); pos[(vo + i) * 3 + 1] = p.getY(i); pos[(vo + i) * 3 + 2] = p.getZ(i);
            if (n) { norm[(vo + i) * 3] = n.getX(i); norm[(vo + i) * 3 + 1] = n.getY(i); norm[(vo + i) * 3 + 2] = n.getZ(i); }
        }
        if (g.index) { for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + vo); }
        else { for (let i = 0; i < p.count; i++) idx.push(i + vo); }
        vo += p.count;
    });
    const m = new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    m.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    m.setIndex(idx);
    m.computeVertexNormals();
    return m;
}

// Shared leaf wind shader material
function makeLeafMaterial() {
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
            varying vec3 vNormal;
            varying vec3 vWorldPos;
            varying float vLocalY;

            void main() {
                vec3 pos = position;
                vec4 wp4 = instanceMatrix * vec4(pos, 1.0);

                float hf = max(pos.y - 2.0, 0.0) / 8.0;
                hf *= hf;
                float wMain = sin(time * 1.3 + wp4.x * 0.018 + wp4.z * 0.013) * windStrength;
                float wGust = sin(time * 3.5 + wp4.x * 0.07 + wp4.z * 0.05) * 0.3 * windStrength;
                float wLeaf = sin(time * 9.0 + pos.x * 4.0 + pos.z * 3.0 + wp4.x * 0.4) * 0.06;
                float w = (wMain + wGust + wLeaf) * hf;
                wp4.x += w * 1.2;
                wp4.z += w * 0.6;
                wp4.y -= abs(w) * 0.15;

                vWorldPos = wp4.xyz;
                vNormal = normalize(mat3(instanceMatrix) * normal);
                vLocalY = pos.y;
                gl_Position = projectionMatrix * viewMatrix * wp4;
            }
        `,
        fragmentShader: `
            uniform vec3 sunDirection;
            uniform vec3 fogColor;
            uniform float fogDensity;
            varying vec3 vNormal;
            varying vec3 vWorldPos;
            varying float vLocalY;

            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

            void main() {
                vec3 N = normalize(vNormal);
                float NdotL = dot(N, sunDirection);

                float colorVar = hash(floor(vWorldPos.xz * 0.5)) * 0.15;
                vec3 sunLeaf  = vec3(0.28 + colorVar, 0.58, 0.14);
                vec3 shadeLeaf = vec3(0.06, 0.18 + colorVar * 0.5, 0.03);
                vec3 midLeaf  = vec3(0.14, 0.36, 0.07);

                vec3 col = mix(midLeaf, sunLeaf, max(NdotL, 0.0) * 0.85);
                col = mix(col, shadeLeaf, max(-NdotL, 0.0) * 0.55);

                float innerAO = smoothstep(3.0, 7.0, vLocalY) * 0.3 + 0.7;
                col *= innerAO;

                vec3 V = normalize(cameraPosition - vWorldPos);
                float sss = pow(max(dot(V, -sunDirection + N * 0.4), 0.0), 3.0);
                col += vec3(0.18, 0.40, 0.04) * sss * 0.7;

                vec3 lit = col * (0.32 + max(NdotL, 0.0) * 0.68);

                float rim = pow(1.0 - max(dot(V, N), 0.0), 3.5);
                lit += vec3(0.08, 0.18, 0.04) * rim * 0.5;

                float d = length(vWorldPos - cameraPosition);
                float fog = 1.0 - exp(-fogDensity * d * fogDensity * d);
                lit = mix(lit, fogColor, clamp(fog, 0.0, 1.0));

                gl_FragColor = vec4(lit, 1.0);
            }
        `,
        side: THREE.DoubleSide,
    });
}

// Trunk wind shader material
function makeTrunkMaterial() {
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
            varying vec3 vNormal;
            varying vec3 vWorldPos;
            varying float vLocalY;

            void main() {
                vec3 pos = position;
                vec4 wp4 = instanceMatrix * vec4(pos, 1.0);

                float hf = max(pos.y, 0.0) / 8.0;
                hf *= hf * 0.3;
                float w = sin(time * 1.3 + wp4.x * 0.018 + wp4.z * 0.013) * windStrength * hf;
                wp4.x += w * 0.4;
                wp4.z += w * 0.2;

                vWorldPos = wp4.xyz;
                vNormal = normalize(mat3(instanceMatrix) * normal);
                vLocalY = pos.y;
                gl_Position = projectionMatrix * viewMatrix * wp4;
            }
        `,
        fragmentShader: `
            uniform vec3 sunDirection;
            uniform vec3 fogColor;
            uniform float fogDensity;
            varying vec3 vNormal;
            varying vec3 vWorldPos;
            varying float vLocalY;

            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

            void main() {
                vec3 N = normalize(vNormal);
                float NdotL = max(dot(N, sunDirection), 0.0);

                vec3 barkDark = vec3(0.18, 0.10, 0.05);
                vec3 barkLight = vec3(0.35, 0.22, 0.12);
                float barkNoise = hash(floor(vWorldPos.xz * 2.0 + vLocalY * 3.0));
                vec3 bark = mix(barkDark, barkLight, barkNoise * 0.6 + vLocalY * 0.02);

                vec3 lit = bark * (0.35 + NdotL * 0.65);

                float d = length(vWorldPos - cameraPosition);
                float fog = 1.0 - exp(-fogDensity * d * fogDensity * d);
                lit = mix(lit, fogColor, clamp(fog, 0.0, 1.0));

                gl_FragColor = vec4(lit, 1.0);
            }
        `,
        side: THREE.FrontSide,
    });
}

// Recursive procedural tree builder
function buildProceduralTree(seed, trunkHeight, trunkRadius, depth, branchDecay, leafSize) {
    const trunkParts = [];
    const leafParts = [];
    let rng = seed;
    const rand = () => { rng = (rng * 16807 + 13) % 2147483647; return (rng - 1) / 2147483646; };

    function addBranch(ox, oy, oz, dirX, dirY, dirZ, length, radius, level) {
        const seg = Math.max(4, 7 - level);
        const geo = new THREE.CylinderGeometry(radius * 0.4, radius, length, seg);

        const dir = new THREE.Vector3(dirX, dirY, dirZ).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);

        geo.translate(0, length / 2, 0);
        geo.applyQuaternion(quat);
        geo.translate(ox, oy, oz);
        trunkParts.push(geo);

        const ex = ox + dir.x * length;
        const ey = oy + dir.y * length;
        const ez = oz + dir.z * length;

        if (level >= depth) {
            const numLeaves = 3 + Math.floor(rand() * 4);
            for (let i = 0; i < numLeaves; i++) {
                const lr = leafSize * (0.6 + rand() * 0.5);
                const leaf = new THREE.IcosahedronGeometry(lr, 1);
                const p = leaf.attributes.position;
                for (let v = 0; v < p.count; v++) {
                    const px = p.getX(v), py = p.getY(v), pz = p.getZ(v);
                    const d = Math.sin(px * 5 + py * 7 + i) * 0.18 + Math.cos(pz * 4 + px * 3) * 0.12;
                    p.setX(v, px * (1 + d));
                    p.setY(v, py * (1 + d * 0.6));
                    p.setZ(v, pz * (1 + d));
                }
                const lx = ex + (rand() - 0.5) * lr * 1.8;
                const ly = ey + (rand() - 0.3) * lr * 1.2;
                const lz = ez + (rand() - 0.5) * lr * 1.8;
                leaf.translate(lx, ly, lz);
                leafParts.push(leaf);
            }
            return;
        }

        const numChildren = 2 + Math.floor(rand() * 2);
        const spreadBase = 0.35 + level * 0.08;

        for (let i = 0; i < numChildren; i++) {
            const azimuth = rand() * Math.PI * 2;
            const elevationSpread = spreadBase + (rand() - 0.5) * 0.2;

            const perp1 = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
            if (perp1.length() < 0.01) perp1.set(1, 0, 0);
            const perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize();

            const newDir = new THREE.Vector3()
                .addScaledVector(dir, Math.cos(elevationSpread))
                .addScaledVector(perp1, Math.sin(elevationSpread) * Math.cos(azimuth))
                .addScaledVector(perp2, Math.sin(elevationSpread) * Math.sin(azimuth))
                .normalize();

            newDir.y = Math.max(newDir.y, 0.15);
            newDir.normalize();

            const childLen = length * (branchDecay + (rand() - 0.5) * 0.1);
            const childRad = radius * (0.5 + rand() * 0.15);

            addBranch(ex, ey, ez, newDir.x, newDir.y, newDir.z, childLen, childRad, level + 1);
        }

        if (level >= depth - 1 && rand() > 0.4) {
            const mx = ox + dir.x * length * 0.6 + (rand() - 0.5) * 0.5;
            const my = oy + dir.y * length * 0.6 + rand() * 0.3;
            const mz = oz + dir.z * length * 0.6 + (rand() - 0.5) * 0.5;
            const lr = leafSize * (0.5 + rand() * 0.4);
            const leaf = new THREE.IcosahedronGeometry(lr, 1);
            const p = leaf.attributes.position;
            for (let v = 0; v < p.count; v++) {
                const px = p.getX(v), py = p.getY(v), pz = p.getZ(v);
                const d = Math.sin(px * 4 + py * 6) * 0.15;
                p.setX(v, px * (1 + d));
                p.setZ(v, pz * (1 + d));
            }
            leaf.translate(mx, my, mz);
            leafParts.push(leaf);
        }
    }

    addBranch(0, 0, 0, 0, 1, 0, trunkHeight, trunkRadius, 0);
    return { trunkParts, leafParts };
}

function buildBroadleafTree(seed) {
    return buildProceduralTree(seed, 4.5, 0.45, 3, 0.62, 0.9);
}

function buildConiferTree(seed) {
    const trunkParts = [];
    const leafParts = [];
    let rng = seed;
    const rand = () => { rng = (rng * 16807 + 13) % 2147483647; return (rng - 1) / 2147483646; };

    const trunk = new THREE.CylinderGeometry(0.05, 0.3, 10, 6);
    trunk.translate(0, 5, 0);
    trunkParts.push(trunk);

    const tiers = 8;
    for (let t = 0; t < tiers; t++) {
        const y = 2.5 + t * 1.0;
        const tierRadius = (2.8 - t * 0.3) * (0.85 + rand() * 0.3);
        const branchCount = 4 + Math.floor(rand() * 3);
        const angleOffset = rand() * Math.PI * 2;

        for (let b = 0; b < branchCount; b++) {
            const a = angleOffset + (b / branchCount) * Math.PI * 2 + (rand() - 0.5) * 0.3;
            const bLen = tierRadius * (0.7 + rand() * 0.3);

            const br = new THREE.CylinderGeometry(0.01, 0.04, bLen, 4);
            br.rotateZ(Math.PI * 0.38 + rand() * 0.1);
            br.rotateY(a);
            br.translate(Math.sin(a) * bLen * 0.3, y, Math.cos(a) * bLen * 0.3);
            trunkParts.push(br);

            const nx = Math.sin(a) * bLen * 0.55;
            const nz = Math.cos(a) * bLen * 0.55;
            const needle = new THREE.SphereGeometry(0.6 + rand() * 0.3, 5, 4);
            const p = needle.attributes.position;
            for (let v = 0; v < p.count; v++) {
                const stretch = 1.5 + rand() * 0.5;
                const px = p.getX(v), py = p.getY(v), pz = p.getZ(v);
                p.setX(v, px * stretch);
                p.setY(v, py * 0.5);
                p.setZ(v, pz * stretch);
            }
            needle.rotateY(a);
            needle.translate(nx, y + 0.1, nz);
            leafParts.push(needle);
        }
    }

    const top = new THREE.ConeGeometry(0.6, 1.5, 6);
    const tp = top.attributes.position;
    for (let v = 0; v < tp.count; v++) {
        const px = tp.getX(v), pz = tp.getZ(v);
        const d = Math.sin(px * 5 + pz * 4) * 0.1;
        tp.setX(v, px * (1 + d));
        tp.setZ(v, pz * (1 + d));
    }
    top.translate(0, 10.5, 0);
    leafParts.push(top);

    return { trunkParts, leafParts };
}

function buildBushTree(seed) {
    return buildProceduralTree(seed, 1.2, 0.12, 2, 0.7, 0.55);
}

// Place instanced trees of a given variant set
function placeVariants(variants, count, trunkMat, leafMat, filterFn) {
    const dummy = new THREE.Object3D();
    let rng = 12345;
    const rand = () => { rng = (rng * 16807) % 2147483647; return (rng - 1) / 2147483646; };
    const allTrunkInsts = [];
    const allLeafInsts = [];

    variants.forEach(v => {
        const tInst = new THREE.InstancedMesh(v.trunk, trunkMat.clone(), count);
        const lInst = new THREE.InstancedMesh(v.leaf, leafMat.clone(), count);
        tInst.castShadow = true; tInst.receiveShadow = true;
        lInst.castShadow = true; lInst.receiveShadow = true;

        let placed = 0;
        for (let att = 0; att < count * 30 && placed < count; att++) {
            const x = (rand() - 0.5) * TERRAIN_SIZE * 0.88;
            const z = (rand() - 0.5) * TERRAIN_SIZE * 0.88;
            const h = getTerrainHeight(x, z);
            const n = getTerrainNormal(x, z);
            if (!filterFn(h, n, rand)) continue;

            const scale = 0.5 + rand() * 0.6;
            dummy.position.set(x, h, z);
            dummy.scale.set(scale * (0.8 + rand() * 0.4), scale * (0.9 + rand() * 0.2), scale * (0.8 + rand() * 0.4));
            dummy.rotation.set((rand() - 0.5) * 0.05, rand() * Math.PI * 2, (rand() - 0.5) * 0.05);
            dummy.updateMatrix();
            tInst.setMatrixAt(placed, dummy.matrix);
            lInst.setMatrixAt(placed, dummy.matrix);
            placed++;
        }
        tInst.count = placed; lInst.count = placed;
        tInst.instanceMatrix.needsUpdate = true; lInst.instanceMatrix.needsUpdate = true;
        state.scene.add(tInst); state.scene.add(lInst);
        allTrunkInsts.push(tInst); allLeafInsts.push(lInst);
    });

    return { allTrunkInsts, allLeafInsts };
}

export function createTrees() {
    const trunkMat = makeTrunkMaterial();
    const leafMat = makeLeafMaterial();

    // Build geometry variants
    const broadVariants = [];
    for (let i = 0; i < 4; i++) {
        const tree = buildBroadleafTree(42 + i * 1000);
        broadVariants.push({ trunk: mergeGeos(tree.trunkParts), leaf: mergeGeos(tree.leafParts) });
    }
    const conVariants = [];
    for (let i = 0; i < 3; i++) {
        const tree = buildConiferTree(777 + i * 500);
        conVariants.push({ trunk: mergeGeos(tree.trunkParts), leaf: mergeGeos(tree.leafParts) });
    }
    const bushVariants = [];
    for (let i = 0; i < 3; i++) {
        const tree = buildBushTree(333 + i * 700);
        bushVariants.push({ trunk: mergeGeos(tree.trunkParts), leaf: mergeGeos(tree.leafParts) });
    }

    // Place each type with biome-appropriate filters
    const broad = placeVariants(broadVariants, 70, trunkMat, leafMat,
        (h, n) => h > WATER_LEVEL + 1.5 && h <= 20 && n.y >= 0.72);
    const con = placeVariants(conVariants, 55, trunkMat, leafMat,
        (h, n) => h > 5 && h <= 28 && n.y >= 0.7);
    const bush = placeVariants(bushVariants, 100, trunkMat, leafMat,
        (h) => h > WATER_LEVEL + 0.5 && h <= 16);

    state.treeLeafInstances = [...broad.allLeafInsts, ...con.allLeafInsts, ...bush.allLeafInsts];
    state.treeTrunkInstances = [...broad.allTrunkInsts, ...con.allTrunkInsts, ...bush.allTrunkInsts];
}
