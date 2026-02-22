import * as THREE from '/static/vendor/three/three.module.js';
import { TERRAIN_SIZE, WATER_LEVEL } from './constants.js';
import state from './state.js';

export function createWater() {
    const waterGeo = new THREE.PlaneGeometry(TERRAIN_SIZE * 2, TERRAIN_SIZE * 2, 200, 200);
    waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            sunDirection: { value: new THREE.Vector3(0.3, 0.45, 0.5).normalize() },
            camPos: { value: new THREE.Vector3() },
            fogColor: { value: new THREE.Color(0x9dc4e0) },
            fogDensity: { value: 0.0012 },
        },
        vertexShader: `
            uniform float time;
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            void main() {
                vec3 pos = position;
                float w1 = sin(pos.x * 0.025 + time * 0.7) * cos(pos.z * 0.018 + time * 0.5) * 0.6;
                float w2 = sin(pos.x * 0.06 + time * 1.1) * sin(pos.z * 0.04 + time * 0.8) * 0.25;
                float w3 = cos(pos.x * 0.012 + pos.z * 0.01 + time * 0.25) * 1.0;
                float w4 = sin(pos.x * 0.15 + time * 1.8) * cos(pos.z * 0.12 + time * 1.5) * 0.08;
                pos.y += w1 + w2 + w3 + w4;

                float dx = cos(pos.x*0.025+time*0.7)*0.025*cos(pos.z*0.018+time*0.5)*0.6
                         + cos(pos.x*0.06+time*1.1)*0.06*sin(pos.z*0.04+time*0.8)*0.25
                         - sin(pos.x*0.012+pos.z*0.01+time*0.25)*0.012*1.0
                         + cos(pos.x*0.15+time*1.8)*0.15*cos(pos.z*0.12+time*1.5)*0.08;
                float dz = sin(pos.x*0.025+time*0.7)*(-sin(pos.z*0.018+time*0.5))*0.018*0.6
                         + sin(pos.x*0.06+time*1.1)*cos(pos.z*0.04+time*0.8)*0.04*0.25
                         - sin(pos.x*0.012+pos.z*0.01+time*0.25)*0.01*1.0
                         + sin(pos.x*0.15+time*1.8)*(-sin(pos.z*0.12+time*1.5))*0.12*0.08;
                vNormal = normalize(normalMatrix * vec3(-dx, 1.0, -dz));

                vec4 wp = modelMatrix * vec4(pos, 1.0);
                vWorldPos = wp.xyz;
                gl_Position = projectionMatrix * viewMatrix * wp;
            }
        `,
        fragmentShader: `
            uniform vec3 sunDirection;
            uniform vec3 camPos;
            uniform float time;
            uniform vec3 fogColor;
            uniform float fogDensity;
            varying vec3 vWorldPos;
            varying vec3 vNormal;

            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float vnoise(vec2 p) {
                vec2 i = floor(p); vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                           mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
            }

            void main() {
                vec3 V = normalize(camPos - vWorldPos);
                vec3 N = normalize(vNormal);

                float cosTheta = max(dot(V, N), 0.0);
                float fresnel = 0.04 + 0.96 * pow(1.0 - cosTheta, 5.0);

                vec3 H = normalize(sunDirection + V);
                float spec = pow(max(dot(N, H), 0.0), 512.0);
                float specBroad = pow(max(dot(N, H), 0.0), 32.0);

                float caustic = vnoise(vWorldPos.xz * 0.08 + time * 0.3);
                caustic += vnoise(vWorldPos.xz * 0.15 - time * 0.2) * 0.5;

                vec3 deepWater = vec3(0.01, 0.06, 0.15);
                vec3 shallowWater = vec3(0.05, 0.20, 0.35);
                vec3 skyReflect = vec3(0.45, 0.65, 0.85);

                float depthFactor = smoothstep(-10.0, 0.0, vWorldPos.y);
                vec3 waterBase = mix(deepWater, shallowWater, depthFactor);
                waterBase += vec3(0.02, 0.05, 0.03) * caustic * depthFactor;

                vec3 color = mix(waterBase, skyReflect, fresnel * 0.7);

                color += vec3(1.0, 0.95, 0.8) * spec * 3.5;
                color += vec3(0.7, 0.8, 0.9) * specBroad * 0.2;

                float sss = pow(max(dot(V, -sunDirection + N * 0.3), 0.0), 3.0);
                color += vec3(0.0, 0.15, 0.12) * sss * 0.5;

                float dist = length(vWorldPos - camPos);
                float fog = 1.0 - exp(-fogDensity * dist * fogDensity * dist);
                color = mix(color, fogColor, clamp(fog, 0.0, 1.0));

                gl_FragColor = vec4(color, mix(0.75, 0.92, fresnel));
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    state.water = new THREE.Mesh(waterGeo, waterMat);
    state.water.position.y = WATER_LEVEL;
    state.scene.add(state.water);
}
