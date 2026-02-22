import * as THREE from '/static/vendor/three/three.module.js';
import { TERRAIN_SIZE, WATER_LEVEL } from './constants.js';
import { getTerrainHeight } from './noise.js';
import state from './state.js';

export function createRocks() {
    const geos = [
        new THREE.DodecahedronGeometry(1, 1),
        new THREE.DodecahedronGeometry(1, 0),
        new THREE.IcosahedronGeometry(1, 0),
    ];
    const mats = [
        new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.92, flatShading: true }),
        new THREE.MeshStandardMaterial({ color: 0x6a6560, roughness: 0.9, flatShading: true }),
        new THREE.MeshStandardMaterial({ color: 0x504840, roughness: 0.95, flatShading: true }),
    ];

    const count = 200;
    const instances = geos.map((geo, i) => {
        const inst = new THREE.InstancedMesh(geo, mats[i], count);
        inst.castShadow = true;
        inst.receiveShadow = true;
        return inst;
    });

    const dummy = new THREE.Object3D();
    const placedCounts = [0, 0, 0];

    let rng = 99999;
    const rand = () => { rng = (rng * 16807) % 2147483647; return (rng - 1) / 2147483646; };

    for (let attempt = 0; attempt < 3000; attempt++) {
        const x = (rand() - 0.5) * TERRAIN_SIZE * 0.85;
        const z = (rand() - 0.5) * TERRAIN_SIZE * 0.85;
        const h = getTerrainHeight(x, z);
        if (h < WATER_LEVEL - 1) continue;

        const gi = Math.floor(rand() * 3);
        if (placedCounts[gi] >= count) continue;

        const scale = 0.3 + rand() * 2.5;
        dummy.position.set(x, h + scale * 0.2, z);
        dummy.scale.set(scale * (0.8 + rand() * 0.4), scale * (0.4 + rand() * 0.6), scale * (0.8 + rand() * 0.4));
        dummy.rotation.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
        dummy.updateMatrix();
        instances[gi].setMatrixAt(placedCounts[gi], dummy.matrix);
        placedCounts[gi]++;
    }

    instances.forEach((inst, i) => {
        inst.count = placedCounts[i];
        inst.instanceMatrix.needsUpdate = true;
        state.scene.add(inst);
    });
}
