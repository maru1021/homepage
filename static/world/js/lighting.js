import * as THREE from '/static/vendor/three/three.module.js';
import state from './state.js';

export function createLighting() {
    const ambient = new THREE.AmbientLight(0x7799bb, 0.5);
    state.scene.add(ambient);

    state.sun = new THREE.DirectionalLight(0xfff0d0, 2.0);
    state.sun.position.set(300, 400, 250);
    state.sun.castShadow = true;
    state.sun.shadow.mapSize.set(4096, 4096);
    state.sun.shadow.camera.near = 1;
    state.sun.shadow.camera.far = 1000;
    const s = 150;
    state.sun.shadow.camera.left = -s;
    state.sun.shadow.camera.right = s;
    state.sun.shadow.camera.top = s;
    state.sun.shadow.camera.bottom = -s;
    state.sun.shadow.bias = -0.0005;
    state.sun.shadow.normalBias = 0.02;
    state.scene.add(state.sun);
    state.scene.add(state.sun.target);

    const hemi = new THREE.HemisphereLight(0x88bbff, 0x445522, 0.35);
    state.scene.add(hemi);

    const fill = new THREE.DirectionalLight(0x8899bb, 0.3);
    fill.position.set(-200, 100, -200);
    state.scene.add(fill);
}
