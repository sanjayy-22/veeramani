// PlayCanvas engine spike: Madurai Diwali street (night) with a stand-in hero.
// Everything is procedural (canvas textures), no external assets.
import * as pc from 'playcanvas';

const params = new URLSearchParams(location.search);
const POST = params.get('post') !== '0';
const SSAO = params.get('ssao') !== '0';
const LIGHTS = params.get('lights') !== '0'; // local omni lights (clustered)
const SHADOWS = params.get('shadows') !== '0';
const SCALE = parseFloat(params.get('scale') || '1'); // CameraFrame renderTargetScale
const ANISO = parseInt(params.get('aniso') || '8', 10);

// ---------- app ----------
const canvas = document.getElementById('app');
const app = new pc.Application(canvas, {
  keyboard: new pc.Keyboard(window),
  graphicsDeviceOptions: { antialias: false, powerPreference: 'high-performance' },
});
app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio, 2);
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
window.addEventListener('resize', () => app.resizeCanvas());
const device = app.graphicsDevice;

// ---------- helpers ----------
let seed = 1337;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const mkCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const hex = (h) => new pc.Color().fromString(h);

function canvasTexture(cnv, { srgb = true, repeat = true, mipmaps = true, projection } = {}) {
  const addr = repeat ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE;
  const tex = new pc.Texture(device, {
    width: cnv.width, height: cnv.height,
    format: srgb ? pc.PIXELFORMAT_SRGBA8 : pc.PIXELFORMAT_RGBA8,
    mipmaps, anisotropy: ANISO, addressU: addr, addressV: addr,
    minFilter: mipmaps ? pc.FILTER_LINEAR_MIPMAP_LINEAR : pc.FILTER_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    ...(projection ? { projection } : {}),
  });
  tex.setSource(cnv);
  return tex;
}

// Derive a tangent-space normal map from a greyscale height canvas (central differences).
function normalFromHeight(hc, strength = 2.5) {
  const w = hc.width, h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = mkCanvas(w, h);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h);
  const H = (x, y) => src[((((y + h) % h) * w) + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255; // canvas y is down, GL normal-map green is up
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

function material({ color = '#ffffff', gloss = 0.35, metal = 0, map, normal, bump = 1, tiling,
  emissive, emissiveIntensity = 1, emissiveMap, lit = true } = {}) {
  const m = new pc.StandardMaterial();
  m.diffuse = hex(color);
  m.useMetalness = true;
  m.metalness = metal;
  m.gloss = gloss;
  if (map) m.diffuseMap = map;
  if (normal) { m.normalMap = normal; m.bumpiness = bump; }
  if (emissive) { m.emissive = hex(emissive); m.emissiveIntensity = emissiveIntensity; }
  if (emissiveMap) m.emissiveMap = emissiveMap;
  if (tiling) {
    m.diffuseMapTiling = tiling;
    m.normalMapTiling = tiling;
  }
  m.useLighting = lit;
  m.update();
  return m;
}

function shape(type, mat, { pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0], parent = app.root,
  shadows = true, batch } = {}) {
  const e = new pc.Entity();
  e.addComponent('render', { type, material: mat, castShadows: shadows, receiveShadows: true,
    ...(batch !== undefined ? { batchGroupId: batch } : {}) });
  e.setLocalPosition(...pos);
  e.setLocalScale(...scale);
  e.setLocalEulerAngles(...rot);
  parent.addChild(e);
  return e;
}

// ---------- procedural textures ----------
function cobbleTextures(size = 512) {
  const col = mkCanvas(size, size), hgt = mkCanvas(size, size);
  const c = col.getContext('2d'), h = hgt.getContext('2d');
  c.fillStyle = '#211d1a'; c.fillRect(0, 0, size, size);
  h.fillStyle = '#000'; h.fillRect(0, 0, size, size);
  const rows = 9, cols = 7, rh = size / rows, cw = size / cols;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const w = cw * (0.8 + rand() * 0.12), hh = rh * (0.78 + rand() * 0.12);
      const sx = k * cw + (r % 2) * cw * 0.5 + (rand() - 0.5) * 5;
      const sy = r * rh + (rh - hh) / 2 + (rand() - 0.5) * 4;
      const g = 70 + rand() * 60, warm = rand() * 18;
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const x = sx + ox, y = sy + oy, cx = x + w / 2, cy = y + hh / 2;
          const gc = c.createRadialGradient(cx - w * 0.15, cy - hh * 0.2, 2, cx, cy, Math.max(w, hh) * 0.65);
          gc.addColorStop(0, `rgb(${g + 30 + warm},${g + 24 + warm * 0.6},${g + 18})`);
          gc.addColorStop(1, `rgb(${g * 0.6 + warm},${g * 0.56},${g * 0.52})`);
          c.fillStyle = gc; c.beginPath(); c.roundRect(x, y, w, hh, 9); c.fill();
          const gh = h.createRadialGradient(cx, cy, 1, cx, cy, Math.max(w, hh) * 0.6);
          gh.addColorStop(0, '#fff'); gh.addColorStop(0.7, '#9a9a9a'); gh.addColorStop(1, '#3a3a3a');
          h.fillStyle = gh; h.beginPath(); h.roundRect(x, y, w, hh, 9); h.fill();
        }
      }
    }
  }
  // grit / speckle
  for (let i = 0; i < 9000; i++) {
    const v = rand() < 0.5 ? 0 : 255;
    c.fillStyle = `rgba(${v},${v},${v},${0.05 + rand() * 0.07})`;
    c.fillRect(rand() * size, rand() * size, 1.5, 1.5);
  }
  return { color: canvasTexture(col), normal: canvasTexture(normalFromHeight(hgt, 3), { srgb: false }) };
}

