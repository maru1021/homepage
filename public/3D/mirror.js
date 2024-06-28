import * as THREE from 'https://unpkg.com/three/build/three.module.js'
import { OrbitControls } from 'https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js';
 

const canvas = document.getElementById("canvas");

//シーン
const scene = new THREE.Scene();

const sizes = {
    width: innerWidth,
    height: innerHeight
}

//カメラ
const camera = new THREE.PerspectiveCamera(75,sizes.width/sizes.height,
0.1,3000);
camera.position.set(500,0,1000);
scene.add(camera);

//レンダラー
const rennderer = new THREE.WebGLRenderer({canvas:canvas,antialias: true});
rennderer.setSize(sizes.width,sizes.height);
rennderer.setPixelRatio(Window.devicePixelRatio)

//背景 右,左,上,下,前,後ろ
const background = [
    "envImage/right.png",
    "envImage/left.png",
    "envImage/up.png",
    "envImage/down.png",
    "envImage/front.png",
    "envImage/back.png"
]

//背景設定
const loader = new THREE.CubeTextureLoader();
scene.background = loader.load(background);

//カメラを動かせるように
const contorols = new OrbitControls(camera,canvas);
contorols.enableDamping = true;

//球体を作成、映り込み設定
const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(1000);//映り込みの解像度
const cubeCamera = new THREE.CubeCamera(1,1000,cubeRenderTarget);
scene.add(cubeCamera);

const material = new THREE.MeshBasicMaterial({
    envMap: cubeRenderTarget.texture,//球体の色を背景画像に
    reflectivity: 1//映り込み具合
});
const geometory = new THREE.SphereGeometry(350,50,50);

const spehere = new THREE.Mesh(geometory,material);
spehere.position.set(0,100,-10);
scene.add(spehere);


function animate(){
contorols.update();//カメラ操作のアップデート
cubeCamera.update(rennderer,scene)//球体鵜映り込みアップデート
rennderer.render(scene,camera);
window.requestAnimationFrame(animate);
};

animate();