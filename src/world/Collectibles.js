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
class Collectibles {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.powerups = [];
    this.dummy = new THREE.Object3D();
    const spiral = [];
    for (let i = 0; i < 70; i++) {
      const a = (i / 69) * TAU * 2.6,
        r = 0.055 + (i / 69) * 0.3;
      spiral.push(v3(Math.cos(a) * r, Math.sin(a) * r, Math.sin(a * 2) * 0.02));
    }
    this.geometry = [
      new THREE.IcosahedronGeometry(0.29, 1),
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(spiral),
        65,
        0.052,
        5,
        false,
      ),
      new THREE.BoxGeometry(0.52, 0.32, 0.39),
      new THREE.SphereGeometry(0.28, 12, 8),
      new THREE.CylinderGeometry(0.34, 0.34, 0.12, 16),
      new THREE.BoxGeometry(0.48, 0.27, 0.42),
    ];
    this.meshes = this.geometry.map((geom, i) => {
      const m = new THREE.InstancedMesh(geom, mat(SWEETS[i].color, 0.21), 96);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      game.world.add(m);
      return m;
    });
    this.sparkClock = 0;
  }
  add(x, z, type, velocity = null) {
    this.items.push({
      pos: v3(
        clamp(x, -14.5, 14.5),
        velocity ? 0.8 : 0.7,
        clamp(z, this.game.bounds.minZ + 1, this.game.bounds.maxZ - 1),
      ),
      type: type % 6,
      phase: rand(0, TAU),
      velocity,
      alive: true,
    });
  }
  scatter(pos, count, seed = 0) {
    for (let i = 0; i < count; i++) {
      const a = (i / Math.max(1, count)) * TAU + rand(-0.2, 0.2);
      this.add(
        pos.x + Math.cos(a) * 0.5,
        pos.z + Math.sin(a) * 0.5,
        (i + seed) % 6,
        v3(Math.cos(a) * rand(1, 3), rand(3, 5), Math.sin(a) * rand(1, 3)),
      );
    }
  }
  power(x, z, type) {
    const root = group(this.game.world, x, 0.8, z);
    if (type === "coffee") {
      mesh(root, "cylinder", 0xe5f4ed, [0, 0, 0], [0.27, 0.48, 0.27]);
      mesh(root, "cylinder", 0x673b21, [0, 0.25, 0], [0.23, 0.015, 0.23]);
      const h = mesh(root, "torus", 0xe5f4ed, [0.3, 0, 0], [0.18, 0.18, 0.18]);
      mesh(root, "cylinder", 0xd3a74a, [0, -0.3, 0], [0.38, 0.04, 0.38]);
    } else if (type === "magnet") {
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12;
        mesh(
          root,
          "sphere",
          i % 3 === 0 ? 0xffaa4f : 0xfffce8,
          [Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0],
          [0.12, 0.12, 0.1],
          0.2,
        );
      }
    } else {
      mesh(root, "sphere", 0xbc703c, [0, -0.1, 0], [0.4, 0.14, 0.3]);
      mesh(root, "cone", 0xffdf7c, [0, 0.18, 0], [0.12, 0.4, 0.12], 1);
    }
    flatRing(
      this.game.world,
      x,
      z,
      0.65,
      type === "coffee" ? 0xffc17a : type === "magnet" ? 0xf7f3dc : 0x8bffbd,
    );
    this.powerups.push({ root, type, x, z, alive: true });
  }
  update(dt) {
    const g = this.game,
      p = g.player.pos;
    this.sparkClock -= dt;
    for (const item of this.items) {
      if (!item.alive) continue;
      if (item.velocity) {
        item.velocity.y -= dt * 9;
        item.pos.addScaledVector(item.velocity, dt);
        item.pos.x = clamp(item.pos.x, -14.5, 14.5);
        item.pos.z = clamp(item.pos.z, g.bounds.minZ + 1, g.bounds.maxZ - 1);
        if (item.pos.y < 0.7) {
          item.pos.y = 0.7;
          item.velocity = null;
        }
      }
      const d = Math.hypot(item.pos.x - p.x, item.pos.z - p.z);
      if (g.player.magnet > 0 && d < 7) {
        const to = p
          .clone()
          .add(v3(0, 0.9, 0))
          .sub(item.pos);
        item.pos.addScaledVector(to, Math.min(1, dt * 6));
      }
      if (d < 1.05 && Math.abs(p.y + 0.85 - item.pos.y) < 2) {
        item.alive = false;
        g.collected++;
        g.totalCollected++;
        g.score += SWEETS[item.type].value;
        g.audio.play("collect");
        g.hud.pickup(`${SWEETS[item.type].name} +${SWEETS[item.type].value}`);
        g.particles.emit(item.pos, SWEETS[item.type].color, 7, 1.6, 0.5);
      } else if (this.sparkClock <= 0 && d < 15 && Math.random() < 0.4)
        g.particles.emit(item.pos, 0xfff1af, 1, 0.3, 0.6, 0.13);
    }
    if (this.sparkClock <= 0) this.sparkClock = 0.24;
    for (const power of this.powerups) {
      if (!power.alive) continue;
      power.root.rotation.y += dt;
      power.root.position.y = 0.85 + Math.sin(g.elapsed * 2 + power.x) * 0.13;
      if (Math.hypot(power.x - p.x, power.z - p.z) < 1.15 && p.y < 2.1) {
        power.alive = false;
        power.root.visible = false;
        if (power.type === "coffee") {
          g.player.coffee = 12;
          g.hud.toast("Filter Coffee Boost · 12 seconds of extra pep!", 2);
        } else if (power.type === "magnet") {
          g.player.magnet = 14;
          g.hud.toast("Jasmine Garland · nearby sweets come to you!", 2);
        } else {
          g.lives = Math.min(7, g.lives + 1);
          g.hud.toast("Extra Diya · one more life!", 2);
        }
        g.audio.play("power");
        g.particles.emit(power.root.position, 0xd7f96a, 25, 3, 0.8);
      }
    }
    this.draw(g.elapsed);
  }
  draw(t) {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const item of this.items) {
      if (!item.alive) continue;
      this.dummy.position.copy(item.pos);
      if (!item.velocity)
        this.dummy.position.y += Math.sin(t * 2.7 + item.phase) * 0.16;
      this.dummy.rotation.set(
        0.15,
        t * 1.5 + item.phase,
        item.type === 4 ? 0.2 : 0,
      );
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.meshes[item.type].setMatrixAt(
        counts[item.type]++,
        this.dummy.matrix,
      );
    }
    this.meshes.forEach((m, i) => {
      m.count = counts[i];
      m.instanceMatrix.needsUpdate = true;
    });
  }
}
export { Collectibles };
