// Engine-agnostic signed-distance sculpting and Naive Surface Nets meshing.
// A character is a list of primitives bound to bones; the mesher returns one
// continuous, watertight surface with per-vertex region and bone weights.

const smin = (a, b, k) => {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

// Primitive distance functions. All take local point (x,y,z) and the primitive.
function dCone(p, x, y, z) {
  // Capsule with linearly interpolated radius ("round cone" approximation).
  const [ax, ay, az] = p.a,
    bx = p.b[0] - ax,
    by = p.b[1] - ay,
    bz = p.b[2] - az;
  const px = x - ax,
    py = y - ay,
    pz = z - az;
  const t = Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / p.len2));
  const r = p.ra + (p.rb - p.ra) * t;
  let dx = px - bx * t,
    dy = py - by * t,
    dz = pz - bz * t;
  if (p.squash) {
    // Elliptic cross-section: scale the perpendicular offset.
    dx /= p.squash[0];
    dz /= p.squash[1];
    return (Math.hypot(dx, dy, dz) - r) * Math.min(p.squash[0], p.squash[1]);
  }
  return Math.hypot(dx, dy, dz) - r;
}
function dEllipsoid(p, x, y, z) {
  const [cx, cy, cz] = p.c,
    [rx, ry, rz] = p.r;
  const qx = (x - cx) / rx,
    qy = (y - cy) / ry,
    qz = (z - cz) / rz;
  const k0 = Math.hypot(qx, qy, qz);
  const k1 = Math.hypot(qx / rx, qy / ry, qz / rz);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
}
function dBox(p, x, y, z) {
  const qx = Math.abs(x - p.c[0]) - p.h[0] + p.round,
    qy = Math.abs(y - p.c[1]) - p.h[1] + p.round,
    qz = Math.abs(z - p.c[2]) - p.h[2] + p.round;
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) +
    Math.min(Math.max(qx, qy, qz), 0) -
    p.round
  );
}
const FN = { cone: dCone, ellipsoid: dEllipsoid, box: dBox };

