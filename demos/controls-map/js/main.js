import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { MapControls } from 'three/addons/controls/MapControls.js';

let camera, controls, scene, renderer;

// ====== ORIGINAL ======
let origGroup;               // cubos originales
let origLights;              // luces originales

// ====== CIUDAD ======
const CITY = { half: 800, grid: 80, road: 16, cars: 80 };
let cityGroup, basePlane, roadGroup, marksGroup;
let buildingsGroup, carsGroup, parksGroup, lampsGroup, signalsGroup, billboardsGroup, sidewalksGroup;
let pedestriansGroup;
let hemiLight, dirLight;
const buildings = [];
const cars = [];
const semaphores = [];  // {meshes:{r,y,g}, phaseOffset, gridX, gridZ}
const lamps = [];       // {bulb, light}
const billboards = [];  // {mesh, ctx, tex}
let cityMode = false;   // tecla C alterna
let nightMode = false;

// ====== NUEVO (solo añadir) ======
const smartVehicles = []; // tráfico que obedece semáforos
const signalMap = new Map(); // "x,z" -> { phaseOffset }

// ====== NUEVO: peatones optimizados ======
const PEDESTRIANS = { count: 320, speedMin: 1.2, speedMax: 2.8 };
let pedBodiesIM, pedHeadsIM; // InstancedMesh
const peds = []; // {axis, dir, lane, pos:THREE.Vector3, v, len, rotY}

// =================== INIT ===================
init();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcccccc);
  scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000);
  camera.position.set(0, 200, -400);

  // controles
  controls = new MapControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 100;
  controls.maxDistance = 900;
  controls.maxPolarAngle = Math.PI / 2;

  // ====== mundo original (SIN CAMBIOS de lógica) ======
  origGroup = new THREE.Group();
  scene.add(origGroup);

  const geometry = new THREE.BoxGeometry();
  geometry.translate(0, 0.5, 0);
  const material = new THREE.MeshPhongMaterial({ color: 0xeeeeee, flatShading: true });

  for (let i = 0; i < 500; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = Math.random() * 1600 - 800;
    mesh.position.y = 0;
    mesh.position.z = Math.random() * 1600 - 800;
    mesh.scale.x = 20;
    mesh.scale.y = Math.random() * 80 + 10;
    mesh.scale.z = 20;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    origGroup.add(mesh);
  }

  // luces originales
  origLights = new THREE.Group();
  const dirLight1 = new THREE.DirectionalLight(0xffffff, 3);
  dirLight1.position.set(1, 1, 1);
  origLights.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0x002288, 3);
  dirLight2.position.set(-1, -1, -1);
  origLights.add(dirLight2);

  const ambientLight = new THREE.AmbientLight(0x555555);
  origLights.add(ambientLight);
  scene.add(origLights);

  // ====== ciudad (pre-construida pero oculta) ======
  buildCity();
  cityGroup.visible = false;

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('keydown', onKey);

  // GUI original + toggles de ciudad
  const gui = new GUI();
  gui.add(controls, 'zoomToCursor');
  gui.add(controls, 'screenSpacePanning');

  const fCity = gui.addFolder('City Mode (C)');
  fCity.add({ enable: ()=>toggleCity() }, 'enable').name('Toggle City (C)');
  fCity.add(scene.fog, 'density', 0, 0.01, 0.0005).name('Fog density');
  fCity.add({ night: ()=>toggleNight() }, 'night').name('Toggle Night (N)');

  const fLayers = gui.addFolder('City Layers');
  fLayers.add(parksGroup, 'visible').name('Parks');
  fLayers.add(lampsGroup, 'visible').name('Lamps');
  fLayers.add(signalsGroup, 'visible').name('Traffic lights');
  fLayers.add(billboardsGroup, 'visible').name('Billboards');
  fLayers.add(sidewalksGroup, 'visible').name('Sidewalks');
  fLayers.add(pedestriansGroup, 'visible').name('Pedestrians'); // NUEVO
}

