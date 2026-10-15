// Turns baked mesh data into Babylon skinned meshes: Veeramani (body + photo-
// textured head on one skeleton, with rigid attachments) and the alien thieves.
import {
  Skeleton,
  Bone,
  Matrix,
  Mesh,
  VertexData,
  VertexBuffer,
  SubMesh,
  MultiMaterial,
  TransformNode,
  Quaternion,
  Vector3,
  MeshBuilder,
  DynamicTexture,
  Texture,
  Color3,
} from "../../engine/babylon.js";
import { decodeModels } from "../../engine/modelFormat.js";
import { pbr, getScene, isHeadless, hex } from "../../engine/prims.js";
import { textureSet } from "../../engine/textures.js";
import { BONES, HEAD_CENTER, HEAD_V, REGION_IDS, bodyPrims } from "./heroDesign.js";
import { makeField } from "./sdf.js";
import { ALIEN_BONES } from "../alienDesign.js";
import { HeroAnimator } from "./HeroAnimator.js";
import { clamp, lerp, smoothstep } from "../../core/math.js";

let models = null,
  faceImage = null;

export function setModels(decoded, face = null) {
  models = decoded;
  faceImage = face;
}
export async function loadCharacterAssets(base = "") {
  const [bin, face] = await Promise.all([
    fetch(`${base}assets/models.bin`).then((r) => {
      if (!r.ok) throw new Error("models.bin " + r.status);
      return r.arrayBuffer();
    }),
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `${base}assets/veeramani-face.png`;
    }),
  ]);
  setModels(decodeModels(bin), face);
}

function buildSkeleton(name, defs) {
  const scene = getScene();
  const skeleton = new Skeleton(name, name + Math.random(), scene);
  const bones = {},
    rest = {};
  defs.forEach(([n, parent, p]) => {
    rest[n] = p;
    const pp = parent ? rest[parent] : [0, 0, 0];
    bones[n] = new Bone(n, skeleton, parent ? bones[parent] : null, Matrix.Translation(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]));
  });
  return { skeleton, bones, rest };
}

function skinnedMesh(name, data, skeleton, { linearColors = true } = {}) {
  const scene = getScene();
  // Baked data is counter-clockwise (glTF convention); Babylon's default front
  // face is the opposite winding, so flip once per data set.
  if (!data.babylonWinding) {
    const I = data.indices;
    for (let i = 0; i < I.length; i += 3) [I[i + 1], I[i + 2]] = [I[i + 2], I[i + 1]];
    data.babylonWinding = true;
  }
  const m = new Mesh(name, scene);
  const vd = new VertexData();
  vd.positions = data.positions;
  vd.normals = data.normals;
  vd.indices = data.indices;
  vd.uvs = data.uvs;
  const colors = new Float32Array(data.colors);
  for (let i = 0; i < data.count; i++) {
    for (let k = 0; k < 3; k++) if (linearColors) colors[i * 4 + k] = colors[i * 4 + k] ** 2.2;
    colors[i * 4 + 3] = 1;
  }
  vd.colors = colors;
  vd.matricesIndices = data.boneIndices;
  vd.matricesWeights = data.boneWeights;
  vd.applyToMesh(m, false);
  m.skeleton = skeleton;
  m.numBoneInfluencers = 4;
  m.receiveShadows = true;
  m.isPickable = false;
  m.alwaysSelectAsActiveMesh = true; // skinned bounds would otherwise cull limbs
  return m;
}

