// Veeramani's sculpt and rig, in model space: feet at y=0, facing +Z, the
// character's left side is +X. Engine-agnostic; HeroBuilder turns it into a
// skinned mesh. Units match gameplay collision (head top ≈ 3.15).
import { cone, ellipsoid, box, makeField, surfaceNets, skinWeights } from "./sdf.js";
import { smoothstep, clamp, lerp } from "../../core/math.js";

export const HEAD_CENTER = [0, 2.83, 0.0];

// name, parent, rest position (model space)
export const BONES = [
  ["root", null, [0, 0, 0]],
  ["hips", "root", [0, 1.02, 0]],
  ["spine", "hips", [0, 1.42, 0]],
  ["chest", "spine", [0, 1.88, 0]],
  ["neck", "chest", [0, 2.42, -0.01]],
  ["head", "neck", [0, 2.6, 0]],
  ["bag", "chest", [0.36, 2.3, 0]],
];
for (const [s, n] of [
  [1, "L"],
  [-1, "R"],
]) {
  BONES.push(
    ["clav" + n, "chest", [s * 0.1, 2.3, 0]],
    ["upperArm" + n, "clav" + n, [s * 0.4, 2.24, -0.01]],
    ["foreArm" + n, "upperArm" + n, [s * 0.485, 1.8, -0.015]],
    ["hand" + n, "foreArm" + n, [s * 0.55, 1.39, 0.02]],
    ["thigh" + n, "hips", [s * 0.17, 0.98, 0]],
    ["shin" + n, "thigh" + n, [s * 0.178, 0.55, 0.01]],
    ["foot" + n, "shin" + n, [s * 0.18, 0.1, -0.005]],
  );
}

export function bodyPrims() {
  const P = [];
  const add = (p, bone, region, k) => (P.push(Object.assign(p, { bone, region }, k == null ? {} : { k })), p);
  // Veshti first so shirt/arms blend on top of its waist fold.
  add(cone([0, 1.2, 0], [0, 0.17, 0.0], 0.405, 0.44, { squash: [1, 0.74] }), "hips", "veshti", 0.0);
  add(ellipsoid([0, 1.17, 0.01], [0.425, 0.06, 0.31]), "hips", "veshti", 0.03);
  add(ellipsoid([0, 1.12, -0.01], [0.37, 0.22, 0.25]), "hips", "veshti", 0.05);
  // Flat hem: carve everything authored so far below the ankle line.
  add(box([0, -0.4, 0], [1, 0.57, 1], 0, { sub: true }), "hips", "veshti", 0.015);
  // Torso: a sturdy build, slight belly, broad shoulders.
  add(ellipsoid([0, 1.47, 0.03], [0.385, 0.32, 0.275]), "spine", "shirt", 0.12);
  add(ellipsoid([0, 1.93, 0.0], [0.43, 0.4, 0.265]), "chest", "shirt", 0.14);
  // Untucked shirt hem: a crisp lip that overhangs the veshti's waist fold.
  add(ellipsoid([0, 1.27, 0.02], [0.405, 0.055, 0.3]), "spine", "shirt", 0.02);
  add(cone([-0.3, 2.17, -0.01], [0.3, 2.17, -0.01], 0.17, 0.17), "chest", "shirt", 0.12);
  add(ellipsoid([0, 2.25, -0.06], [0.24, 0.12, 0.16]), "chest", "shirt", 0.1);
  // Shirt collar: a firm band around the neck base, small blend radius.
  add(ellipsoid([0, 2.355, -0.005], [0.17, 0.05, 0.155]), "chest", "collar", 0.02);
  add(cone([0, 2.3, -0.005], [0, 2.66, 0.0], 0.112, 0.104), "neck", "skin", 0.018);
  for (const s of [1, -1]) {
    const n = s > 0 ? "L" : "R";
    add(ellipsoid([s * 0.39, 2.2, -0.01], [0.17, 0.17, 0.165]), "upperArm" + n, "shirt", 0.09);
    add(cone([s * 0.405, 2.2, -0.01], [s * 0.47, 1.87, -0.015], 0.14, 0.12), "upperArm" + n, "shirt", 0.06);
    add(cone([s * 0.466, 1.9, -0.015], [s * 0.474, 1.86, -0.015], 0.128, 0.13), "upperArm" + n, "shirt", 0.012);
    add(cone([s * 0.485, 1.84, -0.015], [s * 0.548, 1.43, 0.02], 0.09, 0.068), "foreArm" + n, "skin", 0.03);
    add(ellipsoid([s * 0.565, 1.3, 0.025], [0.05, 0.1, 0.074]), "hand" + n, "skin", 0.05);
    add(cone([s * 0.535, 1.37, 0.075], [s * 0.528, 1.28, 0.1], 0.027, 0.021), "hand" + n, "skin", 0.02);
    add(cone([s * 0.17, 0.98, 0], [s * 0.178, 0.55, 0.01], 0.13, 0.088), "thigh" + n, "skin", 0.05);
    add(cone([s * 0.178, 0.55, 0.01], [s * 0.18, 0.12, -0.005], 0.08, 0.058), "shin" + n, "skin", 0.05);
    add(ellipsoid([s * 0.183, 0.065, 0.07], [0.072, 0.05, 0.15]), "foot" + n, "skin", 0.05);
    add(box([s * 0.183, 0.016, 0.07], [0.085, 0.016, 0.175], 0.012), "foot" + n, "sandal", 0.01);
    add(cone([s * 0.12, 0.085, 0.13], [s * 0.245, 0.085, 0.13], 0.018, 0.018), "foot" + n, "sandal", 0.01);
  }
  return P;
}