// =================== CITY BUILD ===================
function buildCity(){
  cityGroup = new THREE.Group();
  scene.add(cityGroup);

  // suelo base
  basePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half*2+200, CITY.half*2+200),
    new THREE.MeshStandardMaterial({ color: 0x202429, roughness: 1, metalness: 0 })
  );
  basePlane.rotation.x = -Math.PI/2;
  basePlane.receiveShadow = true;
  cityGroup.add(basePlane);

  // grupos
  roadGroup = new THREE.Group();     cityGroup.add(roadGroup);
  marksGroup = new THREE.Group();    cityGroup.add(marksGroup);
  buildingsGroup = new THREE.Group();cityGroup.add(buildingsGroup);
  carsGroup = new THREE.Group();     cityGroup.add(carsGroup);
  parksGroup = new THREE.Group();    cityGroup.add(parksGroup);
  lampsGroup = new THREE.Group();    cityGroup.add(lampsGroup);
  signalsGroup = new THREE.Group();  cityGroup.add(signalsGroup);
  billboardsGroup = new THREE.Group(); cityGroup.add(billboardsGroup);
  sidewalksGroup = new THREE.Group(); cityGroup.add(sidewalksGroup);
  pedestriansGroup = new THREE.Group(); cityGroup.add(pedestriansGroup); // NUEVO

  // avenidas + marcas + banquetas
  addRoadGrid();
  addSidewalks();

  // edificios
  buildBuildings(500);
  enhanceBuildings();

  // parques/plazas
  buildParks();

  // farolas
  buildLamps();

  // semáforos
  buildTrafficLights();

  // pantallas publicitarias
  buildBillboards();

  // luces ciudad
  hemiLight = new THREE.HemisphereLight(0xffffff, 0x4b5057, 0.9);
  dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(60, 100, -40);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 600;
  cityGroup.add(hemiLight, dirLight, new THREE.AmbientLight(0x222222));

  // autos (tus originales)
  spawnCars(CITY.cars);

  // tráfico inteligente adicional
  spawnSmartVehicles(40);

  // ====== NUEVO: peatones (instanced) ======
  spawnPedestrians(PEDESTRIANS.count);
}

function addRoadGrid(){
  const L = CITY.half*2 + CITY.grid;
  const asph = new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 1, metalness: 0 });
  const gX = new THREE.BoxGeometry(L, 0.1, CITY.road);
  const gZ = new THREE.BoxGeometry(CITY.road, 0.1, L);

  for (let x = -CITY.half; x <= CITY.half; x += CITY.grid) {
    const m = new THREE.Mesh(gX, asph); m.position.set(0, 0.01, x); m.receiveShadow = true; roadGroup.add(m);
  }
  for (let z = -CITY.half; z <= CITY.half; z += CITY.grid) {
    const m = new THREE.Mesh(gZ, asph); m.position.set(z, 0.01, 0); m.receiveShadow = true; roadGroup.add(m);
  }

  const markMat = new THREE.MeshBasicMaterial({ color: 0x9ec8ff, toneMapped:false });
  const dashLen = 10, dashGap = 10, dashW = 1.2, dashH = 0.05;

  for (let z = -CITY.half; z <= CITY.half; z += CITY.grid) {
    for (let x = -CITY.half; x < CITY.half; x += dashLen + dashGap) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(dashLen, dashH, dashW), markMat);
      d.position.set(x + dashLen/2, 0.06, z); marksGroup.add(d);
    }
  }
  for (let x = -CITY.half; x <= CITY.half; x += CITY.grid) {
    for (let z = -CITY.half; z < CITY.half; z += dashLen + dashGap) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(dashW, dashH, dashLen), markMat);
      d.position.set(x, 0.06, z + dashLen/2); marksGroup.add(d);
    }
  }
}

function addSidewalks(){
  // bandas claras paralelas a las avenidas (simulan banqueta)
  const L = CITY.half*2 + CITY.grid;
  const w = CITY.road + 6;
  const mat = new THREE.MeshStandardMaterial({ color: 0x394046, roughness: 1 });
  const gX = new THREE.BoxGeometry(L, 0.05, w);
  const gZ = new THREE.BoxGeometry(w, 0.05, L);

  for (let x = -CITY.half; x <= CITY.half; x += CITY.grid) {
    const m = new THREE.Mesh(gX, mat); m.position.set(0, 0.02, x); m.receiveShadow = true; sidewalksGroup.add(m);
  }
  for (let z = -CITY.half; z <= CITY.half; z += CITY.grid) {
    const m = new THREE.Mesh(gZ, mat); m.position.set(z, 0.02, 0); m.receiveShadow = true; sidewalksGroup.add(m);
  }
}

