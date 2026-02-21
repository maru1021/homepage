/**
 * DKCドライブ - 3Dモデルビューア
 * Three.jsを使用した3Dモデル表示（STL/OBJ/GLTF/GLB/STP/STEP）
 * 寸法計測・断面表示・カメラプリセット・ワイヤーフレーム対応
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FILE_TYPES, API } from './constants.js';

// ===== 定数 =====

const CONFIG = {
    MODEL_SIZE: 150,
    CAMERA_FOV: 75,
    CAMERA_NEAR: 1,
    MIN_DISTANCE_RATIO: 0.5,
    MAX_DISTANCE_RATIO: 5,
    ZOOM_FACTOR: 0.15,
    PAN_SPEED: 0.5,
    ROTATE_SPEED: 0.5,
    DAMPING_FACTOR: 0.1,
    BACKGROUND_COLOR: 0x1a1a2e,
    MATERIAL: { color: 0x00d4ff, metalness: 0.3, roughness: 0.4 }
};

const CAD_FORMATS = ['stp', 'step'];

const LOADERS = {
    stl: STLLoader,
    obj: OBJLoader,
    gltf: GLTFLoader,
    glb: GLTFLoader
};

const MEASURE_COLORS = {
    POINT: 0xff4444,
    LINE: 0xffff00,
    LABEL_BG: 'rgba(0, 0, 0, 0.8)',
    LABEL_TEXT: '#ffffff',
    ANGLE_ARC: 0x44ff44,
    ANGLE_LINE: 0x44ff44,
    AREA_FACE: 0xff8800,
    ANNOTATION_PIN: 0x2196f3,
    ANNOTATION_BG: 'rgba(33, 150, 243, 0.9)',
    ANNOTATION_TEXT: '#ffffff'
};

// 計測モード種別
const MEASURE_MODES = {
    DISTANCE: 'distance',
    ANGLE: 'angle',
    AREA: 'area'
};

// クリッピングプレーンの法線（切り取る側の逆向き）
const CLIP_NORMALS = {
    x: [-1, 0, 0],
    y: [0, -1, 0],
    z: [0, 0, -1]
};

// ヘルパー平面の回転（PlaneGeometryデフォルトはXY平面・法線Z方向）
const CLIP_HELPER_ROTATIONS = {
    x: { axis: 'y', angle: Math.PI / 2 },
    y: { axis: 'x', angle: -Math.PI / 2 },
    z: null  // デフォルトのまま
};

// カメラビューのプリセット
const CAMERA_VIEWS = {
    front:  { pos: [0, 0, 1],  up: [0, 1, 0] },
    back:   { pos: [0, 0, -1], up: [0, 1, 0] },
    top:    { pos: [0, 1, 0],  up: [0, 0, -1] },
    bottom: { pos: [0, -1, 0], up: [0, 0, 1] },
    left:   { pos: [-1, 0, 0], up: [0, 1, 0] },
    right:  { pos: [1, 0, 0],  up: [0, 1, 0] }
};

// ツールバーのイベントバインド定義
const TOOLBAR_BINDINGS = [
    { id: 'btn-3d-measure', handler: 'toggleMeasureMode', args: [MEASURE_MODES.DISTANCE] },
    { id: 'btn-3d-measure-angle', handler: 'toggleMeasureMode', args: [MEASURE_MODES.ANGLE] },
    { id: 'btn-3d-measure-area', handler: 'toggleMeasureMode', args: [MEASURE_MODES.AREA] },
    { id: 'btn-3d-measure-clear', handler: 'clearAllMeasurements' },
    { id: 'btn-3d-annotate', handler: 'toggleAnnotationMode' },
    { id: 'btn-3d-annotate-clear', handler: 'clearAllAnnotations' },
    { id: 'btn-3d-clip-x', handler: 'toggleClipPlane', args: ['x'] },
    { id: 'btn-3d-clip-y', handler: 'toggleClipPlane', args: ['y'] },
    { id: 'btn-3d-clip-z', handler: 'toggleClipPlane', args: ['z'] },
    { id: 'btn-3d-clip-reset', handler: 'resetClipPlane' },
    { id: 'btn-3d-wireframe', handler: 'toggleWireframe' },
    { id: 'btn-3d-fit', handler: 'fitToView' },
    { id: 'btn-3d-screenshot', handler: 'takeScreenshot' },
    { id: 'btn-3d-info', handler: 'toggleModelInfo' },
    ...['front', 'back', 'top', 'bottom', 'left', 'right'].map(dir => ({
        id: `btn-3d-view-${dir}`, handler: 'setCameraView', args: [dir]
    }))
];

/**
 * 3Dビューアのミックスイン
 */
