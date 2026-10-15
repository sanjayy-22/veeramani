import { extendRoute, updateRoute } from "./CampaignRoutes.js";
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
import { Alien } from "../actors/Alien.js";
import { Boss } from "../actors/Boss.js";
class LevelBuilder {
  constructor(game) {
    this.game = game;
    this.solids = [];
    this.hazards = [];
    this.animated = [];
    this.dinosaur = null;
    this.portal = null;
    this.portalReady = false;
    this.fireworkClock = 1;
  }
  solid(x, z, w, d, h, color) {
    const m = mesh(this.game.world, "box", color, [x, h / 2, z], [w, h, d]);
    this.solids.push({ x, z, w, d, h });
    return m;
  }
  hazard(type, x, z, r = 1, life = Infinity) {
    const root = group(this.game.world, x, 0, z);
    if (type === "pot") {
      mesh(root, "sphere", 0xa8643b, [0, 0.55, 0], [r, 0.6, r]);
      mesh(
        root,
        "torus",
        0xe3ad73,
        [0, 0.55, 0],
        [r * 0.85, r * 0.85, r * 0.85],
      ).rotation.x = Math.PI / 2;
    } else {
      const color =
        type === "lava"
          ? 0xff6c38
          : type === "crater"
            ? 0x673b43
            : type === "slime"
              ? 0x89bc48
              : 0x4689a0;
      mesh(
        root,
        "cylinder",
        color,
        [0, 0.035, 0],
        [r, 0.07, type === "lava" ? r * 0.4 : r],
        type === "lava" ? 0.8 : 0.08,
      );
      if (type === "crater") flatRing(root, 0, 0, r, 0xdd8d69);
      if (type === "puddle") flatRing(root, 0, 0, r * 0.6, 0x8ec4c9);
    }
    this.hazards.push({ root, type, x, z, r, life, age: 0, baseX: x });
    return root;
  }
  build(index) {
    const g = this.game,
      c = g.config,
      w = g.world;
    g.scene.background = new THREE.Color(c.sky);
    g.scene.fog = new THREE.Fog(c.fog, 36, 95);
    g.sun.color.set(index === 1 ? 0xffdeb0 : 0xffffff);
    g.sun.intensity = index === 0 ? 2 : 2.5;
    g.ambient.color.set(index === 2 ? 0xbde2cc : 0xc7dfff);
    mesh(w, "box", c.ground, [0, -0.3, 0], [35, 0.6, 49]);
    mesh(
      w,
      "box",
      index === 0
        ? 0x72717b
        : index === 1
          ? 0xddc394
          : index === 2
            ? 0x7c8159
            : 0xc47b61,
      [0, -0.015, 0],
      [7, 0.035, 43],
    );
    const pebbles = [];
    for (let i = 0; i < 85; i++) {
      const side = i % 2 ? -1 : 1;
      pebbles.push([
        side * rand(16.6, 26),
        rand(0.1, 0.6),
        rand(-30, 27),
        rand(0.3, 1),
        rand(0.3, 1.5),
        rand(0.3, 1),
        rand(0, TAU),
      ]);
    }
    instanced(
      w,
      "ico",
      index === 2 ? 0x5b6c4b : index === 3 ? 0x91473f : 0x88888b,
      pebbles,
    );
    const stars = [];
    for (let i = 0; i < 110; i++)
      stars.push([
        rand(-70, 70),
        rand(18, 52),
        rand(-65, 5),
        rand(0.025, 0.085),
      ]);
    instanced(w, "sphere", 0xffefd2, stars, 0.9);
    this.makePortal();
    if (index === 0) this.madurai();
    if (index === 1) this.kingdom();
    if (index === 2) this.jungle();
    if (index === 3) this.mars();
    // Three trails of six sweets. Thieves carry exactly four more each;
    // the Mars chief adds twelve. Conservation makes every chapter finishable.
    for (let lane = 0; lane < 3; lane++)
      for (let j = 0; j < 6; j++)
        g.collectibles.add(
          -10 + lane * 10 + Math.sin(j) * 1.2,
          13 - j * 5.1,
          j,
        );
    g.collectibles.power(-4, 10, "coffee");
    g.collectibles.power(9, -3, "magnet");
    g.collectibles.power(-11, -14, "life");
    const routes = [
      [
        [-7, 8],
        [-12, 2],
        [-8, -7],
        [-3, -3],
      ],
      [
        [8, 5],
        [12, -3],
        [7, -13],
        [3, -7],
      ],
      [
        [-6, -12],
        [0, -16],
        [6, -12],
        [0, -6],
      ],
      [
        [-11, 13],
        [-4, 11],
        [3, 13],
        [-3, 18],
      ],
    ];
    g.aliens = routes
      .slice(0, c.aliens)
      .map((route, i) => new Alien(g, i, route));
    if (index === 3) g.boss = new Boss(g);
    extendRoute(this, index);
  }
  makePortal() {
    const w = this.game.world;
    this.portal = group(w, 0, 2.6, -20.8);
    mesh(this.portal, "torus", 0x867ca5, [0, 0, 0], [2.3, 2.6, 1], 0.7);
    this.inner = mesh(
      this.portal,
      "sphere",
      0x74dbd5,
      [0, 0, 0],
      [2.05, 2.35, 0.08],
    );
    this.inner.material = new THREE.MeshBasicMaterial({
      color: 0x69d3e4,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    this.inner.castShadow = false;
    this.swirls = [];
    for (let i = 0; i < 3; i++) {
      const ring = mesh(
        this.portal,
        "torus",
        i % 2 ? 0xd7f96a : 0x99eaff,
        [0, 0, 0.1 + i * 0.03],
        [1.4 + i * 0.27, 1.65 + i * 0.3, 0.3],
        0.85,
      );
      ring.rotation.z = i;
      this.swirls.push(ring);
    }
    mesh(w, "cylinder", 0x6b7185, [0, 0.12, -20.8], [3, 0.24, 2.3]);
  }
  madurai() {
    const w = this.game.world;
    const colors = [0xdb8e77, 0x6aa8a0, 0xdfb96e, 0x9295b8];
    for (const side of [-1, 1])
      for (let j = 0; j < 6; j++) {
        const z = 17 - j * 7,
          x = side * 19,
          h = rand(4.5, 7);
        mesh(w, "box", colors[j % 4], [x, h / 2, z], [5, h, 5.7]);
        mesh(w, "box", 0xf6d4a1, [x, h, z], [5.4, 0.28, 6]);
        mesh(w, "box", 0x283f4b, [x - side * 2.54, 1.5, z], [0.08, 2.5, 1.2]);
        for (const zz of [-1.7, 1.7]) {
          mesh(
            w,
            "box",
            0xffd996,
            [x - side * 2.55, 3.7, z + zz],
            [0.1, 1.1, 0.85],
            0.45,
          );
          mesh(
            w,
            "box",
            0xb96f60,
            [x - side * 2.62, 3.7, z + zz],
            [0.14, 0.07, 0.95],
          );
        }
      }
    const lamps = [],
      flames = [];
    for (let z = -18; z <= 19; z += 2.5)
      for (const side of [-1, 1]) {
        lamps.push([side * 14.8, 0.13, z, 0.23, 0.13, 0.23]);
        flames.push([side * 14.8, 0.36, z, 0.07, 0.22, 0.07]);
      }
    instanced(w, "sphere", 0xbc7447, lamps);
    instanced(w, "cone", 0xffd87d, flames, 1.3);
    const bulbs = [[], [], [], []];
    for (let z = -18; z <= 19; z += 7) {
      mesh(w, "box", 0x453d4c, [0, 6.2, z], [35, 0.025, 0.025]);
      for (let x = -16; x <= 16; x += 1) {
        const y = 6.2 - Math.sin(((x + 16) / 32) * Math.PI) * 1.3;
        bulbs[(x + 16) % 4].push([x, y, z, 0.12, 0.16, 0.12]);
      }
    }
    [0xffcf69, 0xe78ca2, 0x8ce8cd, 0xf5f3c2].forEach((c, i) =>
      instanced(w, "sphere", c, bulbs[i], 1),
    );
    for (const z of [12, -1, -13]) {
      flatRing(w, 0, z, 2.1, 0xf1bf79);
      flatRing(w, 0, z, 1.6, 0xe699ae);
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12;
        const petal = mesh(
          w,
          "sphere",
          i % 2 ? 0x9be0d4 : 0xffe2a6,
          [Math.cos(a) * 1.05, 0.045, z + Math.sin(a) * 1.05],
          [0.42, 0.035, 0.19],
        );
        petal.rotation.y = -a;
      }
    }
    this.hazard("puddle", -4, 3, 1.45);
    this.hazard("puddle", 6, -7, 1.5);
    this.hazard("puddle", -11, -6, 1.3);
    this.table = group(w, 5, 0, 17);
    mesh(this.table, "box", 0x855e4e, [0, 1.2, 0], [4, 0.2, 1.7]);
    mesh(this.table, "box", 0xe6a473, [0, 1.32, 0], [4.1, 0.08, 1.8]);
    for (const x of [-1.6, 1.6])
      for (const z of [-0.6, 0.6])
        mesh(this.table, "box", 0x624e46, [x, 0.6, z], [0.15, 1.2, 0.15]);
    for (let i = 0; i < 6; i++) {
      mesh(
        this.table,
        "cylinder",
        0xffd98c,
        [-1.5 + i * 0.6, 1.39, 0],
        [0.25, 0.04, 0.38],
      );
      mesh(
        this.table,
        "sphere",
        SWEETS[i].color,
        [-1.5 + i * 0.6, 1.65, 0],
        [0.21, 0.23, 0.23],
      );
    }
  }
  gopuram(x, z, s = 1) {
    const root = group(this.game.world, x, 0, z);
    root.scale.setScalar(s);
    for (let i = 0; i < 6; i++) {
      const width = 7 - i * 0.9,
        y = i * 1.45;
      mesh(
        root,
        "box",
        i % 2 ? 0xc2a88d : 0xd2bb98,
        [0, y + 0.65, 0],
        [width, 1.3, 4 - i * 0.36],
      );
      mesh(
        root,
        "box",
        0xeee0b7,
        [0, y + 1.3, 0],
        [width + 0.35, 0.2, 4.2 - i * 0.36],
      );
      for (let j = -1; j <= 1; j++)
        mesh(
          root,
          "cone",
          0xad8a7f,
          [j * width * 0.3, y + 1.1, 2.1 - i * 0.18],
          [0.3, 0.7, 0.22],
        );
    }
    mesh(root, "box", 0x544b53, [0, 1.4, 2.02], [2, 2.8, 0.08]);
    for (let i = -2; i <= 2; i++)
      mesh(root, "sphere", 0xe8bb67, [i * 0.65, 9, 0], [0.2, 0.35, 0.2]);
  }
  kingdom() {
    const w = this.game.world;
    this.gopuram(-20, -15, 1.25);
    this.gopuram(20, -21, 0.9);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const x = s * 18,
          z = 16 - i * 5;
        mesh(w, "box", 0x9b8e84, [x, 2.1, z], [0.9, 4.2, 0.9]);
        mesh(w, "box", 0xd2c1a1, [x, 4.2, z], [1.5, 0.35, 1.5]);
      }
      mesh(w, "box", 0xc2aa8a, [s * 18, 4.7, 3], [4, 0.7, 31]);
    }
    for (const [x, z] of [
      [-6, 3],
      [6, -3],
      [-5, -11],
      [10, 11],
    ]) {
      this.solid(x, z, 2.8, 1.55, 1.05, 0x996e4d);
      for (const side of [-1, 1])
        mesh(
          w,
          "box",
          0x6b5443,
          [x + side * 1.3, 1.4, z - 0.7],
          [0.1, 2.8, 0.1],
        );
      mesh(w, "box", x > 0 ? 0xe2a663 : 0xc26561, [x, 2.9, z], [3.3, 0.2, 2]);
    }
    for (const s of [-1, 1])
      for (let z = -16; z < 20; z += 7) {
        mesh(w, "cylinder", 0x776355, [s * 14.5, 0.8, z], [0.12, 1.6, 0.12]);
        mesh(w, "cone", 0xffbc59, [s * 14.5, 1.9, z], [0.17, 0.55, 0.17], 1.1);
      }
    this.hazard("pot", 0, 5, 0.7);
    this.hazard("pot", 0, -8, 0.8);
    this.hazard("pot", 0, -15, 0.65);
  }
  jungle() {
    const w = this.game.world;
    for (let i = 0; i < 26; i++) {
      const x = (i % 2 ? -1 : 1) * rand(17, 24),
        z = rand(-27, 23);
      mesh(w, "cylinder", 0x6d6750, [x, 2, z], [0.4, 4, 0.4]);
      for (let j = 0; j < 7; j++) {
        const a = (j * TAU) / 7,
          leaf = mesh(
            w,
            "sphere",
            j % 2 ? 0x90b766 : 0x4d956b,
            [
              x + Math.cos(a) * 1.2,
              3.5 + Math.sin(j) * 0.3,
              z + Math.sin(a) * 1.2,
            ],
            [2.5, 0.23, 0.6],
          );
        leaf.rotation.y = -a;
        leaf.rotation.z = 0.18;
      }
    }
    for (const [x, z] of [
      [-6, 3],
      [7, -6],
      [-9, -13],
      [4, 12],
    ]) {
      this.hazard("lava", x, z, 2.1);
      for (let i = 0; i < 3; i++)
        mesh(
          w,
          "ico",
          0x4c5650,
          [x - 1.5 + i * 1.5, 0.17, z + 0.8],
          [0.4, 0.3, 0.3],
        );
    }
    const d = group(w, -10, 0, -2);
    mesh(d, "sphere", 0x8fbd73, [0, 2, 0], [2.5, 1.55, 1.2]);
    mesh(d, "cylinder", 0x8fbd73, [1.7, 3.3, 0], [0.65, 3.4, 0.65]).rotation.z =
      -0.35;
    mesh(d, "sphere", 0x9ccc83, [2.4, 5, 0], [1, 0.6, 0.65]);
    for (const z of [-0.5, 0.5])
      mesh(d, "sphere", 0x183e3c, [2.7, 5.18, z], [0.12, 0.15, 0.07]);
    for (const x of [-1.4, 1.2])
      for (const z of [-0.7, 0.7])
        mesh(d, "cylinder", 0x76a863, [x, 0.65, z], [0.35, 1.3, 0.35]);
    const tail = mesh(d, "cone", 0x8fbd73, [-3, 2, 0], [0.7, 3, 0.7]);
    tail.rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++)
      mesh(d, "cone", 0xc5db87, [-1.8 + i * 0.6, 3.3, 0], [0.25, 0.6, 0.25]);
    const solid = { x: -10, z: -2, w: 6.5, d: 2.6, h: 4.5 };
    this.solids.push(solid);
    this.dinosaur = { root: d, solid };
  }
  mars() {
    const w = this.game.world;
    for (const [x, z, r] of [
      [-5, 7, 1.6],
      [6, 0, 1.7],
      [-8, -9, 1.7],
      [10, -15, 1.4],
    ])
      this.hazard("crater", x, z, r);
    for (const s of [-1, 1]) {
      mesh(w, "sphere", 0x97b3c0, [s * 20, 0, -10], [5, 5, 6]);
      mesh(w, "cylinder", 0x4d536f, [s * 20, 0.15, -10], [5.5, 0.3, 6.5]);
      for (let j = 0; j < 4; j++)
        mesh(
          w,
          "box",
          0xb4f4d7,
          [s * 16.5, 1.5, -14 + j * 2.5],
          [0.2, 1.1, 1.2],
          0.4,
        );
      mesh(w, "cylinder", 0x85869c, [s * 20, 6, -10], [0.1, 4, 0.1]);
      mesh(w, "sphere", 0xffb56c, [s * 20, 8, -10], [0.3, 0.3, 0.3], 1);
    }
    mesh(w, "sphere", 0xe9a37b, [24, 23, -60], [7, 7, 7], 0.15);
    const orbit = mesh(w, "torus", 0xd6b4b0, [24, 23, -60], [11, 3, 11]);
    orbit.rotation.x = 1.1;
  }
  update(dt, ambient = false) {
    const g = this.game,
      t = g.elapsed;
    this.swirls.forEach((s, i) => {
      s.rotation.z += dt * (i % 2 ? -0.8 : 1.2);
      s.scale.x = (1.4 + i * 0.27) * (1 + Math.sin(t * 2 + i) * 0.07);
    });
    this.inner.material.opacity = this.portalReady ? 0.4 : 0.12;
    if (Math.random() < dt * 35) {
      const a = rand(0, TAU);
      g.particles.emit(
        v3(Math.cos(a) * 2.25, 2.6 + Math.sin(a) * 2.5, -20.65),
        this.portalReady ? 0xd7f96a : 0x85dfff,
        1,
        0.2,
        0.75,
      );
    }
    if (g.levelIndex === 0) {
      this.fireworkClock -= dt;
      if (this.fireworkClock <= 0) {
        const p = v3(rand(-20, 20), rand(12, 20), rand(-25, -7));
        g.particles.emit(
          p,
          [0xffcb69, 0xf0a2c3, 0xa4f9cc][Math.floor(rand(0, 3))],
          55,
          7,
          1.6,
          0.38,
        );
        if (!ambient || g.state === STATES.VICTORY) g.audio.play("firework");
        this.fireworkClock = g.state === STATES.VICTORY ? 0.65 : rand(2, 4);
      }
    }
    if (ambient) return;
    updateRoute(this, dt);
    if (this.dinosaur) {
      const x = Math.sin(t * 0.45) * 10;
      this.dinosaur.root.position.x = x;
      this.dinosaur.solid.x = x;
      this.dinosaur.root.rotation.z = Math.sin(t * 2) * 0.025;
    }
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.age += dt;
      h.life -= dt;
      if (h.life <= 0) {
        g.world.remove(h.root);
        this.hazards.splice(i, 1);
        continue;
      }
      if (h.type === "pot") {
        h.x = Math.sin(h.age * 0.85 + h.z) * 11;
        h.root.position.x = h.x;
        h.root.rotation.z -= dt * 3;
      }
      if (h.type === "lava")
        h.root.children[0].material.emissiveIntensity =
          0.6 + Math.sin(t * 5) * 0.2;
      const p = g.player.pos,
        dx = p.x - h.x,
        dz = p.z - h.z,
        hit =
          h.type === "lava"
            ? Math.abs(dx) < h.r + 0.25 && Math.abs(dz) < h.r * 0.4 + 0.25
            : Math.hypot(dx, dz) < h.r + 0.25;
      if (hit && p.y < (h.type === "pot" ? 1.15 : 0.4)) g.player.hurt();
    }
  }
}
export { LevelBuilder };
