import * as THREE from "three";
import { group, mesh, flatRing, v3 } from "../core/primitives.js";
import { LEVELS } from "../config.js";

export class Hub {
  constructor(game) {
    this.game = game;
    this.solids = [];
    this.hazards = [];
    this.portalReady = false;
    this.portals = [];
    this.age = 0;
    game.bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 19 };
    game.spawn = v3(0, 0, 13);
    game.scene.background = new THREE.Color(0x172e4a);
    game.scene.fog = new THREE.Fog(0x23394c, 30, 90);
    mesh(game.world, "cylinder", 0x526574, [0, -0.35, 0], [29, 0.7, 29]);
    flatRing(game.world, 0, 0, 9, 0xc5ad76).scale.z = 0.14;
    flatRing(game.world, 0, 0, 8.4, 0x9c80b4).scale.z = 0.14;
    const positions = [
      [-12, 3],
      [-6, -10],
      [6, -10],
      [12, 3],
    ];
    positions.forEach(([x, z], i) => {
      const unlocked = i <= game.campaign.data.unlocked,
        done = game.campaign.data.records[i];
      const root = group(game.world, x, 2.5, z),
        color = unlocked ? 0x9fe8d9 : 0x656b82;
      mesh(
        root,
        "torus",
        color,
        [0, 0, 0],
        [2.25, 2.6, 0.75],
        unlocked ? 0.8 : 0,
      );
      const disc = mesh(root, "sphere", color, [0, 0, 0], [2, 2.3, 0.12], 0.2);
      disc.material = disc.material.clone();
      disc.material.transparent = true;
      disc.material.opacity = unlocked ? 0.25 : 0.07;
      mesh(game.world, "cylinder", 0x8b8a9e, [x, 0.1, z], [2.7, 0.2, 2.7]);
      this.label(
        `${i + 1}  ${["MADURAI", "KINGDOM", "JUNGLE", "MARS"][i]}`,
        x,
        6,
        z,
        unlocked ? "#e8f8cd" : "#9398a9",
      );
      this.label(
        done
          ? `${done.medal.toUpperCase()} · ${done.score} PTS`
          : unlocked
            ? "ENTER PORTAL"
            : "LOCKED",
        x,
        5.2,
        z,
        done ? "#ffdb80" : "#b8d3d8",
      );
      this.portals.push({ root, x, z, index: i, unlocked });
    });
    this.label("THE TIME COURTYARD", 0, 6, -19, "#f4dfb5");
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2,
        x = Math.cos(a) * 24,
        z = Math.sin(a) * 24;
      mesh(game.world, "cylinder", 0x867d73, [x, 1.4, z], [0.28, 2.8, 0.28]);
      mesh(game.world, "sphere", 0xffce82, [x, 2.9, z], [0.2, 0.3, 0.2], 0.9);
    }
    mesh(game.world, "box", 0x795844, [0, 0.9, 0], [3.5, 0.18, 1.6]);
    for (const x of [-1.4, 1.4])
      mesh(game.world, "box", 0x634b3c, [x, 0.45, 0], [0.18, 0.9, 1.3]);
    game.campaign.data.records.forEach((r, i) => {
      if (r)
        mesh(
          game.world,
          "oct",
          0xffcc70,
          [-1.2 + i * 0.8, 1.3, 0],
          [0.28, 0.4, 0.28],
          0.5,
        );
    });
  }
  label(text, x, y, z, color) {
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 96;
    const ctx = c.getContext("2d");
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.font = "bold 40px sans-serif";
    ctx.fillText(text, 384, 62);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, depthTest: false }),
    );
    sprite.scale.set(8, 1, 1);
    sprite.position.set(x, y, z);
    sprite.userData.disposeTexture = true;
    this.game.world.add(sprite);
  }
  update(dt) {
    this.age += dt;
    for (const p of this.portals) {
      p.root.children[0].rotation.z += dt * (p.index % 2 ? -0.18 : 0.18);
      if (p.unlocked && Math.random() < dt * 18) {
        const a = Math.random() * Math.PI * 2;
        this.game.particles.emit(
          v3(p.x + Math.cos(a) * 2.2, 2.5 + Math.sin(a) * 2.5, p.z),
          0x9fe8d9,
          1,
          0.3,
          0.8,
        );
      }
      if (
        this.age > 1 &&
        Math.hypot(this.game.player.pos.x - p.x, this.game.player.pos.z - p.z) <
          1.6
      ) {
        if (p.unlocked) {
          this.game.beginChapter(p.index);
          return;
        }
        this.game.hud.toast(
          "Recover the sweets in the previous era to unlock this portal.",
          2,
        );
      }
    }
  }
}