export const Viewer3DMixin = (Base) => class extends Base {

    init3DViewer() {
        const container = this.elements.threeViewer;
        container.innerHTML = '';

        const { width, height } = this.getContainerSize(container);

        this.three.scene = new THREE.Scene();
        this.three.scene.background = new THREE.Color(CONFIG.BACKGROUND_COLOR);

        this.three.camera = new THREE.PerspectiveCamera(CONFIG.CAMERA_FOV, width / height, 0.1, 10000);
        this.three.camera.position.set(0, 100, 200);

        this.three.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.three.renderer.setSize(width, height);
        this.three.renderer.setPixelRatio(window.devicePixelRatio);
        this.three.renderer.localClippingEnabled = true;
        container.appendChild(this.three.renderer.domElement);

        this.three.controls = new OrbitControls(this.three.camera, this.three.renderer.domElement);
        Object.assign(this.three.controls, {
            enableDamping: true,
            dampingFactor: CONFIG.DAMPING_FACTOR,
            panSpeed: CONFIG.PAN_SPEED,
            rotateSpeed: CONFIG.ROTATE_SPEED,
            enableZoom: false
        });

        container.addEventListener('wheel', (e) => this.handleCustomZoom(e), { passive: false });
        this.setupLights();

        this.three.measureState = {
            active: false, mode: null, points: [], markers: [], lines: [], labels: [], measurements: []
        };
        this.three.clipState = {
            active: false, axis: null, plane: null, helper: null, helperEdge: null, value: 0
        };
        this.three.annotationState = {
            active: false, annotations: [], markers: [], labels: []
        };
        this.three.raycaster = new THREE.Raycaster();
        this.three.mouse = new THREE.Vector2();
        this.three.wireframeMode = 0;
        this.three.wireframeOverlay = null;

        this.animate3D();
        setTimeout(() => this.resizeRenderer(), 100);
    }

    getContainerSize(container) {
        return {
            width: container.clientWidth || 800,
            height: container.clientHeight || 600
        };
    }

    setupLights() {
        this.three.scene.add(new THREE.AmbientLight(0xffffff, 1.0));

        const directionalLights = [
            { pos: [100, 200, 100], intensity: 1.0 },
            { pos: [-100, 50, -100], intensity: 0.6 },
            { pos: [0, -100, 0], intensity: 0.4 }
        ];

        directionalLights.forEach(({ pos, intensity }) => {
            const light = new THREE.DirectionalLight(0xffffff, intensity);
            light.position.set(...pos);
            this.three.scene.add(light);
        });
    }

    resizeRenderer() {
        if (!this.three.renderer) return;
        const { width, height } = this.getContainerSize(this.elements.threeViewer);
        this.three.camera.aspect = width / height;
        this.three.camera.updateProjectionMatrix();
        this.three.renderer.setSize(width, height);
    }

    animate3D() {
        if (!this.three.renderer) return;
        requestAnimationFrame(() => this.animate3D());
        this.three.controls?.update();
        this.three.renderer.render(this.three.scene, this.three.camera);
    }

    handleCustomZoom(e) {
        e.preventDefault();
        if (!this.three.camera || !this.three.controls) return;

        const { controls, camera } = this.three;
        const target = controls.target;

        const delta = e.deltaY > 0 ? 1 : -1;

        const direction = new THREE.Vector3().subVectors(camera.position, target).normalize();
        const currentDist = camera.position.distanceTo(target);

        const moveAmount = currentDist * CONFIG.ZOOM_FACTOR * delta;
        const newDist = currentDist + moveAmount;

        const minDist = controls.minDistance || 50;
        const maxDist = controls.maxDistance || 800;

        if (newDist >= minDist && newDist <= maxDist) {
            camera.position.copy(direction.multiplyScalar(newDist).add(target));
        }
    }

    async load3DModel(filePath) {
        this.showViewer(FILE_TYPES.MODEL3D);
        await new Promise(r => setTimeout(r, 50));
        this.init3DViewer();

        const ext = filePath.split('.').pop().toLowerCase();
        const isCAD = CAD_FORMATS.includes(ext);
        const LoaderClass = isCAD ? STLLoader : LOADERS[ext];

        if (!LoaderClass) {
            console.error('未対応の3D形式:', ext);
            return;
        }

        // 単位判定用に拡張子を保存（STP/STEPはmm、他は不明）
        this.three.fileExt = ext;
        this.three.isCAD = isCAD;

        this.showLoading();
        try {
            const model = await this.loadAndProcessModel(filePath, ext, isCAD, LoaderClass);
            this.setupModelView(model);
            this.init3DToolbar();
        } catch (e) {
            console.error('3Dモデル読み込みエラー:', e);
            alert(isCAD
                ? '3Dモデルの変換に失敗しました。STEPまたはIGES形式に変換してお試しください。'
                : '3Dモデルの読み込みに失敗しました'
            );
        } finally {
            this.hideLoading();
        }
    }

    async loadAndProcessModel(filePath, ext, isCAD, LoaderClass) {
        const modelUrl = isCAD
            ? `${API.CAD}?path=${encodeURIComponent(filePath)}`
            : `/media/dkc_drive/${encodeURIComponent(filePath)}`;

        const result = await new Promise((resolve, reject) => {
            new LoaderClass().load(modelUrl, resolve, undefined, reject);
        });

        const isSTL = ext === 'stl' || isCAD;
        if (isSTL) {
            const { color, metalness, roughness } = CONFIG.MATERIAL;
            return new THREE.Mesh(
                result,
                new THREE.MeshStandardMaterial({ color, metalness, roughness, side: THREE.DoubleSide })
            );
        }
        return (ext === 'gltf' || ext === 'glb') ? result.scene : result;
    }

    setupModelView(model) {
        if (this.three.currentModel) {
            this.three.scene.remove(this.three.currentModel);
        }

        const box = new THREE.Box3().setFromObject(model);
        const maxDim = Math.max(...box.getSize(new THREE.Vector3()).toArray());

        if (maxDim > 0) {
            this.three.scaleRatio = CONFIG.MODEL_SIZE / maxDim;
            model.scale.setScalar(this.three.scaleRatio);
            box.setFromObject(model);
            model.position.sub(box.getCenter(new THREE.Vector3()));
        } else {
            this.three.scaleRatio = 1;
        }

        const dist = CONFIG.MODEL_SIZE * 2;
        this.three.camera.position.set(dist * 0.5, dist * 0.5, dist);
        this.three.camera.lookAt(0, 0, 0);
        this.three.camera.near = CONFIG.CAMERA_NEAR;
        this.three.camera.far = CONFIG.MODEL_SIZE * 20;
        this.three.camera.updateProjectionMatrix();

        this.three.controls.minDistance = CONFIG.MODEL_SIZE * CONFIG.MIN_DISTANCE_RATIO;
        this.three.controls.maxDistance = CONFIG.MODEL_SIZE * CONFIG.MAX_DISTANCE_RATIO;
        this.three.controls.target.set(0, 0, 0);
        this.three.controls.update();

        this.three.scene.add(model);
        this.three.currentModel = model;
        this.three.modelBounds = new THREE.Box3().setFromObject(model);
    }

    // ===== 実寸換算 =====

    /**
     * Three.js内部の距離を元ファイルの実寸に変換
     */
    toRealDistance(threeDistance) {
        const ratio = this.three.scaleRatio || 1;
        return threeDistance / ratio;
    }

    /**
     * 実寸距離を単位付き文字列にフォーマット
     * STP/STEP: mm単位（大きければm変換）
     * その他: 単位なし
     */
    formatRealDistance(threeDistance) {
        const real = this.toRealDistance(threeDistance);
        const isCAD = this.three.isCAD;
        const ext = this.three.fileExt;

        // STP/STEPは通常mm単位
        if (isCAD || ext === 'stp' || ext === 'step') {
            if (real >= 1000) {
                return `${(real / 1000).toFixed(2)} m`;
            }
            return `${real.toFixed(2)} mm`;
        }

        // STL/OBJ/GLTF等は単位不明だが、製造業ではmmが多い
        // 元座標の値をそのまま表示
        return `${real.toFixed(2)}`;
    }

    // ===== ツールバー =====

    init3DToolbar() {
        const toolbar = document.getElementById('three-toolbar');
        if (!toolbar) return;

        toolbar.style.display = 'flex';

        // ボタンのイベントバインド（定数テーブル駆動）
        for (const { id, handler, args } of TOOLBAR_BINDINGS) {
            const btn = document.getElementById(id);
            if (btn) btn.onclick = () => this[handler](...(args || []));
        }

        // 断面スライダー
        const slider = document.getElementById('clip-slider');
        if (slider) {
            slider.oninput = (e) => this.updateClipPlanePosition(parseFloat(e.target.value));
        }
    }

    // ===== 寸法計測機能 =====

    toggleMeasureMode(mode = MEASURE_MODES.DISTANCE) {
        const state = this.three.measureState;

        // アノテーションモードが有効なら先に解除
        if (this.three.annotationState.active) {
            this.toggleAnnotationMode();
        }

        // 同じモードの再押下 or 別モードへの切替
        if (state.active && state.mode === mode) {
            // 同じモード → OFF
            this.deactivateMeasureMode();
            return;
        }

        // 別モードが有効なら一旦解除
        if (state.active) {
            this.deactivateMeasureMode();
        }

        // モード起動
        state.active = true;
        state.mode = mode;
        state.points = [];

        // ボタンのアクティブ状態
        const btnIds = {
            [MEASURE_MODES.DISTANCE]: 'btn-3d-measure',
            [MEASURE_MODES.ANGLE]: 'btn-3d-measure-angle',
            [MEASURE_MODES.AREA]: 'btn-3d-measure-area'
        };
        for (const [m, id] of Object.entries(btnIds)) {
            const btn = document.getElementById(id);
            if (btn) btn.classList.toggle('active', m === mode);
        }

        const container = this.elements.threeViewer;
        container.style.cursor = 'crosshair';
        this.three.controls.enableRotate = false;

        this._measureClickHandler = (e) => this.onMeasureClick(e);
        this._measureMoveHandler = (e) => this.onMeasureMouseMove(e);
        container.addEventListener('click', this._measureClickHandler);
        container.addEventListener('mousemove', this._measureMoveHandler);

        const statusMessages = {
            [MEASURE_MODES.DISTANCE]: '距離計測: 1点目をクリック',
            [MEASURE_MODES.ANGLE]: '角度計測: 頂点（中心点）をクリック',
            [MEASURE_MODES.AREA]: '面積計測: 面をクリック'
        };
        this.showMeasureStatus(statusMessages[mode]);
    }

    deactivateMeasureMode() {
        const state = this.three.measureState;
        state.active = false;
        state.mode = null;
        state.points = [];

        const container = this.elements.threeViewer;
        container.style.cursor = '';
        this.three.controls.enableRotate = true;

        if (this._measureClickHandler) {
            container.removeEventListener('click', this._measureClickHandler);
        }
        if (this._measureMoveHandler) {
            container.removeEventListener('mousemove', this._measureMoveHandler);
        }
        this.removeMeasurePreview();
        this.hideMeasureStatus();

        for (const id of ['btn-3d-measure', 'btn-3d-measure-angle', 'btn-3d-measure-area']) {
            const btn = document.getElementById(id);
            if (btn) btn.classList.remove('active');
        }
    }

    onMeasureClick(e) {
        const state = this.three.measureState;
        if (state.mode === MEASURE_MODES.AREA) {
            this.onAreaMeasureClick(e);
            return;
        }
        if (state.mode === MEASURE_MODES.ANGLE) {
            this.onAngleMeasureClick(e);
            return;
        }
        this.onDistanceMeasureClick(e);
    }

    onMeasureMouseMove(e) {
        const state = this.three.measureState;
        if (state.mode === MEASURE_MODES.AREA) return;
        if (state.mode === MEASURE_MODES.ANGLE) {
            this.onAngleMeasureMouseMove(e);
            return;
        }
        this.onDistanceMeasureMouseMove(e);
    }

    // --- 距離計測 ---

    onDistanceMeasureClick(e) {
        const state = this.three.measureState;
        const intersection = this.getModelIntersection(e);

        if (!intersection) return;

        const point = intersection.point.clone();
        state.points.push(point);
        this.addMeasureMarker(point);

        if (state.points.length === 1) {
            this.showMeasureStatus('距離計測: 2点目をクリック');
        } else if (state.points.length === 2) {
            const p1 = state.points[0];
            const p2 = state.points[1];
            const distance = p1.distanceTo(p2);
            const realText = this.formatRealDistance(distance);

            this.addMeasureLine(p1, p2);
            this.addMeasureLabel(p1, p2, realText);

            const realDistance = this.toRealDistance(distance);
            state.measurements.push({ type: 'distance', p1: p1.clone(), p2: p2.clone(), distance: realDistance });

            state.points = [];
            this.showMeasureStatus(`距離: ${realText} - 次の計測: 1点目をクリック`);
        }
    }

    onDistanceMeasureMouseMove(e) {
        const state = this.three.measureState;
        if (state.points.length !== 1) {
            this.removeMeasurePreview();
            return;
        }

        const intersection = this.getModelIntersection(e);
        if (!intersection) {
            this.removeMeasurePreview();
            return;
        }

        const p1 = state.points[0];
        const p2 = intersection.point;
        const distance = p1.distanceTo(p2);

        this.removeMeasurePreview();
        this.addMeasurePreviewLine(p1, p2);
        this.showMeasureStatus(`2点目をクリック (距離: ${this.formatRealDistance(distance)})`);
    }

    // --- 角度計測 ---

    onAngleMeasureClick(e) {
        const state = this.three.measureState;
        const intersection = this.getModelIntersection(e);
        if (!intersection) return;

        const point = intersection.point.clone();
        state.points.push(point);
        this.addMeasureMarker(point);

        if (state.points.length === 1) {
            this.showMeasureStatus('角度計測: 2点目（辺の端点A）をクリック');
        } else if (state.points.length === 2) {
            this.showMeasureStatus('角度計測: 3点目（辺の端点B）をクリック');
        } else if (state.points.length === 3) {
            const vertex = state.points[0]; // 頂点
            const pA = state.points[1];
            const pB = state.points[2];

            const vA = new THREE.Vector3().subVectors(pA, vertex).normalize();
            const vB = new THREE.Vector3().subVectors(pB, vertex).normalize();
            const angle = THREE.MathUtils.radToDeg(vA.angleTo(vB));

            // 辺を描画
            this.addAngleLine(vertex, pA);
            this.addAngleLine(vertex, pB);
            this.addAngleArc(vertex, pA, pB, angle);

            // ラベルを頂点付近に表示
            const mid = new THREE.Vector3().addVectors(vA, vB).normalize()
                .multiplyScalar(vertex.distanceTo(pA) * 0.3).add(vertex);
            this.addMeasureLabel(vertex, mid, `${angle.toFixed(1)}°`);

            state.measurements.push({
                type: 'angle', vertex: vertex.clone(),
                pA: pA.clone(), pB: pB.clone(), angle
            });

            state.points = [];
            this.showMeasureStatus(`角度: ${angle.toFixed(1)}° - 次の計測: 頂点をクリック`);
        }
    }

    onAngleMeasureMouseMove(e) {
        const state = this.three.measureState;
        if (state.points.length < 1 || state.points.length > 2) {
            this.removeMeasurePreview();
            return;
        }

        const intersection = this.getModelIntersection(e);
        if (!intersection) {
            this.removeMeasurePreview();
            return;
        }

        this.removeMeasurePreview();
        const lastPoint = state.points[state.points.length - 1];
        this.addMeasurePreviewLine(lastPoint, intersection.point);

        if (state.points.length === 2) {
            const vertex = state.points[0];
            const pA = state.points[1];
            const pB = intersection.point;
            const vA = new THREE.Vector3().subVectors(pA, vertex).normalize();
            const vB = new THREE.Vector3().subVectors(pB, vertex).normalize();
            const angle = THREE.MathUtils.radToDeg(vA.angleTo(vB));
            this.showMeasureStatus(`3点目をクリック (角度: ${angle.toFixed(1)}°)`);
        }
    }

    addAngleLine(p1, p2) {
        const material = new THREE.LineBasicMaterial({
            color: MEASURE_COLORS.ANGLE_LINE, depthTest: false, linewidth: 2
        });
        const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const line = new THREE.Line(geometry, material);
        line.renderOrder = 998;
        line.userData.isMeasure = true;
        this.three.scene.add(line);
        this.three.measureState.lines.push(line);
    }

    addAngleArc(vertex, pA, pB, angleDeg) {
        const vA = new THREE.Vector3().subVectors(pA, vertex).normalize();
        const vB = new THREE.Vector3().subVectors(pB, vertex).normalize();
        const radius = Math.min(vertex.distanceTo(pA), vertex.distanceTo(pB)) * 0.25;
        const segments = Math.max(8, Math.ceil(angleDeg / 5));

        const normal = new THREE.Vector3().crossVectors(vA, vB).normalize();
        const points = [];

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const angleRad = THREE.MathUtils.degToRad(angleDeg) * t;
            // Rodrigues' rotation formula
            const cosA = Math.cos(angleRad);
            const sinA = Math.sin(angleRad);
            const cross = new THREE.Vector3().crossVectors(normal, vA);
            const dot = normal.dot(vA);

            const rotated = new THREE.Vector3()
                .copy(vA).multiplyScalar(cosA)
                .add(cross.multiplyScalar(sinA))
                .add(normal.clone().multiplyScalar(dot * (1 - cosA)));

            points.push(rotated.multiplyScalar(radius).add(vertex));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: MEASURE_COLORS.ANGLE_ARC, depthTest: false
        });
        const arc = new THREE.Line(geometry, material);
        arc.renderOrder = 998;
        arc.userData.isMeasure = true;
        this.three.scene.add(arc);
        this.three.measureState.lines.push(arc);
    }

    // --- 面積計測 ---

    onAreaMeasureClick(e) {
        const state = this.three.measureState;
        const intersection = this.getModelIntersection(e);
        if (!intersection || intersection.face == null) {
            this.showMeasureStatus('面積計測: 面が検出できませんでした。別の場所をクリックしてください');
            return;
        }

        const face = intersection.face;
        const mesh = intersection.object;
        const geo = mesh.geometry;

        // 3頂点を取得（ワールド座標）
        const posAttr = geo.attributes.position;
        const getVertex = (idx) => {
            const v = new THREE.Vector3().fromBufferAttribute(posAttr, idx);
            mesh.localToWorld(v);
            return v;
        };

        const a = getVertex(face.a);
        const b = getVertex(face.b);
        const c = getVertex(face.c);

        // 三角形面積 = |AB × AC| / 2
        const ab = new THREE.Vector3().subVectors(b, a);
        const ac = new THREE.Vector3().subVectors(c, a);
        const crossVec = new THREE.Vector3().crossVectors(ab, ac);
        const area3D = crossVec.length() / 2;

        // 実寸変換（スケール比の二乗で割る）
        const ratio = this.three.scaleRatio || 1;
        const realArea = area3D / (ratio * ratio);

        // 面をハイライト
        this.addAreaHighlight(a, b, c);

        // ラベル表示
        const center = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3);
        const areaText = this.formatRealArea(realArea);
        this.addAreaLabel(center, areaText);

        state.measurements.push({ type: 'area', a: a.clone(), b: b.clone(), c: c.clone(), area: realArea });
        this.showMeasureStatus(`面積: ${areaText} - 次の面をクリック`);
    }

    formatRealArea(area) {
        const isCAD = this.three.isCAD;
        const ext = this.three.fileExt;

        if (isCAD || ext === 'stp' || ext === 'step') {
            if (area >= 1e6) return `${(area / 1e6).toFixed(2)} m²`;
            return `${area.toFixed(2)} mm²`;
        }
        return `${area.toFixed(2)}`;
    }

    addAreaHighlight(a, b, c) {
        const geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z
        ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

        const material = new THREE.MeshBasicMaterial({
            color: MEASURE_COLORS.AREA_FACE, transparent: true, opacity: 0.4,
            side: THREE.DoubleSide, depthTest: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = 997;
        mesh.userData.isMeasure = true;
        this.three.scene.add(mesh);
        this.three.measureState.markers.push(mesh);
    }

    addAreaLabel(position, text) {
        // 中心点少し上にオフセット
        const labelPos = position.clone();
        labelPos.y += 3;
        this.addMeasureLabel(position, labelPos, text);
    }

    getModelIntersection(event) {
        const container = this.elements.threeViewer;
        const rect = container.getBoundingClientRect();
        this.three.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.three.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.three.raycaster.setFromCamera(this.three.mouse, this.three.camera);

        if (!this.three.currentModel) return null;

        const intersects = this.three.raycaster.intersectObject(this.three.currentModel, true);
        return intersects.length > 0 ? intersects[0] : null;
    }

    addMeasureMarker(point) {
        const geometry = new THREE.SphereGeometry(2, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: MEASURE_COLORS.POINT, depthTest: false });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(point);
        sphere.renderOrder = 999;
        sphere.userData.isMeasure = true;
        this.three.scene.add(sphere);
        this.three.measureState.markers.push(sphere);
    }

    addMeasureLine(p1, p2) {
        const material = new THREE.LineBasicMaterial({
            color: MEASURE_COLORS.LINE,
            depthTest: false,
            linewidth: 2
        });
        const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const line = new THREE.Line(geometry, material);
        line.renderOrder = 998;
        line.userData.isMeasure = true;
        this.three.scene.add(line);
        this.three.measureState.lines.push(line);
    }

    addMeasurePreviewLine(p1, p2) {
        const material = new THREE.LineDashedMaterial({
            color: MEASURE_COLORS.LINE,
            depthTest: false,
            dashSize: 3,
            gapSize: 2
        });
        const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        line.renderOrder = 998;
        line.userData.isMeasurePreview = true;
        this.three.scene.add(line);
    }

    /** シーンからuserDataフラグが一致するオブジェクトを削除・破棄 */
    removeSceneObjectsByFlag(flag) {
        if (!this.three.scene) return;
        const toRemove = [];
        this.three.scene.traverse(obj => {
            if (obj.userData[flag]) toRemove.push(obj);
        });
        toRemove.forEach(obj => {
            obj.geometry?.dispose();
            obj.material?.dispose();
            if (obj.material?.map) obj.material.map.dispose();
            this.three.scene.remove(obj);
        });
    }

    removeMeasurePreview() {
        this.removeSceneObjectsByFlag('isMeasurePreview');
    }

    addMeasureLabel(p1, p2, labelText) {
        const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fontSize = 28;
        const padding = 12;

        ctx.font = `bold ${fontSize}px sans-serif`;
        const textWidth = ctx.measureText(labelText).width;

        canvas.width = textWidth + padding * 2;
        canvas.height = fontSize + padding * 2;

        // 背景（角丸）
        ctx.fillStyle = MEASURE_COLORS.LABEL_BG;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(0, 0, canvas.width, canvas.height, 6);
        } else {
            ctx.rect(0, 0, canvas.width, canvas.height);
        }
        ctx.fill();

        // テキスト
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = MEASURE_COLORS.LABEL_TEXT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: texture, depthTest: false, sizeAttenuation: false
        }));
        sprite.position.copy(midPoint);
        const aspect = canvas.width / canvas.height;
        sprite.scale.set(0.08 * aspect, 0.08, 1);
        sprite.renderOrder = 1000;
        sprite.userData.isMeasure = true;

        this.three.scene.add(sprite);
        this.three.measureState.labels.push(sprite);
    }

    clearAllMeasurements() {
        const state = this.three.measureState;
        if (!this.three.scene) return;

        this.removeSceneObjectsByFlag('isMeasure');
        this.removeMeasurePreview();

        Object.assign(state, { markers: [], lines: [], labels: [], measurements: [], points: [] });

        if (state.active) {
            this.showMeasureStatus('計測をクリアしました。1点目をクリックしてください');
        }
    }

    showMeasureStatus(text) {
        const el = document.getElementById('measure-status');
        if (el) {
            el.textContent = text;
            el.style.display = 'block';
        }
    }

    hideMeasureStatus() {
        const el = document.getElementById('measure-status');
        if (el) {
            el.style.display = 'none';
        }
    }

    // ===== 断面表示（クリッピング） =====

    /** モデルの全マテリアルに対してコールバックを実行 */
    forEachModelMaterial(callback) {
        if (!this.three.currentModel) return;
        this.three.currentModel.traverse(child => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(callback);
            }
        });
    }

    toggleClipPlane(axis) {
        const state = this.three.clipState;

        if (state.active && state.axis === axis) {
            this.resetClipPlane();
            return;
        }

        this.removeSceneObjectsByFlag('isClipHelper');
        Object.assign(state, { active: true, axis, value: 0 });

        // ボタンのアクティブ状態
        ['x', 'y', 'z'].forEach(a => {
            const btn = document.getElementById(`btn-3d-clip-${a}`);
            if (btn) btn.classList.toggle('active', a === axis);
        });

        // スライダー表示
        const sliderContainer = document.getElementById('clip-slider-container');
        if (sliderContainer) sliderContainer.style.display = 'flex';
        const slider = document.getElementById('clip-slider');
        if (slider) slider.value = 0;
        const label = document.getElementById('clip-axis-label');
        if (label) label.textContent = `${axis.toUpperCase()}軸`;

        state.plane = new THREE.Plane(new THREE.Vector3(...CLIP_NORMALS[axis]), 0);
        this.forEachModelMaterial(mat => {
            mat.clippingPlanes = [state.plane];
            mat.clipShadows = true;
            mat.needsUpdate = true;
        });

        this.addClipHelper(axis);
        this.updateClipPlanePosition(0);
    }

    addClipHelper(axis) {
        const bounds = this.three.modelBounds;
        if (!bounds) return;

        const size = bounds.getSize(new THREE.Vector3());
        const helperSize = Math.max(size.x, size.y, size.z) * 1.2;

        const geometry = new THREE.PlaneGeometry(helperSize, helperSize);
        const helper = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
            color: 0xff4444, transparent: true, opacity: 0.15,
            side: THREE.DoubleSide, depthWrite: false
        }));

        // 軸に応じて回転
        const rotation = CLIP_HELPER_ROTATIONS[axis];
        if (rotation) helper.rotation[rotation.axis] = rotation.angle;

        helper.renderOrder = 1;
        helper.userData.isClipHelper = true;
        this.three.scene.add(helper);
        this.three.clipState.helper = helper;

        // エッジライン
        const edge = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry),
            new THREE.LineBasicMaterial({ color: 0xff4444, depthTest: false })
        );
        edge.rotation.copy(helper.rotation);
        edge.renderOrder = 2;
        edge.userData.isClipHelper = true;
        this.three.scene.add(edge);
        this.three.clipState.helperEdge = edge;
    }

    updateClipPlanePosition(sliderValue) {
        const state = this.three.clipState;
        if (!state.active || !state.plane || !this.three.modelBounds) return;

        const bounds = this.three.modelBounds;
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());

        // 軸名からコンポーネントを取得（x/y/z → Vector3の対応プロパティ）
        const axisKey = state.axis;
        const axisCenter = center[axisKey];
        const axisSize = size[axisKey];
        const position = axisCenter + (sliderValue / 100) * (axisSize / 2);

        state.plane.constant = position;
        state.value = sliderValue;

        // ヘルパー位置更新
        for (const obj of [state.helper, state.helperEdge]) {
            if (obj) obj.position[axisKey] = position;
        }

        const valueLabel = document.getElementById('clip-value');
        if (valueLabel) valueLabel.textContent = `${sliderValue}%`;
    }

    resetClipPlane() {
        this.forEachModelMaterial(mat => {
            mat.clippingPlanes = [];
            mat.needsUpdate = true;
        });

        this.removeSceneObjectsByFlag('isClipHelper');

        const state = this.three.clipState;
        Object.assign(state, { active: false, axis: null, plane: null, helper: null, helperEdge: null, value: 0 });

        ['x', 'y', 'z'].forEach(a => {
            const btn = document.getElementById(`btn-3d-clip-${a}`);
            if (btn) btn.classList.remove('active');
        });

        const sliderContainer = document.getElementById('clip-slider-container');
        if (sliderContainer) sliderContainer.style.display = 'none';
    }

    // ===== カメラビュー切替 =====

    setCameraView(direction) {
        if (!this.three.camera || !this.three.controls) return;

        const view = CAMERA_VIEWS[direction];
        if (!view) return;

        const dist = CONFIG.MODEL_SIZE * 2;
        const target = this.three.controls.target.clone();

        this.three.camera.position.copy(
            new THREE.Vector3(...view.pos).multiplyScalar(dist).add(target)
        );
        this.three.camera.up.set(...view.up);
        this.three.camera.lookAt(target);
        this.three.controls.update();

        const btn = document.getElementById(`btn-3d-view-${direction}`);
        if (btn) {
            btn.classList.add('active');
            setTimeout(() => btn.classList.remove('active'), 300);
        }
    }

    // ===== ワイヤーフレーム切替 =====

    removeWireframeOverlay() {
        if (!this.three.wireframeOverlay) return;
        this.three.scene.remove(this.three.wireframeOverlay);
        this.three.wireframeOverlay.traverse(child => {
            child.geometry?.dispose();
            child.material?.dispose();
        });
        this.three.wireframeOverlay = null;
    }

    toggleWireframe() {
        if (!this.three.currentModel) return;

        this.three.wireframeMode = (this.three.wireframeMode + 1) % 3;
        const mode = this.three.wireframeMode;

        this.removeWireframeOverlay();

        const isWireOnly = mode === 1;
        this.forEachModelMaterial(mat => {
            mat.wireframe = isWireOnly;
            mat.transparent = false;
            mat.opacity = 1;
            mat.needsUpdate = true;
        });

        // モード2: ソリッド+ワイヤーフレームオーバーレイ
        if (mode === 2) {
            const overlay = this.three.currentModel.clone();
            const clipPlane = this.three.clipState?.active ? this.three.clipState.plane : null;
            overlay.traverse(child => {
                if (child.isMesh) {
                    child.material = new THREE.MeshBasicMaterial({
                        color: 0x000000, wireframe: true,
                        transparent: true, opacity: 0.3, depthTest: true,
                        ...(clipPlane && { clippingPlanes: [clipPlane] })
                    });
                }
            });
            this.three.scene.add(overlay);
            this.three.wireframeOverlay = overlay;
        }

        const btn = document.getElementById('btn-3d-wireframe');
        if (btn) {
            btn.classList.toggle('active', mode > 0);
            btn.title = ['ソリッド表示', 'ワイヤーフレーム表示', 'ソリッド+ワイヤー表示'][mode];
        }
    }

    // ===== フィット表示 =====

    fitToView() {
        if (!this.three.currentModel || !this.three.camera || !this.three.controls) return;

        const dist = CONFIG.MODEL_SIZE * 2;
        this.three.camera.position.set(dist * 0.5, dist * 0.5, dist);
        this.three.camera.lookAt(0, 0, 0);
        this.three.camera.up.set(0, 1, 0);
        this.three.controls.target.set(0, 0, 0);
        this.three.controls.update();
    }

    // ===== スクリーンショット保存 =====

    takeScreenshot() {
        if (!this.three.renderer || !this.three.scene || !this.three.camera) return;

        // 一度レンダリング
        this.three.renderer.render(this.three.scene, this.three.camera);

        // Canvas → DataURL → ダウンロード
        const dataURL = this.three.renderer.domElement.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `3D_screenshot_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.png`;
        link.href = dataURL;
        link.click();
    }

    // ===== モデル情報表示 =====

    toggleModelInfo() {
        const panel = document.getElementById('model-info-panel');
        if (!panel) return;

        const visible = panel.style.display !== 'none';
        if (visible) {
            panel.style.display = 'none';
            return;
        }

        // モデル情報を収集
        let vertexCount = 0;
        let faceCount = 0;

        if (this.three.currentModel) {
            this.three.currentModel.traverse(child => {
                if (child.isMesh && child.geometry) {
                    const geo = child.geometry;
                    if (geo.index) {
                        faceCount += geo.index.count / 3;
                    } else if (geo.attributes.position) {
                        faceCount += geo.attributes.position.count / 3;
                    }
                    if (geo.attributes.position) {
                        vertexCount += geo.attributes.position.count;
                    }
                }
            });
        }

        // バウンディングボックスの実寸
        let dimText = '-';
        if (this.three.modelBounds) {
            const size = this.three.modelBounds.getSize(new THREE.Vector3());
            const rx = this.toRealDistance(size.x);
            const ry = this.toRealDistance(size.y);
            const rz = this.toRealDistance(size.z);
            const unit = (this.three.isCAD) ? ' mm' : '';
            dimText = `${rx.toFixed(1)}${unit} x ${ry.toFixed(1)}${unit} x ${rz.toFixed(1)}${unit}`;
        }

        // ファイル形式
        const ext = (this.three.fileExt || '').toUpperCase();

        // パネルに表示
        panel.innerHTML = `
            <div class="model-info-row"><span>形式</span><span>${ext}</span></div>
            <div class="model-info-row"><span>頂点数</span><span>${vertexCount.toLocaleString()}</span></div>
            <div class="model-info-row"><span>面数</span><span>${faceCount.toLocaleString()}</span></div>
            <div class="model-info-row"><span>寸法 (W x H x D)</span><span>${dimText}</span></div>
        `;
        panel.style.display = 'block';
    }

    // ===== アノテーション機能 =====

    toggleAnnotationMode() {
        const state = this.three.annotationState;

        // 計測モードが有効なら先に解除
        if (this.three.measureState.active) {
            this.deactivateMeasureMode();
        }

        state.active = !state.active;

        const btn = document.getElementById('btn-3d-annotate');
        if (btn) btn.classList.toggle('active', state.active);

        const container = this.elements.threeViewer;
        if (state.active) {
            container.style.cursor = 'crosshair';
            this.three.controls.enableRotate = false;
            this._annotateClickHandler = (e) => this.onAnnotateClick(e);
            container.addEventListener('click', this._annotateClickHandler);
            this.showMeasureStatus('注釈: モデル上をクリックしてピンを配置');
        } else {
            container.style.cursor = '';
            this.three.controls.enableRotate = true;
            if (this._annotateClickHandler) {
                container.removeEventListener('click', this._annotateClickHandler);
            }
            this.hideMeasureStatus();
        }
    }

    onAnnotateClick(e) {
        const intersection = this.getModelIntersection(e);
        if (!intersection) return;

        const point = intersection.point.clone();

        // 入力ダイアログを表示
        this.showAnnotationDialog(point, e);
    }

    showAnnotationDialog(point, event) {
        // 既存ダイアログがあれば削除
        const existing = document.getElementById('annotation-dialog');
        if (existing) existing.remove();

        const dialog = document.createElement('div');
        dialog.id = 'annotation-dialog';
        dialog.className = 'three-annotation-dialog';

        // ダイアログ位置（クリック位置付近）
        dialog.style.left = `${event.clientX + 10}px`;
        dialog.style.top = `${event.clientY - 10}px`;

        dialog.innerHTML = `
            <div class="annotation-dialog-header">注釈を入力</div>
            <textarea class="annotation-dialog-input" id="annotation-text-input"
                      placeholder="テキストを入力..." rows="3"></textarea>
            <div class="annotation-dialog-actions">
                <button class="annotation-dialog-btn cancel" id="annotation-cancel">キャンセル</button>
                <button class="annotation-dialog-btn ok" id="annotation-ok">追加</button>
            </div>
        `;
        document.body.appendChild(dialog);

        const input = document.getElementById('annotation-text-input');
        input.focus();

        // 画面外にはみ出す場合は位置調整
        const rect = dialog.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            dialog.style.left = `${event.clientX - rect.width - 10}px`;
        }
        if (rect.bottom > window.innerHeight) {
            dialog.style.top = `${event.clientY - rect.height - 10}px`;
        }

        const cleanup = () => dialog.remove();

        document.getElementById('annotation-cancel').onclick = cleanup;
        document.getElementById('annotation-ok').onclick = () => {
            const text = input.value.trim();
            if (text) {
                this.addAnnotation(point, text);
            }
            cleanup();
        };

        // Enter（Shift+Enterは改行）で確定
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = input.value.trim();
                if (text) this.addAnnotation(point, text);
                cleanup();
            }
            if (e.key === 'Escape') cleanup();
        });
    }

    addAnnotation(point, text) {
        const state = this.three.annotationState;

        // ピンマーカー（青い球）
        const pinGeo = new THREE.SphereGeometry(2.5, 16, 16);
        const pinMat = new THREE.MeshBasicMaterial({
            color: MEASURE_COLORS.ANNOTATION_PIN, depthTest: false
        });
        const pin = new THREE.Mesh(pinGeo, pinMat);
        pin.position.copy(point);
        pin.renderOrder = 999;
        pin.userData.isAnnotation = true;
        this.three.scene.add(pin);
        state.markers.push(pin);

        // ラベル（スプライト）
        const label = this.createAnnotationLabel(text);
        label.position.copy(point);
        label.position.y += 8;
        label.userData.isAnnotation = true;
        this.three.scene.add(label);
        state.labels.push(label);

        // 接続線（ピン→ラベル）
        const lineMat = new THREE.LineDashedMaterial({
            color: MEASURE_COLORS.ANNOTATION_PIN, depthTest: false,
            dashSize: 2, gapSize: 1
        });
        const lineGeo = new THREE.BufferGeometry().setFromPoints([point, label.position]);
        const line = new THREE.Line(lineGeo, lineMat);
        line.computeLineDistances();
        line.renderOrder = 998;
        line.userData.isAnnotation = true;
        this.three.scene.add(line);

        state.annotations.push({
            point: point.clone(), text,
            pin, label, line
        });

        this.showMeasureStatus(`注釈を追加しました - 次の場所をクリック`);
    }

    createAnnotationLabel(text) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fontSize = 24;
        const padding = 10;
        const maxWidth = 300;

        ctx.font = `${fontSize}px sans-serif`;

        // テキストを複数行に分割
        const lines = text.split('\n');
        let maxLineWidth = 0;
        for (const line of lines) {
            const w = ctx.measureText(line).width;
            if (w > maxLineWidth) maxLineWidth = w;
        }

        const textWidth = Math.min(maxLineWidth, maxWidth);
        canvas.width = textWidth + padding * 2;
        canvas.height = fontSize * lines.length + padding * 2 + 8;

        // 背景
        ctx.fillStyle = MEASURE_COLORS.ANNOTATION_BG;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(0, 0, canvas.width, canvas.height, 8);
        } else {
            ctx.rect(0, 0, canvas.width, canvas.height);
        }
        ctx.fill();

        // 下向き三角ポインタ
        const cx = canvas.width / 2;
        const bottom = canvas.height;
        ctx.beginPath();
        ctx.moveTo(cx - 6, bottom);
        ctx.lineTo(cx, bottom + 8);
        ctx.lineTo(cx + 6, bottom);
        ctx.fill();

        // テキスト
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = MEASURE_COLORS.ANNOTATION_TEXT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach((line, i) => {
            ctx.fillText(line, padding, padding + fontSize * i);
        });

        const texture = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: texture, depthTest: false, sizeAttenuation: false
        }));
        const aspect = canvas.width / canvas.height;
        sprite.scale.set(0.1 * aspect, 0.1, 1);
        sprite.renderOrder = 1000;

        return sprite;
    }

    clearAllAnnotations() {
        if (!this.three.scene) return;
        this.removeSceneObjectsByFlag('isAnnotation');
        const state = this.three.annotationState;
        Object.assign(state, { annotations: [], markers: [], labels: [] });

        if (state.active) {
            this.showMeasureStatus('注釈をクリアしました - 次の場所をクリック');
        }
    }

    // ===== クリーンアップ =====

    cleanup3DViewer() {
        // 計測モード解除・データクリア
        if (this.three.measureState) {
            if (this.three.measureState.active) {
                this.three.measureState.active = false;
                const container = this.elements?.threeViewer;
                if (container) {
                    container.style.cursor = '';
                    if (this._measureClickHandler) container.removeEventListener('click', this._measureClickHandler);
                    if (this._measureMoveHandler) container.removeEventListener('mousemove', this._measureMoveHandler);
                }
            }
            this.clearAllMeasurements();
        }

        // アノテーションモード解除・データクリア
        if (this.three.annotationState) {
            if (this.three.annotationState.active) {
                this.three.annotationState.active = false;
                const container = this.elements?.threeViewer;
                if (container && this._annotateClickHandler) {
                    container.removeEventListener('click', this._annotateClickHandler);
                }
            }
            this.clearAllAnnotations();
        }
        // ダイアログがあれば削除
        const dialog = document.getElementById('annotation-dialog');
        if (dialog) dialog.remove();

        if (this.three.clipState?.active) this.resetClipPlane();
        this.removeWireframeOverlay();
        this.three.wireframeMode = 0;

        // UI非表示
        for (const id of ['three-toolbar', 'model-info-panel']) {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        }

        // Three.jsリソース破棄
        this.three.renderer?.dispose();
        this.three.scene?.clear();

        Object.assign(this.three, {
            renderer: null, scene: null, camera: null, controls: null,
            currentModel: null, modelBounds: null, scaleRatio: null,
            fileExt: null, isCAD: null
        });
    }
};
