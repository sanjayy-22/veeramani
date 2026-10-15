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
class Boss {
  constructor(game) {
    this.game = game;
    this.root = group(game.world, 0, 3, -14);
    this.pos = this.root.position;
    this.model = makeAlien(this.root, 1.65);
    this.model.root.position.y = 0.1;
    this.model.box.scale.set(1.7, 1.6, 1.4);
    this.saucer = mesh(
      this.root,
      "sphere",
      0x91b5c1,
      [0, 0, 0],
      [2.1, 0.35, 1.65],
    );
    mesh(
      this.root,
      "torus",
      0xe0f5ff,
      [0, 0, 0],
      [1.65, 1.65, 1.65],
      0.45,
    ).rotation.x = Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      const a = (i * TAU) / 10;
      mesh(
        this.root,
        "sphere",
        0xd7f96a,
        [Math.cos(a) * 1.8, 0, Math.sin(a) * 1.4],
        [0.12, 0.1, 0.12],
        1,
      );
    }
    this.shield = mesh(
      this.root,
      "sphere",
      0x86f5ef,
      [0, 1, 0],
      [2.1, 2.1, 1.7],
    );
    this.shield.material = new THREE.MeshBasicMaterial({
      color: 0x7af4ed,
      wireframe: true,
      transparent: true,
      opacity: 0.16,
    });
    this.shield.castShadow = false;
    this.hp = 3;
    this.active = false;
    this.age = 0;
    this.stunTime = 0;
    this.dropClock = 3;
    this.defeated = false;
    this.box = null;
    this.boxOpened = false;
    this.decoys = [];
    this.warnings = [];
    this.phase = "";
  }
  get vulnerable() {
    return (
      this.active && !this.defeated && this.stunTime <= 0 && this.age % 8 >= 4
    );
  }
  activate() {
    this.active = true;
    this.age = 0;
    this.game.state = STATES.BOSS;
    this.game.hud.toast(
      "The Chief! Dodge the warning circles. Aim when his shield opens.",
      4,
    );
  }
  hit() {
    if (!this.vulnerable) return;
    this.hp--;
    this.stunTime = 2;
    this.model.stars.visible = true;
    this.game.audio.play("alien");
    this.game.particles.emit(this.pos, 0xffe078, 45, 5, 1);
    if (this.hp <= 0) {
      this.defeated = true;
      this.active = false;
      this.root.visible = false;
      this.box = group(this.game.world, 0, 0.8, -9);
      mesh(this.box, "box", 0xffcc55, [0, 0, 0], [1.4, 1, 1.2], 0.5);
      mesh(this.box, "box", 0xfff3bf, [0, 0.05, 0.62], [0.18, 1.1, 0.03], 1);
      mesh(this.box, "box", 0xfff3bf, [0, 0.53, 0], [1.5, 0.12, 1.3], 0.6);
      this.game.score += 600;
      this.game.hud.toast(
        "The giant box is down! Touch it to recover the final 12 sweets.",
        4,
      );
    } else
      this.game.hud.toast(
        `${3 - this.hp} / 3 hits! The Chief is seeing laddus.`,
        2,
      );
  }
  update(dt) {
    const g = this.game;
    this.age += dt;
    this.stunTime = Math.max(0, this.stunTime - dt);
    this.model.stars.visible = this.stunTime > 0;
    this.model.stars.rotation.y += dt * 5;
    this.shield.visible = !this.vulnerable;
    this.model.antennae.forEach(
      (a, i) => (a.rotation.z = Math.sin(this.age * 6 + i) * 0.3),
    );
    if (this.active) {
      if (this.stunTime <= 0) {
        this.pos.set(
          Math.sin(this.age * 0.53) * 8,
          2.5 + Math.sin(this.age * 1.5) * 0.45,
          -11 + Math.cos(this.age * 0.43) * 4,
        );
        this.root.rotation.z = Math.sin(this.age) * 0.07;
        this.root.rotation.y = Math.sin(this.age * 0.53) * 0.2;
      }
      this.dropClock -= dt;
      if (this.dropClock <= 0) {
        const p = g.player.pos;
        this.warnings.push({
          x: p.x,
          z: p.z,
          t: 1.15,
          ring: flatRing(g.world, p.x, p.z, 1.5, 0xffdf70),
        });
        this.dropClock = 2.8;
        const decoy = group(
          g.world,
          clamp(this.pos.x + rand(-3, 3), -13, 13),
          0.7,
          this.pos.z + 3,
        );
        mesh(decoy, "ico", 0xc7f46e, [0, 0, 0], [0.4, 0.4, 0.4], 0.3);
        mesh(decoy, "box", 0x293640, [0, 0, 0.37], [0.35, 0.08, 0.03]);
        this.decoys.push({ root: decoy, life: 9 });
      }
    }
    for (let i = this.warnings.length - 1; i >= 0; i--) {
      const w = this.warnings[i];
      w.t -= dt;
      w.ring.scale.setScalar(1.5 * (0.9 + Math.sin(w.t * 18) * 0.08));
      if (w.t <= 0) {
        g.world.remove(w.ring);
        g.builder.hazard("slime", w.x, w.z, 1.5, 7);
        g.particles.emit(v3(w.x, 0.2, w.z), 0xa4de62, 20, 2, 0.7);
        this.warnings.splice(i, 1);
      }
    }
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const d = this.decoys[i];
      d.life -= dt;
      d.root.rotation.y += dt * 2;
      d.root.position.y = 0.7 + Math.sin(this.age * 4) * 0.12;
      if (
        d.root.position.distanceTo(g.player.pos.clone().add(v3(0, 0.7, 0))) < 1
      ) {
        g.player.hurt();
        g.hud.toast("Green sweets? Definitely a decoy!", 2);
        d.life = 0;
      }
      if (d.life <= 0) {
        g.world.remove(d.root);
        this.decoys.splice(i, 1);
      }
    }
    if (this.box && !this.boxOpened) {
      this.box.rotation.y += dt;
      this.box.position.y = 0.9 + Math.sin(this.age * 3) * 0.2;
      g.particles.emit(this.box.position, 0xffd66a, 1, 0.6, 0.6);
      if (
        Math.hypot(g.player.pos.x, g.player.pos.z + 9) < 1.8 &&
        g.player.pos.y < 2.8
      ) {
        this.boxOpened = true;
        this.box.visible = false;
        g.collectibles.scatter(this.box.position, 12, 0);
        g.audio.play("power");
      }
    }
  }
}
export { Boss };