const WALLS = ['#e0578a', '#27a99c', '#f0bd45', '#e2733a', '#78bd57', '#6f7fd6', '#efe7d6'];
const TRIMS = ['#fff3d6', '#f6d36b', '#c0392b', '#2e86c1', '#ffffff', '#f5b041', '#8e44ad'];

function facadeTextures(wall, trim) {
  const W = 256, H = 512;
  const col = mkCanvas(W, H), emi = mkCanvas(W, H);
  const c = col.getContext('2d'), e = emi.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  c.fillStyle = wall; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { // weathering stains
    c.fillStyle = `rgba(40,25,15,${rand() * 0.06})`;
    const x = rand() * W, y = rand() * H;
    c.fillRect(x, y, 4 + rand() * 30, 6 + rand() * 60);
  }
  c.fillStyle = trim;
  c.fillRect(0, 0, W, 14); c.fillRect(0, H * 0.5 - 6, W, 12); // cornice + floor band
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, H - 40, W, 40); // plinth
  const win = (x, y, w, h) => {
    const lit = rand() < 0.55;
    c.fillStyle = trim; c.fillRect(x - 6, y - 6, w + 12, h + 12);
    c.fillStyle = lit ? '#ffcf73' : '#1c1612'; c.fillRect(x, y, w, h);
    c.fillStyle = '#3d2a1c'; c.fillRect(x + w / 2 - 2, y, 4, h); c.fillRect(x, y + h * 0.45, w, 4); // mullions
    c.fillStyle = rand() < 0.5 ? '#2f6f5a' : '#2c4f8f'; // shutters
    c.fillRect(x - 22, y - 4, 14, h + 8); c.fillRect(x + w + 8, y - 4, 14, h + 8);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x - 8, y + h + 6, w + 16, 6); // sill shadow
    if (lit) {
      e.fillStyle = '#ffb347'; e.fillRect(x, y, w, h);
      e.fillStyle = '#000'; e.fillRect(x + w / 2 - 2, y, 4, h); e.fillRect(x, y + h * 0.45, w, 4);
    }
  };
  win(52, 70, 50, 80); win(154, 70, 50, 80); // upper floor
  win(40, 300, 44, 70); // ground floor window
  // door with arch
  c.fillStyle = trim; c.beginPath(); c.roundRect(130, 290, 86, 190, [43, 43, 0, 0]); c.fill();
  c.fillStyle = '#5a3018'; c.beginPath(); c.roundRect(138, 298, 70, 182, [35, 35, 0, 0]); c.fill();
  c.strokeStyle = '#3a1e0e'; c.lineWidth = 3;
  for (let i = 0; i < 4; i++) c.strokeRect(144 + (i % 2) * 31, 340 + Math.floor(i / 2) * 64, 26, 54);
  c.fillStyle = '#f2c14e'; c.fillRect(126, 282, 94, 8); // thoranam (door garland)
  for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#3f8f3a' : '#f39c12'; c.beginPath(); c.arc(132 + i * 10, 294, 5, 0, Math.PI); c.fill(); }
  return { color: canvasTexture(col), emissive: canvasTexture(emi) };
}

