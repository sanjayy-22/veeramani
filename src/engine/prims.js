// Scene-building helpers on top of Babylon: cached PBR materials, shared
// geometry with GPU instancing, thin-instance batches and billboard labels.
import {
  MeshBuilder,
  Mesh,
  VertexData,
  PBRMaterial,
  StandardMaterial,
  Color3,
  TransformNode,
  Matrix,
  Quaternion,
  Vector3,
  DynamicTexture,
} from "./babylon.js";

let scene = null,
  headless = false;
const mats = new Map(),
  bases = new Map(),
  slabMats = new Map(),
  named = new Map();
const hexCache = new Map();

export function initPrims(s, isHeadless) {
  scene = s;
  headless = isHeadless;
  for (const cache of [mats, bases, slabMats, named]) cache.clear();
}
export const getScene = () => scene;
export const isHeadless = () => headless;

/** 0xRRGGBB → Color3 (linear by default, as PBR expects). */
export function hex(value, linear = true) {
  const key = value * 2 + (linear ? 1 : 0);
  if (!hexCache.has(key)) {
    const c = Color3.FromHexString("#" + value.toString(16).padStart(6, "0"));
    hexCache.set(key, linear ? c.toLinearSpace() : c);
  }
  return hexCache.get(key).clone();
}

export function pbr(name, { color = 0xffffff, rough = 0.85, metal = 0, glow = 0, albedo, bump, alpha = 1, sheen = 0 } = {}) {
  const m = new PBRMaterial(name, scene);
  m.albedoColor = hex(color);
  m.metallic = metal;
  m.roughness = rough;
  if (glow > 0) {
    m.emissiveColor = hex(color);
    m.emissiveIntensity = glow;
  }
  if (albedo) m.albedoTexture = albedo;
  if (bump) {
    m.bumpTexture = bump;
    m.bumpTexture.level = 0.9;
  }
  if (sheen) {
    m.sheen.isEnabled = true;
    m.sheen.intensity = sheen;
    m.sheen.color = new Color3(1, 1, 1);
  }
  if (alpha < 1) {
    m.alpha = alpha;
    m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  }
  m.environmentIntensity = 0.6;
  return m;
}

export function mat(color, glow = 0) {
  const key = color + ":" + glow;
  if (!mats.has(key)) {
    // Faint "glow" values only brighten the surface; real emitters (≥0.5) feed the glow layer.
    const m = pbr("m" + key, { color, glow: glow >= 0.5 ? glow * 0.9 : 0, rough: glow > 0.5 ? 0.4 : 0.82 });
    if (glow > 0 && glow < 0.5) {
      m.emissiveColor = hex(color).scale(glow * 0.6);
      m.emissiveIntensity = 1;
    }
    m.freeze?.();
    mats.set(key, m);
  }
  return mats.get(key);
}

function octahedron() {
  const p = [1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1];
  const f = [0, 2, 4, 0, 5, 2, 0, 4, 3, 0, 3, 5, 1, 4, 2, 1, 2, 5, 1, 3, 4, 1, 5, 3];
  const positions = [],
    indices = [];
  for (let i = 0; i < f.length; i++) {
    positions.push(p[f[i] * 3], p[f[i] * 3 + 1], p[f[i] * 3 + 2]);
    indices.push(i);
  }
  const normals = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const vd = new VertexData();
  Object.assign(vd, { positions, indices, normals });
  return vd;
}

function baseMesh(kind) {
  let m;
  if (kind === "box") m = MeshBuilder.CreateBox(kind, { size: 1 }, scene);
  else if (kind === "sphere") m = MeshBuilder.CreateSphere(kind, { diameter: 2, segments: 14 }, scene);
  else if (kind === "ico") m = MeshBuilder.CreateIcoSphere(kind, { radius: 1, subdivisions: 1, flat: true }, scene);
  else if (kind === "cone")
    m = MeshBuilder.CreateCylinder(kind, { height: 1, diameterTop: 0, diameterBottom: 2, tessellation: 12 }, scene);
  else if (kind === "cylinder") m = MeshBuilder.CreateCylinder(kind, { height: 1, diameter: 2, tessellation: 18 }, scene);
  else if (kind === "torus") {
    // Same orientation as before: ring in the XY plane (rotate x by -π/2 to lay flat).
    m = MeshBuilder.CreateTorus(kind, { diameter: 2, thickness: 0.24, tessellation: 40 }, scene);
    m.rotation.x = Math.PI / 2;
    m.bakeCurrentTransformIntoVertices();
  } else {
    m = new Mesh(kind, scene);
    octahedron().applyToMesh(m);
  }
  return m;
}

/** Shared geometry per (kind, material); everything else is a GPU instance. */
function source(kind, material) {
  const key = kind + "|" + material.name;
  if (!bases.has(key)) {
    const m = baseMesh(kind);
    m.name = "src:" + key;
    m.material = material;
    m.receiveShadows = true;
    m.position.y = -10000; // the source itself stays out of view
    m.isPickable = false;
    bases.set(key, m);
    scene.metadata?.renderer?.addCaster(m, false);
  }
  return bases.get(key);
}

export function group(parent, x = 0, y = 0, z = 0) {
  const g = new TransformNode("g", scene);
  g.parent = parent;
  g.position.set(x, y, z);
  return g;
}

