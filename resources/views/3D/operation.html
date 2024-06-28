<!DOCTYPE html>
<html>
<head>
  <style>
    body{
      margin: 0;
      overflow: hidden;
    }
  </style>
  <meta charset="UTF-8" />
  <script type="importmap">
    {
      "imports": {
          "three": "https://unpkg.com/three@0.126.1/build/three.module.js",
          "three/addons/": "https://unpkg.com/three@0.126.1/examples/jsm/"
      }
    }
  </script>
  
  <script src="../3D/stats.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/dat-gui/0.7.9/dat.gui.min.js"></script>
</head>


<body>
    <div id="WebGL-output"></div>
    <div id="Stats-output"></div>

<script type="module">
  import * as THREE from 'three';
  import { OrbitControls } from 'https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js';
 
  var camera;
  var scene;
  var renderer;
  window.addEventListener('resize',onResize,false);

  function onResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
  }
 
  init();
  animate();

  function init() {
    var stats = initStats();
    //シーンの作成
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xffffff,20,500);
 
    //カメラの設定
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(-30,40,30);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
        
    //レンダラー
    renderer = new THREE.WebGLRenderer({ 
      alpha: true,
      antialias: true
    });
    renderer.setClearColor(new THREE.Color(0xEEEEEE));
    renderer.setSize(window.innerWidth, window.innerHeight);  
    renderer.shadowMap.enabled = true;
    
    //カメラコントローラーを制御する
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.2;


    //補助線
    const axes = new THREE.AxesHelper(120);
    scene.add(axes);

    const gridHelper = new THREE.GridHelper(150, 50,0xffff00) 
    scene.add(gridHelper);

    //光源
    var ambientColor = "#0c0c0c"
    var ambientLight = new THREE.AmbientLight(ambientColor);
    scene.add(ambientLight);

    var spotColor = "#ffffff"
    var spotLight = new THREE.SpotLight(spotColor);
    spotLight.intensity = 0.7; // 光の強さ
    spotLight.castShadow = true;
    spotLight.angle = 0.5;
    spotLight.target.position.set(0,0,0);
    scene.add(spotLight);

    var pointColor = "#ccffcc";
    var pointLight = new THREE.PointLight(pointColor);
    pointLight.intensity = 1.6;
    scene.add(pointLight);

    // 立体を作成
    var planegeometry = new THREE.PlaneGeometry(100,50);
    var planematerial = new THREE.MeshLambertMaterial({
      color: 0xffffff
    });
    var plane = new THREE.Mesh(planegeometry, planematerial);
    plane.receiveShadow = true;
    scene.add(plane);  

    var sphereGeometry = new THREE.SphereGeometry(4,20,20);
    var sphereMaterial = new THREE.MeshLambertMaterial({
      color: 0x7777ff
    });
    var sphere = new THREE.Mesh(sphereGeometry,sphereMaterial);
    sphere.castShadow = true;
    scene.add(sphere);

    var cubeGeometry = new THREE.BoxGeometry(4,4,4);
    var cubeMaterial = new THREE.MeshLambertMaterial({
      color: 0xff0000
    });
    var cube = new THREE.Mesh(cubeGeometry,cubeMaterial);  
    cube.castShadow = true;
    scene.add(cube);
    

    //調整 
    var adjustment = new function(){
      this.rotationSpeed = 0.02;
      this.bouncingSpeed = 0.03;
      this.numberOfObjects = scene.children.length;

      this.Ambient_Color = ambientColor; 
      this.disableSpotlight = false;
      this.Spot_Color = spotColor;
      this.Spot_intensity = 1;
      this.Spot_distance = 100;
      this.Spot_decay = 1;
      this.Spot_angle = 0.5;
      this.target = "Plane";
      
      this.LightSpeed = 0;
      this.disablePointlight = false;
      this.Point_Color = pointColor;
      this.Point_intensity = 1;
      this.Point_distance = 100;
      this.Point_decay = 1;

      this.addCube=function(){
        var cubeSize = Math.ceil((Math.random()*3));
        var cubeGeometry = new THREE.BoxGeometry(
          cubeSize,cubeSize,cubeSize
        );
        var cubeMaterial = new THREE.MeshLambertMaterial({
          color: Math.random() *0xffffff
        });
        var cube = new THREE.Mesh(cubeGeometry,cubeMaterial);
        cube.castShadow = true;
        cube.name = "cube-"+scene.children.length;

        cube.position.x = -30+Math.round((
          Math.random()*planegeometry.parameters.width
        ));
        cube.position.y = Math.round((Math.random()*5));
        cube.position.z = -20+Math.round((
          Math.random()*planegeometry.parameters.height
        ));

        scene.add(cube);
        this.numberOfObjects = scene.children.length;
      };

      this.addsphere=function(){
        var sphereSize = Math.ceil((Math.random()*3));
        var sphereGeometry = new THREE.SphereGeometry(
          sphereSize,20,20
        );
        var sphereMaterial = new THREE.MeshLambertMaterial({
          color: Math.random() *0xffffff
        });
        var sphere = new THREE.Mesh(sphereGeometry,sphereMaterial);
        sphere.castShadow = true;
        sphere.name = "sphere-"+scene.children.length;


        sphere.position.x = -30+Math.round((
          Math.random()*planegeometry.parameters.width
        ));
        sphere.position.y = Math.round((Math.random()*5));
        sphere.position.z = -20+Math.round((
          Math.random()*planegeometry.parameters.height
        ));

        scene.add(sphere);
        this.numberOfObjects = scene.children.length;
      };

      this.remove = function(){
        var allChildren = scene.children;
        var lastOfject = allChildren[allChildren.length -1];
        if(lastOfject instanceof THREE.Mesh  && allChildren.length>=7){
          scene.remove(lastOfject);
          this.numberOfObjects = allChildren.length;
        }
      };
    
    };

    //コントローラー
    var gui = new dat.GUI();
    gui.addColor(adjustment,'Ambient_Color').onChange(function(e){
      ambientLight.color = new THREE.Color(e);
    });

    gui.add(adjustment,'disableSpotlight').onChange(function(e){
      spotLight.visible =! e;
    });
    gui.addColor(adjustment,'Spot_Color').onChange(function(e){
      spotLight.color = new THREE.Color(e);
    });
    gui.add(adjustment,'Spot_intensity',0,3).onChange(function(e){
      spotLight.intensity = e;
    });
    gui.add(adjustment,'Spot_distance',0,100).onChange(function(e){
      spotLight.distance = e;
    });
    gui.add(adjustment,'Spot_decay',0,100).onChange(function(e){
      spotLight.decay = e;
    })
    gui.add(adjustment,'Spot_angle',0,100).onChange(function(e){
      spotLight.angle = e;
    })
    gui.add(adjustment,'LightSpeed',0,0.5);

    gui.add(adjustment,'disablePointlight').onChange(function(e){
      pointLight.visible =! e;
    });
    gui.addColor(adjustment,'Point_Color').onChange(function(e){
      pointLight.color = new THREE.Color(e);
    });
    gui.add(adjustment,'Point_intensity',0,3).onChange(function(e){
      pointLight.intensity = e;
    });
    gui.add(adjustment,'Point_distance',0,100).onChange(function(e){
      pointLight.distance = e;
    });
    gui.add(adjustment,'Point_decay',0,100).onChange(function(e){
      pointLight.decay = e;
    })

    gui.add(adjustment,'rotationSpeed',0,0.5);
    gui.add(adjustment,'bouncingSpeed',0,0.5);
    gui.add(adjustment, 'addCube');
    gui.add(adjustment, 'addsphere');
    gui.add(adjustment, 'remove');
    gui.add(adjustment, 'numberOfObjects').listen();

    document.getElementById("WebGL-output")
      .appendChild(renderer.domElement);

    render();

    //FPS
    function initStats(){
      var stats = new Stats();
      stats.setMode(0);
      stats.domElement.style.position = 'absolute';
      stats.domElement.style.left = '0px';
      stats.domElement.style.top = '0px';
      document.getElementById("Stats-output")
      .appendChild(stats.domElement);
      return stats;
    }

      //動作、配置
    var step = 0;
    var invert = 1;
    var phase = 0;

    function render(){ 
      stats.update();

      scene.traverse(function(obj){
        if(obj instanceof THREE.Mesh && obj != plane){
          obj.rotation.x += adjustment.rotationSpeed;
          obj.rotation.y += adjustment.rotationSpeed;
          obj.rotation.z += adjustment.rotationSpeed;
        }
      });

      if (phase > 2 * Math.PI) {
        invert = invert * -1;
        phase -= 2 * Math.PI;
      } else {
        phase += adjustment.LightSpeed;
      }
      spotLight.position.z = +(10 * (Math.sin(phase)));
      spotLight.position.x = +(-20 * (Math.cos(phase)));
      spotLight.position.y = 5;

      pointLight.position.set(-20,10,10);
      
      plane.position.set(25,0,0);
      plane.rotation.x =-0.5 * Math.PI;

      cube.position.set(-4,3,0);

      
      step += adjustment.bouncingSpeed;
      sphere.position.x =20+(10*(Math.cos(step)))
      sphere.position.y=2+(10*Math.abs(Math.sin(step)));
      sphere.position.z=2;
      sphere.rotation.z +=0.1;

      requestAnimationFrame(render);
      renderer.render(scene,camera);
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
    
  </script>

  </body>
</html>