// ---------------------------------------------------------------- face bake
function bakeHeadTexture(head) {
  const T = 1024;
  const tex = new DynamicTexture("veeramaniHead", { width: T, height: T }, getScene(), true);
  if (!faceImage) return tex;
  const ctx = tex.getContext();
  const src = document.createElement("canvas");
  src.width = faceImage.width;
  src.height = faceImage.height;
  const sctx = src.getContext("2d");
  sctx.drawImage(faceImage, 0, 0);
  const photo = sctx.getImageData(0, 0, src.width, src.height).data,
    PW = src.width;
  const k = PW / 1254; // landmarks were measured on the 1254 px source
  const S = 0.7 / (1226 * k); // model units per photo pixel
  const sample = (x, y) => {
    const px = clamp(Math.round(627 * k + x / S), 0, PW - 1),
      py = clamp(Math.round(14 * k + (0.34 - y) / S), 0, PW - 1),
      o = (py * PW + px) * 4;
    return [photo[o], photo[o + 1], photo[o + 2], photo[o + 3] / 255];
  };
  // Average cheek tone keeps unseen skin consistent with the photograph.
  let skin = [0, 0, 0],
    n = 0;
  for (let y = 700; y < 800; y += 4)
    for (const x0 of [330, 880])
      for (let x = x0; x < x0 + 60; x += 4) {
        const o = (Math.round(y * k) * PW + Math.round(x * k)) * 4;
        skin[0] += photo[o];
        skin[1] += photo[o + 1];
        skin[2] += photo[o + 2];
        n++;
      }
  skin = skin.map((c) => c / n);
  const hairline = (theta) =>
    lerp(lerp(0.2, 0.0, smoothstep(0.45, 1.3, Math.abs(theta))), -0.15, smoothstep(1.7, 2.7, Math.abs(theta)));
  const grain = (x, y) => {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  const base = (theta, x, y, z) => {
    const hl = hairline(theta) + (grain(theta * 40, 0) - 0.5) * 0.02;
    if (y > hl) {
      const g = grain(theta * 300, y * 900),
        grey = g > 0.93 ? 70 : 0; // salt-and-pepper strands
      const v = 22 + g * 16 + grey;
      return [v, v * 0.93, v * 0.88];
    }
    const shade = 0.92 + grain(x * 300, y * 300) * 0.08;
    return skin.map((c) => c * shade);
  };
  const img = ctx.getImageData(0, 0, T, T),
    out = img.data;
  const [hx, hy, hz] = HEAD_CENTER;
  // Background fill from the cylindrical parameterisation (covers UV gutters).
  for (let row = 0; row < T; row++) {
    const v = 1 - (row + 0.5) / T,
      y = lerp(HEAD_V[0], HEAD_V[1], clamp((v - 0.02) / 0.96, 0, 1));
    for (let col = 0; col < T; col++) {
      const theta = ((col + 0.5) / T - 0.5) * Math.PI * 2;
      const c = base(theta, Math.sin(theta) * 0.2, y, Math.cos(theta) * 0.2),
        o = (row * T + col) * 4;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
    }
  }
  // Rasterise every head triangle in UV space, blending the photograph on
  // front-facing surface points (projected straight onto the photo plane).
  const P = head.positions,
    N = head.normals,
    UV = head.uvs,
    I = head.indices;
  for (let t = 0; t < I.length; t += 3) {
    const ids = [I[t], I[t + 1], I[t + 2]];
    const px = ids.map((i) => UV[i * 2] * T),
      py = ids.map((i) => (1 - UV[i * 2 + 1]) * T);
    const minX = Math.floor(Math.min(...px)),
      maxX = Math.ceil(Math.max(...px)),
      minY = Math.floor(Math.min(...py)),
      maxY = Math.ceil(Math.max(...py));
    const det = (py[1] - py[2]) * (px[0] - px[2]) + (px[2] - px[1]) * (py[0] - py[2]);
    if (Math.abs(det) < 1e-9) continue;
    for (let yy = minY; yy <= maxY; yy++)
      for (let xx = minX; xx <= maxX; xx++) {
        const cx = xx + 0.5,
          cy = yy + 0.5;
        let w0 = ((py[1] - py[2]) * (cx - px[2]) + (px[2] - px[1]) * (cy - py[2])) / det,
          w1 = ((py[2] - py[0]) * (cx - px[2]) + (px[0] - px[2]) * (cy - py[2])) / det,
          w2 = 1 - w0 - w1;
        if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
        const lerp3 = (A, i) => A[ids[0] * 3 + i] * w0 + A[ids[1] * 3 + i] * w1 + A[ids[2] * 3 + i] * w2;
        const x = lerp3(P, 0) - hx,
          y = lerp3(P, 1) - hy,
          z = lerp3(P, 2) - hz,
          nz = lerp3(N, 2);
        const theta = Math.atan2(x, z);
        const b = base(theta, x, y, z);
        const ph = sample(x, y);
        const f = smoothstep(0.02, 0.38, nz) * smoothstep(-0.05, 0.05, z) * ph[3];
        const row = clamp(yy, 0, T - 1),
          col = ((xx % T) + T) % T,
          o = (row * T + col) * 4;
        out[o] = lerp(b[0], ph[0], f);
        out[o + 1] = lerp(b[1], ph[1], f);
        out[o + 2] = lerp(b[2], ph[2], f);
      }
  }
  ctx.putImageData(img, 0, 0);
  tex.update(true);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.anisotropicFilteringLevel = 8;
  return tex;
}

// ---------------------------------------------------------------- hero
const heroMaterials = {};
function heroMats() {
  if (heroMaterials.skin && heroMaterials.skin.getScene() === getScene()) return heroMaterials;
  const weave = textureSet("weave", 256, 11);
  heroMaterials.skin = pbr("heroSkin", { color: 0xffffff, rough: 0.58 });
  heroMaterials.shirt = pbr("heroShirt", { color: 0xffffff, rough: 0.9, albedo: weave.albedo, bump: weave.normal, sheen: 0.35 });
  heroMaterials.veshti = pbr("heroVeshti", { color: 0xffffff, rough: 0.92, albedo: weave.albedo, bump: weave.normal, sheen: 0.5 });
  heroMaterials.sandal = pbr("heroSandal", { color: 0xffffff, rough: 0.55 });
  for (const m of Object.values(heroMaterials)) m.metadata = { shared: true };
  if (heroMaterials.shirt.bumpTexture) {
    heroMaterials.shirt.bumpTexture.level = 0.5;
    heroMaterials.veshti.bumpTexture.level = 0.35;
  }
  return heroMaterials;
}

function regionSubmeshes(mesh, data, multi) {
  // Group triangles by the majority region id carried in vertex-colour alpha.
  const I = data.indices,
    groups = new Map();
  for (let t = 0; t < I.length; t += 3) {
    const r = [0, 1, 2].map((k) => Math.round(data.colors[I[t + k] * 4 + 3] * 255));
    const region = r[0] === r[1] || r[0] === r[2] ? r[0] : r[1];
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region).push(I[t], I[t + 1], I[t + 2]);
  }
  const ordered = [...groups.entries()].sort((a, b) => a[0] - b[0]);
  const flat = new I.constructor(I.length);
  let at = 0;
  for (const [, tris] of ordered) {
    flat.set(tris, at);
    at += tris.length;
  }
  mesh.setIndices(flat, data.count, false);
  const ids = Object.fromEntries(Object.entries(REGION_IDS).map(([k, v]) => [v, k]));
  const slot = { skin: 0, shirt: 1, collar: 1, veshti: 2, sandal: 3, hair: 0 };
  mesh.subMeshes = [];
  at = 0;
  for (const [region, tris] of ordered) {
    new SubMesh(slot[ids[region]] ?? 0, 0, data.count, at, tris.length, mesh);
    at += tris.length;
  }
  mesh.material = multi;
}

