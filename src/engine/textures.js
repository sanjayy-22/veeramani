// Procedural, tileable PBR texture sets painted at load time (no image files).
// Each set has an albedo map and a normal map derived from a painted height field.
import { DynamicTexture, Texture } from "./babylon.js";
import { getScene, isHeadless } from "./prims.js";

const cache = new Map();

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
// Tileable value noise: n(x, y, F) samples a lattice of period F at (x·F, y·F)
// for x, y in [0, 1), so every integer frequency wraps seamlessly.
function makeNoise(seed) {
  const r = rng(seed),
    S = 512,
    g = new Float32Array(S * S).map(() => r());
  return (x0, y0, F) => {
    const at = (x, y) => g[(((y % F) + F) % F) * S + (((x % F) + F) % F)];
    const x = x0 * F,
      y = y0 * F;
    const xi = Math.floor(x),
      yi = Math.floor(y),
      xf = x - xi,
      yf = y - yi;
    const u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi),
      b = at(xi + 1, yi),
      c = at(xi, yi + 1),
      d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbm(noise, x, y, F, oct = 4) {
  let s = 0,
    a = 0.5,
    f = F;
  for (let i = 0; i < oct; i++) {
    s += noise(x, y, f) * a;
    a *= 0.5;
    f *= 2;
  }
  return s;
}
// Tileable Voronoi: returns [f1, f2, cellId] on a wrapped grid of N cells.
function makeVoronoi(seed, N) {
  const r = rng(seed),
    pts = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) pts.push([i + 0.15 + r() * 0.7, j + 0.15 + r() * 0.7, r()]);
  return (x, y) => {
    const ci = Math.floor(x),
      cj = Math.floor(y);
    let f1 = 9,
      f2 = 9,
      id = 0;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const i = ci + di,
          j = cj + dj;
        const p = pts[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
        const px = p[0] + (i - (((i % N) + N) % N)),
          py = p[1] + (j - (((j % N) + N) % N));
        const d = Math.hypot(x - px, y - py);
        if (d < f1) {
          f2 = f1;
          f1 = d;
          id = p[2];
        } else if (d < f2) f2 = d;
      }
    return [f1, f2, id];
  };
}

const PAINTERS = {
  // Madurai street: rounded granite setts with dark joints.
  cobble(x, y, n, v) {
    const [f1, f2, id] = v(x * 10, y * 10);
    const edge = f2 - f1;
    const h = Math.min(1, edge * 3.2) ** 0.6 * (0.8 + 0.2 * n(x, y, 64));
    const tone = 0.42 + id * 0.18 + fbm(n, x, y, 30) * 0.15;
    const joint = edge < 0.08;
    return [
      joint ? [44, 42, 46] : [tone * 205, tone * 200, tone * 210].map((c) => c * (0.85 + 0.25 * h)),
      joint ? 0 : h,
    ];
  },
  // Ancient kingdom: sandstone slabs in a running bond with worn edges.
  slab(x, y, n) {
    const rows = 5,
      row = Math.floor(y * rows),
      off = row % 2 ? 0.5 : 0;
    const u = x * 3 + off,
      fu = u - Math.floor(u),
      fv = y * rows - row;
    const edge = Math.min(fu, 1 - fu, fv * 0.6, (1 - fv) * 0.6);
    const wear = fbm(n, x, y, 18);
    const h = Math.min(1, edge * 14) * (0.75 + 0.25 * wear);
    const tint = 0.85 + ((Math.floor(u) * 7 + row * 13) % 5) * 0.04;
    return [[222 * tint * (0.82 + 0.25 * wear), 190 * tint * (0.82 + 0.2 * wear), 140 * tint * (0.8 + 0.2 * wear)], h];
  },
  // Jungle floor: moss and earth patches with fallen-leaf speckle.
  soil(x, y, n) {
    const m = fbm(n, x, y, 6, 5),
      fine = n(x, y, 90);
    const moss = Math.max(0, Math.min(1, (m - 0.45) * 4));
    const c = [
      (95 + fine * 30) * (1 - moss) + 70 * moss,
      (78 + fine * 22) * (1 - moss) + (120 + fine * 30) * moss,
      (54 + fine * 15) * (1 - moss) + 52 * moss,
    ];
    return [c, m * 0.7 + fine * 0.3];
  },
  // Mars regolith: rusty dust, scattered pebbles and micro craters.
  regolith(x, y, n, v) {
    const m = fbm(n, x, y, 8, 5),
      [f1, , id] = v(x * 14, y * 14);
    const pebble = f1 < 0.12 + id * 0.08 && id > 0.55;
    const h = m * 0.6 + (pebble ? 0.6 - f1 * 2 : 0);
    const c = [178 + m * 50, 86 + m * 30, 60 + m * 20].map((k) => k * (pebble ? 0.78 : 1));
    return [c, h];
  },
  // Lime plaster for building walls (tinted by material colour).
  plaster(x, y, n) {
    const m = fbm(n, x, y, 8, 5),
      stain = Math.max(0, fbm(n, x, y, 3) - 0.55) * 1.6;
    const k = 225 + m * 30 - stain * 70;
    return [[k, k * 0.97, k * 0.93], m];
  },
  // Cotton weave for the hero's clothes.
  weave(x, y, n) {
    const u = x * 48,
      w = y * 48;
    const a = Math.sin(u * Math.PI * 2) * 0.5 + 0.5,
      b = Math.sin(w * Math.PI * 2) * 0.5 + 0.5;
    const over = (Math.floor(u) + Math.floor(w)) % 2 ? a : b;
    const k = 225 + over * 30 + n(x, y, 200) * 10;
    return [[k, k, k], over * 0.8 + n(x, y, 120) * 0.2];
  },
};

