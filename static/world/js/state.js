import * as THREE from '/static/vendor/three/three.module.js';

// Mutable shared state
const state = {
    // Player
    player: new THREE.Vector3(0, 0, 0),
    playerFacing: 0,
    cameraTheta: 0,
    cameraPhi: 1.38,
    moveInput: { x: 0, y: 0 },
    lookInput: { x: 0, y: 0 },
    clock: new THREE.Clock(),
    time: 0,
    windTime: 0,

    // Scene refs (set during init)
    renderer: null,
    scene: null,
    camera: null,

    // Object refs (set during creation)
    terrain: null,
    water: null,
    sky: null,
    sun: null,
    grassInstanced: null,
    meadowInstanced: null,
    treeLeafInstances: null,
    treeTrunkInstances: null,
    particleSystem: null,
    minimapCtx: null,
};

export default state;