// Head authored around its centre (photo-aligned: hair top +0.34, chin -0.36).
export function headPrims() {
  const P = [];
  const add = (p, region = "skin", k, bone = "head") =>
    (P.push(Object.assign(p, { bone, region }, k == null ? {} : { k })), p);
  add(ellipsoid([0, 0.04, -0.03], [0.205, 0.29, 0.235]), "skin", 0);
  add(ellipsoid([0, 0.11, -0.05], [0.213, 0.245, 0.237]), "hair", 0.03);
  add(ellipsoid([0, -0.13, 0.03], [0.188, 0.21, 0.185]), "skin", 0.09);
  add(ellipsoid([0, -0.3, 0.11], [0.1, 0.07, 0.085]), "skin", 0.07);
  for (const s of [1, -1]) {
    add(ellipsoid([s * 0.11, -0.085, 0.135], [0.08, 0.07, 0.07]), "skin", 0.07);
    add(ellipsoid([s * 0.205, -0.07, -0.005], [0.03, 0.085, 0.05]), "skin", 0.025);
    add(ellipsoid([s * 0.036, -0.078, 0.21], [0.03, 0.024, 0.03]), "skin", 0.02);
    add(ellipsoid([s * 0.095, 0.003, 0.238], [0.052, 0.03, 0.04], { sub: true }), "skin", 0.035);
  }
  add(cone([-0.12, 0.066, 0.17], [0.12, 0.066, 0.17], 0.034, 0.034), "skin", 0.05);
  add(cone([0, 0.0, 0.198], [0, -0.066, 0.252], 0.024, 0.036), "skin", 0.035);
  add(ellipsoid([0, -0.182, 0.183], [0.074, 0.03, 0.035]), "skin", 0.03);
  add(cone([0, -0.27, -0.045], [0, -0.5, -0.035], 0.112, 0.118), "skin", 0.05, "neck");
  // Translate into model space.
  const [hx, hy, hz] = HEAD_CENTER;
  for (const p of P) {
    for (const key of ["a", "b", "c"])
      if (p[key]) p[key] = [p[key][0] + hx, p[key][1] + hy, p[key][2] + hz];
    if (p.type === "cone") p.len2 = (p.b[0] - p.a[0]) ** 2 + (p.b[1] - p.a[1]) ** 2 + (p.b[2] - p.a[2]) ** 2;
  }
  return P;
}

// Colour palette in linear-ish sRGB 0..1 (converted by the engine layer).
// Region ids travel in the vertex-colour alpha byte of the baked asset.
export const REGION_IDS = { skin: 0, shirt: 1, collar: 2, veshti: 3, sandal: 4, hair: 5 };
export const PALETTE = {
  skin: [0.56, 0.38, 0.28],
  shirt: [0.2, 0.38, 0.62],
  shirtDark: [0.13, 0.26, 0.45],
  collar: [0.26, 0.45, 0.68],
  veshti: [0.95, 0.93, 0.87],
  gold: [0.83, 0.64, 0.29],
  sandal: [0.2, 0.12, 0.07],
  hair: [0.07, 0.06, 0.055],
};

// Fine surface detail painted into vertex colours: placket, pockets, borders.
export function bodyColor(region, x, y, z) {
  const P = PALETTE;
  if (region === "shirt") {
    const placket = Math.abs(x) < 0.028 && z > 0 && y > 1.2;
    const pocket =
      z > 0.05 &&
      Math.abs(Math.abs(x) - 0.2) < 0.095 &&
      y > 1.86 &&
      y < 2.12 &&
      (Math.abs(Math.abs(x) - 0.2) > 0.075 || y < 1.885 || y > 2.095);
    return placket || pocket ? P.shirtDark : P.shirt;
  }
  if (region === "collar") return P.collar;
  if (region === "veshti") {
    const hemBand = y > 0.2 && y < 0.27;
    const foldLine = Math.abs(x - 0.13) < 0.018 && z > 0;
    const waist = y > 1.16 && y < 1.19;
    return hemBand || foldLine || waist ? P.gold : P.veshti;
  }
  if (region === "sandal") return P.sandal;
  return P.skin;
}