function buildBuildings(count){
  const geo = new THREE.BoxGeometry(1,1,1);
  geo.translate(0,0.5,0);

  const winTex = makeWindowsTexture();
  winTex.colorSpace = THREE.SRGBColorSpace;

  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a1e24,
      roughness: 0.6,
      metalness: 0.2,
      map: winTex,
      emissive: new THREE.Color(0x0b0f16),
      emissiveMap: winTex,
      emissiveIntensity: 0.25
    });
    const b = new THREE.Mesh(geo, mat);

    b.position.x = snapToGrid(Math.random()*1600 - 800, CITY.grid);
    b.position.z = snapToGrid(Math.random()*1600 - 800, CITY.grid);
    const shift = (CITY.road/2) + THREE.MathUtils.randFloat(6, 18);
    b.position.x += (Math.random()<0.5?-1:1) * shift * 0.5;
    b.position.z += (Math.random()<0.5?-1:1) * shift * 0.5;

    const w = THREE.MathUtils.randFloat(10, 26);
    const d = THREE.MathUtils.randFloat(10, 26);
    const h = THREE.MathUtils.randFloat(30, 220);
    b.scale.set(w, h, d);
    b.updateMatrix();
    b.matrixAutoUpdate = false;

    const repX = Math.max(1, Math.round(w/6));
    const repY = Math.max(3, Math.round(h/12));
    b.material.map.repeat.set(repX, repY);
    b.material.emissiveMap.repeat.copy(b.material.map.repeat);

    b.castShadow = true; b.receiveShadow = true;
    buildingsGroup.add(b);
    buildings.push(b);
  }
}

// === NUEVO: embellece edificios ya creados (hijos y materiales realistas) ===
function enhanceBuildings(){
  const glassLike = (map)=> new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().setHSL(0.58, 0.25, 0.35),
    roughness: 0.15, metalness: 0.05, clearcoat: 0.3,
    reflectivity: 0.7, transmission: 0.02, thickness: 0.4,
    map, emissive: 0x0b0f16, emissiveMap: map, emissiveIntensity: 0.35
  });
  const concrete = (map)=> new THREE.MeshStandardMaterial({
    color: 0x1a1e24, roughness: 0.7, metalness: 0.2,
    map, emissive: 0x0b0f16, emissiveMap: map, emissiveIntensity: 0.25
  });
  const mixed = (map)=> new THREE.MeshStandardMaterial({
    color: 0x262b31, roughness: 0.5, metalness: 0.35,
    map, emissive: 0x0b0f16, emissiveMap: map, emissiveIntensity: 0.28
  });

  buildingsGroup.children.forEach((b)=>{
    if (!b.isMesh) return;
    const w = b.scale.x, h = b.scale.y, d = b.scale.z;

    const map = b.material.map;
    const r = Math.random();
    b.material = r<0.33 ? glassLike(map) : (r<0.66 ? concrete(map) : mixed(map));

    const podH = THREE.MathUtils.randFloat(3,8);
    const podH_rel = podH / h;
    const podium = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, podH_rel, 1.15),
      new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: 0.9, metalness: 0.1 })
    );
    podium.position.y = podH_rel/2;
    podium.castShadow = podium.receiveShadow = true;
    b.add(podium);

    const choice = Math.random();
    if (choice < 0.33){
      const h2_rel = 0.35, w2_rel = 0.7, d2_rel = 0.7;
      const add = new THREE.Mesh(new THREE.BoxGeometry(w2_rel, h2_rel, d2_rel), b.material.clone());
      add.position.y = 1 + h2_rel/2;
      b.add(add);
    } else if (choice < 0.66){
      const taper = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.5, 4, 1), b.material.clone());
      taper.rotation.y = Math.PI/4;
      taper.position.y = 1 + 0.25;
      b.add(taper);
    } else {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.45), b.material.clone());
      side.position.set(0.45, 0.3, 0);
      b.add(side);
    }

    if (Math.random() < 0.7){
      const hvac = new THREE.Mesh(
        new THREE.BoxGeometry(4/w, 2/h, 6/d),
        new THREE.MeshStandardMaterial({ color: 0x5d636a, roughness:0.9 })
      );
      hvac.position.set(THREE.MathUtils.randFloatSpread(0.4), 1 + (2/h)/2, THREE.MathUtils.randFloatSpread(0.4));
      b.add(hvac);
    }
    if (Math.random() < 0.35){
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2/Math.max(w,d), 0.2/Math.max(w,d), 8/h, 6),
        new THREE.MeshStandardMaterial({ color: 0x9aa1a8 })
      );
      mast.position.set(THREE.MathUtils.randFloatSpread(0.2), 1 + 8/h/2, THREE.MathUtils.randFloatSpread(0.2));
      b.add(mast);
    }
  });
}

