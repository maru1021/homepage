import * as THREE from 'three';
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
0.1,5000);
camera.position.set(300, 400, 500);
camera.lookAt(new THREE.Vector3(0, 0, 0));
scene.add(camera);

//レンダラー
const rennderer = new THREE.WebGLRenderer({canvas:canvas,antialias: true});
rennderer.setSize(sizes.width,sizes.height);
rennderer.setPixelRatio(Window.devicePixelRatio)

//カメラを動かせるように
const contorols = new OrbitControls(camera,canvas);
contorols.enableDamping = true;

//オブジェクト
const earthGeometry = new THREE.SphereGeometry(30,50,50);
const earthMaterial = new THREE.MeshLambertMaterial({
  map: new THREE.TextureLoader().load("envImage/earth.png")
});
const earth = new THREE.Mesh(earthGeometry,earthMaterial);
scene.add(earth);
earth.position.set(200,0,0);
earth.name = "earth"

const sunGeometry = new THREE.SphereGeometry(150,50,50);
const sunMaterial = new THREE.MeshBasicMaterial({
  map: new THREE.TextureLoader().load("envImage/sun.jpg"),
});
const sun = new THREE.Mesh(sunGeometry,sunMaterial);
scene.add(sun);
sun.position.set(0,0,0);
sun.name = "sun"

const moonGeometry = new THREE.SphereGeometry(8,50,50);
const moonMaterial = new THREE.MeshStandardMaterial({
  map: new THREE.TextureLoader().load("envImage/moon.jpg")
});
const moon = new THREE.Mesh(moonGeometry,moonMaterial);
scene.add(moon);
moon.position.set(230,0,0);
moon.name = "moon"

//ライト
var ambientColor = "#0c0c0c";
var ambientLight = new THREE.AmbientLight(ambientColor);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight();
directionalLight.position.set(0,0,0);
directionalLight.target = earth;
scene.add(directionalLight);

//初期流星作成
function star(n){
  const x_size = window.innerWidth*2;
  const y_size = window.innerHeight*2;
  const length = n;
  const star = [];

  for(let i=0; i<length; i++){
      let starGeometry = new THREE.SphereGeometry(1,1,1);
      let starMaterial = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide
    });
    star[i] = new THREE.Mesh(starGeometry,starMaterial);

    star[i].position.x = x_size * (Math.random() - 0.5);
    star[i].position.y = y_size * (Math.random() - 0.5);
    star[i].position.z = x_size * (Math.random() - 0.5);
    scene.add( star[i] );
  }
}

star(200);

function handleClick(event) {
    star(1000);
}

// 画面クリックイベントのリスナー登録
document.addEventListener("click", handleClick, false);

//動作
    let deg = 0;

  let earthOrbitRadius = 400; // 地球の公転半径
  let moonOrbitRadius = 50; // 月の公転半径
  let earthRotationSpeed = 0.01; // 地球の回転速度
  let moonRotationSpeed = 0.05; // 月の回転速度

  function tick() {
  const size = Math.random()/100

  sun.rotation.y -= 0.01;

    // 地球の回転と公転
  earth.rotation.y += earthRotationSpeed;
  earth.position.x = Math.cos(earth.rotation.y) * earthOrbitRadius;
  earth.position.z = Math.sin(earth.rotation.y) * earthOrbitRadius;

  // 月の回転と公転
  moon.rotation.y += moonRotationSpeed;
  moon.position.x = earth.position.x + Math.cos(moon.rotation.y) * moonOrbitRadius;
  moon.position.z = earth.position.z + Math.sin(moon.rotation.y) * moonOrbitRadius;

    star(1);

    scene.traverse(function(obj){
      if(obj instanceof THREE.Mesh && obj.name != "earth" && obj.name != "sun" 
      && obj.name != "moon"){
        obj.position.x -= 10;
        obj.position.y -= 10;
        obj.position.z -= 5;
      }
    });
   
    rennderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

function animate(){
  contorols.update();//カメラ操作のアップデート
  rennderer.render(scene,camera);
  window.requestAnimationFrame(tick);
};

animate();  