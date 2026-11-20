// Scena 3D: linie de găleți -> paletizare manuală (operator) sau cu celula UR20.
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutBack = (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

// Dimensiuni (metri)
const BELT_Y = 0.8;
const PICK = new THREE.Vector3(-0.85, BELT_Y, 0);
const PALLET = { w: 1.2, d: 0.8, h: 0.144 };
const PALLET_POS = [new THREE.Vector3(0, 0, -1.05), new THREE.Vector3(0, 0, 1.05)];
const PEDESTAL_H = 0.5;
const SHOULDER_H = PEDESTAL_H + 0.24;
const L1 = 0.95, L2 = 0.8, LW = 0.42; // braț, antebraț, încheietură+gripper
const PICK_T = 0.15; // momentul preluării în ciclu

const MAT = {
  floor: new THREE.MeshStandardMaterial({ color: 0xd3d7dc, roughness: 0.9 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xf5c400, roughness: 0.6 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.6, metalness: 0.3 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.4, metalness: 0.7 }),
  belt: new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.8 }),
  roller: new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.3, metalness: 0.8 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xb98a58, roughness: 0.85 }),
  card: new THREE.MeshStandardMaterial({ color: 0xc9a46b, roughness: 0.9 }),
  pail: new THREE.MeshStandardMaterial({ color: 0x6e3f22, roughness: 0.55 }),
  lid: new THREE.MeshStandardMaterial({ color: 0x55301a, roughness: 0.5 }),
  handle: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.3, metalness: 0.8 }),
  urBody: new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.32, metalness: 0.35 }),
  urCap: new THREE.MeshStandardMaterial({ color: 0x8fb3cc, roughness: 0.35, metalness: 0.2 }),
  urDark: new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.5, metalness: 0.4 }),
  vest: new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7 }),
  stripe: new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.3, metalness: 0.5 }),
  pants: new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.8 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xe0b08a, roughness: 0.7 }),
  helmet: new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.4 }),
  rack: new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6 }),
  beam: new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.6 }),
  box: new THREE.MeshStandardMaterial({ color: 0xa47b4f, roughness: 0.9 }),
  zone: new THREE.MeshBasicMaterial({ color: 0xf5c400, transparent: true, opacity: 0.18, depthWrite: false }),
  zoneRing: new THREE.MeshBasicMaterial({ color: 0xf5c400, transparent: true, opacity: 0.8 }),
  vision: new THREE.MeshBasicMaterial({ color: 0x22e07a, transparent: true, opacity: 0, depthWrite: false }),
  led: new THREE.MeshBasicMaterial({ color: 0x22e07a }),
};

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
function cyl(rt, rb, h, mat, seg = 24) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
}
// Cilindru culcat pe axa X (pentru segmentele brațului)
function cylX(r, len, mat) {
  const m = cyl(r, r, len, mat);
  m.rotation.z = -Math.PI / 2;
  m.position.x = len / 2;
  return m;
}
// Articulație UR: carcasă cilindrică pe axa Z, cu capace colorate
function joint(r, len, group) {
  const g = new THREE.Group();
  const body = cyl(r, r, len, MAT.urBody, 32);
  body.rotation.x = Math.PI / 2;
  const cap1 = cyl(r * 0.92, r * 0.92, 0.02, MAT.urCap, 32);
  cap1.rotation.x = Math.PI / 2; cap1.position.z = len / 2 + 0.01;
  const cap2 = cap1.clone(); cap2.position.z = -len / 2 - 0.01;
  g.add(body, cap1, cap2);
  group.add(g);
  return g;
}
function enableShadows(obj) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