function buildParks(){
  const parkMat = new THREE.MeshStandardMaterial({ color: 0x375f3a, roughness: 1, metalness: 0 });
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 1, metalness: 0 });

  for (let x = -CITY.half; x <= CITY.half; x += CITY.grid){
    for (let z = -CITY.half; z <= CITY.half; z += CITY.grid){
      const ix = Math.round((x + CITY.half) / CITY.grid);
      const iz = Math.round((z + CITY.half) / CITY.grid);
      if ((ix + iz) % 7 !== 0) continue;

      const size = CITY.grid - 18;
      const park = new THREE.Mesh(new THREE.BoxGeometry(size, 0.1, size), parkMat);
      park.position.set(x, 0.015, z);
      park.castShadow = false; park.receiveShadow = true;
      parksGroup.add(park);

      const path = new THREE.Mesh(new THREE.BoxGeometry(size*0.15, 0.12, size), pathMat);
      path.position.set(x, 0.02, z);
      parksGroup.add(path);

      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d3a1a });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });
      for (let i=0;i<THREE.MathUtils.randInt(3,8);i++){
        const tx = x + THREE.MathUtils.randFloatSpread(size*0.8);
        const tz = z + THREE.MathUtils.randFloatSpread(size*0.8);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.7,4,6), trunkMat);
        trunk.position.set(tx, 2.1, tz); trunk.castShadow=true; trunk.receiveShadow=true;
        const crown = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 10), leafMat);
        crown.position.set(0, 3.5, 0); crown.castShadow=true; crown.receiveShadow=true;
        trunk.add(crown);
        parksGroup.add(trunk);
      }
    }
  }
}

function buildLamps(){
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x55585c, metalness: 0.6, roughness: 0.5 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff1c1, toneMapped:false });

  for (let x = -CITY.half; x <= CITY.half; x += CITY.grid){
    for (let z = -CITY.half; z <= CITY.half; z += CITY.grid){
      const ix = Math.round((x + CITY.half) / CITY.grid);
      const iz = Math.round((z + CITY.half) / CITY.grid);
      if (ix % 3 !== 0 || iz % 3 !== 0) continue;

      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.7,12,8), poleMat);
      base.position.set(x+CITY.road*0.7, 6, z+CITY.road*0.7);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 10), bulbMat);
      bulb.position.set(0, 6.5, 0);
      base.add(bulb);

      const light = new THREE.PointLight(0xfff0c0, 0.0, 36, 2.0);
      light.position.set(0, 6.6, 0);
      base.add(light);

      lampsGroup.add(base);
      lamps.push({ bulb, light });
    }
  }
}

function buildTrafficLights(){
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1d1f22, metalness: 0.4, roughness: 0.8 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.6, roughness: 0.5 });
  const bulbR = new THREE.MeshBasicMaterial({ color: 0x990000, toneMapped:false });
  const bulbY = new THREE.MeshBasicMaterial({ color: 0xaa7c00, toneMapped:false });
  const bulbG = new THREE.MeshBasicMaterial({ color: 0x008f2a, toneMapped:false });

  signalMap.clear();

  for (let x = -CITY.half; x <= CITY.half; x += CITY.grid){
    for (let z = -CITY.half; z <= CITY.half; z += CITY.grid){
      const ix = Math.round((x + CITY.half) / CITY.grid);
      const iz = Math.round((z + CITY.half) / CITY.grid);
      if (ix % 4 !== 0 || iz % 4 !== 0) continue;

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.5,7,8), poleMat);
      pole.position.set(x - CITY.road*0.7, 3.5, z + CITY.road*0.7);

      const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.6, 1.0), bodyMat);
      head.position.set(0, 4.1, 0);
      pole.add(head);

      const r = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), bulbR);
      const y = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), bulbY);
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), bulbG);
      r.position.set(0, 1.1, 0.55); y.position.set(0, 0.0, 0.55); g.position.set(0,-1.1, 0.55);
      head.add(r,y,g);

      signalsGroup.add(pole);
      const phaseOffset = Math.random()*6.0;

      semaphores.push({
        meshes:{ r, y, g },
        phaseOffset,
        gridX: x,
        gridZ: z
      });

      signalMap.set(`${x},${z}`, { phaseOffset });
    }
  }
}

