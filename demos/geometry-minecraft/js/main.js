import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

let container, stats;
let camera, controls, scene, renderer;

const worldWidth = 128, worldDepth = 128;
const worldHalfWidth = worldWidth / 2;
const worldHalfDepth = worldDepth / 2;
const data = generateHeight(worldWidth, worldDepth);

const clock = new THREE.Clock();

init();

function init() {
  container = document.getElementById('container');

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 20000);
  camera.position.y = getY(worldHalfWidth, worldHalfDepth) * 100 + 100;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfd1e5);

  // ----- Cubos tipo “voxel” (caras) -----
  const matrix = new THREE.Matrix4();

  const pxGeometry = new THREE.PlaneGeometry(100, 100);
  pxGeometry.attributes.uv.array[1] = 0.5;
  pxGeometry.attributes.uv.array[3] = 0.5;
  pxGeometry.rotateY(Math.PI / 2);
  pxGeometry.translate(50, 0, 0);

  const nxGeometry = new THREE.PlaneGeometry(100, 100);
  nxGeometry.attributes.uv.array[1] = 0.5;
  nxGeometry.attributes.uv.array[3] = 0.5;
  nxGeometry.rotateY(-Math.PI / 2);
  nxGeometry.translate(-50, 0, 0);

  const pyGeometry = new THREE.PlaneGeometry(100, 100);
  pyGeometry.attributes.uv.array[5] = 0.5;
  pyGeometry.attributes.uv.array[7] = 0.5;
  pyGeometry.rotateX(-Math.PI / 2);
  pyGeometry.translate(0, 50, 0);

  const pzGeometry = new THREE.PlaneGeometry(100, 100);
  pzGeometry.attributes.uv.array[1] = 0.5;
  pzGeometry.attributes.uv.array[3] = 0.5;
  pzGeometry.translate(0, 0, 50);

  const nzGeometry = new THREE.PlaneGeometry(100, 100);
  nzGeometry.attributes.uv.array[1] = 0.5;
  nzGeometry.attributes.uv.array[3] = 0.5;
  nzGeometry.rotateY(Math.PI);
  nzGeometry.translate(0, 0, -50);

  const geometries = [];

  for (let z = 0; z < worldDepth; z++) {
    for (let x = 0; x < worldWidth; x++) {
      const h = getY(x, z);

      matrix.makeTranslation(
        x * 100 - worldHalfWidth * 100,
        h * 100,
        z * 100 - worldHalfDepth * 100
      );

      const px = getY(x + 1, z);
      const nx = getY(x - 1, z);
      const pz = getY(x, z + 1);
      const nz = getY(x, z - 1);

      geometries.push(pyGeometry.clone().applyMatrix4(matrix));

      if ((px !== h && px !== h + 1) || x === 0) {
        geometries.push(pxGeometry.clone().applyMatrix4(matrix));
      }
      if ((nx !== h && nx !== h + 1) || x === worldWidth - 1) {
        geometries.push(nxGeometry.clone().applyMatrix4(matrix));
      }
      if ((pz !== h && pz !== h + 1) || z === worldDepth - 1) {
        geometries.push(pzGeometry.clone().applyMatrix4(matrix));
      }
      if ((nz !== h && nz !== h + 1) || z === 0) {
        geometries.push(nzGeometry.clone().applyMatrix4(matrix));
      }
    }
  }

  const geometry = BufferGeometryUtils.mergeGeometries(geometries);
  geometry.computeBoundingSphere();

  const texture = new THREE.TextureLoader().load('textures/minecraft/atlas.png');
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide })
  );
  scene.add(mesh);

  // ----- Luces -----
  const ambientLight = new THREE.AmbientLight(0xeeeeee, 3);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 12);
  directionalLight.position.set(1, 1, 0.5).normalize();
  scene.add(directionalLight);

  // ----- Renderer -----
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  container.appendChild(renderer.domElement);

  // ----- Controles -----
  controls = new FirstPersonControls(camera, renderer.domElement);
  controls.movementSpeed = 1000;
  controls.lookSpeed = 0.125;
  controls.lookVertical = true;

  // ====== AÑADIDO: entorno “valle con lago” al presionar C ======
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyC') toggleNatureScene();
  });

  // ----- Stats -----
  stats = new Stats();
  container.appendChild(stats.dom);

  // ----- Resize -----
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  controls.handleResize();
}

function generateHeight(width, height) {
  const data = [];
  const perlin = new ImprovedNoise();
  const size = width * height;
  const z = Math.random() * 100;

  let quality = 2;

  for (let j = 0; j < 4; j++) {
    if (j === 0) for (let i = 0; i < size; i++) data[i] = 0;

    for (let i = 0; i < size; i++) {
      const x = i % width, y = (i / width) | 0;
      data[i] += perlin.noise(x / quality, y / quality, z) * quality;
    }

    quality *= 4;
  }

  return data;
}