/** Instanced primitive. Pass {solo:true} to get a real mesh with its own material. */
export function mesh(parent, kind, color, pos = [0, 0, 0], scale = [1, 1, 1], glow = 0, opts = {}) {
  let m;
  if (opts.solo) {
    m = baseMesh(kind);
    m.material = opts.material || pbr("solo", { color, glow: glow * 1.6 });
    m.receiveShadows = true;
    if (opts.cast !== false) scene.metadata?.renderer?.addCaster(m, false);
  } else {
    m = source(kind, opts.material || mat(color, glow)).createInstance("i");
  }
  m.parent = parent;
  m.position.set(pos[0], pos[1], pos[2]);
  m.scaling.set(scale[0], scale[1], scale[2]);
  m.isPickable = false;
  return m;
}

export function flatRing(parent, x, z, r, color, glow = 0.25) {
  const m = mesh(parent, "torus", color, [x, 0.03, z], [r, r, r], glow);
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** Many static copies in one draw call: items are [x,y,z,sx,sy,sz,rotY]. */
export function instanced(parent, kind, color, items, glow = 0, material) {
  const m = baseMesh(kind);
  m.material = material || mat(color, glow);
  m.parent = parent;
  m.receiveShadows = true;
  m.isPickable = false;
  const buffer = new Float32Array(items.length * 16);
  const s = new Vector3(),
    t = new Vector3(),
    q = new Quaternion(),
    mtx = new Matrix();
  items.forEach((a, i) => {
    s.set(a[3] ?? 1, a[4] ?? a[3] ?? 1, a[5] ?? a[3] ?? 1);
    t.set(a[0], a[1], a[2]);
    Quaternion.RotationYawPitchRollToRef(a[6] || 0, 0, 0, q);
    Matrix.ComposeToRef(s, q, t, mtx);
    mtx.copyToArray(buffer, i * 16);
  });
  m.thinInstanceSetBuffer("matrix", buffer, 16, true);
  m.alwaysSelectAsActiveMesh = items.length > 0;
  return m;
}

export function setVisible(node, visible) {
  node.setEnabled(visible);
}

/** Camera-facing text label (hub portal names). */
export function label(parent, text, x, y, z, color, width = 8) {
  const plane = MeshBuilder.CreatePlane("label", { width, height: width / 8 }, scene);
  plane.parent = parent;
  plane.position.set(x, y, z);
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  if (headless) return plane;
  const tex = new DynamicTexture("labelTex", { width: 1024, height: 128 }, scene, true);
  tex.hasAlpha = true;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 1024, 128);
  ctx.font = "900 62px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(6,20,30,0.75)";
  ctx.strokeText(text, 512, 86);
  ctx.fillStyle = color;
  ctx.fillText(text, 512, 86);
  tex.update();
  const m = new StandardMaterial("labelMat", scene);
  m.diffuseTexture = tex;
  m.emissiveTexture = tex;
  m.opacityTexture = tex;
  m.disableLighting = true;
  m.backFaceCulling = false;
  m.disableDepthWrite = true;
  m.metadata = { ownTextures: true };
  plane.material = m;
  plane.applyFog = false;
  return plane;
}

/** Disposes a level's nodes while keeping shared sources and cached materials. */
export function disposeChildren(root) {
  const shared = new Set(mats.values());
  for (const child of root.getChildren(undefined, true)) {
    const owned = [child, ...(child.getChildMeshes?.(false) || [])];
    for (const m of owned)
      if (m.material && !shared.has(m.material) && !m.isAnInstance && !m.material.metadata?.shared)
        m.material.dispose(false, !!m.material.metadata?.ownTextures);
    child.dispose(false, false);
  }
}

/** Textured PBR material (procedural set from textures.js) tinted by colour. */
export function surfaceMat(kind, color, rough = 0.9, textureSet) {
  const key = kind + ":" + color + ":" + rough;
  if (!slabMats.has(key)) {
    const set = textureSet ? textureSet(kind) : {};
    const m = pbr("surf" + key, { color, rough, albedo: set.albedo, bump: set.normal });
    m.metadata = { shared: true };
    slabMats.set(key, m);
  }
  return slabMats.get(key);
}
/**
 * Box with world-scaled, per-face planar UVs so tiling textures keep a
 * constant texel density on any size of wall, slab or floor.
 */
export function slab(parent, [x, y, z], [w, h, d], material, tile = 4) {
  const m = MeshBuilder.CreateBox("slab", { width: w, height: h, depth: d }, scene);
  const pos = m.getVerticesData("position"),
    nor = m.getVerticesData("normal"),
    uv = new Float32Array((pos.length / 3) * 2);
  for (let i = 0; i < pos.length / 3; i++) {
    const px = pos[i * 3] + x,
      py = pos[i * 3 + 1] + y,
      pz = pos[i * 3 + 2] + z,
      ax = Math.abs(nor[i * 3]),
      ay = Math.abs(nor[i * 3 + 1]);
    const [u, v] = ay > 0.5 ? [px, pz] : ax > 0.5 ? [pz, py] : [px, py];
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  m.setVerticesData("uv", uv);
  m.parent = parent;
  m.position.set(x, y, z);
  m.material = material;
  m.receiveShadows = true;
  m.isPickable = false;
  m.freezeWorldMatrix?.();
  if (h > 0.5) scene.metadata?.renderer?.addCaster(m, false);
  return m;
}

/** A PBR material created once and kept across levels (safe for instancing). */
export function sharedPbr(name, opts) {
  if (!named.has(name) || named.get(name).getScene() !== scene) {
    const m = pbr(name, opts);
    m.metadata = { shared: true };
    named.set(name, m);
  }
  return named.get(name);
}
