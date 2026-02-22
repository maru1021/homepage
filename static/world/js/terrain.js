import * as THREE from '/static/vendor/three/three.module.js';
import { TERRAIN_SIZE, TERRAIN_SEGMENTS, WATER_LEVEL } from './constants.js';
import { getTerrainHeight } from './noise.js';
import state from './state.js';

export function createTerrain() {
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        positions.setY(i, getTerrainHeight(x, z));
    }
    geo.computeVertexNormals();

    const terrainMat = new THREE.ShaderMaterial({
        uniforms: {
            waterLevel: { value: WATER_LEVEL },
            sunDirection: { value: new THREE.Vector3(0.3, 0.45, 0.5).normalize() },
            fogColor: { value: new THREE.Color(0x9dc4e0) },
            fogDensity: { value: 0.0012 },
            time: { value: 0 },
        },
        vertexShader: `
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying float vHeight;
            void main() {
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vWorldPos = wp.xyz;
                vNormal = normalize(normalMatrix * normal);
                vHeight = position.y;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float waterLevel;
            uniform vec3 sunDirection;
            uniform vec3 fogColor;
            uniform float fogDensity;
            uniform float time;
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying float vHeight;

            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float vnoise(vec2 p) {
                vec2 i = floor(p); vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                           mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
            }
            float fbm3(vec2 p) {
                float v = 0.0, a = 0.5;
                for (int i = 0; i < 3; i++) { v += a * vnoise(p); p *= 2.1; a *= 0.5; }
                return v;
            }

            void main() {
                vec3 N = normalize(vNormal);
                float slope = 1.0 - N.y;
                float h = vHeight;

                float detail = fbm3(vWorldPos.xz * 0.08);
                float detail2 = fbm3(vWorldPos.xz * 0.3);
                float micro = vnoise(vWorldPos.xz * 2.0);

                vec3 deepSand = vec3(0.65, 0.55, 0.38);
                vec3 wetSand = vec3(0.72, 0.65, 0.48);
                vec3 grassLight = vec3(0.30, 0.52, 0.15);
                vec3 grassDark = vec3(0.18, 0.38, 0.08);
                vec3 forest = vec3(0.12, 0.28, 0.06);
                vec3 dirt = vec3(0.42, 0.32, 0.22);
                vec3 rock = vec3(0.45, 0.42, 0.38);
                vec3 rockDark = vec3(0.32, 0.30, 0.28);
                vec3 snow = vec3(0.92, 0.94, 0.96);
                vec3 snowShadow = vec3(0.75, 0.80, 0.88);

                vec3 color;
                float sandLine = waterLevel + 0.8 + detail * 0.5;
                float grassLine = 4.0 + detail * 3.0;
                float forestLine = 14.0 + detail * 4.0;
                float rockLine = 26.0 + detail * 3.0;
                float snowLine = 36.0 + detail * 4.0;

                if (h < sandLine) {
                    float t = smoothstep(waterLevel - 0.5, sandLine, h);
                    color = mix(deepSand, wetSand, t);
                    color = mix(color, color * (0.9 + micro * 0.2), 0.5);
                } else if (h < grassLine) {
                    float t = smoothstep(sandLine, grassLine, h);
                    vec3 grass = mix(grassLight, grassDark, detail2);
                    color = mix(wetSand, grass, smoothstep(0.0, 0.3, t));
                    color = mix(color, dirt, smoothstep(0.5, 0.7, detail) * 0.3);
                    color *= 0.85 + micro * 0.3;
                } else if (h < forestLine) {
                    float t = smoothstep(grassLine, forestLine, h);
                    vec3 grass = mix(grassDark, forest, detail);
                    color = mix(grass, dirt, t * 0.3);
                    color *= 0.85 + detail2 * 0.3;
                } else if (h < rockLine) {
                    float t = smoothstep(forestLine, rockLine, h);
                    color = mix(dirt, rock, t);
                    color = mix(color, rockDark, detail * 0.5);
                    color *= 0.85 + micro * 0.3;
                } else if (h < snowLine) {
                    float t = smoothstep(rockLine, snowLine, h);
                    color = mix(rock, snow, t);
                    color = mix(color, snowShadow, (1.0 - detail) * t * 0.4);
                } else {
                    color = mix(snow, snowShadow, (1.0 - detail2) * 0.3);
                }

                if (slope > 0.35) {
                    float rockBlend = smoothstep(0.35, 0.65, slope);
                    vec3 cliffColor = mix(rockDark, rock, detail2);
                    color = mix(color, cliffColor, rockBlend);
                }

                float NdotL = max(dot(N, sunDirection), 0.0);
                float ambient = 0.35;
                float diffuse = NdotL * 0.65;
                float shadow = smoothstep(-0.1, 0.3, NdotL);

                float sss = 0.0;
                if (h > sandLine && h < forestLine) {
                    float backLight = max(dot(-N, sunDirection), 0.0);
                    sss = backLight * 0.15;
                }

                vec3 lit = color * (ambient + diffuse * shadow) + color * sss * vec3(0.5, 0.8, 0.2);

                if (h < sandLine + 1.0 || h > snowLine - 3.0) {
                    vec3 viewDir = normalize(cameraPosition - vWorldPos);
                    vec3 halfVec = normalize(sunDirection + viewDir);
                    float spec = pow(max(dot(N, halfVec), 0.0), 32.0);
                    lit += vec3(1.0, 0.95, 0.85) * spec * 0.15;
                }

                float dist = length(vWorldPos - cameraPosition);
                float fog = 1.0 - exp(-fogDensity * dist * fogDensity * dist);
                lit = mix(lit, fogColor, clamp(fog, 0.0, 1.0));

                gl_FragColor = vec4(lit, 1.0);
            }
        `,
        side: THREE.FrontSide,
    });

    state.terrain = new THREE.Mesh(geo, terrainMat);
    state.terrain.receiveShadow = true;
    state.scene.add(state.terrain);
}