function skyCanvas() { // equirect night sky
  const W = 1024, H = 512, s = mkCanvas(W, H), c = s.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#02030a'); g.addColorStop(0.3, '#08102e'); g.addColorStop(0.45, '#22183f');
  g.addColorStop(0.5, '#4a2a42'); g.addColorStop(0.53, '#1a1220'); g.addColorStop(1, '#050307');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    const y = rand() * H * 0.46, a = rand() * (1 - y / (H * 0.46));
    c.fillStyle = `rgba(255,255,240,${a})`;
    c.fillRect(rand() * W, y, rand() < 0.1 ? 2 : 1, rand() < 0.1 ? 2 : 1);
  }
  const mg = c.createRadialGradient(W * 0.75, H * 0.18, 4, W * 0.75, H * 0.18, 40);
  mg.addColorStop(0, '#fffbe8'); mg.addColorStop(0.25, '#f4f0d8'); mg.addColorStop(0.3, 'rgba(180,190,255,0.25)');
  mg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = mg; c.fillRect(0, 0, W, H);
  return s;
}

function envCanvas() { // brighter hemisphere used only for image-based ambient fill
  const s = mkCanvas(256, 128), c = s.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#0a0f26'); g.addColorStop(0.48, '#181424'); g.addColorStop(0.52, '#24160e'); g.addColorStop(1, '#140c08');
  c.fillStyle = g; c.fillRect(0, 0, 256, 128);
  return s;
}

// ---------- scene setup ----------
const sky = canvasTexture(skyCanvas(), { repeat: false, mipmaps: false, projection: pc.TEXTUREPROJECTION_EQUIRECT });
app.scene.skybox = pc.EnvLighting.generateSkyboxCubemap(sky);
const envSrc = canvasTexture(envCanvas(), { repeat: false, mipmaps: false, projection: pc.TEXTUREPROJECTION_EQUIRECT });
app.scene.envAtlas = pc.EnvLighting.generateAtlas(pc.EnvLighting.generateLightingSource(envSrc));
app.scene.skyboxMip = 0;
app.scene.skyboxIntensity = 1;
app.scene.ambientLight = hex('#1c1a2e'); // used only by materials without env lighting

app.scene.fog.type = pc.FOG_EXP2;
app.scene.fog.color = hex('#1d1528');
app.scene.fog.density = 0.022;

const STATIC = app.batcher.addGroup('static', false, 40).id;
const DYNAMIC = app.batcher.addGroup('flames', true, 40).id;

// Moon light with soft shadows
const moon = new pc.Entity('moon');
moon.addComponent('light', {
  type: 'directional', color: hex('#a9b8ff'), intensity: 0.8,
  castShadows: SHADOWS, shadowType: pc.SHADOW_PCF5_16F, shadowResolution: 2048,
  shadowDistance: 45, numCascades: 2, cascadeDistribution: 0.6, shadowBias: 0.25, normalOffsetBias: 0.05,
  shadowIntensity: 0.85,
});
moon.setEulerAngles(42, 25, 0);
app.root.addChild(moon);

// Street ground
const STREET_LEN = 140, HALF = 5;
const cob = cobbleTextures();
const groundMat = material({ map: cob.color, normal: cob.normal, bump: 1.2, gloss: 0.55,
  tiling: new pc.Vec2(6, STREET_LEN / 1.65) });