function buildBillboards(){
  for (let i=0;i<14;i++){
    const planeW = THREE.MathUtils.randFloat(14, 26);
    const planeH = THREE.MathUtils.randFloat(8, 14);

    const cv = document.createElement('canvas'); cv.width=256; cv.height=128;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped:false, side:THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), mat);
    mesh.position.set(
      snapToGrid(THREE.MathUtils.randFloatSpread(CITY.half*2), CITY.grid) + (Math.random()<0.5?-1:1)* (CITY.road*0.8),
      planeH*0.6 + 4,
      snapToGrid(THREE.MathUtils.randFloatSpread(CITY.half*2), CITY.grid)
    );
    mesh.lookAt(mesh.position.clone().add(new THREE.Vector3(0,0,1)));
    billboardsGroup.add(mesh);
    billboards.push({ mesh, ctx, tex, t: Math.random()*100 });
  }
}

// =================== AUTOS (tus originales) ===================
function spawnCars(n){
  const bodyGeo = new THREE.BoxGeometry(4, 1.2, 2);
  const headGeo = new THREE.BoxGeometry(0.6, 0.4, 0.6);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.2 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0, toneMapped:false });

  for (let i=0;i<n;i++){
    const axis = Math.random()<0.5 ? 'x' : 'z';
    const lane = snapToGrid(THREE.MathUtils.randFloatSpread(CITY.half*2), CITY.grid);
    const pos = new THREE.Vector3(axis==='x' ? -CITY.half : lane, 0.7, axis==='z' ? -CITY.half : lane);
    const dir = Math.random()<0.5 ? 1 : -1;
    const speed = THREE.MathUtils.randFloat(14, 28);

    const car = new THREE.Mesh(bodyGeo, bodyMat.clone());
    car.position.copy(pos);
    const h1 = new THREE.Mesh(headGeo, headMat), h2 = new THREE.Mesh(headGeo, headMat);
    h1.position.set( 1.8*dir, 0.4,  0.4);
    h2.position.set( 1.8*dir, 0.4, -0.4);
    car.add(h1,h2);
    car.userData = { axis, dir, speed };
    cars.push(car);
    carsGroup.add(car);
  }
}

function updateCars(dt){
  if (!cityMode) return;
  const limit = CITY.half;
  for (const c of cars){
    if (c.userData.axis === 'x'){
      c.position.x += c.userData.dir * c.userData.speed * dt;
      if (c.position.x >  limit) c.position.x = -limit;
      if (c.position.x < -limit) c.position.x =  limit;
      c.rotation.y = c.userData.dir > 0 ? Math.PI*1.5 : Math.PI*0.5;
    } else {
      c.position.z += c.userData.dir * c.userData.speed * dt;
      if (c.position.z >  limit) c.position.z = -limit;
      if (c.position.z < -limit) c.position.z =  limit;
      c.rotation.y = c.userData.dir > 0 ? 0 : Math.PI;
    }
  }
}

// =================== NUEVO: TRÁFICO con semáforos ===================
function spawnSmartVehicles(n){
  const types = [
    { w:4,  h:1.2, d:2,   speed:[16,30], color:0x222222, head:0xfff3b0 },
    { w:9,  h:2.4, d:2.6, speed:[12,18], color:0x114488, head:0xfff3b0 },
    { w:7,  h:2.2, d:2.4, speed:[10,16], color:0x333333, head:0xfff3b0 },
  ];
  for (let i=0;i<n;i++){
    const T = types[Math.floor(Math.random()*types.length)];
    const bodyGeo = new THREE.BoxGeometry(T.w, T.h, T.d);
    const headGeo = new THREE.BoxGeometry(0.6, 0.4, 0.6);
    const bodyMat = new THREE.MeshStandardMaterial({ color:T.color, roughness:0.6, metalness:0.2 });
    const headMat = new THREE.MeshBasicMaterial({ color:T.head, toneMapped:false });

    const mesh = new THREE.Mesh(bodyGeo, bodyMat);
    mesh.castShadow = false; mesh.receiveShadow = false;

    const axis = Math.random()<0.5 ? 'x' : 'z';
    const lane = snapToGrid(THREE.MathUtils.randFloatSpread(CITY.half*2), CITY.grid);
    const dir = Math.random()<0.5 ? 1 : -1;
    const pos = new THREE.Vector3(axis==='x' ? -CITY.half : lane, T.h*0.5 + 0.1, axis==='z' ? -CITY.half : lane);
    mesh.position.copy(pos);

    const h1 = new THREE.Mesh(headGeo, headMat), h2 = new THREE.Mesh(headGeo, headMat);
    h1.position.set((T.w/2 - 0.2)*dir, T.h*0.25,  0.5);
    h2.position.set((T.w/2 - 0.2)*dir, T.h*0.25, -0.5);
    mesh.add(h1,h2);

    const vMax = THREE.MathUtils.randFloat(T.speed[0], T.speed[1]);
    const veh = { mesh, axis, dir, v:vMax*0.6, vMax, a:24, lane, length:T.w };
    smartVehicles.push(veh);
    carsGroup.add(mesh);
  }
}

