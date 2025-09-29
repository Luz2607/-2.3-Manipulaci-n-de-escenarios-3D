import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let camera, scene, renderer, controls;

const objects = [];
let raycaster;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const vertex = new THREE.Vector3();
const color = new THREE.Color();

// ====== NUEVO: grupos para alternar entornos ======
let baseGroup;                  // mundo original (suelo + cajas)
let synthGroup = null;          // entorno futurista
let synthBuilt = false;
let synthOn = false;

// ====== NUEVO: refs para animación del modo synth ======
let synth = {
  stars: null,
  floatCubes: null,            // InstancedMesh de cubos flotantes
  timeStart: performance.now(),
  gridPulse: []
};

init();

function init() {

  camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 2000 );
  camera.position.y = 10;

  scene = new THREE.Scene();
  scene.background = new THREE.Color( 0xffffff );
  scene.fog = new THREE.Fog( 0xffffff, 0, 750 );

  const light = new THREE.HemisphereLight( 0xeeeeff, 0x777788, 2.5 );
  light.position.set( 0.5, 1, 0.75 );
  scene.add( light );

  controls = new PointerLockControls( camera, document.body );
  // --- AÑADIDO: compatibilidad getObject() ---
  if (typeof controls.getObject !== 'function') {
    controls.getObject = () => controls.object;
  }

  const blocker = document.getElementById( 'blocker' ) || makeBlocker();
  const instructions = document.getElementById( 'instructions' ) || makeInstructions();

  instructions.addEventListener( 'click', function () {
    controls.lock();
  } );

  controls.addEventListener( 'lock', function () {
    instructions.style.display = 'none';
    blocker.style.display = 'none';
  } );

  controls.addEventListener( 'unlock', function () {
    blocker.style.display = 'block';
    instructions.style.display = '';
  } );

  scene.add( controls.object );

  const onKeyDown = function ( event ) {
    switch ( event.code ) {

      case 'ArrowUp':
      case 'KeyW': moveForward = true; break;

      case 'ArrowLeft':
      case 'KeyA': moveLeft = true; break;

      case 'ArrowDown':
      case 'KeyS': moveBackward = true; break;

      case 'ArrowRight':
      case 'KeyD': moveRight = true; break;

      case 'Space':
        if ( canJump === true ) velocity.y += 350;
        canJump = false;
        break;

      // ====== NUEVO: alternar entorno Synth ======
      case 'KeyC':
        toggleSynth();
        break;
    }
  };

  const onKeyUp = function ( event ) {
    switch ( event.code ) {
      case 'ArrowUp':
      case 'KeyW': moveForward = false; break;

      case 'ArrowLeft':
      case 'KeyA': moveLeft = false; break;

      case 'ArrowDown':
      case 'KeyS': moveBackward = false; break;

      case 'ArrowRight':
      case 'KeyD': moveRight = false; break;
    }
  };

  document.addEventListener( 'keydown', onKeyDown );
  document.addEventListener( 'keyup', onKeyUp );

  raycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3( 0, - 1, 0 ), 0, 10 );

  // ====== ORIGINAL: floor + boxes dentro de un grupo ======
  baseGroup = new THREE.Group();
  scene.add(baseGroup);

  // floor
  let floorGeometry = new THREE.PlaneGeometry( 2000, 2000, 100, 100 );
  floorGeometry.rotateX( - Math.PI / 2 );

  // vertex displacement
  let position = floorGeometry.attributes.position;
  for ( let i = 0, l = position.count; i < l; i ++ ) {
    vertex.fromBufferAttribute( position, i );
    vertex.x += Math.random() * 20 - 10;
    vertex.y += Math.random() * 2;
    vertex.z += Math.random() * 20 - 10;
    position.setXYZ( i, vertex.x, vertex.y, vertex.z );
  }

  floorGeometry = floorGeometry.toNonIndexed(); // ensure each face has unique vertices
  position = floorGeometry.attributes.position;
  const colorsFloor = [];
  for ( let i = 0, l = position.count; i < l; i ++ ) {
    color.setHSL( Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75, THREE.SRGBColorSpace );
    colorsFloor.push( color.r, color.g, color.b );
  }
  floorGeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colorsFloor, 3 ) );
  const floorMaterial = new THREE.MeshBasicMaterial( { vertexColors: true } );
  const floor = new THREE.Mesh( floorGeometry, floorMaterial );
  baseGroup.add( floor );

  // objects
  const boxGeometry = new THREE.BoxGeometry( 20, 20, 20 ).toNonIndexed();
  position = boxGeometry.attributes.position;
  const colorsBox = [];
  for ( let i = 0, l = position.count; i < l; i ++ ) {
    color.setHSL( Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75, THREE.SRGBColorSpace );
    colorsBox.push( color.r, color.g, color.b );
  }
  boxGeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colorsBox, 3 ) );

  for ( let i = 0; i < 500; i ++ ) {
    const boxMaterial = new THREE.MeshPhongMaterial( { specular: 0xffffff, flatShading: true, vertexColors: true } );
    boxMaterial.color.setHSL( Math.random() * 0.2 + 0.5, 0.75, Math.random() * 0.25 + 0.75, THREE.SRGBColorSpace );

    const box = new THREE.Mesh( boxGeometry, boxMaterial );
    box.position.x = Math.floor( Math.random() * 20 - 10 ) * 20;
    box.position.y = Math.floor( Math.random() * 20 ) * 20 + 10;
    box.position.z = Math.floor( Math.random() * 20 - 10 ) * 20;

    baseGroup.add( box );
    objects.push( box );
  }

  // renderer
  renderer = new THREE.WebGLRenderer( { antialias: true } );
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setAnimationLoop( animate );
  document.body.appendChild( renderer.domElement );

  // panel de ayuda (derecha)
  addHelpPanel();

  window.addEventListener( 'resize', onWindowResize );
}

