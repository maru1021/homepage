import * as THREE from '/static/vendor/three/three.module.js';
import state from './state.js';

export function createSky() {
    const skyGeo = new THREE.SphereGeometry(1400, 64, 64);
    const skyMat = new THREE.ShaderMaterial({
        uniforms: {
            sunDirection: { value: new THREE.Vector3(0.3, 0.45, 0.5).normalize() },
            time: { value: 0 },
        },
        vertexShader: `
            varying vec3 vWorldPos;
            varying vec3 vPos;
            void main() {
                vPos = position;
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vWorldPos = wp.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 sunDirection;
            uniform float time;
            varying vec3 vWorldPos;
            varying vec3 vPos;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }
            float vnoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                float a = hash(i);
                float b = hash(i + vec2(1, 0));
                float c = hash(i + vec2(0, 1));
                float d = hash(i + vec2(1, 1));
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }
            float fbm(vec2 p) {
                float v = 0.0, a = 0.5;
                mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
                for (int i = 0; i < 6; i++) {
                    v += a * vnoise(p);
                    p = rot * p * 2.0;
                    a *= 0.5;
                }
                return v;
            }

            void main() {
                vec3 dir = normalize(vWorldPos);
                float elevation = dir.y;

                vec3 zenith = vec3(0.15, 0.35, 0.85);
                vec3 horizon = vec3(0.55, 0.72, 0.88);
                vec3 ground = vec3(0.7, 0.78, 0.82);
                vec3 sky;
                if (elevation > 0.0) {
                    float t = pow(elevation, 0.4);
                    sky = mix(horizon, zenith, t);
                } else {
                    sky = mix(horizon, ground, min(-elevation * 4.0, 1.0));
                }

                float sunDot = max(dot(dir, sunDirection), 0.0);
                vec3 sunGlow = vec3(1.0, 0.92, 0.7);
                sky += sunGlow * pow(sunDot, 128.0) * 3.0;
                sky += sunGlow * pow(sunDot, 16.0) * 0.6;
                sky += vec3(1.0, 0.6, 0.3) * pow(sunDot, 4.0) * 0.12;

                float horizonGlow = exp(-abs(elevation) * 6.0);
                sky += vec3(0.9, 0.75, 0.55) * horizonGlow * 0.2;

                if (elevation > -0.02) {
                    vec2 cloudUV = dir.xz / max(dir.y + 0.1, 0.05) * 0.4;
                    cloudUV += time * 0.003;
                    float cloud = fbm(cloudUV * 3.0);
                    cloud = smoothstep(0.35, 0.7, cloud);

                    vec2 cloudUVSun = cloudUV + sunDirection.xz * 0.03;
                    float cloudShadow = fbm(cloudUVSun * 3.0);
                    cloudShadow = smoothstep(0.35, 0.7, cloudShadow);
                    float lit = 1.0 - (cloudShadow - cloud) * 2.0;
                    lit = clamp(lit, 0.6, 1.0);

                    vec3 cloudColor = mix(vec3(0.7, 0.73, 0.78), vec3(1.0, 0.98, 0.95), lit);
                    cloudColor += sunGlow * pow(sunDot, 4.0) * 0.3 * cloud;

                    float fade = smoothstep(-0.02, 0.15, elevation);
                    sky = mix(sky, cloudColor, cloud * fade * 0.85);
                }

                sky = mix(sky, vec3(0.65, 0.75, 0.85), exp(-elevation * 3.0) * 0.15);

                gl_FragColor = vec4(sky, 1.0);
            }
        `,
        side: THREE.BackSide,
        depthWrite: false,
    });
    state.sky = new THREE.Mesh(skyGeo, skyMat);
    state.scene.add(state.sky);
}