function isGreenFor(axis, ix, iz, t){
  const sig = signalMap.get(`${ix},${iz}`);
  if (!sig) return true; // sin semáforo -> libre
  const cycle = 8.0, amber = 1.0, green = 5.0;
  let tt = (t + sig.phaseOffset) % cycle;
  if (axis === 'x'){
    return tt < green || (tt >= green && tt < green+amber); // verde o ámbar para X
  } else {
    return tt >= green + amber; // verde para Z cuando X está rojo
  }
}

function updateSmartVehicles(dt, t){
  if (!cityMode || smartVehicles.length === 0) return;
  const limit = CITY.half;
  const stopDist = 10;
  const minGap = 6;
  const maxA = 24;
  const maxBrake = 36;

  const lanes = new Map();
  for (const v of smartVehicles){
    const key = `${v.axis}|${v.dir}|${v.lane}`;
    (lanes.get(key) || lanes.set(key, []).get(key)).push(v);
  }
  for (const arr of lanes.values()){
    arr.sort((a,b)=> (a.axis==='x'
      ? (a.dir>0 ? a.mesh.position.x - b.mesh.position.x : b.mesh.position.x - a.mesh.position.x)
      : (a.dir>0 ? a.mesh.position.z - b.mesh.position.z : b.mesh.position.z - a.mesh.position.z)
    ));
  }

  for (const v of smartVehicles){
    const p = v.axis==='x' ? v.mesh.position.x : v.mesh.position.z;
    const nextCross = v.dir>0 ? Math.ceil(p / CITY.grid)*CITY.grid
                              : Math.floor(p / CITY.grid)*CITY.grid;
    const ix = v.axis==='x' ? nextCross : v.lane;
    const iz = v.axis==='x' ? v.lane     : nextCross;
    const distToCross = Math.abs(nextCross - p);

    let wantStop = false;
    if (distToCross < stopDist && !isGreenFor(v.axis, ix, iz, t)) wantStop = true;

    const arr = lanes.get(`${v.axis}|${v.dir}|${v.lane}`) || [];
    const idx = arr.indexOf(v);
    if (idx > 0){
      const front = arr[idx-1];
      const myPos = v.axis==='x' ? v.mesh.position.x : v.mesh.position.z;
      const frPos = v.axis==='x' ? front.mesh.position.x : front.mesh.position.z;
      const gap = (v.dir>0 ? (frPos - myPos) : (myPos - frPos)) - front.length*0.5 - v.length*0.5;
      if (gap < minGap) wantStop = true;
    }

    const target = wantStop ? 0 : v.vMax;
    const a = (target > v.v ? maxA : -maxBrake);
    v.v = THREE.MathUtils.clamp(v.v + a*dt, 0, v.vMax);

    if (v.axis==='x'){
      v.mesh.position.x += v.dir * v.v * dt;
      if (v.mesh.position.x >  limit) v.mesh.position.x = -limit;
      if (v.mesh.position.x < -limit) v.mesh.position.x =  limit;
      v.mesh.rotation.y = v.dir > 0 ? Math.PI*1.5 : Math.PI*0.5;
    } else {
      v.mesh.position.z += v.dir * v.v * dt;
      if (v.mesh.position.z >  limit) v.mesh.position.z = -limit;
      if (v.mesh.position.z < -limit) v.mesh.position.z =  limit;
      v.mesh.rotation.y = v.dir > 0 ? 0 : Math.PI;
    }
  }
}