shape('plane', groundMat, { pos: [0, 0, -STREET_LEN / 2 + 10], scale: [HALF * 2 + 6, 1, STREET_LEN] });

// Buildings on both sides
const facades = WALLS.map((w, i) => {
  const t = facadeTextures(w, TRIMS[i]);
  return material({ map: t.color, emissiveMap: t.emissive, emissive: '#ffffff', emissiveIntensity: 2.2, gloss: 0.2 });
});
const trimMats = TRIMS.map(t => material({ color: t, gloss: 0.3 }));
const plinthMat = material({ color: '#6b5a4a', gloss: 0.25 });
for (const side of [-1, 1]) {
  let z = 8;
  while (z > -STREET_LEN + 12) {
    const w = 6 + rand() * 2.5, h = 7 + rand() * 4, d = 6, idx = Math.floor(rand() * WALLS.length);
    const x = side * (HALF + d / 2);
    shape('box', facades[idx], { pos: [x, h / 2, z - w / 2], scale: [d, h, w] });
    shape('box', trimMats[(idx + 2) % TRIMS.length], { pos: [x - side * 0.1, h + 0.35, z - w / 2], scale: [d + 0.3, 0.7, w + 0.1], batch: STATIC });
    shape('box', plinthMat, { pos: [side * (HALF - 0.25), 0.15, z - w / 2], scale: [0.5, 0.3, w], batch: STATIC });
    z -= w + 0.05;
  }
}

// Temple gopuram silhouette at the end of the street
const gopuramColors = ['#d35400', '#f1c40f', '#c0392b', '#16a085', '#e67e22', '#f39c12', '#9b59b6'];
for (let t = 0; t < 7; t++) {
  const s = 1 - t * 0.12;
  shape('box', material({ color: gopuramColors[t], gloss: 0.25, emissive: gopuramColors[t], emissiveIntensity: 0.15 }),
    { pos: [0, 2 + t * 2.4, -STREET_LEN - 6], scale: [14 * s, 2.4, 6 * s] });
}
shape('cone', material({ color: '#f5c542', metal: 1, gloss: 0.7 }), { pos: [0, 19.5, -STREET_LEN - 6], scale: [2, 2.5, 2] });

// Bulb strings (zigzag across the street) with a warm omni light per string
const BULB_COLORS = ['#ff3b3b', '#ffd23b', '#3bff6a', '#3b8bff', '#ff3bd8', '#ffffff'];
const bulbMats = BULB_COLORS.map(c => material({ color: '#000000', emissive: c, emissiveIntensity: 9, lit: false }));
const wireMat = material({ color: '#111111', gloss: 0.2 });
const tmp = new pc.Vec3();
for (let i = 0, z = 2; z > -STREET_LEN + 14; z -= 9, i++) {
  const a = new pc.Vec3(-HALF + 0.2, 6, z), b = new pc.Vec3(HALF - 0.2, 6, z - 4);
  if (i % 2) { a.z -= 4; b.z += 4; }
  const N = 13, pts = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    tmp.lerp(a, b, t);
    tmp.y -= 1.1 * 4 * t * (1 - t);
    pts.push(tmp.clone());
  }
  pts.forEach((p, k) => {
    if (k > 0 && k < N) shape('sphere', bulbMats[(k + i) % bulbMats.length], { pos: [p.x, p.y - 0.08, p.z], scale: [0.13, 0.17, 0.13], shadows: false, batch: STATIC });
    if (k < N) {
      const q = pts[k + 1], len = p.distance(q);
      const wseg = shape('box', wireMat, { pos: [(p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2], scale: [0.02, 0.02, len], shadows: false });
      wseg.lookAt(q);
      wseg.render.batchGroupId = STATIC;
    }
  });
  const mid = pts[N >> 1];
  const l = new pc.Entity();
  if (LIGHTS) l.addComponent('light', { type: 'omni', color: hex(i % 2 ? '#ffc070' : '#ff9a70'), intensity: 1.2, range: 10, castShadows: false });
  l.setPosition(mid.x, mid.y - 0.5, mid.z);
  app.root.addChild(l);
}

