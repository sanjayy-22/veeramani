// Procedural animation for Veeramani's skeleton: idle breathing, a distance-
// driven run cycle, jump/fall/land, dash, throw, hurt and a celebratory wave.
// Engine-neutral: produces per-bone Euler angles (radians) and a hip offset.
import { clamp, damp, lerp } from "../../core/math.js";

const BONES = [
  "hips", "spine", "chest", "neck", "head", "bag",
  "clavL", "upperArmL", "foreArmL", "handL", "thighL", "shinL", "footL",
  "clavR", "upperArmR", "foreArmR", "handR", "thighR", "shinR", "footR",
];

export class HeroAnimator {
  constructor() {
    this.phase = 0;
    this.time = 0;
    this.run = 0; // 0 idle → 1 full run
    this.air = 0;
    this.dash = 0;
    this.land = 0;
    this.throwT = 9;
    this.hurtT = 9;
    this.wave = 0;
    this.lean = 0;
    this.hipY = 0;
    this.wasGrounded = true;
    this.bag = { x: 0, z: 0, vx: 0, vz: 0 };
    this.pose = Object.fromEntries(BONES.map((b) => [b, [0, 0, 0]]));
    this.smoothed = Object.fromEntries(BONES.map((b) => [b, [0, 0, 0]]));
    this.events = [];
  }
  throw() {
    this.throwT = 0;
  }
  hurt() {
    this.hurtT = 0;
  }
  /**
   * s: { speed, grounded, vy, dashing, turnRate, accelX, accelZ, celebrate }
   * Returns the smoothed pose. Footstep events are pushed to this.events.
   */
  update(dt, s) {
    this.time += dt;
    this.throwT += dt;
    this.hurtT += dt;
    const t = this.time;
    const runTarget = s.grounded ? clamp(s.speed / 6.7, 0, 1.25) : 0;
    this.run = damp(this.run, runTarget, 10, dt);
    this.air = damp(this.air, s.grounded ? 0 : 1, s.grounded ? 18 : 10, dt);
    this.dash = damp(this.dash, s.dashing ? 1 : 0, 16, dt);
    this.wave = damp(this.wave, s.celebrate ? 1 : 0, 4, dt);
    this.lean = damp(this.lean, clamp(s.turnRate * 0.06, -0.3, 0.3), 8, dt);
    if (s.grounded && !this.wasGrounded) {
      this.land = 1;
      this.events.push("land");
    }
    this.wasGrounded = s.grounded;
    this.land = Math.max(0, this.land - dt * 4.5);
    // Stride length grows with speed; phase is distance-driven so feet don't slide.
    const prev = this.phase;
    this.phase += dt * s.speed * (s.grounded ? 1.55 : 0.3);
    if (Math.floor(prev / Math.PI) !== Math.floor(this.phase / Math.PI) && s.grounded && this.run > 0.25)
      this.events.push("step");

    const P = this.pose;
    for (const b of BONES) P[b][0] = P[b][1] = P[b][2] = 0;
    const r = this.run,
      ph = this.phase,
      sn = Math.sin(ph),
      cs = Math.cos(ph);
    const idle = 1 - clamp(r * 1.5, 0, 1);

    // Idle: breathing, weight shift, gentle look-around.
    const breathe = Math.sin(t * 1.7);
    P.spine[0] += breathe * 0.015 * idle;
    P.chest[0] += breathe * 0.02 * idle;
    P.hips[2] += Math.sin(t * 0.55) * 0.035 * idle;
    P.spine[2] -= Math.sin(t * 0.55) * 0.03 * idle;
    P.head[1] += Math.sin(t * 0.37) * 0.28 * idle * (1 - this.wave);
    P.head[0] += Math.sin(t * 0.23) * 0.05 * idle;
    for (const [side, k] of [["L", 1], ["R", -1]]) {
      P["upperArm" + side][2] += k * (0.1 + breathe * 0.01) * idle;
      P["foreArm" + side][0] -= 0.18 * idle;
    }

    // Run cycle.
    const legA = 0.62 * r,
      armA = 0.7 * r;
    P.thighL[0] += -sn * legA;
    P.thighR[0] += sn * legA;
    P.shinL[0] += (0.15 + Math.max(0, cs) * 1.05) * r;
    P.shinR[0] += (0.15 + Math.max(0, -cs) * 1.05) * r;
    P.footL[0] += (-0.2 * Math.max(0, cs) + sn * 0.15) * r;
    P.footR[0] += (-0.2 * Math.max(0, -cs) - sn * 0.15) * r;
    P.upperArmL[0] += sn * armA;
    P.upperArmR[0] += -sn * armA;
    P.upperArmL[2] += 0.12 * r;
    P.upperArmR[2] -= 0.12 * r;
    P.foreArmL[0] -= (0.5 + Math.max(0, -sn) * 0.6) * r;
    P.foreArmR[0] -= (0.5 + Math.max(0, sn) * 0.6) * r;
    P.hips[1] += sn * 0.14 * r;
    P.chest[1] -= sn * 0.2 * r;
    P.spine[0] += 0.14 * r + this.dash * 0.45;
    P.head[0] -= 0.1 * r + this.dash * 0.3;
    P.spine[2] += this.lean;
    P.head[2] -= this.lean * 0.5;
    let hip = Math.abs(cs) * 0.07 * r - 0.03 * r;

    // Airborne: tuck, arms out; rising vs falling changes the silhouette.
    const a = this.air,
      rising = clamp(s.vy / 8, -1, 1);
    if (a > 0.01) {
      P.thighL[0] += (-0.95 + rising * 0.2) * a;
      P.shinL[0] += 1.25 * a;
      P.thighR[0] += 0.35 * a;
      P.shinR[0] += 0.55 * a;
      P.footL[0] += 0.3 * a;
      P.upperArmL[2] += (0.9 - rising * 0.35) * a;
      P.upperArmR[2] -= (0.9 - rising * 0.35) * a;
      P.upperArmL[0] -= 0.35 * a;
      P.upperArmR[0] -= 0.35 * a;
      P.foreArmL[0] -= 0.6 * a;
      P.foreArmR[0] -= 0.6 * a;
      P.spine[0] += (-0.12 * rising + 0.08) * a;
      P.head[0] += 0.12 * rising * a;
    }

    // Landing squash.
    const l = this.land * this.land;
    hip -= 0.2 * l;
    P.thighL[0] -= 0.45 * l;
    P.thighR[0] -= 0.45 * l;
    P.shinL[0] += 0.9 * l;
    P.shinR[0] += 0.9 * l;
    P.footL[0] -= 0.45 * l;
    P.footR[0] -= 0.45 * l;
    P.spine[0] += 0.25 * l;

    // Dash: arms swept back, torso low.
    const d = this.dash;
    P.upperArmL[0] += 0.9 * d;
    P.upperArmR[0] += 0.9 * d;
    P.upperArmL[2] += 0.25 * d;
    P.upperArmR[2] -= 0.25 * d;
    hip -= 0.08 * d;

    // Overhand sparkler throw with the right arm (0.45 s).
    if (this.throwT < 0.45) {
      const k = this.throwT / 0.45,
        wind = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7;
      const swing = k < 0.3 ? -2.7 * (k / 0.3) : lerp(-2.7, -0.4, Math.min(1, (k - 0.3) / 0.35));
      P.upperArmR[0] = swing;
      P.upperArmR[2] = -0.25;
      P.foreArmR[0] = -0.9 * wind - 0.2;
      P.chest[1] += (k < 0.3 ? 0.35 : -0.35) * wind;
      P.spine[0] += 0.12 * (1 - wind);
    }

    // Hurt recoil.
    if (this.hurtT < 0.6) {
      const k = Math.sin((this.hurtT / 0.6) * Math.PI);
      P.spine[0] -= 0.45 * k;
      P.head[0] -= 0.3 * k;
      P.upperArmL[2] += 1.1 * k;
      P.upperArmR[2] -= 1.1 * k;
    }

    // Celebration wave (menus, victory, era recovered).
    const w = this.wave;
    if (w > 0.01) {
      P.upperArmR[2] = lerp(P.upperArmR[2], -2.25, w);
      P.upperArmR[0] = lerp(P.upperArmR[0], -0.45, w);
      P.foreArmR[2] = lerp(P.foreArmR[2], -0.35 + Math.sin(t * 9) * 0.45, w);
      P.foreArmR[0] = lerp(P.foreArmR[0], -0.3, w);
      P.head[2] += 0.08 * w;
      P.head[1] = lerp(P.head[1], -0.15, w);
    }

    // Shoulder bag: damped spring driven by body acceleration and bounce.
    const bag = this.bag;
    const ax = -(s.accelX || 0) * 0.02,
      az = (s.accelZ || 0) * 0.02 + Math.abs(cs) * 0.04 * r;
    bag.vx += (-bag.x * 40 - bag.vx * 5 + az * 40) * dt;
    bag.vz += (-bag.z * 40 - bag.vz * 5 + ax * 40) * dt;
    bag.x = clamp(bag.x + bag.vx * dt, -0.5, 0.5);
    bag.z = clamp(bag.z + bag.vz * dt, -0.4, 0.4);
    P.bag[0] = bag.x;
    P.bag[2] = bag.z;

    this.hipY = damp(this.hipY, hip, 20, dt);
    // Critically damp toward the target pose to soften state changes.
    const rate = 22;
    for (const b of BONES)
      for (let i = 0; i < 3; i++) this.smoothed[b][i] = damp(this.smoothed[b][i], P[b][i], b === "upperArmR" && this.throwT < 0.45 ? 60 : rate, dt);
    return this.smoothed;
  }
}