function getY(x, z) {
  return (data[x + z * worldWidth] * 0.15) | 0;
}

function animate() {
  // animaciones del entorno nuevo (olas, nubes, cascada, muñequitos)
  if (natureOn) animateNature();
  render();
  stats.update();
}

function render() {
  controls.update(clock.getDelta());
  renderer.render(scene, camera);
}

/* ============= AÑADIDOS: entorno “valle con lago y árboles” (tecla C) ============= */
let natureGroup = null;
let natureBuilt = false;
let natureOn = false;

let waterMesh, waterGeo, waterBaseY = 220;        // nivel del agua
let cloudGroup, sunBillboard, waterfallMesh, waterfallMat;
let waterTime = 0;

// >>> AÑADIDO: muñequitos
let walkers = []; // {group, parts, yaw, speed, step}
let sitters  = []; // {group, parts, breatheT}
const NPC_COUNT_WALK = 10;
const NPC_COUNT_SIT  = 5;

function toggleNatureScene(){
  if (!natureBuilt) { buildNatureScene(); natureBuilt = true; }
  natureOn = !natureOn;
  if (natureGroup) natureGroup.visible = natureOn;

  // ajuste suave de cielo (adición)
  scene.background = new THREE.Color(natureOn ? 0xbfe3ff : 0xbfd1e5);
}

function buildNatureScene(){
  natureGroup = new THREE.Group();
  natureGroup.visible = false;
  scene.add(natureGroup);

  // --- Sol (billboard sencillo) ---
  sunBillboard = makeSunBillboard(220);
  sunBillboard.position.set(0, 1200, -1500);
  natureGroup.add(sunBillboard);

  // --- Agua (superficie con pequeñas olas) ---
  waterGeo = new THREE.PlaneGeometry(8000, 8000, 96, 96);
  waterGeo.rotateX(-Math.PI/2);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x2c74ff,
    roughness: 0.25,
    metalness: 0.0,
    transmission: 0.75,
    thickness: 0.5,
    transparent: true
  });
  waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = waterBaseY;
  natureGroup.add(waterMesh);

  // --- Cascada (textura que desliza vertical) ---
  waterfallMat = new THREE.MeshBasicMaterial({
    map: makeWaterfallTexture(),
    transparent: true,
    opacity: 0.9
  });
  if (waterfallMat.map){
    waterfallMat.map.wrapT = THREE.RepeatWrapping;
    waterfallMat.map.wrapS = THREE.RepeatWrapping;
    waterfallMat.map.repeat.set(1, 4);
  }
  waterfallMesh = new THREE.Mesh(new THREE.PlaneGeometry(260, 420), waterfallMat);
  waterfallMesh.position.set(600, waterBaseY + 210, -400);
  waterfallMesh.rotation.y = Math.PI/6;
  natureGroup.add(waterfallMesh);

  // espuma base de la cascada (partículas)
  const splash = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Array(3*400).fill(0).map((_,i)=>{
        if(i%3===0) return 600 + (Math.random()-0.5)*240;
        if(i%3===1) return waterBaseY + (Math.random()*8);
        return -400 + (Math.random()-0.5)*120;
      }), 3)
    ),
    new THREE.PointsMaterial({ color:0xffffff, size:4, opacity:0.8, transparent:true })
  );
  natureGroup.add(splash);

  // --- Árboles voxel ---
  addVoxelTrees(64);

  // --- Nubes ---
  cloudGroup = new THREE.Group();
  const cloudTex = makeCloudTexture();
  for (let i=0;i<22;i++){
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 220),
      new THREE.MeshBasicMaterial({ map: cloudTex, transparent:true, opacity:0.85, depthWrite:false })
    );
    p.position.set((Math.random()-0.5)*6000, 1100 + Math.random()*200, (Math.random()-0.5)*6000);
    p.rotation.y = Math.random()*Math.PI*2;
    cloudGroup.add(p);
  }
  natureGroup.add(cloudGroup);

  // --- Muñequitos: caminar + sentados ---
  spawnWalkers(NPC_COUNT_WALK);
  spawnSitters(NPC_COUNT_SIT);
}