export function makeHero(parent) {
  const scene = getScene();
  const root = new TransformNode("hero", scene);
  root.parent = parent;
  const { skeleton, bones, rest } = buildSkeleton("veeramani", BONES);
  const animator = new HeroAnimator();
  const hero = { root, skeleton, bones, animator, meshes: [] };
  if (!models) return finishRig(hero, rest);
  const M = heroMats();
  const body = skinnedMesh("heroBody", models.heroBody, skeleton);
  const multi = new MultiMaterial("heroMulti", scene);
  multi.subMaterials.push(M.skin, M.shirt, M.veshti, M.sandal);
  regionSubmeshes(body, models.heroBody, multi);
  body.parent = root;
  const head = skinnedMesh("heroHead", models.heroHead, skeleton, { linearColors: false });
  const headMat = pbr("heroFace", { color: 0xffffff, rough: 0.62 });
  if (!isHeadless()) headMat.albedoTexture = bakeHeadTexture(models.heroHead);
  headMat.metadata = { ownTextures: true };
  head.material = headMat;
  head.parent = root;
  hero.meshes.push(body, head);
  // Rigid attachments authored in model space, re-expressed in bone space.
  const attach = (node, bone, x, y, z) => {
    node.attachToBone(bones[bone], body);
    node.position.set(x - rest[bone][0], y - rest[bone][1], z - rest[bone][2]);
    hero.meshes.push(node);
    return node;
  };
  const button = pbr("heroButton", { color: 0x1b1b1f, rough: 0.35 });
  for (let i = 0; i < 5; i++) {
    const b = MeshBuilder.CreateSphere("button", { diameter: 0.034, segments: 6 }, scene);
    b.scaling.z = 0.5;
    b.material = button;
    attach(b, i < 2 ? "chest" : "spine", 0, 2.28 - i * 0.17, i < 2 ? 0.262 - i * 0.004 : 0.3);
  }
  // Cloth shoulder bag on a spring-driven bone, with a strap hugging the torso.
  const field = makeField(bodyPrims());
  const hug = (p, out = 0.022) => {
    let [x, y, z] = p;
    for (let i = 0; i < 6; i++) {
      const e = 0.004,
        d = field.evaluate(x, y, z);
      const gx = field.evaluate(x + e, y, z) - field.evaluate(x - e, y, z),
        gy = field.evaluate(x, y + e, z) - field.evaluate(x, y - e, z),
        gz = field.evaluate(x, y, z + e) - field.evaluate(x, y, z - e),
        g = Math.hypot(gx, gy, gz) || 1;
      const step = d - out;
      x -= (gx / g) * step;
      y -= (gy / g) * step;
      z -= (gz / g) * step;
    }
    return new Vector3(x, y, z);
  };
  const strapMat = pbr("heroStrap", { color: 0x6e5534, rough: 0.8 });
  const front = [[-0.27, 2.43, 0.02], [-0.14, 2.2, 0.25], [0.06, 1.92, 0.3], [0.25, 1.62, 0.25], [0.37, 1.48, 0.0]].map((p) => hug(p));
  const back = [[-0.27, 2.43, 0.02], [-0.18, 2.22, -0.24], [0.04, 1.92, -0.3], [0.25, 1.65, -0.27], [0.36, 1.5, -0.12]].map((p) => hug(p));
  for (const path of [front, back]) {
    const local = path.map((v) => v.subtract(new Vector3(...rest.chest)));
    const tube = MeshBuilder.CreateTube("strap", { path: local, radius: 0.022, tessellation: 6, cap: 3 }, scene);
    tube.scaling.set(1, 1, 1);
    tube.material = strapMat;
    tube.attachToBone(bones.chest, body);
    hero.meshes.push(tube);
  }
  const bagMat = pbr("heroBag", { color: 0xb38b50, rough: 0.95, sheen: 0.3 });
  const bag = MeshBuilder.CreateSphere("bag", { diameter: 2, segments: 16 }, scene);
  bag.scaling.set(0.2, 0.25, 0.1);
  bag.material = bagMat;
  attach(bag, "bag", 0.42, 1.3, -0.08);
  const flap = MeshBuilder.CreateBox("bagFlap", { width: 0.36, height: 0.2, depth: 0.04 }, scene);
  flap.material = pbr("heroBagFlap", { color: 0x8c6a3a, rough: 0.9 });
  flap.rotation.y = Math.PI / 2;
  attach(flap, "bag", 0.53, 1.42, -0.08);
  const laddu = MeshBuilder.CreateSphere("bagLaddu", { diameter: 0.17, segments: 10 }, scene);
  laddu.material = pbr("heroLaddu", { color: 0xffbc3e, rough: 0.7, glow: 0.12 });
  attach(laddu, "bag", 0.42, 1.55, -0.06);
  for (const m of hero.meshes) {
    m.isPickable = false;
    m.receiveShadows = true;
  }
  return finishRig(hero, rest);
}