// =================== NUEVO: PEATONES ===================
function spawnPedestrians(n){
  // geom y mats compartidos
  const bodyGeo = new THREE.BoxGeometry(0.55, 1.1, 0.38);
  bodyGeo.translate(0, 0.55, 0);
  const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  headGeo.translate(0, 1.25, 0);

  const palette = [0xd35400,0x8e44ad,0x16a085,0xc0392b,0x2980b9,0x2ecc71,0xf39c12];
  const bodyMat = new THREE.MeshStandardMaterial({
    color: palette[Math.floor(Math.random()*palette.length)],
    roughness: 0.8, metalness: 0.0
  });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 1 });

  pedBodiesIM = new THREE.InstancedMesh(bodyGeo, bodyMat, n);
  pedHeadsIM  = new THREE.InstancedMesh(headGeo, headMat, n);
  pedBodiesIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pedHeadsIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pedestriansGroup.add(pedBodiesIM, pedHeadsIM);

  const y = 0.02; // base sobre banqueta
  const sideOffset = CITY.road*0.65; // desplazamiento desde el centro de la vía hacia banqueta

  for (let i=0;i<n;i++){
    const axis = Math.random()<0.5 ? 'x' : 'z';
    const lane = snapToGrid(THREE.MathUtils.randFloatSpread(CITY.half*2), CITY.grid);
    const dir = Math.random()<0.5 ? 1 : -1;
    const v = THREE.MathUtils.randFloat(PEDESTRIANS.speedMin, PEDESTRIANS.speedMax);
    const pos = new THREE.Vector3(
      axis==='x' ? (dir>0 ? -CITY.half :  CITY.half) : (lane + (Math.random()<0.5?-1:1)*sideOffset),
      y,
      axis==='z' ? (dir>0 ? -CITY.half :  CITY.half) : (lane + (Math.random()<0.5?-1:1)*sideOffset)
    );
    const rotY = axis==='x' ? (dir>0 ? Math.PI*1.5 : Math.PI*0.5) : (dir>0 ? 0 : Math.PI);
    peds.push({ axis, dir, lane, pos, v, len:0.6, rotY });
  }
}

function isPedGreenFor(axis, ix, iz, t){
  // peatón puede cruzar cuando el eje de vehículos NO está en verde/ámbar
  return !isGreenFor(axis, ix, iz, t);
}

function updatePedestrians(dt, t){
  if (!cityMode || peds.length===0 || !pedBodiesIM) return;

  const limit = CITY.half;
  const stopDist = 3.0;       // se detienen cerca de esquina si no les toca
  const turnChance = 0.25;    // probabilidad de girar en cruce
  const mat = new THREE.Matrix4();
  let idx = 0;

  // orden simple por carril para evitar empujones: no necesitamos arrays separados; solo checamos vecino cercano con una búsqueda local ligera
  // (para mantenerlo barato, omitimos búsqueda compleja).

  for (const p of peds){
    const pCoord = (p.axis==='x' ? p.pos.x : p.pos.z);
    const nextCross = p.dir>0 ? Math.ceil(pCoord / CITY.grid)*CITY.grid
                              : Math.floor(pCoord / CITY.grid)*CITY.grid;
    const ix = p.axis==='x' ? nextCross : p.lane;
    const iz = p.axis==='x' ? p.lane     : nextCross;
    const dist = Math.abs(nextCross - pCoord);

    // cruzar calle: si dist < stopDist y no está en verde peatonal, detener
    let blocked = false;
    if (dist < stopDist && !isPedGreenFor(p.axis, ix, iz, t)) blocked = true;

    // avance
    const step = (blocked ? 0 : p.v) * dt;
    if (p.axis==='x'){
      p.pos.x += p.dir * step;
      // wrap
      if (p.pos.x >  limit) p.pos.x = -limit;
      if (p.pos.x < -limit) p.pos.x =  limit;
    } else {
      p.pos.z += p.dir * step;
      if (p.pos.z >  limit) p.pos.z = -limit;
      if (p.pos.z < -limit) p.pos.z =  limit;
    }

    // giro aleatorio en cruces cuando sí puede cruzar
    if (dist < 0.6 && isPedGreenFor(p.axis, ix, iz, t) && Math.random() < turnChance){
      // girar 90° y cambiar axis
      if (p.axis==='x'){
        p.axis='z';
        p.dir = Math.random()<0.5 ? 1 : -1;
        p.rotY = (p.dir>0 ? 0 : Math.PI);
      } else {
        p.axis='x';
        p.dir = Math.random()<0.5 ? 1 : -1;
        p.rotY = (p.dir>0 ? Math.PI*1.5 : Math.PI*0.5);
      }
      // al girar, alinear a rejilla exacta
      if (p.axis==='x') p.pos.z = snapToGrid(p.pos.z, CITY.grid);
      else              p.pos.x = snapToGrid(p.pos.x, CITY.grid);
    }

    // escribir matrices de instancia
    mat.makeRotationY(p.rotY);
    mat.setPosition(p.pos.x, 0, p.pos.z);
    pedBodiesIM.setMatrixAt(idx, mat);
    pedHeadsIM.setMatrixAt(idx, mat);
    idx++;
  }

  pedBodiesIM.instanceMatrix.needsUpdate = true;
  pedHeadsIM.instanceMatrix.needsUpdate = true;
}

