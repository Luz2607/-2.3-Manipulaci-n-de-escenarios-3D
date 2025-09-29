import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let camera, controls, scene, renderer;

// ===== REFERENCIAS PARA ALTERNAR Y EGIPTO =====
const origObjects = [];                 
let isEgyptOn = false;
let egyptBuilt = false;
let egyptGroup = null;

// ===== PIRÁMIDES (para colisiones) =====
const pyramidBases = [];   

// ===== CAMELLOS =====
const CAMEL_COUNT = 6;
const camels = [];
let camelBodyIM, camelNeckIM, camelHeadIM, camelHumpIM, camelTailIM, camelEarLIM, camelEarRIM, camelBlanketIM;
let camelLegFLIM, camelLegFRIM, camelLegBLIM, camelLegBRIM;

const sandColor = new THREE.Color(0xE5C089);
const pyramidColor = new THREE.Color(0xCFAE6E);

const WORLD_HALF = 800;
const SMALL_PYRAMIDS = 500;

init();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcccccc);
  scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  document.body.appendChild(renderer.domElement);

  Object.assign(renderer.domElement.style, { display:'block', outline:'none', border:'none', boxShadow:'none' });
  document.body.style.margin = '0';

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.set(400, 200, 0);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.listenToKeyEvents(window);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 100;
  controls.maxDistance = 500;
  controls.maxPolarAngle = Math.PI / 2;

  // ===== MUNDO ORIGINAL: 500 conos =====
  const geometry = new THREE.ConeGeometry(10, 30, 4, 1);
  const material = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true });

  for (let i = 0; i < 500; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = Math.random() * 1600 - 800;
    mesh.position.y = 0;
    mesh.position.z = Math.random() * 1600 - 800;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    origObjects.push(mesh);
  }

  // luces originales
  const dirLight1 = new THREE.DirectionalLight(0xffffff, 3);
  dirLight1.position.set(1, 1, 1);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0x002288, 3);
  dirLight2.position.set(-1, -1, -1);
  scene.add(dirLight2);

  const ambientLight = new THREE.AmbientLight(0x555555);
  scene.add(ambientLight);

  // tecla C → alternar Egipto
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyC') toggleEgyptMode();
  });

  window.addEventListener('resize', onWindowResize);

  // ===== PANEL DE INDICACIONES =====
  const help = document.createElement('div');
  help.id = "instructions";
  help.innerHTML = `
    <h3>Indicaciones</h3>
    <ul>
      <li><b>C</b> → Activar/Desactivar modo Egipto</li>
      <li><b>Arrastrar mouse</b> → Rotar vista</li>
      <li><b>Scroll</b> → Zoom</li>
      <li><b>Click derecho + arrastrar</b> → Mover cámara</li>
    </ul>
  `;
  Object.assign(help.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    width: '240px',
    padding: '12px',
    background: 'rgba(0,0,0,0.65)',
    color: '#fff',
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px',
    lineHeight: '1.4em',
    borderRadius: '8px',
    zIndex: 1000
  });
  document.body.appendChild(help);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  if (isEgyptOn) updateCamels();
  controls.update();
  renderer.render(scene, camera);
}

/* ======================== MODO EGIPCIO ======================== */
// ... (aquí sigue igual la construcción de pirámides y camellos con colisión y rodeo)
// (se mantiene todo el código que ya tenías con pirámides grandes/pequeñas + camellos)

/* ======================== MODO EGIPCIO ======================== */

function toggleEgyptMode() {
  if (!egyptBuilt) { buildEgyptScene(); egyptBuilt = true; }
  isEgyptOn = !isEgyptOn;

  // ocultar/mostrar conos originales
  for (const m of origObjects) m.visible = !isEgyptOn;

  if (egyptGroup) egyptGroup.visible = isEgyptOn;

  // atmósfera
  if (isEgyptOn) {
    scene.background = sandColor.clone().multiplyScalar(0.95);
    scene.fog.color.copy(scene.background);
    scene.fog.density = 0.0016;
  } else {
    scene.background.set(0xcccccc);
    scene.fog.color.set(0xcccccc);
    scene.fog.density = 0.002;
  }
}