// =============== Panel UI rápido ===============
function addHelpPanel(){
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;right:18px;top:18px;width:260px;z-index:1000;
    background:rgba(10,10,20,.7);color:#fff;border-radius:10px;
    font:14px/1.45 system-ui,sans-serif;padding:12px 14px;
    backdrop-filter: blur(4px);
  `;
  el.innerHTML = `
    <div style="font-weight:700;margin-bottom:6px">Controles</div>
    <div><b>C</b> — Alternar modo <i>Synth City</i></div>
    <div><b>Click</b> — Bloquear puntero</div>
    <div><b>WASD</b> — Mover</div>
    <div><b>Espacio</b> — Saltar</div>
    <div style="opacity:.8;margin-top:6px">Consejo: en modo synth hay cubos flotantes y una ciudad neón con cielo estrellado.</div>
  `;
  document.body.appendChild(el);
}

// =============== Bloqueador / instrucciones mínimo si no existían ===============
function makeBlocker(){
  const d = document.createElement('div');
  d.id = 'blocker';
  d.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);';
  document.body.appendChild(d);
  return d;
}
function makeInstructions(){
  const d = document.createElement('div');
  d.id = 'instructions';
  d.style.cssText = `
    position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    color:#fff;font:16px/1.4 system-ui,sans-serif;text-align:center;cursor:pointer;
  `;
  d.innerHTML = `<div style="margin-bottom:6px;font-size:22px;font-weight:700">Haz click para jugar</div>
  <div>WASD moverse • Espacio saltar • C alterna entorno futurista</div>`;
  document.body.appendChild(d);
  return d;
}

// =============== MODO SYNTH CITY ===============
function toggleSynth(){
  if (!synthBuilt) {
    buildSynthCity();
    synthBuilt = true;
  }
  synthOn = !synthOn;

  // ocultar/mostrar mundo base
  baseGroup.visible = !synthOn;

  // mostrar/ocultar synth
  if (synthGroup) synthGroup.visible = synthOn;

  // atmósfera
  if (synthOn) {
    scene.fog.color.set(0xBCA9FF);
    scene.fog.near = 100;
    scene.fog.far = 1600;
    scene.background = makeSkyGradient();
  } else {
    scene.fog.color.set(0xffffff);
    scene.fog.near = 0;
    scene.fog.far = 750;
    scene.background = new THREE.Color(0xffffff);
  }
}

function buildSynthCity(){
  synthGroup = new THREE.Group();
  synthGroup.visible = false;
  scene.add(synthGroup);

  // --- Cielo estrellado (puntos) ---
  const starGeo = new THREE.BufferGeometry();
  const starCount = 2000;
  const positions = new Float32Array(starCount*3);
  for (let i=0;i<starCount;i++){
    const r = 1200 + Math.random()*800;
    const theta = Math.random()*Math.PI*2;
    const phi = Math.acos(2*Math.random()-1);
    positions[i*3+0] = r*Math.sin(phi)*Math.cos(theta);
    positions[i*3+1] = r*Math.cos(phi);
    positions[i*3+2] = r*Math.sin(phi)*Math.sin(theta);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  const starMat = new THREE.PointsMaterial({ size: 2, color: 0xFFFFFF, opacity: 0.9, transparent: true });
  synth.stars = new THREE.Points(starGeo, starMat);
  synthGroup.add(synth.stars);

  // --- Suelo espejo simple + líneas de neón (calles) ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshStandardMaterial({ color: 0x101018, metalness: 0.8, roughness: 0.2 })
  );
  ground.rotation.x = -Math.PI/2;
  ground.position.y = -0.001;
  synthGroup.add(ground);

  // tiras de neón
  const neonMatCyan = new THREE.MeshBasicMaterial({ color: 0x00E5FF, transparent:true, opacity:0.8, blending:THREE.AdditiveBlending });
  const neonMatMag = new THREE.MeshBasicMaterial({ color: 0xFF39FF, transparent:true, opacity:0.8, blending:THREE.AdditiveBlending });
  const stripW = 3, stripH = 0.1, stripLen = 4000;
  const stripGeo = new THREE.BoxGeometry(stripLen, stripH, stripW);
  const stripGeo2 = new THREE.BoxGeometry(stripW, stripH, stripLen);

  const strip1 = new THREE.Mesh(stripGeo, neonMatMag);
  strip1.position.y = 0.05;
  synthGroup.add(strip1);

  const strip2 = new THREE.Mesh(stripGeo2, neonMatCyan);
  strip2.position.y = 0.05;
  synthGroup.add(strip2);

  // cuadrícula adicional
  const grid = new THREE.GridHelper(4000, 80, 0x5522ff, 0x5522ff);
  grid.material.opacity = 0.15;
  grid.material.transparent = true;
  synthGroup.add(grid);

  // --- Torres y prisma de vidrio (ciudad low poly) ---
  const city = new THREE.Group();
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x88cfff,
    metalness: 0.0,
    roughness: 0.1,
    transmission: 0.9,
    thickness: 0.6,
    transparent: true
  });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x201030, metalness: 0.6, roughness: 0.5 });

  const rng = (min,max)=>min+Math.random()*(max-min);
  for (let i=0;i<250;i++){
    const w = rng(10, 60);
    const d = rng(10, 60);
    const h = rng(20, 260);
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = Math.random()<0.4 ? glassMat.clone() : wallMat.clone();
    if (mat instanceof THREE.MeshStandardMaterial) { mat.emissive = new THREE.Color(0x221144); }
    const bld = new THREE.Mesh(geo, mat);
    bld.position.set( (Math.random()-0.5)*3000, h/2, (Math.random()-0.5)*3000 );
    city.add(bld);

    // <<< AÑADIDO: que sean colisionables para poder subir
    objects.push(bld);

    // barras de neón en fachadas (algunas)
    if (Math.random()<0.35){
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 1.2), new THREE.MeshBasicMaterial({
        color: (Math.random()<0.5?0x00E5FF:0xFF39FF),
        blending: THREE.AdditiveBlending, transparent:true, opacity:0.85
      }));
      bar.position.set(bld.position.x + (Math.random()-0.5)*w*0.8, h/2, bld.position.z + (Math.random()<0.5?d/2+0.6:-d/2-0.6));
      synthGroup.add(bar);
      synth.gridPulse?.push(bar.material);
    }
  }
  synthGroup.add(city);

  // --- Cubos flotantes translúcidos (InstancedMesh) ---
  const cubeGeo = new THREE.BoxGeometry(30,30,30);
  const cubeMat = new THREE.MeshPhysicalMaterial({
    color: 0xB388FF, metalness: 0, roughness: 0.05, transmission: 0.85, thickness: 1.0, transparent:true,
    emissive: new THREE.Color(0x330044), emissiveIntensity: 0.2
  });
  const COUNT = 80;
  synth.floatCubes = new THREE.InstancedMesh(cubeGeo, cubeMat, COUNT);
  const tmp = new THREE.Matrix4();
  for (let i=0;i<COUNT;i++){
    const x = (Math.random()-0.5)*1500;
    const y = 80 + Math.random()*320;
    const z = (Math.random()-0.5)*1500;
    const s = 0.6 + Math.random()*1.8;
    tmp.compose(new THREE.Vector3(x,y,z), new THREE.Quaternion(), new THREE.Vector3(s,s,s));
    synth.floatCubes.setMatrixAt(i, tmp);
  }
  synth.floatCubes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  synthGroup.add(synth.floatCubes);

  // --- Luces de ambiente neón ---
  const key = new THREE.DirectionalLight(0xFFFFFF, 0.6);
  key.position.set(200,400,100);
  synthGroup.add(key);
  const fillCyan = new THREE.PointLight(0x00E5FF, 1.6, 0, 2);
  fillCyan.position.set(-200, 120, -100);
  const fillMag = new THREE.PointLight(0xFF39FF, 1.4, 0, 2);
  fillMag.position.set(220, 160, 140);
  synthGroup.add(fillCyan, fillMag);

  // <<< AÑADIDO: plataformas/cubos para trepar
  addSynthPlatforms();
}

function makeSkyGradient(){
  // textura de gradiente morado-azul para el fondo
  const c = document.createElement('canvas');
  c.width = 2; c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0,0,0,512);
  g.addColorStop(0, '#2a1e6b');
  g.addColorStop(0.5, '#5a4fb0');
  g.addColorStop(1, '#bca9ff');
  ctx.fillStyle = g; ctx.fillRect(0,0,2,512);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {

  const time = performance.now();

  // ====== JUGABILIDAD ORIGINAL ======
  if ( controls.isLocked === true ) {

    raycaster.ray.origin.copy( controls.object.position );
    raycaster.ray.origin.y -= 10;

    const intersections = raycaster.intersectObjects( objects, false );
    const onObject = intersections.length > 0;

    const delta = ( time - prevTime ) / 1000;

    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= 9.8 * 100.0 * delta; // gravedad

    direction.z = Number( moveForward ) - Number( moveBackward );
    direction.x = Number( moveRight ) - Number( moveLeft );
    direction.normalize();

    if ( moveForward || moveBackward ) velocity.z -= direction.z * 400.0 * delta;
    if ( moveLeft || moveRight ) velocity.x -= direction.x * 400.0 * delta;

    if ( onObject === true ) {
      velocity.y = Math.max( 0, velocity.y );
      canJump = true;
    }

    controls.moveRight( - velocity.x * delta );
    controls.moveForward( - velocity.z * delta );
    controls.object.position.y += ( velocity.y * delta );

    if ( controls.object.position.y < 10 ) {
      velocity.y = 0;
      controls.object.position.y = 10;
      canJump = true;
    }
  }

  // ====== ANIMACIONES DEL MODO SYNTH ======
  if (synthOn && synthGroup){
    const t = (time - synth.timeStart) * 0.001;

    // estrellas muy lentas
    if (synth.stars) {
      synth.stars.rotation.y = t * 0.01;
    }

    // pulso de barras de neón
    if (synth.gridPulse && synth.gridPulse.length){
      const pulse = (Math.sin(t*2.0)*0.5+0.5)*0.5 + 0.5;
      synth.gridPulse.forEach(m => m.opacity = 0.55 * pulse + 0.25);
    }

    // flotación de cubos
    if (synth.floatCubes){
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      const p = new THREE.Vector3();
      for (let i=0;i<synth.floatCubes.count;i++){
        synth.floatCubes.getMatrixAt(i, m);
        m.decompose(p, q, s);
        p.y += Math.sin(t*1.2 + i*0.37) * 0.35; // subir/bajar sutil
        const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3*deltaAngle(i,t), 0.2*deltaAngle(i*2,t), 0));
        q.multiply(rot);
        m.compose(p, q, s);
        synth.floatCubes.setMatrixAt(i, m);
      }
      synth.floatCubes.instanceMatrix.needsUpdate = true;
    }
  }

  prevTime = time;
  renderer.render( scene, camera );
}

function deltaAngle(seed, t){
  return Math.sin(t*0.4 + seed)*0.02;
}

/* ===== AÑADIDO: plataformas/cubos colisionables en el entorno Synth ===== */
function addSynthPlatforms() {
  const platGeo = new THREE.BoxGeometry(20, 20, 20);
  const platMat = new THREE.MeshPhongMaterial({
    color: 0x9a67ff, emissive: 0x5511aa, shininess: 80, transparent: true, opacity: 0.95
  });

  // Escalera cerca del punto de inicio
  for (let i = 0; i < 8; i++) {
    const step = new THREE.Mesh(platGeo, platMat.clone());
    step.position.set(60, 10 + i * 20, -40);
    synthGroup.add(step);
    objects.push(step); // importante para poder subirse
  }

  // Plataformas dispersas por la ciudad
  for (let i = 0; i < 100; i++) {
    const b = new THREE.Mesh(platGeo, platMat.clone());
    b.position.set(
      Math.floor((Math.random() * 40 - 20)) * 20,
      10 + Math.floor(Math.random() * 8) * 20,
      Math.floor((Math.random() * 40 - 20)) * 20
    );
    synthGroup.add(b);
    objects.push(b);
  }
}
