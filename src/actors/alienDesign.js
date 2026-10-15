// The sweet thieves: soft-bodied green aliens sculpted as one skinned surface.
// Model space, feet at y=0, facing +Z. Baked offline with the hero.
import { cone, ellipsoid, makeField, surfaceNets, skinWeights } from "./hero/sdf.js";
import { smoothstep } from "../core/math.js";

export const ALIEN_BONES = [
  ["root", null, [0, 0, 0]],
  ["body", "root", [0, 0.45, 0]],
  ["head", "body", [0, 1.05, 0]],
  ["armL", "body", [0.4, 0.95, 0.05]],
  ["armR", "body", [-0.4, 0.95, 0.05]],
  ["footL", "root", [0.24, 0.2, 0.05]],
  ["footR", "root", [-0.24, 0.2, 0.05]],
];

export function alienPrims() {
  const P = [];
  const add = (p, bone, region, k) => (P.push(Object.assign(p, { bone, region }, k == null ? {} : { k })), p);
  add(ellipsoid([0, 0.78, 0], [0.42, 0.5, 0.36]), "body", "skin", 0);
  add(ellipsoid([0, 0.72, 0.12], [0.3, 0.33, 0.25]), "body", "belly", 0.08);
  add(ellipsoid([0, 1.42, 0.02], [0.6, 0.45, 0.44]), "head", "skin", 0.18);
  add(ellipsoid([0, 1.2, 0.36], [0.16, 0.05, 0.06], { sub: true }), "head", "mouth", 0.04);
  for (const s of [1, -1]) {
    const n = s > 0 ? "L" : "R";
    add(cone([s * 0.38, 0.98, 0.05], [s * 0.42, 0.86, 0.36], 0.11, 0.09), "arm" + n, "skin", 0.06);
    add(ellipsoid([s * 0.4, 0.88, 0.42], [0.1, 0.1, 0.1]), "arm" + n, "skin", 0.04);
    add(cone([s * 0.22, 0.42, 0.0], [s * 0.24, 0.2, 0.06], 0.1, 0.11), "foot" + n, "skin", 0.08);
    add(ellipsoid([s * 0.25, 0.13, 0.12], [0.17, 0.13, 0.25]), "foot" + n, "foot", 0.05);
    add(ellipsoid([s * 0.2, 1.68, -0.02], [0.08, 0.12, 0.08]), "head", "skin", 0.08);
  }
  return P;
}

const COLORS = {
  skin: [0.42, 0.78, 0.25],
  belly: [0.72, 0.9, 0.45],
  foot: [0.27, 0.6, 0.24],
  mouth: [0.12, 0.28, 0.17],
};

export function buildAlienData(cell = 0.03) {
  const field = makeField(alienPrims());
  const mesh = surfaceNets(field, cell);
  const map = Object.fromEntries(ALIEN_BONES.map(([n], i) => [n, i]));
  const skin = skinWeights(field, mesh, map, 0.06);
  const colors = new Float32Array(mesh.count * 4);
  for (let v = 0; v < mesh.count; v++) {
    const region = field.prims[mesh.owner[v]].region;
    const y = mesh.positions[v * 3 + 1],
      z = mesh.positions[v * 3 + 2];
    let c = COLORS[region] || COLORS.skin;
    // Darken the mouth crease and add a soft top-to-bottom gradient.
    if (z > 0.28 && Math.abs(y - 1.2) < 0.045) c = COLORS.mouth;
    const g = 0.85 + 0.15 * smoothstep(0.2, 1.8, y);
    colors.set([c[0] * g, c[1] * g, c[2] * g, 1], v * 4);
  }
  const uvs = new Float32Array(mesh.count * 2);
  return { ...mesh, boneIndices: skin.indices, boneWeights: skin.weights, colors, uvs };
}