// Diyas (oil lamps) on the building plinths
const clayMat = material({ color: '#9c4a22', gloss: 0.3 });
const flameMat = material({ color: '#000000', emissive: '#ffa53a', emissiveIntensity: 7, lit: false });
const flames = [];
for (const side of [-1, 1]) {
  for (let z = 6, n = 0; z > -STREET_LEN + 14; z -= 2.6, n++) {
    const x = side * (HALF - 0.25), y = 0.3;
    shape('cylinder', clayMat, { pos: [x, y + 0.04, z], scale: [0.2, 0.08, 0.2], batch: STATIC });
    const f = shape('sphere', flameMat, { pos: [x, y + 0.17, z], scale: [0.07, 0.17, 0.07], shadows: false, batch: DYNAMIC });
    flames.push({ e: f, ph: rand() * 10 });
    if (n % 4 === (side > 0 ? 0 : 2)) {
      const l = new pc.Entity();
      if (LIGHTS) l.addComponent('light', { type: 'omni', color: hex('#ff9440'), intensity: 1.8, range: 3.5, castShadows: false });
      l.setPosition(x - side * 0.3, y + 0.5, z);
      app.root.addChild(l);
    }
  }
}

// ---------- hero stand-in ----------
const hero = new pc.Entity('hero');
app.root.addChild(hero);
const body = new pc.Entity('body');
hero.addChild(body);
const shirt = material({ color: '#2f63c4', gloss: 0.25 });
const veshti = material({ color: '#f3efe4', gloss: 0.15 });
const skin = material({ color: '#8a5636', gloss: 0.35 });
const hair = material({ color: '#151010', gloss: 0.5 });
const sandal = material({ color: '#4a2c1a', gloss: 0.2 });
shape('cylinder', veshti, { parent: body, pos: [0, 0.48, 0], scale: [0.5, 0.86, 0.42] });
shape('capsule', shirt, { parent: body, pos: [0, 1.2, 0], scale: [0.56, 0.78, 0.38] });
shape('sphere', skin, { parent: body, pos: [0, 1.74, 0], scale: [0.34, 0.38, 0.34] });
shape('sphere', hair, { parent: body, pos: [0, 1.86, 0.02], scale: [0.35, 0.2, 0.35] });
shape('box', hair, { parent: body, pos: [0, 1.69, -0.165], scale: [0.14, 0.03, 0.03] }); // moustache
const limbs = [];
for (const s of [-1, 1]) {
  const arm = new pc.Entity();
  arm.setLocalPosition(s * 0.34, 1.48, 0);
  body.addChild(arm);
  shape('capsule', shirt, { parent: arm, pos: [0, -0.12, 0], scale: [0.17, 0.3, 0.17] });
  shape('capsule', skin, { parent: arm, pos: [0, -0.4, 0], scale: [0.12, 0.42, 0.12] });
  const foot = shape('box', sandal, { parent: body, pos: [s * 0.12, 0.04, 0], scale: [0.13, 0.08, 0.28] });
  limbs.push({ arm, foot, s });
}

// ---------- camera + post ----------
const camera = new pc.Entity('camera');
camera.addComponent('camera', { fov: 55, nearClip: 0.1, farClip: 260, clearColor: hex('#05060f') });
app.root.addChild(camera);

let frame = null;
if (POST) {
  frame = new pc.CameraFrame(app, camera.camera);
  frame.rendering.toneMapping = pc.TONEMAP_ACES;
  frame.rendering.samples = 4;
  frame.rendering.renderTargetScale = SCALE;
  frame.bloom.intensity = 0.025;
  frame.bloom.blurLevel = 14;
  frame.bloom.threshold = 0.6;
  if (SSAO) {
    frame.ssao.type = pc.SSAOTYPE_LIGHTING;
    frame.ssao.intensity = 0.6;
    frame.ssao.radius = 1.2;
    frame.ssao.samples = 12;
  }
  frame.grading.enabled = true;
  frame.grading.saturation = 1.15;
  frame.grading.contrast = 1.05;
  frame.vignette.intensity = 0.45;
  frame.vignette.inner = 0.55;
  frame.vignette.outer = 1.25;
  frame.update();
} else {
  camera.camera.toneMapping = pc.TONEMAP_ACES;
}

