// Engine-neutral vector math with chainable, in-place semantics. Game logic uses
// these so it never depends on a renderer's math library.
export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  clone() {
    return new Vec3(this.x, this.y, this.z);
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  addScaledVector(v, s) {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }
  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  length() {
    return Math.hypot(this.x, this.y, this.z);
  }
  normalize() {
    const l = this.length();
    return l > 0 ? this.multiplyScalar(1 / l) : this;
  }
  distanceTo(v) {
    return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z);
  }
  lerp(v, t) {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    this.z += (v.z - this.z) * t;
    return this;
  }
  toArray(out = [], o = 0) {
    out[o] = this.x;
    out[o + 1] = this.y;
    out[o + 2] = this.z;
    return out;
  }
  fromArray(a, o = 0) {
    return this.set(a[o], a[o + 1], a[o + 2]);
  }
}
export class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  length() {
    return Math.hypot(this.x, this.y);
  }
  normalize() {
    const l = this.length();
    if (l > 0) {
      this.x /= l;
      this.y /= l;
    }
    return this;
  }
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const angleDelta = (from, to) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));
// Distance from point p to segment a→b (used for swept projectile hits).
export function segmentPointDistance(a, b, p) {
  const bx = b.x - a.x,
    by = b.y - a.y,
    bz = b.z - a.z,
    len = bx * bx + by * by + bz * bz;
  const t = len
    ? clamp(((p.x - a.x) * bx + (p.y - a.y) * by + (p.z - a.z) * bz) / len, 0, 1)
    : 0;
  return Math.hypot(a.x + bx * t - p.x, a.y + by * t - p.y, a.z + bz * t - p.z);
}