// Cloth that hangs from the hips but swings with the thighs near the hem.
function veshtiWeights(x, y, z, prim) {
  if (prim.region !== "veshti") return null;
  const t = clamp((1.12 - y) / (1.12 - 0.17), 0, 1);
  const left = smoothstep(-0.14, 0.14, x);
  const leg = t * 0.62;
  const shin = t * t * 0.25;
  return [
    ["hips", 1 - leg],
    ["thighL", (leg - shin) * left],
    ["thighR", (leg - shin) * (1 - left)],
    ["shinL", shin * left],
    ["shinR", shin * (1 - left)],
  ].filter(([, w]) => w > 1e-3);
}

export function boneIndexMap() {
  return Object.fromEntries(BONES.map(([n], i) => [n, i]));
}

export function buildBodyData(cell = 0.022) {
  const field = makeField(bodyPrims());
  const mesh = surfaceNets(field, cell);
  const skin = skinWeights(field, mesh, boneIndexMap(), 0.045, veshtiWeights);
  const colors = new Float32Array(mesh.count * 4);
  const regions = new Array(mesh.count);
  for (let v = 0; v < mesh.count; v++) {
    const region = field.prims[mesh.owner[v]].region;
    regions[v] = region;
    const c = bodyColor(region, mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]);
    colors.set([c[0], c[1], c[2], REGION_IDS[region] / 255], v * 4);
  }
  // Cylindrical UVs for the tiling fabric detail texture (≈ 1 tile per 0.25 units).
  const uvs = new Float32Array(mesh.count * 2);
  for (let v = 0; v < mesh.count; v++) {
    const x = mesh.positions[v * 3],
      y = mesh.positions[v * 3 + 1],
      z = mesh.positions[v * 3 + 2];
    uvs[v * 2] = (Math.atan2(x, z) / (2 * Math.PI)) * 6;
    uvs[v * 2 + 1] = y * 4;
  }
  return { ...mesh, boneIndices: skin.indices, boneWeights: skin.weights, colors, regions, uvs };
}

export const HEAD_V = [-0.5, 0.37]; // head-local y range mapped to texture v
export function buildHeadData(cell = 0.0085) {
  const field = makeField(headPrims());
  const mesh = surfaceNets(field, cell);
  const skin = skinWeights(field, mesh, boneIndexMap(), 0.03);
  const [hx, hy, hz] = HEAD_CENTER;
  // Cylindrical UV around the head axis; the bake fills it from the photo.
  let uvs = new Float32Array(mesh.count * 2);
  for (let v = 0; v < mesh.count; v++) {
    const x = mesh.positions[v * 3] - hx,
      y = mesh.positions[v * 3 + 1] - hy,
      z = mesh.positions[v * 3 + 2] - hz;
    uvs[v * 2] = 0.5 + Math.atan2(x, z) / (2 * Math.PI);
    uvs[v * 2 + 1] = lerp(0.02, 0.98, clamp((y - HEAD_V[0]) / (HEAD_V[1] - HEAD_V[0]), 0, 1));
  }
  // Duplicate vertices of triangles that straddle the back seam (u wraps 1→0).
  const extra = [];
  const idx = Array.from(mesh.indices);
  const dup = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const us = [0, 1, 2].map((k) => uvs[idx[t + k] * 2]);
    if (Math.max(...us) - Math.min(...us) < 0.5) continue;
    for (let k = 0; k < 3; k++) {
      const v = idx[t + k];
      if (uvs[v * 2] >= 0.5) continue;
      if (!dup.has(v)) {
        dup.set(v, mesh.count + extra.length);
        extra.push(v);
      }
      idx[t + k] = dup.get(v);
    }
  }
  const total = mesh.count + extra.length;
  const grow = (arr, size) => {
    const out = new arr.constructor(total * size);
    out.set(arr);
    extra.forEach((src, i) => {
      for (let s = 0; s < size; s++) out[(mesh.count + i) * size + s] = arr[src * size + s];
    });
    return out;
  };
  const positions = grow(mesh.positions, 3),
    normals = grow(mesh.normals, 3),
    indices2 = grow(skin.indices, 4),
    weights = grow(skin.weights, 4);
  uvs = grow(uvs, 2);
  extra.forEach((_, i) => (uvs[(mesh.count + i) * 2] += 1));
  return {
    positions,
    normals,
    uvs,
    indices: total > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
    boneIndices: indices2,
    boneWeights: weights,
    count: total,
  };
}