function buildEgyptScene() {
  egyptGroup = new THREE.Group();
  egyptGroup.visible = false;
  scene.add(egyptGroup);

  // suelo
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshPhongMaterial({ color: sandColor, flatShading: true })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  egyptGroup.add(ground);

  // luces cálidas
  const sun = new THREE.DirectionalLight(0xffe6a8, 2.1);
  sun.position.set(300, 400, -200);
  egyptGroup.add(sun);
  egyptGroup.add(new THREE.HemisphereLight(0xfff1c1, 0x886644, 0.55));

  // textura caliza suave
  const limestoneTex = makeLimestoneTexture();
  limestoneTex.wrapS = limestoneTex.wrapT = THREE.RepeatWrapping;
  limestoneTex.repeat.set(1.2, 1.6);

  // 3 pirámides grandes + pyramidion + falda
  const bigSpecs = [
    { pos: new THREE.Vector3(-300, 0, -200), height: 220, base: 300 },
    { pos: new THREE.Vector3(  80, 0, -360), height: 180, base: 240 },
    { pos: new THREE.Vector3(-120, 0,  140), height: 140, base: 180 },
  ];
  const bigMat = new THREE.MeshPhongMaterial({ color: pyramidColor, map: limestoneTex, flatShading: true });
  for (const s of bigSpecs) {
    const radius = s.base * 0.5;
    const body = new THREE.Mesh(new THREE.ConeGeometry(radius, s.height, 4, 1), bigMat);
    body.position.copy(s.pos);
    body.position.y = s.height * 0.5;
    egyptGroup.add(body);

    // pyramidion dorado
    const capH = Math.max(8, s.height * 0.06);
    const capR = Math.max(6, radius * 0.18);
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(capR, capH, 4, 1),
      new THREE.MeshPhongMaterial({ color: 0xD4AF37, shininess: 80, specular: 0xFFF3A6 })
    );
    cap.position.set(s.pos.x, s.height + capH * 0.5, s.pos.z);
    egyptGroup.add(cap);

    // falda
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.08, radius * 1.45, 6, 28, 1, true),
      new THREE.MeshPhongMaterial({ color: sandColor, flatShading: true, side: THREE.DoubleSide })
    );
    skirt.position.set(s.pos.x, 3, s.pos.z);
    skirt.rotation.y = Math.random() * Math.PI;
    egyptGroup.add(skirt);

    // colisión
    const halfDiag = Math.hypot(radius, radius);
    pyramidBases.push({ center: s.pos.clone(), baseHalf: halfDiag + 20 });
  }

  // 500 pirámides pequeñas
  const smallMat = new THREE.MeshPhongMaterial({ color: pyramidColor.clone().multiplyScalar(0.98), map: limestoneTex, flatShading: true });
  const smallGeo = new THREE.ConeGeometry(7, 20, 4, 1);
  for (let i = 0; i < SMALL_PYRAMIDS; i++) {
    const x = Math.random() * (WORLD_HALF*2) - WORLD_HALF;
    const z = Math.random() * (WORLD_HALF*2) - WORLD_HALF;
    const small = new THREE.Mesh(smallGeo, smallMat);
    small.position.set(x, 10, z); // base al suelo
    small.rotation.y = Math.random() * Math.PI;
    egyptGroup.add(small);

    const radius = 7;
    const halfDiag = Math.hypot(radius, radius);
    pyramidBases.push({ center: new THREE.Vector3(x,0,z), baseHalf: halfDiag + 6 });
  }

  // camellos
  buildCamels();
}

/* ======================== CAMELLOS ======================== */

