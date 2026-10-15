import * as THREE from "three";
import { STATES, LEVELS, SWEETS } from "../config.js";
import {
  $,
  clamp,
  rand,
  TAU,
  v3,
  fmt,
  mats,
  geos,
  mat,
  geo,
  mesh,
  group,
  flatRing,
  instanced,
} from "../core/primitives.js";
import { makeHero, makeAlien } from "./models.js";
class Player {
  constructor(game) {
    this.game = game;
    Object.assign(this, makeHero(game.world));
    this.pos = this.root.position;
    this.velocity = v3();
    this.facing = v3(0, 0, -1);
    this.invuln = 0;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.throwCooldown = 0;
    this.coffee = 0;
    this.magnet = 0;
    this.buffer = 0;
    this.coyote = 0.12;
    this.grounded = true;
    this.walk = 0;
  }
  reset() {
    this.pos.copy(this.game.spawn || v3(0, 0, 16));
    this.velocity.set(0, 0, 0);
    this.facing.set(0, 0, -1);
    this.root.rotation.y = Math.PI;
    this.invuln = 1;
    this.dashTime =
      this.dashCooldown =
      this.throwCooldown =
      this.coffee =
      this.magnet =
      this.buffer =
        0;
    this.grounded = true;
    this.coyote = 0.12;
    this.root.visible = true;
  }
  update(dt) {
    const g = this.game,
      input = g.input;
    for (const k of [
      "invuln",
      "dashTime",
      "dashCooldown",
      "throwCooldown",
      "coffee",
      "magnet",
      "buffer",
    ])
      this[k] = Math.max(0, this[k] - dt);
    const dir = input.movement();
    if (input.take("Space")) this.buffer = 0.16;
    this.coyote = this.grounded ? 0.12 : Math.max(0, this.coyote - dt);
    if (this.buffer > 0 && this.coyote > 0) {
      this.velocity.y = g.levelIndex === 3 ? 10.4 : 9.4;
      this.buffer = 0;
      this.coyote = 0;
      this.grounded = false;
      g.audio.play("jump");
      g.particles.emit(this.pos, 0xffecc2, 8, 1.5, 0.45);
    }
    if (
      (input.take("ShiftLeft") || input.take("ShiftRight")) &&
      this.dashCooldown <= 0
    ) {
      this.dashTime = 0.26;
      this.dashCooldown = 1.65;
      this.invuln = Math.max(this.invuln, 0.3);
      g.audio.tone(140, 0.15, "triangle", 0.12, 440);
    }
    if (dir.length() > 0.08) {
      this.facing.set(dir.x, 0, dir.y).normalize();
      const desired = Math.atan2(this.facing.x, this.facing.z),
        delta = Math.atan2(
          Math.sin(desired - this.root.rotation.y),
          Math.cos(desired - this.root.rotation.y),
        );
      this.root.rotation.y += delta * (1 - Math.exp(-18 * dt));
    }
    const speed = this.dashTime > 0 ? 17 : this.coffee > 0 ? 9.1 : 6.7,
      desired =
        this.dashTime > 0
          ? new THREE.Vector2(this.facing.x, this.facing.z)
          : dir,
      smooth = 1 - Math.exp(-20 * dt);
    this.velocity.x = THREE.MathUtils.lerp(
      this.velocity.x,
      desired.x * speed,
      smooth,
    );
    this.velocity.z = THREE.MathUtils.lerp(
      this.velocity.z,
      desired.y * speed,
      smooth,
    );
    // Axis-separated AABB collision permits sliding along stalls without snagging.
    this.pos.x = clamp(
      this.pos.x + this.velocity.x * dt,
      g.bounds.minX,
      g.bounds.maxX,
    );
    this.resolve("x");
    this.pos.z = clamp(
      this.pos.z + this.velocity.z * dt,
      g.bounds.minZ,
      g.bounds.maxZ,
    );
    this.resolve("z");
    const oldY = this.pos.y;
    this.velocity.y -= g.config.gravity * dt;
    this.pos.y += this.velocity.y * dt;
    this.grounded = false;
    let floor = 0;
    for (const o of g.builder.solids) {
      if (
        Math.abs(this.pos.x - o.x) < o.w / 2 + 0.28 &&
        Math.abs(this.pos.z - o.z) < o.d / 2 + 0.28 &&
        oldY >= o.h - 0.12 &&
        this.pos.y <= o.h &&
        this.velocity.y <= 0
      )
        floor = Math.max(floor, o.h);
    }
    if (this.pos.y <= floor) {
      this.pos.y = floor;
      this.velocity.y = 0;
      this.grounded = true;
    }
    const running = Math.hypot(this.velocity.x, this.velocity.z);
    this.walk += dt * running * 1.9;
    this.arms.forEach(
      (a, i) =>
        (a.rotation.x = this.grounded
          ? Math.sin(this.walk + i * Math.PI) * Math.min(0.7, running * 0.11)
          : -0.8),
    );
    this.legs.forEach(
      (l, i) =>
        (l.rotation.x = this.grounded
          ? Math.sin(this.walk + i * Math.PI) * Math.min(0.6, running * 0.08)
          : i === 0
            ? -0.4
            : 0.45),
    );
    this.body.position.y = this.grounded ? Math.sin(this.walk * 2) * 0.035 : 0;
    this.arms.forEach((a) => {
      if (a.userData.elbow)
        a.userData.elbow.rotation.x = -0.15 - Math.min(0.5, running * 0.04);
    });
    this.body.rotation.z = Math.sin(g.elapsed * 2) * 0.025;
    this.root.visible =
      this.invuln <= 1 || Math.floor(this.invuln * 14) % 2 === 0;
    if (
      (input.take("KeyE") || input.keys.has("KeyE")) &&
      this.throwCooldown === 0
    )
      g.throwSparkler();
    if (this.dashTime > 0)
      g.particles.emit(
        this.pos.clone().add(v3(0, 0.6, 0)),
        0x8bfff1,
        2,
        0.5,
        0.3,
      );
  }
  resolve(axis) {
    for (const o of this.game.builder.solids) {
      if (this.pos.y >= o.h - 0.09) continue;
      const rx = o.w / 2 + 0.36,
        rz = o.d / 2 + 0.36;
      if (Math.abs(this.pos.x - o.x) < rx && Math.abs(this.pos.z - o.z) < rz) {
        this.pos[axis] =
          o[axis] +
          Math.sign(this.pos[axis] - o[axis] || 1) * (axis === "x" ? rx : rz);
        this.velocity[axis] = 0;
      }
    }
  }
  hurt() {
    const g = this.game;
    if (this.invuln > 0) return;
    g.lives--;
    this.invuln = 2.5;
    this.pos.copy(g.spawn);
    this.velocity.set(0, 0, 0);
    this.dashTime = 0;
    g.audio.play("hurt");
    g.particles.emit(this.pos.clone().add(v3(0, 1, 0)), 0xffa979, 18, 3, 0.7);
    g.hud.flash = 0.32;
    g.hud.toast(
      [
        "A little slip! Your sweets are safe.",
        "Veshti intact. Dignity mostly intact.",
        "Shake it off, Veeramani!",
      ][Math.floor(rand(0, 3))],
      2,
    );
    if (g.lives <= 0) g.over("Out of diyas!");
  }
}
export { Player };
