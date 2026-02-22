import * as THREE from '/static/vendor/three/three.module.js';
import {
    TERRAIN_SIZE, WATER_LEVEL, PLAYER_HEIGHT, MOVE_SPEED,
    CAMERA_DISTANCE, CAMERA_MIN_PHI, CAMERA_MAX_PHI, CAMERA_AUTO_TURN_SPEED,
} from './constants.js';
import { getTerrainHeight } from './noise.js';
import { getKeyboardInput } from './controls.js';
import state from './state.js';

export function updatePlayer(dt) {
    const kb = getKeyboardInput();
    const inputX = state.moveInput.x + kb.mx;
    const inputY = state.moveInput.y + kb.my;

    if (Math.abs(inputX) > 0.01 || Math.abs(inputY) > 0.01) {
        const forward = new THREE.Vector3(
            -Math.sin(state.cameraTheta), 0, -Math.cos(state.cameraTheta)
        );
        const right = new THREE.Vector3(
            Math.cos(state.cameraTheta), 0, -Math.sin(state.cameraTheta)
        );

        const moveDir = new THREE.Vector3();
        moveDir.addScaledVector(right, inputX);
        moveDir.addScaledVector(forward, -inputY);
        if (moveDir.length() > 1) moveDir.normalize();

        state.player.x += moveDir.x * MOVE_SPEED * dt;
        state.player.z += moveDir.z * MOVE_SPEED * dt;

        state.playerFacing = Math.atan2(moveDir.x, moveDir.z);

        // Auto camera turn when right stick is not used
        if (Math.abs(state.lookInput.x) < 0.05) {
            let targetTheta = state.playerFacing + Math.PI;
            let diff = targetTheta - state.cameraTheta;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const lateralFactor = Math.abs(inputX) * 0.7 + 0.3;
            state.cameraTheta += diff * CAMERA_AUTO_TURN_SPEED * lateralFactor * dt;
        }

        const halfSize = TERRAIN_SIZE * 0.45;
        state.player.x = Math.max(-halfSize, Math.min(halfSize, state.player.x));
        state.player.z = Math.max(-halfSize, Math.min(halfSize, state.player.z));
    }

    const targetY = Math.max(getTerrainHeight(state.player.x, state.player.z), WATER_LEVEL) + PLAYER_HEIGHT;
    state.player.y += (targetY - state.player.y) * Math.min(1, dt * 8);
}

export function updateCamera(dt) {
    state.cameraTheta -= state.lookInput.x * 0.04;
    state.cameraPhi -= state.lookInput.y * 0.025;
    state.cameraPhi = Math.max(CAMERA_MIN_PHI, Math.min(CAMERA_MAX_PHI, state.cameraPhi));

    const offsetX = CAMERA_DISTANCE * Math.sin(state.cameraPhi) * Math.sin(state.cameraTheta);
    const offsetY = CAMERA_DISTANCE * Math.cos(state.cameraPhi);
    const offsetZ = CAMERA_DISTANCE * Math.sin(state.cameraPhi) * Math.cos(state.cameraTheta);

    const targetCamPos = new THREE.Vector3(
        state.player.x + offsetX,
        state.player.y + offsetY,
        state.player.z + offsetZ
    );

    state.camera.position.lerp(targetCamPos, Math.min(1, dt * 10));

    const camTerrainY = getTerrainHeight(state.camera.position.x, state.camera.position.z);
    if (state.camera.position.y < camTerrainY + 1.5) {
        state.camera.position.y = camTerrainY + 1.5;
    }

    state.camera.lookAt(state.player.x, state.player.y - 0.5, state.player.z);
}