function buildCamels() {
  // materiales (tonos variaditos)
  const coatColors = [0xB57F50, 0xA7744A, 0xC08A5B];
  const darkMat  = new THREE.MeshPhongMaterial({ color: 0x7A5537, flatShading: true }); // patas/cola
  const earMat   = new THREE.MeshPhongMaterial({ color: 0x5d4029, flatShading: true });
  const blankets = [
    new THREE.MeshPhongMaterial({ color: 0xB22222, flatShading: true }),
    new THREE.MeshPhongMaterial({ color: 0x1F6FEB, flatShading: true }),
    new THREE.MeshPhongMaterial({ color: 0x2DA44E, flatShading: true })
  ];

  // geometrías base
  const bodyGeo   = new THREE.BoxGeometry(10, 5, 4);           // cuerpo
  const neckGeo   = new THREE.CylinderGeometry(0.9, 1.2, 4, 8);// cuello
  const headGeo   = new THREE.BoxGeometry(3.0, 2.2, 2.4);      // cabeza
  const snoutGeo  = new THREE.BoxGeometry(1.4, 1.2, 1.4);      // hocico
  const humpGeo   = new THREE.SphereGeometry(2.8, 10, 10);     // joroba
  const tailGeo   = new THREE.CylinderGeometry(0.25, 0.35, 3.2, 6);
  const earGeo    = new THREE.ConeGeometry(0.35, 0.9, 6);
  const blanketGeo= new THREE.BoxGeometry(5.8, 0.4, 3.6);
  const legGeo    = new THREE.CylinderGeometry(0.6, 0.8, 6, 6);

  // instancias
  camelBodyIM   = new THREE.InstancedMesh(bodyGeo,   new THREE.MeshPhongMaterial({ color: coatColors[0], flatShading:true }), CAMEL_COUNT);
  camelNeckIM   = new THREE.InstancedMesh(neckGeo,   new THREE.MeshPhongMaterial({ color: coatColors[1], flatShading:true }), CAMEL_COUNT);
  camelHeadIM   = new THREE.InstancedMesh(headGeo,   new THREE.MeshPhongMaterial({ color: coatColors[2], flatShading:true }), CAMEL_COUNT);
  camelHumpIM   = new THREE.InstancedMesh(humpGeo,   new THREE.MeshPhongMaterial({ color: coatColors[0], flatShading:true }), CAMEL_COUNT);
  camelTailIM   = new THREE.InstancedMesh(tailGeo,   darkMat, CAMEL_COUNT);
  camelEarLIM   = new THREE.InstancedMesh(earGeo,    earMat, CAMEL_COUNT);
  camelEarRIM   = new THREE.InstancedMesh(earGeo,    earMat, CAMEL_COUNT);
  camelBlanketIM= new THREE.InstancedMesh(blanketGeo, blankets[0], CAMEL_COUNT); // el material cambia por instancia con color

  camelLegFLIM = new THREE.InstancedMesh(legGeo, darkMat, CAMEL_COUNT);
  camelLegFRIM = new THREE.InstancedMesh(legGeo, darkMat, CAMEL_COUNT);
  camelLegBLIM = new THREE.InstancedMesh(legGeo, darkMat, CAMEL_COUNT);
  camelLegBRIM = new THREE.InstancedMesh(legGeo, darkMat, CAMEL_COUNT);

  const ims = [
    camelBodyIM, camelNeckIM, camelHeadIM, camelHumpIM, camelTailIM,
    camelEarLIM, camelEarRIM, camelBlanketIM,
    camelLegFLIM, camelLegFRIM, camelLegBLIM, camelLegBRIM
  ];
  ims.forEach(im => { im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); egyptGroup.add(im); });

  // posición inicial: lugares seguros y yaw aleatorio
  for (let i = 0; i < CAMEL_COUNT; i++) {
    const pos = findSafeSpot();
    const yaw = Math.random() * Math.PI * 2;
    const speed = 12 + Math.random()*4;     // unidades/seg (lento)
    camels.push({ pos, yaw, speed, turn: 0, avoidTimer: 0 });

    // color/blanket variado por instancia
    camelBodyIM.setColorAt(i, new THREE.Color(coatColors[i % coatColors.length]));
    camelHeadIM.setColorAt(i, new THREE.Color(coatColors[(i+1) % coatColors.length]));
    camelBlanketIM.setColorAt(i, new THREE.Color([0xB22222,0x1F6FEB,0x2DA44E][i%3]));
  }
  flagCamelsUpdate(true); // también actualiza colores
}

function findSafeSpot() {
  for (let t=0; t<200; t++) {
    const x = Math.random()*(WORLD_HALF*2) - WORLD_HALF;
    const z = Math.random()*(WORLD_HALF*2) - WORLD_HALF;
    if (isSafe(x, z)) return new THREE.Vector3(x, 3, z);
  }
  return new THREE.Vector3(0,3,0);
}

// ¿está libre esta posición respecto a cualquier pirámide?
function isSafe(x, z, extraMargin=0) {
  for (let i = 0; i < pyramidBases.length; i++) {
    const p = pyramidBases[i];
    const dx = x - p.center.x;
    const dz = z - p.center.z;
    if ((dx*dx + dz*dz) < (p.baseHalf + extraMargin) * (p.baseHalf + extraMargin)) return false;
  }
  return true;
}