function finishRig(hero, rest) {
  const q = new Quaternion(),
    restHips = new Vector3(0, rest.hips[1], 0);
  hero.applyPose = (pose, hipY = 0) => {
    for (const [name, e] of Object.entries(pose)) {
      const bone = hero.bones[name];
      if (!bone) continue;
      Quaternion.RotationYawPitchRollToRef(e[1], e[0], e[2], q);
      bone.rotationQuaternion = q;
    }
    restHips.y = rest.hips[1] + hipY;
    hero.bones.hips.position = restHips;
  };
  hero.setVisible = (v) => hero.root.setEnabled(v);
  hero.dispose = () => {
    hero.root.dispose(false, false);
    hero.skeleton.dispose();
  };
  return hero;
}

// ---------------------------------------------------------------- aliens
let alienSource = null;
export function makeAlienRig(parent, scale = 1) {
  const scene = getScene();
  const root = new TransformNode("alien", scene);
  root.parent = parent;
  root.scaling.setAll(scale);
  const { skeleton, bones, rest } = buildSkeleton("alien", ALIEN_BONES);
  const rig = { root, skeleton, bones, meshes: [] };
  if (models) {
    if (!alienSource || alienSource.isDisposed() || alienSource.getScene() !== scene) {
      alienSource = skinnedMesh("alienSrc", models.alien, null);
      alienSource.material = pbr("alienSkin", { color: 0xffffff, rough: 0.38, sheen: 0.2 });
      alienSource.material.metadata = { shared: true };
      alienSource.material.clearCoat.isEnabled = true;
      alienSource.material.clearCoat.intensity = 0.35;
      alienSource.setEnabled(false);
      alienSource.skeleton = null;
    }
    const body = alienSource.clone("alienBody", root, true);
    body.setEnabled(true);
    body.skeleton = skeleton;
    body.parent = root;
    rig.meshes.push(body);
    const eyeMat = pbr("alienEye", { color: 0x0b1d22, rough: 0.12 });
    eyeMat.clearCoat.isEnabled = true;
    const shine = pbr("alienShine", { color: 0xffffff, glow: 1.2 });
    const add = (node, bone, x, y, z) => {
      node.attachToBone(bones[bone], body);
      node.position.set(x - rest[bone][0], y - rest[bone][1], z - rest[bone][2]);
      if (node.getBoundingInfo) rig.meshes.push(node);
      return node;
    };
    for (const s of [1, -1]) {
      const eye = MeshBuilder.CreateSphere("eye", { diameter: 2, segments: 14 }, scene);
      eye.scaling.set(0.16, 0.22, 0.09);
      eye.rotation.z = s * -0.2;
      eye.material = eyeMat;
      add(eye, "head", s * 0.22, 1.46, 0.39);
      const glint = MeshBuilder.CreateSphere("glint", { diameter: 2, segments: 6 }, scene);
      glint.scaling.set(0.04, 0.05, 0.02);
      glint.material = shine;
      add(glint, "head", s * 0.19, 1.55, 0.47);
    }
    rig.antennae = [];
    const stalkMat = pbr("alienStalk", { color: 0x70bb40, rough: 0.5 });
    const bulbMat = pbr("alienBulb", { color: 0xd7f96a, glow: 0.9, rough: 0.3 });
    for (const s of [1, -1]) {
      const a = new TransformNode("antenna", scene);
      add(a, "head", s * 0.27, 1.76, -0.02);
      const stalk = MeshBuilder.CreateCylinder("stalk", { height: 0.42, diameterTop: 0.04, diameterBottom: 0.07, tessellation: 8 }, scene);
      stalk.position.y = 0.2;
      stalk.parent = a;
      stalk.material = stalkMat;
      const bulb = MeshBuilder.CreateSphere("bulb", { diameter: 0.22, segments: 10 }, scene);
      bulb.position.y = 0.44;
      bulb.parent = a;
      bulb.material = bulbMat;
      rig.antennae.push(a);
      rig.meshes.push(stalk, bulb);
    }
    // The stolen sweet box held in both hands.
    rig.box = new TransformNode("box", scene);
    add(rig.box, "body", 0, 0.9, 0.56);
    const boxMat = pbr("alienBox", { color: 0xf5c752, rough: 0.6, glow: 0.15 });
    const ribbon = pbr("alienRibbon", { color: 0xfff4b3, rough: 0.5, glow: 0.3 });
    const b1 = MeshBuilder.CreateBox("loot", { width: 0.62, height: 0.44, depth: 0.42 }, scene);
    b1.material = boxMat;
    b1.parent = rig.box;
    const b2 = MeshBuilder.CreateBox("ribbon", { width: 0.1, height: 0.46, depth: 0.44 }, scene);
    b2.material = ribbon;
    b2.parent = rig.box;
    const b3 = MeshBuilder.CreateBox("lid", { width: 0.66, height: 0.07, depth: 0.46 }, scene);
    b3.position.y = 0.24;
    b3.material = ribbon;
    b3.parent = rig.box;
    rig.meshes.push(b1, b2, b3);
  } else {
    rig.antennae = [new TransformNode("a", scene), new TransformNode("a", scene)];
    rig.box = new TransformNode("box", scene);
    rig.box.parent = root;
  }
  // Dizzy stars orbiting above the head.
  rig.stars = new TransformNode("stars", scene);
  rig.stars.parent = root;
  rig.stars.position.y = 2.35;
  if (models) {
    const starMat = pbr("dizzy", { color: 0xffe779, glow: 1.6 });
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const s = MeshBuilder.CreatePolyhedron("star", { type: 1, size: 0.14 }, scene);
      s.position.set(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55);
      s.scaling.y = 1.4;
      s.material = starMat;
      s.parent = rig.stars;
    }
  }
  rig.stars.setEnabled(false);
  const q = new Quaternion(),
    bodyRest = new Vector3(...rest.body),
    footRest = { L: new Vector3(...rest.footL), R: new Vector3(...rest.footR) };
  // t: time, speed 0..1, stunned flag, wobble scalar.
  rig.animate = (t, speed, stunned = false, hop = 0) => {
    const B = rig.bones,
      sw = Math.sin(t * 9);
    const set = (bone, x, y, z) => {
      Quaternion.RotationYawPitchRollToRef(y, x, z, q);
      bone.rotationQuaternion = q;
    };
    set(B.body, 0.1 * speed, 0, stunned ? Math.sin(t * 10) * 0.18 : Math.sin(t * 6) * 0.12 * (0.4 + speed));
    set(B.head, stunned ? Math.sin(t * 7) * 0.2 : 0, stunned ? Math.sin(t * 5) * 0.5 : Math.sin(t * 2) * 0.15, 0);
    bodyRest.y = rest.body[1] + hop;
    B.body.position = bodyRest;
    for (const [side, k] of [["L", 1], ["R", -1]]) {
      footRest[side].z = rest["foot" + side][2] + Math.sin(t * 9 + (k > 0 ? 0 : Math.PI)) * 0.16 * speed;
      footRest[side].y = rest["foot" + side][1] + Math.max(0, Math.sin(t * 9 + (k > 0 ? 0 : Math.PI))) * 0.12 * speed;
      B["foot" + side].position = footRest[side];
      set(B["arm" + side], stunned ? -1.2 : sw * 0.05, 0, stunned ? k * 0.9 : 0);
    }
    rig.antennae.forEach((a, i) => (a.rotation.z = Math.sin(t * 9 + i) * 0.25));
    rig.box.setEnabled(!stunned);
  };
  rig.dispose = () => {
    rig.root.dispose(false, false);
    skeleton.dispose();
  };
  return rig;
}
