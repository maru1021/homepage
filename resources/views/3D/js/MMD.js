import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js';
import { MMDLoader } from 'https://unpkg.com/three/examples/jsm/loaders/MMDLoader.js';
import { MMDAnimationHelper} from 'https://unpkg.com/three/examples/jsm/animation/MMDAnimationHelper.js';
import { FontLoader } from "https://unpkg.com/three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "https://unpkg.com/three/examples/jsm/geometries/TextGeometry.js";


class App {
  constructor() {
    this.canvas = document.getElementById("canvas");
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, this.canvas.width / this.canvas.height, 0.1, 5000);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.orbitControls = new OrbitControls(this.camera, this.canvas);
    
    this.moving = false;
    this.animationHelper = new MMDAnimationHelper({ afterglow: 2.0 });
    this.loader = new MMDLoader();
    this.listener = new THREE.AudioListener();

    this.modelFile = 'Hatsune_Miku/miku.pmx';
    this.stageFile = 'envImage/okashi/stage.pmx';
    this.motionFile = ['vmd/女の子になりたい_常盤くるみ.vmd'];
    this.audioFile = 'music/女の子になりたい.mp3';
    

    //MMD
    this.loadModel();
    this.audio(this.audioFile);
  }

  //画面表示
  setScene() {
    const scene = this.scene;
    const camera = this.camera;
    const renderer = this.renderer;
    const orbitControls = this.orbitControls;

    camera.position.set(0, 20, 80);
    scene.add(camera);
    camera.lookAt(new THREE.Vector3(0,20,0));

    renderer.setSize(this.canvas.width, this.canvas.height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(window.devicePixelRatio);

    orbitControls.maxPolarAngle = Math.PI / 2 - 0.2;
    orbitControls.minPolarAngle = 0;
    orbitControls.enableDamping = true;

    const moveSpeed = 1;

    //オブジェクト
    const cubeGeometry = new THREE.BoxGeometry(0, 0, 0);
    const cubeMaterial = new THREE.MeshBasicMaterial();
    const Box = new THREE.Mesh(cubeGeometry, cubeMaterial);
    scene.add(Box);
    this.Box = Box;
    Box.visible =false;

    //ライト
    const ambientColor = "#000000";
    const ambientLight = new THREE.AmbientLight(ambientColor);
    scene.add(ambientLight);

    const spotColor = "#d2a973";
    const spotLight = new THREE.SpotLight(spotColor);
    spotLight.castShadow = true;
    scene.add(spotLight);
    spotLight.position.set(30, 80, 100);
    spotLight.angle = 280;

    scene.fog = new THREE.Fog(0x000000, 0.015);

    // ジョイスティックの作成
    const joystickContainer = document.getElementById('joystick');
    const joystick = nipplejs.create({
      zone: joystickContainer,
      mode: 'static',
      position: { left: '10%', top: '90%' },
      color: '#ffffff',
    });

    const movement = new THREE.Vector3();

    joystick.on('start', () => {
      this.moving = true;
    });

    joystick.on('end', () => {
      this.moving = false;
      movement.set(0, 0, 0);
    });

    joystick.on('move', (evt, data) => {
      if (this.moving) {
        const dx = data.vector.x * moveSpeed;
        const dy = data.vector.y * moveSpeed;

        // カメラの向きに基づいて移動ベクトルを計算
        movement.set(dx, 0, -dy);
        camera.localToWorld(movement);
        movement.sub(camera.position);
      }
    });

    

    //アニメーション
    const animate = ()  => {
      if (this.moving) {
        this.Box.position.add(movement);
        this.camera.position.add(movement);
      }
  
      if (this.animationHelper) {
        this.animationHelper.update(1 / 60); // フレームレートを指定
      }

      if (this.change == "change") {
        this.audio();
      }

      spotLight.position.x = Box.position.x + 50;
      spotLight.position.y = Box.position.y + 50;
      spotLight.position.z = Box.position.z + 50;
      this.camera.lookAt(new THREE.Vector3(0,20,0));
  
      renderer.render(scene, camera);
      renderer.setAnimationLoop(animate);
    }

    animate();
  }

  loadModel() {
      const loader = new MMDLoader();
      const animationHelper = this.animationHelper;
      const modelFile = this.modelFile;
      const stageFile = this.stageFile;
      const motionFile = this.motionFile;

    //ステージ
    loader.load(stageFile,(stage) => {
      this.scene.add(stage);
      stage.scale.x = 3;
      stage.scale.y = 3;
      stage.scale.z = 3;
    })

      loader.load(modelFile, (model) => {
        this.scene.add(model);
        model.castShadow = true;

        loader.loadAnimation(motionFile, model, (vmd) => {
          this.animationHelper.add(model, {
            animation: vmd,
            physics: true,
          });
          animationHelper.enable('animation');
          animationHelper.enable('ik');
          animationHelper.enable('physics');
        });
      });
    }
  

  //音楽
  audio(music) {
    const camera = this.camera;
    const audioFile = music;
    const audioListener = this.listener
    camera.add(audioListener);
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load(audioFile, (audioBuffer) => {
      const audio = new THREE.Audio(audioListener);
      audio.setBuffer(audioBuffer);
      audio.setLoop(true);
      audio.setVolume(0.5);
      audio.play();
    });
  }

}

const app = new App();
window.onload = app.setScene();