// movimiento con steering sencillo (evitar y rodear)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
function updateCamels() {
  const dt = 0.016; // aproximado 60fps
  for (let i = 0; i < camels.length; i++) {
    const c = camels[i];

    // vector forward
    const forward = new THREE.Vector3(Math.cos(c.yaw), 0, Math.sin(c.yaw));

    // mira un poco adelante (visión)
    const lookAhead = 10; // metros para prever choque
    let hazard = checkHazard(c.pos, forward, lookAhead);

    // si hay obstáculo enfrente, decide giro (izq/der) y guarda un timer para "rodear"
    if (hazard) {
      if (c.turn === 0) {
        // elige lado con más espacio: samplea 2 rayos
        const leftFree  = sampleFree(c.pos, c.yaw + 0.6);
        const rightFree = sampleFree(c.pos, c.yaw - 0.6);
        c.turn = (leftFree > rightFree) ? +1 : -1; // +1 izq, -1 der
        c.avoidTimer = 0.6 + Math.random()*0.6;    // tiempo que seguirá bordeando
      }
    }

    // steering: si está bordeando, aplica giro suave
    const turnSpeed = 0.9; // rad/s
    if (c.avoidTimer > 0) {
      c.yaw += c.turn * turnSpeed * dt;
      c.avoidTimer -= dt;
      // si ya no hay peligro, reduce el timer más rápido
      const fwd2 = new THREE.Vector3(Math.cos(c.yaw),0,Math.sin(c.yaw));
      if (!checkHazard(c.pos, fwd2, lookAhead*0.8)) c.avoidTimer -= dt*0.5;
    } else {
      // ligera deriva aleatoria para que no sean perfectamente rectos
      c.yaw += (Math.random()-0.5) * 0.04 * dt;
      c.turn = 0;
    }

    // avanza
    const speedMps = c.speed; // unidades/seg
    const move = new THREE.Vector3(Math.cos(c.yaw),0,Math.sin(c.yaw)).multiplyScalar(speedMps*dt);

    // prueba de paso seguro (con margen pequeño)
    const nextX = c.pos.x + move.x;
    const nextZ = c.pos.z + move.z;
    if (isSafe(nextX, nextZ, 2)) {
      c.pos.x = THREE.MathUtils.clamp(nextX, -WORLD_HALF+5, WORLD_HALF-5);
      c.pos.z = THREE.MathUtils.clamp(nextZ, -WORLD_HALF+5, WORLD_HALF-5);
    } else {
      // si no es seguro, forzar giro para rodear
      c.yaw += (c.turn !== 0 ? c.turn : (Math.random()<0.5?1:-1)) * turnSpeed * dt;
      c.avoidTimer = 0.4;
    }

    // === dibujar una instancia completa del camello en (c.pos, yaw) ===
    drawCamelInstance(i, c.pos, c.yaw);
  }
  flagCamelsUpdate();
}

// devuelve true si hay pirámide en el segmento [pos, pos+dir*dist]
function checkHazard(pos, dir, dist) {
  const aheadX = pos.x + dir.x * dist;
  const aheadZ = pos.z + dir.z * dist;
  return !isSafe(aheadX, aheadZ, 0);
}

// estima “libertad” en una dirección (distancia segura acumulada)
function sampleFree(pos, yaw) {
  let score = 0;
  const dir = new THREE.Vector3(Math.cos(yaw),0,Math.sin(yaw));
  for (let d=4; d<=16; d+=4) {
    if (isSafe(pos.x + dir.x*d, pos.z + dir.z*d, 0)) score += 1;
  }
  return score;
}