/* --------- utilidades de construcción --------- */
function gridToWorld(x,z){
  return new THREE.Vector3(
    x*100 - worldHalfWidth*100,
    getY(x,z)*100 + 50,
    z*100 - worldHalfDepth*100
  );
}
// >>> AÑADIDO: altura del terreno en coords mundo
function heightAtWorld(x,z){
  const gx = Math.max(0, Math.min(worldWidth-1, Math.round((x + worldHalfWidth*100)/100)));
  const gz = Math.max(0, Math.min(worldDepth-1, Math.round((z + worldHalfDepth*100)/100)));
  return getY(gx, gz)*100 + 50;
}

function addVoxelTrees(count){
  const trunkGeo = new THREE.BoxGeometry(40, 160, 40);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1d });

  const leavesGeo1 = new THREE.BoxGeometry(200, 140, 200);
  const leavesGeo2 = new THREE.BoxGeometry(140, 120, 140);
  const leavesMat = new THREE.MeshLambertMaterial({ color: 0x4aa637 });

  const trunkIM = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const leavesIM1 = new THREE.InstancedMesh(leavesGeo1, leavesMat, count);
  const leavesIM2 = new THREE.InstancedMesh(leavesGeo2, leavesMat, count);

  const m = new THREE.Matrix4();
  let i = 0, guard = 0;
  while (i < count && guard < count*10){
    guard++;
    const gx = Math.floor(Math.random()*worldWidth);
    const gz = Math.floor(Math.random()*worldDepth);
    const pos = gridToWorld(gx,gz);
    if (pos.y < waterBaseY + 10) continue;

    m.compose(new THREE.Vector3(pos.x, pos.y + 80, pos.z), new THREE.Quaternion(), new THREE.Vector3(1,1,1));
    trunkIM.setMatrixAt(i, m);

    m.compose(new THREE.Vector3(pos.x, pos.y + 200, pos.z), new THREE.Quaternion(), new THREE.Vector3(1,1,1));
    leavesIM1.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(pos.x, pos.y + 280, pos.z), new THREE.Quaternion(), new THREE.Vector3(1,1,1));
    leavesIM2.setMatrixAt(i, m);

    i++;
  }
  trunkIM.instanceMatrix.needsUpdate = true;
  leavesIM1.instanceMatrix.needsUpdate = true;
  leavesIM2.instanceMatrix.needsUpdate = true;

  natureGroup.add(trunkIM, leavesIM1, leavesIM2);
}

function makeSunBillboard(size=200){
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128,128,40,128,128,128);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,256,256);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent:true, depthWrite:false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(size,size,1);
  return sp;
}

function makeCloudTexture(){
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,256,128);
  for (let i=0;i<40;i++){
    const x = Math.random()*256, y = Math.random()*128, r = 20 + Math.random()*40;
    const g = ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

function makeWaterfallTexture(){
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0,0,0,256);
  g.addColorStop(0,'rgba(70,130,255,0.9)');
  g.addColorStop(1,'rgba(70,130,255,0.2)');
  ctx.fillStyle = g; ctx.fillRect(0,0,64,256);
  ctx.globalAlpha = 0.6;
  for (let i=0;i<12;i++){
    const x = Math.random()*64;
    ctx.fillStyle = 'rgba(190,220,255,0.9)';
    ctx.fillRect(x,0,1.2,256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ================== MUÑEQUITOS ================== */
// modelo simple estilo voxel
function makeMiniDude(scale=1) {
  const group = new THREE.Group();

  const skin = new THREE.MeshLambertMaterial({ color: 0xffe0bd });
  const shirt = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.6, 0.5) });
  const pants = new THREE.MeshLambertMaterial({ color: 0x3b4a6b });

  // cuerpo
  const body = new THREE.Mesh(new THREE.BoxGeometry(12,18,6), shirt);
  body.position.y = 18;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(10,10,10), skin);
  head.position.y = 18 + 10 + 2;
  group.add(head);

  // brazos (pivot en hombro)
  const armGeo = new THREE.BoxGeometry(4,14,4);
  const armL = new THREE.Mesh(armGeo, shirt);
  const armR = new THREE.Mesh(armGeo, shirt);
  const armLG = new THREE.Group(), armRG = new THREE.Group();
  armLG.add(armL); armRG.add(armR);
  armL.position.y = -7; armR.position.y = -7; // pivot arriba
  armLG.position.set(-8, 18, 0);
  armRG.position.set( 8, 18, 0);
  group.add(armLG, armRG);

  // piernas (pivot en cadera)
  const legGeo = new THREE.BoxGeometry(4,14,4);
  const legL = new THREE.Mesh(legGeo, pants);
  const legR = new THREE.Mesh(legGeo, pants);
  const legLG = new THREE.Group(), legRG = new THREE.Group();
  legL.position.y = -7; legR.position.y = -7;
  legLG.add(legL); legRG.add(legR);
  legLG.position.set(-4, 18-9, 0);
  legRG.position.set( 4, 18-9, 0);
  group.add(legLG, legRG);

  group.scale.setScalar(scale);

  return {
    group,
    parts: { body, head, armLG, armRG, legLG, legRG }
  };
}

