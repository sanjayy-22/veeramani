import { group, mesh, flatRing, v3, label } from "../core/primitives.js";
import { slab, surfaceMat, pbr } from "../engine/prims.js";
import { textureSet } from "../engine/textures.js";
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
    game.renderer.setSky({ top: 0x0b1433, horizon: 0x3b3d72, glow: 0xc58cff, stars: 1, fog: 0x272c55, fogDensity: 0.011, sun: 0xb8c4ff, sunIntensity: 1.7, hemiSky: 0x9fb0ff, hemiGround: 0x5a4660, hemiIntensity: 0.65, sunDir: [-0.5, 0.6, 0.35] });
    const floor = mesh(game.world, "cylinder", 0x526574, [0, -0.35, 0], [29, 0.7, 29], 0, {
      solo: true,
      material: surfaceMat("slab", 0x9c95a8, 0.85, textureSet),
      cast: false,
    });
    floor.material.metadata = { shared: true };
    flatRing(game.world, 0, 0, 9, 0xc5ad76).scaling.z = 0.14;
    flatRing(game.world, 0, 0, 8.4, 0x9c80b4).scaling.z = 0.14;
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
      const ring = mesh(
        root,
        "torus",
        color,
        [0, 0, 0],
        [2.25, 2.6, 0.75],
        unlocked ? 0.8 : 0,
      );
      const disc = mesh(root, "sphere", color, [0, 0, 0], [2, 2.3, 0.12], 0, {
        solo: true,
        cast: false,
        material: pbr("hubDisc", { color, glow: unlocked ? 1.2 : 0.1, alpha: unlocked ? 0.25 : 0.07 }),
      });
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
      this.portals.push({ root, ring, x, z, index: i, unlocked });
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
    return label(this.game.world, text, x, y, z, color);
  }
  update(dt) {
    this.age += dt;
    for (const p of this.portals) {
      p.ring.rotation.z += dt * (p.index % 2 ? -0.18 : 0.18);
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