// ---------- gameplay loop ----------
const kb = app.keyboard;
const pos = new pc.Vec3(0, 0, 4), vel = new pc.Vec3();
const camPos = new pc.Vec3(0, 3.6, 11.5);
let yaw = 0, vy = 0, grounded = true, phase = 0, t = 0, lastNow = 0;
const hud = document.getElementById('hud');
const frameMs = [];
window.__spike = { frameMs, ready: false, pos, drawCalls: () => app.stats.drawCalls.total };

app.on('update', (dt) => {
  const now = performance.now(); // wall-clock frame time (engine clamps dt to maxDeltaTime)
  if (lastNow) frameMs.push(now - lastNow);
  lastNow = now;
  dt = Math.min(dt, 0.1);
  t += dt;
  if (frameMs.length > 600) frameMs.shift();

  const ix = (kb.isPressed(pc.KEY_D) ? 1 : 0) - (kb.isPressed(pc.KEY_A) ? 1 : 0);
  const iz = (kb.isPressed(pc.KEY_S) ? 1 : 0) - (kb.isPressed(pc.KEY_W) ? 1 : 0);
  const moving = ix !== 0 || iz !== 0;
  const speed = 5.2;
  const inv = moving ? 1 / Math.hypot(ix, iz) : 0;
  vel.set(ix * inv * speed, 0, iz * inv * speed);
  pos.x = pc.math.clamp(pos.x + vel.x * dt, -HALF + 0.8, HALF - 0.8);
  pos.z = pc.math.clamp(pos.z + vel.z * dt, -STREET_LEN + 4, 8);
  if (grounded && kb.wasPressed(pc.KEY_SPACE)) { vy = 6; grounded = false; }
  vy -= 16 * dt;
  pos.y += vy * dt;
  if (pos.y <= 0) { pos.y = 0; vy = 0; grounded = true; }

  if (moving) {
    const target = Math.atan2(-vel.x, -vel.z) * pc.math.RAD_TO_DEG;
    let d = ((target - yaw + 540) % 360) - 180;
    yaw += d * Math.min(1, dt * 12);
    phase += dt * 11;
  } else {
    phase += (Math.round(phase / Math.PI) * Math.PI - phase) * Math.min(1, dt * 10);
  }
  hero.setPosition(pos);
  hero.setEulerAngles(0, yaw, 0);
  body.setLocalPosition(0, moving && grounded ? Math.abs(Math.sin(phase)) * 0.06 : 0, 0);
  for (const { arm, foot, s } of limbs) {
    const swing = Math.sin(phase) * s;
    arm.setLocalEulerAngles(grounded ? swing * 38 : -150, 0, s * 6);
    foot.setLocalPosition(s * 0.12, 0.04 + Math.max(0, swing) * 0.08, swing * 0.22);
  }

  // flicker the diya flames (dynamic batch keeps them cheap)
  for (const f of flames) {
    const k = 1 + Math.sin(t * 13 + f.ph) * 0.12 + Math.sin(t * 29 + f.ph * 3) * 0.06;
    f.e.setLocalScale(0.07 * (2 - k), 0.17 * k, 0.07 * (2 - k));
  }

  // chase camera behind and above
  const desired = tmp.set(pos.x * 0.6, pos.y * 0.5 + 3.6, pos.z + 7.5);
  camPos.lerp(camPos, desired, 1 - Math.exp(-dt * 5));
  camera.setPosition(camPos);
  camera.lookAt(pos.x, pos.y + 1.3, pos.z - 4);

  if ((app.frame % 15) === 0) {
    const avg = frameMs.reduce((a, b) => a + b, 0) / frameMs.length;
    hud.textContent = `PlayCanvas ${pc.version}  ${avg.toFixed(1)} ms (${(1000 / avg).toFixed(0)} fps)  draws ${app.stats.drawCalls.total}\nWASD move, Space jump  post=${POST ? 'on' : 'off'}`;
  }
});
app.once('frameend', () => { window.__spike.ready = true; });
app.start();