function paint(kind, size, seed) {
  const n = makeNoise(seed),
    v = makeVoronoi(seed + 7, kind === "regolith" ? 14 : 10);
  const col = new Uint8ClampedArray(size * size * 4),
    height = new Float32Array(size * size);
    for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const x = i / size,
        y = j / size;
      const [c, h] = PAINTERS[kind](x, y, n, v);
      const o = (j * size + i) * 4;
      col[o] = c[0];
      col[o + 1] = c[1];
      col[o + 2] = c[2];
      col[o + 3] = 255;
      height[j * size + i] = h;
    }
  const nor = new Uint8ClampedArray(size * size * 4),
    strength = kind === "weave" ? 2.5 : 4;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const h = (a, b) => height[(((b + size) % size) * size + ((a + size) % size))];
      const dx = (h(i + 1, j) - h(i - 1, j)) * strength,
        dy = (h(i, j + 1) - h(i, j - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const o = (j * size + i) * 4;
      nor[o] = (-dx / l) * 127 + 128;
      nor[o + 1] = (dy / l) * 127 + 128;
      nor[o + 2] = (1 / l) * 127 + 128;
      nor[o + 3] = 255;
    }
  return { col, nor };
}

function toTexture(name, data, size) {
  const t = new DynamicTexture(name, { width: size, height: size }, getScene(), true);
  t.getContext().putImageData(new ImageData(data, size, size), 0, 0);
  t.update(false);
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  t.anisotropicFilteringLevel = 8;
  return t;
}

/** Returns {albedo, normal} for a material kind, or nulls when headless. */
export function textureSet(kind, size = 512, seed = 3) {
  if (isHeadless() || typeof document === "undefined") return { albedo: null, normal: null };
  const key = kind + size;
  if (!cache.has(key)) {
    const { col, nor } = paint(kind, size, seed);
    const albedo = toTexture(kind + "-albedo", col, size),
      normal = toTexture(kind + "-normal", nor, size);
    normal.gammaSpace = false;
    cache.set(key, { albedo, normal });
  }
  return cache.get(key);
}

/** Soft round sprite used by particles and glows. */
export function softDot() {
  if (isHeadless()) return null;
  if (!cache.has("dot")) {
    const t = new DynamicTexture("dot", { width: 64, height: 64 }, getScene(), true);
    const ctx = t.getContext(),
      g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.65)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    t.update();
    t.hasAlpha = true;
    cache.set("dot", t);
  }
  return cache.get("dot");
}