export function cone(a, b, ra, rb, opts = {}) {
  const len2 =
    (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2 || 1e-9;
  return { type: "cone", a, b, ra, rb, len2, ...opts };
}
export const ellipsoid = (c, r, opts = {}) => ({
  type: "ellipsoid",
  c,
  r,
  ...opts,
});
export const box = (c, h, round = 0.02, opts = {}) => ({
  type: "box",
  c,
  h,
  round,
  ...opts,
});

function bounds(p) {
  if (p.type === "cone") {
    const r = Math.max(p.ra, p.rb) * (p.squash ? Math.max(...p.squash) : 1);
    return [0, 1, 2].map((i) => [
      Math.min(p.a[i], p.b[i]) - r,
      Math.max(p.a[i], p.b[i]) + r,
    ]);
  }
  if (p.type === "ellipsoid")
    return [0, 1, 2].map((i) => [p.c[i] - p.r[i], p.c[i] + p.r[i]]);
  return [0, 1, 2].map((i) => [p.c[i] - p.h[i], p.c[i] + p.h[i]]);
}

/**
 * Builds an evaluator for a list of primitives. Each primitive may carry:
 *  k: smooth-blend radius with what came before, sub: carve instead of add,
 *  bone: skeleton bone name, region: material/colour region tag.
 */
export function makeField(prims) {
  for (const p of prims) {
    p.fn = FN[p.type];
    p.k ??= 0.06;
    p.box = bounds(p);
  }
  const dist = new Float64Array(prims.length);
  // Returns blended distance; fills `dist` with raw per-primitive distances.
  function evaluate(x, y, z, raw = false) {
    let d = Infinity;
    for (let i = 0; i < prims.length; i++) {
      const p = prims[i];
      // Cheap AABB early-out keeps far primitives from costing a full evaluation.
      const b = p.box,
        m = p.k + 0.02;
      let di;
      if (
        !raw &&
        !p.sub &&
        (x < b[0][0] - m ||
          x > b[0][1] + m ||
          y < b[1][0] - m ||
          y > b[1][1] + m ||
          z < b[2][0] - m ||
          z > b[2][1] + m)
      ) {
        const ox = Math.max(b[0][0] - x, x - b[0][1], 0),
          oy = Math.max(b[1][0] - y, y - b[1][1], 0),
          oz = Math.max(b[2][0] - z, z - b[2][1], 0);
        di = Math.hypot(ox, oy, oz); // lower bound, far outside the blend range
      } else di = p.fn(p, x, y, z);
      dist[i] = di;
      if (p.sub) d = -smin(-d, di, p.k);
      else d = d === Infinity ? di : smin(d, di, p.k);
    }
    return d;
  }
  return { prims, evaluate, dist };
}

/**
 * Naive Surface Nets over the field's bounds.
 * Returns { positions, normals, indices, owner } where owner[i] is the index of
 * the closest primitive to vertex i (used for colour regions and skin weights).
 */
export function surfaceNets(field, cell, pad = 0.05) {
  const { prims, evaluate, dist } = field;
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (const p of prims) {
    if (p.sub) continue;
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], p.box[i][0] - pad);
      hi[i] = Math.max(hi[i], p.box[i][1] + pad);
    }
  }
  const nx = Math.ceil((hi[0] - lo[0]) / cell) + 1,
    ny = Math.ceil((hi[1] - lo[1]) / cell) + 1,
    nz = Math.ceil((hi[2] - lo[2]) / cell) + 1;
  const sx = 1,
    sy = nx,
    sz = nx * ny;
  const values = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++)
        values[i + j * sy + k * sz] = evaluate(
          lo[0] + i * cell,
          lo[1] + j * cell,
          lo[2] + k * cell,
        );

  const vertexOf = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [];
  const corners = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
  ];
  const edges = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const [a, b, d] = corners[c];
          cv[c] = values[i + a + (j + b) * sy + (k + d) * sz];
          if (cv[c] < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let x = 0,
          y = 0,
          z = 0,
          n = 0;
        for (const [e0, e1] of edges) {
          const v0 = cv[e0],
            v1 = cv[e1];
          if (v0 < 0 === v1 < 0) continue;
          const t = v0 / (v0 - v1),
            A = corners[e0],
            B = corners[e1];
          x += A[0] + (B[0] - A[0]) * t;
          y += A[1] + (B[1] - A[1]) * t;
          z += A[2] + (B[2] - A[2]) * t;
          n++;
        }
        vertexOf[i + j * sy + k * sz] = pos.length / 3;
        pos.push(
          lo[0] + (i + x / n) * cell,
          lo[1] + (j + y / n) * cell,
          lo[2] + (k + z / n) * cell,
        );
      }

  const indices = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    // Counter-clockwise when viewed from outside (matches gradient normals).
    if (flip) indices.push(a, b, c, a, c, d);
    else indices.push(a, c, b, a, d, c);
  };
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const o = i + j * sy + k * sz,
          inside = values[o] < 0;
        // x-edge: cells sharing it vary in j,k
        if (inside !== values[o + sx] < 0)
          quad(
            vertexOf[o],
            vertexOf[o - sy],
            vertexOf[o - sy - sz],
            vertexOf[o - sz],
            inside,
          );
        if (inside !== values[o + sy] < 0)
          quad(
            vertexOf[o],
            vertexOf[o - sz],
            vertexOf[o - sx - sz],
            vertexOf[o - sx],
            inside,
          );
        if (inside !== values[o + sz] < 0)
          quad(
            vertexOf[o],
            vertexOf[o - sx],
            vertexOf[o - sx - sy],
            vertexOf[o - sy],
            inside,
          );
      }

  // Project vertices onto the true surface and take analytic-gradient normals.
  const count = pos.length / 3,
    positions = new Float32Array(pos),
    normals = new Float32Array(count * 3),
    owner = new Int32Array(count),
    e = cell * 0.25;
  for (let v = 0; v < count; v++) {
    let x = positions[v * 3],
      y = positions[v * 3 + 1],
      z = positions[v * 3 + 2];
    let gx = 0,
      gy = 0,
      gz = 0;
    for (let it = 0; it < 2; it++) {
      const d = evaluate(x, y, z);
      gx = evaluate(x + e, y, z) - evaluate(x - e, y, z);
      gy = evaluate(x, y + e, z) - evaluate(x, y - e, z);
      gz = evaluate(x, y, z + e) - evaluate(x, y, z - e);
      const g = Math.hypot(gx, gy, gz) || 1;
      gx /= g;
      gy /= g;
      gz /= g;
      // Clamp the Newton step to stay inside the cell neighbourhood.
      const step = Math.max(-cell * 0.5, Math.min(cell * 0.5, d));
      x -= gx * step;
      y -= gy * step;
      z -= gz * step;
    }
    positions[v * 3] = x;
    positions[v * 3 + 1] = y;
    positions[v * 3 + 2] = z;
    normals[v * 3] = gx;
    normals[v * 3 + 1] = gy;
    normals[v * 3 + 2] = gz;
    evaluate(x, y, z, true);
    let best = 0;
    // |d| picks the primitive whose own surface passes through this point, so a
    // shape carved away below (or buried inside) another never claims it.
    for (let i = 1; i < prims.length; i++)
      if (!prims[i].sub && Math.abs(dist[i]) < Math.abs(dist[best])) best = i;
    owner[v] = best;
  }
  return {
    positions,
    normals,
    indices: count > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
    owner,
    count,
  };
}

/**
 * Smooth skin weights: each primitive contributes exp(-(d - dmin)/sigma) to its
 * bone. The four strongest bones are kept and normalised.
 */
export function skinWeights(field, mesh, boneIndex, sigma = 0.045, override) {
  const { prims, evaluate, dist } = field;
  const n = mesh.count,
    indices = new Float32Array(n * 4),
    weights = new Float32Array(n * 4),
    acc = new Map();
  for (let v = 0; v < n; v++) {
    const x = mesh.positions[v * 3],
      y = mesh.positions[v * 3 + 1],
      z = mesh.positions[v * 3 + 2];
    acc.clear();
    const custom = override?.(x, y, z, prims[mesh.owner[v]]);
    if (custom) for (const [b, w] of custom) acc.set(b, (acc.get(b) || 0) + w);
    else {
      evaluate(x, y, z, true);
      let dmin = Infinity;
      for (let i = 0; i < prims.length; i++)
        if (!prims[i].sub) dmin = Math.min(dmin, dist[i]);
      for (let i = 0; i < prims.length; i++) {
        if (prims[i].sub || prims[i].noSkin) continue;
        const w = Math.exp(-(dist[i] - dmin) / sigma);
        if (w < 1e-3) continue;
        acc.set(prims[i].bone, (acc.get(prims[i].bone) || 0) + w);
      }
    }
    const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = top.reduce((s, [, w]) => s + w, 0) || 1;
    top.forEach(([bone, w], s) => {
      indices[v * 4 + s] = boneIndex[bone];
      weights[v * 4 + s] = w / total;
    });
  }
  return { indices, weights };
}