// =================== TOGGLES ===================
function toggleCity(force){
  cityMode = (force !== undefined) ? !!force : !cityMode;
  cityGroup.visible = cityMode;
  origGroup.visible = !cityMode;
  origLights.visible = !cityMode;

  if (cityMode){
    scene.background.set(nightMode ? 0x0e1116 : 0xcccccc);
    scene.fog.color.set(nightMode ? 0x0e1116 : 0xcccccc);
    camera.near = 1; camera.far = 2000; camera.updateProjectionMatrix();
    if (camera.position.length() < 200) camera.position.set(320, 260, 320);
  }
}

function toggleNight(force){
  nightMode = (force !== undefined) ? !!force : !nightMode;
  const bg = nightMode ? 0x0e1116 : 0xcccccc;
  scene.background.set(bg);
  scene.fog.color.set(bg);

  if (cityGroup){
    hemiLight.intensity = nightMode ? 0.25 : 0.9;
    dirLight.intensity  = nightMode ? 0.15 : 0.6;
    buildings.forEach(b=> b.material.emissiveIntensity = nightMode ? 1.4 : 0.25);
    // lámparas
    for (const l of lamps){
      l.light.intensity = nightMode ? 1.2 : 0.0;
      l.bulb.material.color.set(nightMode ? 0xfff1c1 : 0x333333);
    }
  }
}

function onKey(e){
  if (['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (e.code === 'KeyC') toggleCity();
  if (e.code === 'KeyN') toggleNight();
}

// =================== RENDER LOOP ===================
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

let last = performance.now();
function animate() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  updateCars(dt);
  updateSmartVehicles(dt, now/1000);
  updateSemaphores(now / 1000);
  updateBillboards(now / 1000);
  updateLampFlicker(now / 1000);
  updatePedestrians(dt, now/1000); // NUEVO

  controls.update();
  renderer.render(scene, camera);
}

// =================== ANIMADORES ===================
function updateSemaphores(t){
  if (!cityMode || semaphores.length === 0) return;
  const cycle = 8.0;
  const amber = 1.0;
  const green = 5.0;
  const red   = cycle - green - amber;

  for (const s of semaphores){
    let tt = (t + s.phaseOffset) % cycle;
    const onR = tt < red;
    const onY = tt >= red && tt < red + amber;
    const onG = tt >= red + amber;

    s.meshes.r.material.color.set(onR ? 0xff3b30 : 0x330000);
    s.meshes.y.material.color.set(onY ? 0xffcc00 : 0x331d00);
    s.meshes.g.material.color.set(onG ? 0x2bd36b : 0x003311);
  }
}

function updateBillboards(t){
  if (!cityMode || billboards.length === 0) return;
  for (const b of billboards){
    b.t += 0.5;
    const hue = (Math.sin((t*0.2)+b.t*0.01)*0.5+0.5)*360;
    const ctx = b.ctx; const w = ctx.canvas.width; const h = ctx.canvas.height;
    const grad = ctx.createLinearGradient(0,0,w,h);
    grad.addColorStop(0, `hsl(${hue},80%,60%)`);
    grad.addColorStop(1, `hsl(${(hue+120)%360},80%,50%)`);
    ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(0,h*0.55,w,h*0.45);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px system-ui';
    ctx.fillText('Luz City', 12, h-16);
    b.tex.needsUpdate = true;
  }
}

function updateLampFlicker(t){
  if (!cityMode || !nightMode || lamps.length === 0) return;
  for (const l of lamps){
    const n = (Math.sin(t*5.0 + l.light.id) + 1) * 0.5;
    l.light.intensity = 1.0 + n*0.25;
  }
}

// =================== HELPERS ===================
function makeWindowsTexture({ w=64, h=128, off='#0c0f14', on='#cbe3ff', density=0.55 } = {}){
  const cv = document.createElement('canvas'); cv.width=w; cv.height=h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = off; ctx.fillRect(0,0,w,h);
  const cols=6, rows=16, padX=4, padY=4;
  const cellW=(w-padX*2)/cols, cellH=(h-padY*2)/rows;
  for (let r=0;r<rows;r++){
    for (let c=0;c<cols;c++){
      const x=padX+c*cellW+2, y=padY+r*cellH+2;
      ctx.fillStyle = Math.random()<density ? on : off;
      ctx.fillRect(x,y,cellW-4,cellH-4);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function snapToGrid(v, step){ return Math.round(v/step)*step; }
function keyFor(ix,iz){ return `${ix},${iz}`; }

