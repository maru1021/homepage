import * as THREE from '/static/vendor/three/three.module.js';
import { CAMERA_DISTANCE, WATER_LEVEL, PLAYER_HEIGHT } from './constants.js';
import state from './state.js';
import { getTerrainHeight } from './noise.js';
import { createSky } from './sky.js';
import { createTerrain } from './terrain.js';
import { createWater } from './water.js';
import { createLighting } from './lighting.js';
import { createTrees } from './trees.js';
import { createGrass, createMeadow, createFlowers } from './vegetation.js';
import { createRocks } from './rocks.js';
import { createParticles } from './particles.js';
import { Joystick } from './controls.js';
import { initMinimap, updateMinimap } from './minimap.js';
import { updatePlayer, updateCamera } from './player.js';

// ============================================================
// Renderer & Scene init
// ============================================================

function initRenderer() {
    state.renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('world-canvas'),
        antialias: true,
        powerPreference: 'high-performance',
    });
    state.renderer.setSize(window.innerWidth, window.innerHeight);
    state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    state.renderer.shadowMap.enabled = true;
    state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    state.renderer.toneMappingExposure = 0.95;
    state.renderer.outputColorSpace = THREE.SRGBColorSpace;
}

function initScene() {
    state.scene = new THREE.Scene();
    state.scene.fog = new THREE.FogExp2(0x9dc4e0, 0.0012);
    state.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.3, 3000);
}

// ============================================================
// FPS counter
// ============================================================

let frameCount = 0, lastFpsTime = 0;

function updateFps(time) {
    frameCount++;
    if (time - lastFpsTime >= 1000) {
        document.getElementById('fps-counter').textContent = `${Math.round(frameCount / ((time - lastFpsTime) / 1000))} FPS`;
        frameCount = 0;
        lastFpsTime = time;
    }
}

// ============================================================
// Animation loop
// ============================================================

function animate(time) {
    requestAnimationFrame(animate);
    const dt = Math.min(state.clock.getDelta(), 0.1);
    state.time = time * 0.001;

    updatePlayer(dt);
    updateCamera(dt);

    // Update uniforms
    if (state.water) {
        state.water.material.uniforms.time.value = state.time;
        state.water.material.uniforms.camPos.value.copy(state.camera.position);
    }
    if (state.terrain) {
        state.terrain.material.uniforms.time.value = state.time;
    }
    if (state.sky) {
        state.sky.material.uniforms.time.value = state.time;
    }

    const windPulse = 0.7 + Math.sin(state.time * 0.3) * 0.2 + Math.sin(state.time * 0.8) * 0.1;

    if (state.grassInstanced) {
        state.grassInstanced.material.uniforms.time.value = state.time;
        state.grassInstanced.material.uniforms.windStrength.value = windPulse;
    }
    if (state.meadowInstanced) {
        state.meadowInstanced.material.uniforms.time.value = state.time;
        state.meadowInstanced.material.uniforms.windStrength.value = windPulse;
    }
    if (state.treeLeafInstances) {
        state.treeLeafInstances.forEach(inst => {
            inst.material.uniforms.time.value = state.time;
            inst.material.uniforms.windStrength.value = windPulse;
        });
    }
    if (state.treeTrunkInstances) {
        state.treeTrunkInstances.forEach(inst => {
            inst.material.uniforms.time.value = state.time;
            inst.material.uniforms.windStrength.value = windPulse;
        });
    }
    if (state.particleSystem) {
        state.particleSystem.material.uniforms.time.value = state.time;
        state.particleSystem.material.uniforms.playerPos.value.set(state.player.x, 0, state.player.z);
    }

    // Shadow camera follows player
    if (state.sun) {
        state.sun.position.set(state.player.x + 150, 250, state.player.z + 120);
        state.sun.target.position.copy(state.player);
        state.sun.target.updateMatrixWorld();
    }

    updateMinimap();
    updateFps(time);
    state.renderer.render(state.scene, state.camera);
}

// ============================================================
// Loading & Init
// ============================================================

function updateLoadingBar(progress) {
    const bar = document.querySelector('.loading-bar');
    if (bar) bar.style.width = `${progress}%`;
}

async function init() {
    updateLoadingBar(5);
    initRenderer();
    updateLoadingBar(10);
    initScene();
    updateLoadingBar(15);

    await new Promise(r => setTimeout(r, 50));
    createSky();
    updateLoadingBar(25);

    await new Promise(r => setTimeout(r, 50));
    createTerrain();
    updateLoadingBar(45);

    await new Promise(r => setTimeout(r, 50));
    createWater();
    updateLoadingBar(55);

    createLighting();
    updateLoadingBar(60);

    await new Promise(r => setTimeout(r, 50));
    createTrees();
    updateLoadingBar(72);

    await new Promise(r => setTimeout(r, 50));
    createRocks();
    updateLoadingBar(78);

    await new Promise(r => setTimeout(r, 50));
    createGrass();
    updateLoadingBar(85);

    createFlowers();
    updateLoadingBar(86);

    await new Promise(r => setTimeout(r, 50));
    createMeadow();
    updateLoadingBar(90);

    createParticles();
    updateLoadingBar(92);

    initMinimap();
    updateLoadingBar(95);

    // Starting position
    state.player.set(50, 0, 50);
    state.player.y = Math.max(getTerrainHeight(50, 50), WATER_LEVEL) + PLAYER_HEIGHT;
    state.camera.position.set(
        state.player.x,
        state.player.y + CAMERA_DISTANCE * Math.cos(state.cameraPhi),
        state.player.z + CAMERA_DISTANCE * Math.sin(state.cameraPhi)
    );
    state.camera.lookAt(state.player.x, state.player.y, state.player.z);

    // Joysticks
    new Joystick(document.querySelector('.joystick-left'), (x, y) => {
        state.moveInput.x = x;
        state.moveInput.y = y;
    });
    new Joystick(document.querySelector('.joystick-right'), (x, y) => {
        state.lookInput.x = x;
        state.lookInput.y = y;
    });

    window.addEventListener('resize', () => {
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    updateLoadingBar(100);
    await new Promise(r => setTimeout(r, 400));
    const ls = document.getElementById('loading-screen');
    ls.classList.add('fade-out');
    await new Promise(r => setTimeout(r, 800));
    ls.style.display = 'none';

    state.clock.start();
    requestAnimationFrame(animate);
}

init();