function spawnWalkers(n=8){
  for (let i=0;i<n;i++){
    const {group, parts} = makeMiniDude(2.2);
    // ubicar en tierra lejos del agua
    let tries=0;
    while(tries++<200){
      const x = (Math.random()-0.5)*worldWidth*100*0.8;
      const z = (Math.random()-0.5)*worldDepth*100*0.8;
      const y = heightAtWorld(x,z);
      if (y > waterBaseY + 15){
        group.position.set(x, y, z);
        break;
      }
    }
    group.rotation.y = Math.random()*Math.PI*2;
    natureGroup.add(group);
    walkers.push({
      group,
      parts,
      yaw: group.rotation.y,
      speed: 40 + Math.random()*25,
      step: Math.random()*Math.PI*2
    });
  }
}

function spawnSitters(n=5){
  for (let i=0;i<n;i++){
    const {group, parts} = makeMiniDude(2.2);
    // sentados: piernas dobladas, brazos relajados
    parts.legLG.rotation.x = -Math.PI/2;
    parts.legRG.rotation.x = -Math.PI/2;
    parts.armLG.rotation.x = -0.3;
    parts.armRG.rotation.x = -0.2;

    // elegir lugar (cerca de árboles y no tan empinado)
    let tries=0;
    while(tries++<200){
      const x = (Math.random()-0.5)*worldWidth*100*0.85;
      const z = (Math.random()-0.5)*worldDepth*100*0.85;
      const y = heightAtWorld(x,z);
      if (y > waterBaseY + 10){
        group.position.set(x, y, z);
        break;
      }
    }
    group.rotation.y = Math.random()*Math.PI*2;
    natureGroup.add(group);
    sitters.push({ group, parts, breatheT: Math.random()*Math.PI*2 });
  }
}

/* --------- animaciones del entorno --------- */
function animateNature(){
  const dt = clock.getDelta();
  waterTime += dt;

  // olas
  if (waterGeo){
    const pos = waterGeo.attributes.position;
    for (let i=0;i<pos.count;i++){
      const x = pos.getX(i) * 0.0025;
      const z = pos.getZ(i) * 0.0025;
      const y = Math.sin(waterTime*1.2 + x*4.0 + z*3.0) * 2.2;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    waterGeo.computeVertexNormals();
  }

  // cascada
  if (waterfallMat && waterfallMat.map){
    waterfallMat.map.offset.y = (waterTime*0.6) % 1;
    waterfallMat.needsUpdate = true;
  }

  // nubes
  if (cloudGroup){
    cloudGroup.children.forEach((m)=>{
      m.position.x += 10*dt;
      m.rotation.y += 0.02*dt;
      if (m.position.x > 3200) m.position.x = -3200;
    });
  }

  // ====== animación de muñequitos ======
  animateWalkers(dt);
  animateSitters(dt);
}

function animateWalkers(dt){
  const tryStep = (g, dir, dist)=>{
    const nx = g.position.x + Math.cos(dir)*dist;
    const nz = g.position.z + Math.sin(dir)*dist;
    const ny = heightAtWorld(nx,nz);
    const slope = Math.abs(ny - g.position.y);
    if (ny < waterBaseY + 12 || slope > 28) return false; // evita agua/cuestas
    g.position.set(nx, ny, nz);
    g.rotation.y = dir;
    return true;
  };

  for (const w of walkers){
    // deambular
    w.yaw += (Math.random()-0.5)*0.2*dt;
    if (!tryStep(w.group, w.yaw, w.speed*dt)){
      w.yaw += Math.PI*0.5*(Math.random()<0.5?1:-1);
    }
    // caminar: balanceo brazos/piernas
    w.step += dt*6.0;
    const a = Math.sin(w.step)*0.7, b = Math.cos(w.step)*0.7;
    w.parts.legLG.rotation.x =  a;
    w.parts.legRG.rotation.x = -a;
    w.parts.armLG.rotation.x = -b*0.6;
    w.parts.armRG.rotation.x =  b*0.6;
  }
}

function animateSitters(dt){
  for (const s of sitters){
    s.breatheT += dt*2.0;
    const breathe = Math.sin(s.breatheT)*0.02;
    s.parts.body.position.y = 18 + breathe*6;      // pequeño respiro
    s.parts.head.position.y = 18 + 10 + 2 + breathe*6;
    // mirar alrededor lentamente
    s.group.rotation.y += (Math.random()-0.5)*0.05*dt;
  }
}