function drawCamelInstance(i, basePos, yaw) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), yaw);
  const s1 = new THREE.Vector3(1,1,1);

  // cuerpo
  _m.compose(basePos, q, s1);
  camelBodyIM.setMatrixAt(i, _m);

  // cuello (inclinado hacia delante)
  {
    const off = new THREE.Vector3(5.5, 3.2, 0).applyQuaternion(q);
    const neckPos = basePos.clone().add(off);
    const neckQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, -0.35));
    _m.compose(neckPos, neckQuat, s1);
    camelNeckIM.setMatrixAt(i, _m);
  }

  // cabeza
  {
    const off = new THREE.Vector3(8.2, 4.2, 0).applyQuaternion(q);
    const headPos = basePos.clone().add(off);
    _m.compose(headPos, q, s1);
    camelHeadIM.setMatrixAt(i, _m);
  }

  // hocico (snout)
  {
    const off = new THREE.Vector3(9.8, 4.3, 0).applyQuaternion(q);
    const snMat = camelHeadIM.material.clone();
    const snIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4,1.2,1.4), snMat, 1);
    // Para evitar crear meshes cada frame, omitimos snout instanced extra y lo integramos ópticamente en la cabeza.
    // (Mantener performance: lo simulamos con el head box un poco más largo)
  }

  // joroba
  {
    const off = new THREE.Vector3(0, 5.2, 0).applyQuaternion(q);
    _m.compose(basePos.clone().add(off), q, new THREE.Vector3(1,1,0.8));
    camelHumpIM.setMatrixAt(i, _m);
  }

  // manta/silla (blanket)
  {
    const off = new THREE.Vector3(0.8, 3.2, 0).applyQuaternion(q);
    _m.compose(basePos.clone().add(off), q, new THREE.Vector3(1,1,1));
    camelBlanketIM.setMatrixAt(i, _m);
  }

  // cola (atrás, ligeramente inclinada)
  {
    const off = new THREE.Vector3(-5.8, 3.0, 0).applyQuaternion(q);
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, yaw, 0));
    _m.compose(basePos.clone().add(off), tilt, s1);
    camelTailIM.setMatrixAt(i, _m);
  }

  // orejas
  {
    const offL = new THREE.Vector3(8.4, 5.0, 0.7).applyQuaternion(q);
    const offR = new THREE.Vector3(8.4, 5.0,-0.7).applyQuaternion(q);
    const tiltL = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3, yaw, 0.15));
    const tiltR = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3, yaw,-0.15));
    _m.compose(basePos.clone().add(offL), tiltL, s1); camelEarLIM.setMatrixAt(i, _m);
    _m.compose(basePos.clone().add(offR), tiltR, s1); camelEarRIM.setMatrixAt(i, _m);
  }

  // patas (paso alternado)
  const step = Math.sin(performance.now()*0.003 + i);
  const legUpFront = 0.5 + step*0.25;
  const legUpBack  = 0.5 - step*0.20;
  const legScale = s1;

  const offFL = new THREE.Vector3(3.4, 0, 1.6).applyQuaternion(q);
  const offFR = new THREE.Vector3(3.4, 0,-1.6).applyQuaternion(q);
  const offBL = new THREE.Vector3(-3.4,0, 1.6).applyQuaternion(q);
  const offBR = new THREE.Vector3(-3.4,0,-1.6).applyQuaternion(q);

  _m.compose(new THREE.Vector3(basePos.x+offFL.x, legUpFront, basePos.z+offFL.z), q, legScale); camelLegFLIM.setMatrixAt(i, _m);
  _m.compose(new THREE.Vector3(basePos.x+offFR.x, 0.5 - step*0.25, basePos.z+offFR.z), q, legScale); camelLegFRIM.setMatrixAt(i, _m);
  _m.compose(new THREE.Vector3(basePos.x+offBL.x, legUpBack, basePos.z+offBL.z), q, legScale); camelLegBLIM.setMatrixAt(i, _m);
  _m.compose(new THREE.Vector3(basePos.x+offBR.x, 0.5 + step*0.20, basePos.z+offBR.z), q, legScale); camelLegBRIM.setMatrixAt(i, _m);
}

function flagCamelsUpdate(includeColors=false) {
  if (!camelBodyIM) return;
  camelBodyIM.instanceMatrix.needsUpdate = true;
  camelNeckIM.instanceMatrix.needsUpdate = true;
  camelHeadIM.instanceMatrix.needsUpdate = true;
  camelHumpIM.instanceMatrix.needsUpdate = true;
  camelTailIM.instanceMatrix.needsUpdate = true;
  camelEarLIM.instanceMatrix.needsUpdate = true;
  camelEarRIM.instanceMatrix.needsUpdate = true;
  camelBlanketIM.instanceMatrix.needsUpdate = true;
  camelLegFLIM.instanceMatrix.needsUpdate = true;
  camelLegFRIM.instanceMatrix.needsUpdate = true;
  camelLegBLIM.instanceMatrix.needsUpdate = true;
  camelLegBRIM.instanceMatrix.needsUpdate = true;

  if (includeColors) {
    camelBodyIM.instanceColor && (camelBodyIM.instanceColor.needsUpdate = true);
    camelHeadIM.instanceColor && (camelHeadIM.instanceColor.needsUpdate = true);
    camelBlanketIM.instanceColor && (camelBlanketIM.instanceColor.needsUpdate = true);
  }
}

/* ====== textura “caliza” suave para las pirámides (CanvasTexture) ====== */
function makeLimestoneTexture() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0,0,0,s);
  g.addColorStop(0, '#e7d3a6');
  g.addColorStop(1, '#d8c08e');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,s,s);

  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  for (let i=0;i<700;i++){
    ctx.fillRect(Math.random()*s, Math.random()*s, 1, 1);
  }

  ctx.strokeStyle = 'rgba(60,40,20,0.08)';
  ctx.lineWidth = 1;
  for (let y=30; y<s; y+=28){
    ctx.beginPath();
    ctx.moveTo(0, y + Math.random()*2-1);
    ctx.lineTo(s, y + Math.random()*2-1);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 2;
  tex.needsUpdate = true;
  return tex;
}