export class CellScene {
  constructor(container, { onEvent } = {}) {
    this.container = container;
    this.onEvent = onEvent || (() => {});
    this.mode = 'human';
    this.phase = 0;
    this.count = 0;
    this.kgManual = 0;
    this.params = { kg: 13, diameter: 30, height: 32, handle: true, ppm: 6.5 };
    this.transition = null;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdfe6ee);
    scene.fog = new THREE.Fog(0xdfe6ee, 9, 18);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(3.6, 3.0, 3.4);
    this.camera = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-0.3, 0.7, 0);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2.5;
    controls.maxDistance = 9;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.autoRotate = false;
    this.controls = controls;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(3, 6, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 15 });
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    this.buildEnvironment();
    this.buildConveyor();
    this.buildPallets();
    this.worker = this.buildWorker();
    this.robot = this.buildRobot();
    this.cellExtras = this.buildCellExtras();
    this.robot.group.visible = false;
    this.cellExtras.visible = false;

    this.placedGroup = new THREE.Group();
    scene.add(this.placedGroup);
    this.queueGroup = new THREE.Group();
    scene.add(this.queueGroup);

    this.setParams(this.params);

    this.clock = new THREE.Clock();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    renderer.setAnimationLoop(() => this.tick());
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // pe ecrane înguste, camera se dă puțin în spate
    this.camera.fov = w / h < 1 ? 52 : 40;
    this.camera.updateProjectionMatrix();
  }

  // ---------- Construcția scenei ----------
  buildEnvironment() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), MAT.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Marcaje galbene pe podea în jurul paleților
    PALLET_POS.forEach((p) => {
      const w = PALLET.w + 0.3, d = PALLET.d + 0.3, t = 0.05;
      [[0, -d / 2], [0, d / 2]].forEach(([x, z]) => this.scene.add(box(w, 0.004, t, MAT.yellow, p.x + x, 0.002, p.z + z)));
      [[-w / 2, 0], [w / 2, 0]].forEach(([x, z]) => this.scene.add(box(t, 0.004, d, MAT.yellow, p.x + x, 0.002, p.z + z)));
      // ghidaje galbene la colțuri (ca în poză)
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
        const g = box(0.06, 0.25, 0.06, MAT.yellow, p.x + sx * (PALLET.w / 2 + 0.08), 0.125, p.z + sz * (PALLET.d / 2 + 0.08));
        this.scene.add(g);
      });
    });
    // linie de circulație
    this.scene.add(box(0.08, 0.004, 9, MAT.yellow, 1.35, 0.002, 0));

    // Rafturi de depozit în fundal
    const rack = (x0, z0, rotY) => {
      const g = new THREE.Group();
      const bays = 3, bw = 1.6, depth = 0.9, levels = 4, lh = 0.75;
      for (let i = 0; i <= bays; i++) {
        g.add(box(0.07, levels * lh, 0.07, MAT.rack, i * bw, (levels * lh) / 2, 0));
        g.add(box(0.07, levels * lh, 0.07, MAT.rack, i * bw, (levels * lh) / 2, depth));
      }
      for (let l = 1; l <= levels; l++) {
        g.add(box(bays * bw, 0.08, 0.06, MAT.beam, (bays * bw) / 2, l * lh - 0.3, 0));
        g.add(box(bays * bw, 0.08, 0.06, MAT.beam, (bays * bw) / 2, l * lh - 0.3, depth));
        for (let i = 0; i < bays; i++) {
          if ((i + l) % 3 === 0) continue;
          g.add(box(1.1, 0.4, 0.75, MAT.box, i * bw + bw / 2, l * lh - 0.06, depth / 2));
        }
      }
      g.position.set(x0, 0, z0);
      g.rotation.y = rotY;
      enableShadows(g);
      this.scene.add(g);
    };
    rack(-4.2, -3.4, 0);
    rack(1.0, -3.4, 0);
    rack(-5.2, 2.6, Math.PI / 2);
  }

  buildConveyor() {
    const g = new THREE.Group();
    const x0 = -4.4, x1 = -0.62, len = x1 - x0, cx = (x0 + x1) / 2, w = 0.5;
    g.add(box(len, 0.03, w, MAT.belt, cx, BELT_Y - 0.015, 0));
    g.add(box(len, 0.12, 0.04, MAT.frame, cx, BELT_Y - 0.03, w / 2 + 0.02));
    g.add(box(len, 0.12, 0.04, MAT.frame, cx, BELT_Y - 0.03, -w / 2 - 0.02));
    for (let x = x0 + 0.2; x < x1; x += 0.9) {
      [-1, 1].forEach((s) => g.add(box(0.05, BELT_Y - 0.09, 0.05, MAT.frame, x, (BELT_Y - 0.09) / 2, s * (w / 2 + 0.02))));
    }
    // role vizibile pe lateral (se rotesc când banda merge)
    this.rollers = [];
    for (let x = x0 + 0.1; x < x1; x += 0.22) {
      const r = cyl(0.03, 0.03, w + 0.12, MAT.roller, 12);
      r.rotation.x = Math.PI / 2;
      r.position.set(x, BELT_Y - 0.06, 0);
      g.add(r);
      this.rollers.push(r);
    }
    // opritor la capăt
    g.add(box(0.04, 0.1, w, MAT.dark, x1 + 0.02, BELT_Y + 0.05, 0));
    enableShadows(g);
    this.scene.add(g);
  }

  buildPallets() {
    this.pallets = PALLET_POS.map((p) => {
      const g = new THREE.Group();
      const { w, d, h } = PALLET;
      for (let i = 0; i < 5; i++) g.add(box(w, 0.022, 0.12, MAT.wood, 0, h - 0.011, -d / 2 + 0.06 + i * ((d - 0.12) / 4)));
      for (let i = 0; i < 3; i++) g.add(box(w, 0.022, 0.1, MAT.wood, 0, 0.011, -d / 2 + 0.05 + i * ((d - 0.1) / 2)));
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        g.add(box(0.14, h - 0.044, 0.1, MAT.wood, -w / 2 + 0.07 + i * ((w - 0.14) / 2), h / 2, -d / 2 + 0.05 + j * ((d - 0.1) / 2)));
      }
      g.position.copy(p);
      enableShadows(g);
      this.scene.add(g);
      return g;
    });
  }

  buildWorker() {
    const group = new THREE.Group();
    const hips = 0.92;
    const legs = [-0.1, 0.1].map((x) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, hips, 0);
      const leg = cyl(0.075, 0.065, hips - 0.06, MAT.pants, 12);
      leg.position.y = -(hips - 0.06) / 2;
      const shoe = box(0.12, 0.07, 0.24, MAT.dark, 0, -hips + 0.035, 0.04);
      pivot.add(leg, shoe);
      group.add(pivot);
      return pivot;
    });
    const torso = new THREE.Group();
    torso.position.y = hips;
    const body = box(0.4, 0.58, 0.24, MAT.vest, 0, 0.3, 0);
    const s1 = box(0.41, 0.04, 0.25, MAT.stripe, 0, 0.16, 0);
    const s2 = box(0.41, 0.04, 0.25, MAT.stripe, 0, 0.3, 0);
    const neck = cyl(0.05, 0.05, 0.06, MAT.skin, 10); neck.position.y = 0.62;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), MAT.skin); head.position.y = 0.74;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), MAT.helmet);
    helmet.position.y = 0.77;
    const brim = cyl(0.15, 0.15, 0.015, MAT.helmet, 20); brim.position.set(0, 0.77, 0.02);
    torso.add(body, s1, s2, neck, head, helmet, brim);
    const arms = [-0.25, 0.25].map((x) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.55, 0);
      const upper = cyl(0.055, 0.05, 0.32, MAT.vest, 10); upper.position.y = -0.16;
      const lower = cyl(0.048, 0.042, 0.3, MAT.skin, 10); lower.position.y = -0.46;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), MAT.skin); hand.position.y = -0.62;
      pivot.add(upper, lower, hand);
      torso.add(pivot);
      return pivot;
    });
    group.add(torso);
    enableShadows(group);
    this.scene.add(group);
    group.position.set(PICK.x + 0.55, 0, 0);
    return { group, torso, legs, arms, yaw: -Math.PI / 2 };
  }

  buildRobot() {
    const group = new THREE.Group();
    // piedestal negru (ca în poză)
    group.add(box(0.36, PEDESTAL_H, 0.36, MAT.dark, 0, PEDESTAL_H / 2, 0));
    group.add(box(0.5, 0.03, 0.5, MAT.dark, 0, 0.015, 0));
    const led = box(0.2, 0.02, 0.01, MAT.led, 0, PEDESTAL_H - 0.08, 0.181);
    group.add(led);

    const yaw = new THREE.Group();
    yaw.position.y = PEDESTAL_H;
    group.add(yaw);
    const baseJ = cyl(0.11, 0.12, 0.16, MAT.urBody, 32); baseJ.position.y = 0.08;
    const baseCap = cyl(0.115, 0.115, 0.02, MAT.urCap, 32); baseCap.position.y = 0.17;
    yaw.add(baseJ, baseCap);

    const shoulder = new THREE.Group();
    shoulder.position.y = SHOULDER_H - PEDESTAL_H;
    yaw.add(shoulder);
    joint(0.1, 0.22, shoulder);
    const upper = new THREE.Group(); upper.position.z = 0.15; shoulder.add(upper);
    upper.add(cylX(0.068, L1, MAT.urBody));
    const sj2 = joint(0.085, 0.12, upper); // legătura umăr
    sj2.position.set(0, 0, 0);

    const elbow = new THREE.Group();
    elbow.position.set(L1, 0, 0);
    shoulder.add(elbow);
    const ej = joint(0.085, 0.2, elbow); ej.position.z = 0.07;
    const fore = new THREE.Group(); fore.position.z = -0.0; elbow.add(fore);
    fore.add(cylX(0.055, L2, MAT.urBody));

    const wrist = new THREE.Group();
    wrist.position.set(L2, 0, 0);
    elbow.add(wrist);
    joint(0.065, 0.14, wrist);
    const w1 = cylX(0.05, 0.14, MAT.urBody); wrist.add(w1);
    const w2 = new THREE.Group(); w2.position.x = 0.15; wrist.add(w2);
    const w2b = cyl(0.062, 0.062, 0.13, MAT.urBody, 28); w2b.rotation.z = 0; w2.add(w2b);
    const w2c = cyl(0.058, 0.058, 0.02, MAT.urCap, 28); w2c.position.y = 0.075; w2.add(w2c);
    const flange = cylX(0.045, 0.1, MAT.urDark); flange.position.x = 0.2; wrist.add(flange);
    // gripper pneumatic + camera
    const grip = new THREE.Group(); grip.position.x = 0.27; wrist.add(grip);
    grip.add(box(0.05, 0.26, 0.12, MAT.urDark, 0.025, 0, 0));
    this.fingers = [-1, 1].map((s) => {
      const f = box(0.12, 0.03, 0.04, MAT.frame, 0.11, s * 0.1, 0);
      grip.add(f);
      return f;
    });
    grip.add(box(0.04, 0.05, 0.05, MAT.dark, 0.03, 0, 0.09));

    enableShadows(group);
    this.scene.add(group);
    return { group, yaw, shoulder, elbow, wrist };
  }

  buildCellExtras() {
    const g = new THREE.Group();
    // zona de protecție monitorizată de scanere
    const zone = new THREE.Mesh(new THREE.CircleGeometry(1.9, 64), MAT.zone);
    zone.rotation.x = -Math.PI / 2; zone.position.y = 0.006;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.88, 1.93, 64), MAT.zoneRing);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.007;
    g.add(zone, ring);
    this.zone = zone;
    // trei scanere de siguranță
    [[0.75, -0.55], [0.75, 0.55], [-0.55, 0.55]].forEach(([x, z]) => {
      const s = new THREE.Group();
      s.add(box(0.14, 0.12, 0.14, MAT.yellow, 0, 0.06, 0));
      s.add(cyl(0.05, 0.05, 0.06, MAT.dark, 16).translateY(0.15));
      s.position.set(x, 0, z);
      g.add(s);
    });
    // camera 2D deasupra punctului de preluare
    const pole = box(0.05, 1.9, 0.05, MAT.frame, PICK.x, 0.95, -0.42);
    const arm = box(0.05, 0.05, 0.45, MAT.frame, PICK.x, 1.88, -0.2);
    const cam = box(0.12, 0.08, 0.1, MAT.dark, PICK.x, 1.83, 0);
    g.add(pole, arm, cam);
    const coneH = 1.79 - BELT_Y;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, coneH, 32, 1, true), MAT.vision);
    cone.position.set(PICK.x, BELT_Y + coneH / 2, 0);
    g.add(cone);
    enableShadows(g);
    zone.castShadow = ring.castShadow = cone.castShadow = false;
    this.scene.add(g);
    return g;
  }

  // ---------- Parametri ----------
  setParams(p) {
    this.params = { ...this.params, ...p };
    const d = this.params.diameter / 100, h = this.params.height / 100, r = d / 2;
    // prototip găleată
    const proto = new THREE.Group();
    const body = cyl(r, r * 0.88, h - 0.02, MAT.pail, 28); body.position.y = (h - 0.02) / 2;
    const lid = cyl(r * 1.03, r * 1.03, 0.025, MAT.lid, 28); lid.position.y = h - 0.012;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(r * 0.99, 0.008, 6, 28), MAT.lid);
    rib.rotation.x = Math.PI / 2; rib.position.y = h * 0.8;
    proto.add(body, lid, rib);
    if (this.params.handle) {
      const handle = new THREE.Mesh(new THREE.TorusGeometry(r * 0.95, 0.007, 6, 24, Math.PI), MAT.handle);
      handle.position.y = h;
      handle.scale.y = 0.5;
      proto.add(handle);
    }
    enableShadows(proto);
    this.pailProto = proto;
    this.pailH = h;

    // model de paletizare
    const gap = 0.01;
    const cols = Math.max(1, Math.floor((PALLET.w + gap) / (d + gap)));
    const rows = Math.max(1, Math.floor((PALLET.d + gap) / (d + gap)));
    const layers = Math.max(1, Math.min(4, Math.floor(1.0 / h)));
    this.perLayer = cols * rows;
    this.slotsLocal = [];
    for (let l = 0; l < layers; l++) for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * (d + gap);
      const z = (rr - (rows - 1) / 2) * (d + gap);
      this.slotsLocal.push({ x, z, y: PALLET.h + l * (h + 0.006), layer: l, row: rr });
    }
    this.resetPallets();
    this.rebuildQueue();
  }

  slotWorld(palletIdx, i) {
    const s = this.slotsLocal[i];
    const p = PALLET_POS[palletIdx];
    // pe ambii paleți se începe cu rândul cel mai îndepărtat de robot
    const zSign = palletIdx === 0 ? 1 : -1;
    const rowsZ = s.z * zSign;
    return new THREE.Vector3(p.x + s.x, s.y, p.z + rowsZ);
  }

  resetPallets() {
    this.placedGroup.clear();
    this.palletContent = [new THREE.Group(), new THREE.Group()];
    this.palletContent.forEach((g) => this.placedGroup.add(g));
    this.slotIdx = [0, 0];
    this.target = 0;
    this.pendingClear = null;
    // paletul A pornește parțial încărcat, ca scena să arate ca o linie în lucru
    const prefill = Math.floor(this.slotsLocal.length * 0.4);
    for (let i = 0; i < prefill; i++) this.placeAt(0, this.slotIdx[0]++, this.pailProto.clone());
  }

  placeAt(palletIdx, i, pail) {
    const s = this.slotsLocal[i];
    if (s.layer > 0 && i % this.perLayer === 0) {
      // separator de carton (pus manual de operator)
      const sep = box(PALLET.w, 0.006, PALLET.d, MAT.card);
      sep.position.copy(PALLET_POS[palletIdx]);
      sep.position.y = s.y - 0.003;
      sep.receiveShadow = true;
      this.palletContent[palletIdx].add(sep);
    }
    pail.position.copy(this.slotWorld(palletIdx, i));
    pail.rotation.set(0, 0, 0);
    this.palletContent[palletIdx].add(pail);
  }

  rebuildQueue() {
    this.queueGroup.clear();
    const d = this.params.diameter / 100;
    this.spacing = d + 0.1;
    const n = Math.min(10, Math.max(4, Math.floor(3.3 / this.spacing)));
    this.queue = [];
    for (let k = 0; k < n; k++) {
      const p = this.pailProto.clone();
      this.queueGroup.add(p);
      this.queue.push(p);
    }
    this.phase = 0;
  }

  // ---------- Moduri ----------
  setMode(mode, animate = true) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.phase = 0;
    this.count = 0;
    this.kgManual = 0;
    if (!animate) {
      this.applyModeVisibility(1);
      return;
    }
    this.transition = { t: 0, to: mode };
    this.robot.group.visible = true;
    this.worker.group.visible = true;
    this.cellExtras.visible = true;
  }

  applyModeVisibility(k) {
    const robotOn = this.mode === 'robot';
    const rs = robotOn ? easeOutBack(k) : 1 - k;
    const ws = robotOn ? 1 - k : k;
    this.robot.group.scale.setScalar(Math.max(0.0001, rs));
    this.worker.group.scale.setScalar(Math.max(0.0001, ws));
    this.cellExtras.scale.setScalar(Math.max(0.0001, robotOn ? clamp01(k * 1.2) : 1 - k));
    this.robot.group.visible = rs > 0.001;
    this.worker.group.visible = ws > 0.001;
    this.cellExtras.visible = robotOn ? k > 0 : k < 1;
  }

  shake() {
    this.shakeT = 0.5;
  }

  // ---------- Animație ----------
  cycleSeconds() {
    // ritmul real al liniei, accelerat pentru demonstrație
    const real = 60 / Math.max(0.5, this.params.ppm);
    const shown = Math.min(5.5, Math.max(2.2, real / 3));
    this.speedup = real / shown;
    return shown;
  }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.controls.update();

    if (this.transition) {
      this.transition.t += dt / 1.1;
      const k = clamp01(this.transition.t);
      this.applyModeVisibility(k);
      if (k >= 1) this.transition = null;
    }

    const T = this.cycleSeconds();
    const moving = !this.transition;
    if (moving) this.phase += dt / T;
    if (this.phase >= 1) {
      this.phase -= 1;
      this.completeCycle();
    }
    const p = this.phase;

    // banda: găleata 0 așteaptă la capăt, restul avansează după preluare
    const adv = ease(seg(p, 0.2, 0.9));
    for (let k = 1; k < this.queue.length; k++) {
      this.queue[k].position.set(PICK.x - k * this.spacing + adv * this.spacing, BELT_Y, 0);
      this.queue[k].visible = this.queue[k].position.x > -4.35;
    }
    const beltMoving = p > 0.2 && p < 0.9 && moving;
    if (beltMoving) this.rollers.forEach((r) => (r.rotation.y += dt * 6));

    const front = this.queue[0];
    const slot = this.slotWorld(this.target, this.slotIdx[this.target]);
    if (this.mode === 'robot' && !this.transition) this.animateRobot(p, front, slot);
    else if (this.mode === 'human' && !this.transition) this.animateWorker(p, front, slot, dt);
    else front.position.copy(PICK);

    // camera de vedere: clipire verde când găleata ajunge sub ea
    MAT.vision.opacity = this.mode === 'robot' && p < PICK_T ? 0.22 * Math.sin((p / PICK_T) * Math.PI) : 0;

    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.scene.position.x = Math.sin(this.shakeT * 60) * 0.03 * (this.shakeT / 0.5);
    } else this.scene.position.x = 0;

    this.renderer.render(this.scene, this.camera);
  }

  completeCycle() {
    const pail = this.queue.shift();
    this.queueGroup.remove(pail);
    const t = this.target;
    this.placeAt(t, this.slotIdx[t]++, pail);
    const np = this.pailProto.clone();
    this.queueGroup.add(np);
    this.queue.push(np);
    this.count++;
    if (this.mode === 'human') this.kgManual += this.params.kg;
    this.onEvent({ type: 'placed', mode: this.mode, count: this.count, kgManual: this.kgManual });

    if (this.pendingClear) {
      this.pendingClear.cycles--;
      if (this.pendingClear.cycles <= 0) {
        const i = this.pendingClear.pallet;
        this.palletContent[i].clear();
        this.slotIdx[i] = 0;
        this.pendingClear = null;
        this.onEvent({ type: 'pallet-changed', pallet: i });
      }
    }
    if (this.slotIdx[t] >= this.slotsLocal.length) {
      if (this.mode === 'robot') {
        // a doua poziție de paletizare: robotul continuă, operatorul schimbă paletul plin
        this.target = 1 - t;
        if (this.slotIdx[this.target] >= this.slotsLocal.length) {
          this.palletContent[this.target].clear();
          this.slotIdx[this.target] = 0;
        }
        this.pendingClear = { pallet: t, cycles: 3 };
        this.onEvent({ type: 'pallet-full', mode: 'robot', pallet: t });
      } else {
        this.palletContent[t].clear();
        this.slotIdx[t] = 0;
        this.onEvent({ type: 'pallet-full', mode: 'human', pallet: t });
      }
    }
  }

  // --- Robot: cinematică inversă simplă (umăr + cot), încheietura mereu în jos ---
  solveIK(tip) {
    const { yaw, shoulder, elbow, wrist } = this.robot;
    const W = new THREE.Vector3(tip.x, tip.y + LW, tip.z);
    yaw.rotation.y = Math.atan2(-W.z, W.x);
    // umărul e decalat lateral; compensăm aproximativ
    const r = Math.max(0.25, Math.hypot(W.x, W.z));
    const z = W.y - SHOULDER_H;
    const D = Math.max(-1, Math.min(1, (r * r + z * z - L1 * L1 - L2 * L2) / (2 * L1 * L2)));
    const t3 = Math.acos(D);
    const t2 = Math.atan2(z, r) + Math.atan2(L2 * Math.sin(t3), L1 + L2 * Math.cos(t3));
    shoulder.rotation.z = t2;
    elbow.rotation.z = -t3;
    wrist.rotation.z = -Math.PI / 2 - (t2 - t3);
  }

  polar(a, b, t) {
    const aa = Math.atan2(a.z, a.x), ab = Math.atan2(b.z, b.x);
    let da = ab - aa;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const ang = aa + da * t;
    const ra = Math.hypot(a.x, a.z), rb = Math.hypot(b.x, b.z);
    const rad = lerp(ra, rb, t);
    return new THREE.Vector3(Math.cos(ang) * rad, lerp(a.y, b.y, t), Math.sin(ang) * rad);
  }

  animateRobot(p, pail, slot) {
    const h = this.pailH;
    const pickTop = PICK.clone().setY(PICK.y + h);
    const slotTop = slot.clone().setY(slot.y + h);
    const travelY = Math.max(pickTop.y, slotTop.y) + 0.28;
    const hover = pickTop.clone().setY(pickTop.y + 0.22);
    const pickUp = pickTop.clone().setY(travelY);
    const slotUp = slotTop.clone().setY(travelY);
    let tip, carrying = false, open = true;

    if (p < 0.12) tip = hover.clone().lerp(pickTop, ease(seg(p, 0, 0.12)));
    else if (p < 0.18) { tip = pickTop.clone(); open = p < PICK_T; carrying = p >= PICK_T; }
    else if (p < 0.3) { tip = pickTop.clone().lerp(pickUp, ease(seg(p, 0.18, 0.3))); carrying = true; open = false; }
    else if (p < 0.58) { tip = this.polar(pickUp, slotUp, ease(seg(p, 0.3, 0.58))); carrying = true; open = false; }
    else if (p < 0.7) { tip = slotUp.clone().lerp(slotTop, ease(seg(p, 0.58, 0.7))); carrying = true; open = false; }
    else if (p < 0.76) { tip = slotTop.clone(); open = p > 0.73; carrying = p <= 0.73; }
    else if (p < 0.86) { tip = slotTop.clone().lerp(slotUp, ease(seg(p, 0.76, 0.86))); }
    else tip = this.polar(slotUp, hover, ease(seg(p, 0.86, 1)));

    this.solveIK(tip);
    const f = open ? 0.12 : 0.085;
    this.fingers.forEach((fg, i) => (fg.position.y = (i ? 1 : -1) * f));

    if (!carrying && p < 0.5) pail.position.copy(PICK);
    else if (carrying) pail.position.set(tip.x, tip.y - h, tip.z);
    else pail.position.copy(slot);
  }

  // --- Operator: merge, se apleacă, ridică și cară găleata ---
  animateWorker(p, pail, slot, dt) {
    const w = this.worker;
    const pickStance = new THREE.Vector3(PICK.x + 0.5, 0, 0);
    const zEdge = slot.z < 0 ? PALLET_POS[0].z + PALLET.d / 2 + 0.25 : PALLET_POS[1].z - PALLET.d / 2 - 0.25;
    const placeStance = new THREE.Vector3(slot.x, 0, zEdge);
    let pos, look, walking = false;

    if (p < 0.25) { pos = pickStance; look = PICK; }
    else if (p < 0.55) { pos = pickStance.clone().lerp(placeStance, ease(seg(p, 0.25, 0.55))); look = placeStance.clone().sub(pickStance).add(pos); walking = true; }
    else if (p < 0.76) { pos = placeStance; look = slot; }
    else { pos = placeStance.clone().lerp(pickStance, ease(seg(p, 0.76, 1))); look = pickStance.clone().sub(placeStance).add(pos); walking = true; }

    w.group.position.copy(pos);
    const targetYaw = Math.atan2(look.x - pos.x, look.z - pos.z);
    let dy = targetYaw - w.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    w.yaw += dy * Math.min(1, dt * 10);
    w.group.rotation.y = w.yaw;

    const fwd = new THREE.Vector3(Math.sin(w.yaw), 0, Math.cos(w.yaw));
    const hands = pos.clone().addScaledVector(fwd, 0.4).setY(0.95);
    let bend = 0, armA = 0.15;
    if (p < PICK_T) { const k = Math.sin(seg(p, 0, PICK_T) * Math.PI * 0.5); bend = k * this.bendFor(PICK.y); armA = 0.2 + k * 1.0; pail.position.copy(PICK); }
    else if (p < 0.25) { const k = ease(seg(p, PICK_T, 0.25)); bend = (1 - k) * this.bendFor(PICK.y); armA = 1.2 - k * 0.1; pail.position.copy(PICK.clone().lerp(hands.clone().setY(hands.y - this.pailH * 0.6), k)); }
    else if (p < 0.55) { armA = 1.1; pail.position.copy(hands).setY(hands.y - this.pailH * 0.6); }
    else if (p < 0.7) { const k = ease(seg(p, 0.55, 0.7)); bend = k * this.bendFor(slot.y); armA = 1.1 + k * 0.25; pail.position.copy(hands.clone().setY(hands.y - this.pailH * 0.6).lerp(slot, k)); }
    else if (p < 0.76) { bend = this.bendFor(slot.y); armA = 1.35; pail.position.copy(slot); }
    else { const k = ease(seg(p, 0.76, 0.86)); bend = (1 - k) * this.bendFor(slot.y); armA = 0.2; pail.position.copy(slot); }

    w.torso.rotation.x = bend;
    w.arms.forEach((a) => (a.rotation.x = -armA));
    const swing = walking ? Math.sin(performance.now() / 110) * 0.45 : 0;
    w.legs[0].rotation.x = swing;
    w.legs[1].rotation.x = -swing;
    // genunchi „îndoiți" simulați prin coborârea corpului la aplecare
    w.torso.position.y = 0.92 - bend * 0.12;
  }

  bendFor(y) {
    return Math.max(0, Math.min(1.0, (1.05 - y) * 1.15));
  }
}
