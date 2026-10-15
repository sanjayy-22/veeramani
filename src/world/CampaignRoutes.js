import * as THREE from "three";
import { mesh, group, flatRing, v3, instanced } from "../core/primitives.js";

export const ZONES = [
  ["Festival lane", "Lantern market", "Temple approach", "The stolen table"],
  ["Royal causeway", "Potters’ crossing", "Pillared gardens", "Gopuram square"],
  ["Fern valley", "Lava stepping stones", "Dinosaur crossing", "Ancient grove"],
  ["Red dunes", "Crater field", "Base perimeter", "The Chief’s landing pad"],
];

// The north arena connects to three authored southern route sections. Keep all
// required sweets reachable at ground height; optional tokens reward jumping.
export function extendRoute(builder, index) {
  const g = builder.game,
    w = g.world;
  g.bounds = { minX: -15.3, maxX: 15.3, minZ: -22, maxZ: 103 };
  g.spawn = v3(0, 0, 98);
  g.zone = -1;
  g.tokens = 0;
  mesh(w, "box", g.config.ground, [0, -0.3, 62], [35, 0.6, 84]);
  mesh(
    w,
    "box",
    index === 3
      ? 0xc97656
      : index === 2
        ? 0x727247
        : index === 1
          ? 0xc0a67b
          : 0x657283,
    [0, 0.012, 61],
    [8, 0.025, 84],
  );
  // Keep six sweets from the original arena and put thirty along the new route.
  g.collectibles.items = g.collectibles.items.filter((_, i) => i % 3 === 0);
  for (let j = 0; j < 30; j++) {
    const z = 96 - j * 2.48,
      x = Math.sin(j * 0.69) * 8.2;
    g.collectibles.add(x, z, j);
  }
  g.aliens.forEach((a, i) => {
    const offset = [76, 45, 16, 54][i];
    a.route.forEach((p) => (p.z += offset));
    a.pos.copy(a.route[0]);
  });
  builder.checkpoints = [64, 31, -3].map((z, i) => ({
    z,
    index: i,
    active: false,
    root: flatRing(w, 0, z, 2.5, 0x6db8c1),
  }));
  builder.tokens = [82, 49, 14].map((z, i) => {
    const x = i % 2 ? -11 : 11;
    builder.solid(x, z, 3.4, 3.4, 0.9, index === 3 ? 0x947478 : 0x8b8068);
    const root = group(w, x, 2.2, z);
    mesh(root, "torus", 0xffd477, [0, 0, 0], [0.55, 0.55, 0.55], 0.65);
    mesh(root, "oct", 0xffeeab, [0, 0, 0], [0.22, 0.4, 0.22], 0.5);
    return { root, x, z, alive: true };
  });
  g.collectibles.power(0, 91, "coffee");
  g.collectibles.power(3, 55, "magnet");
  g.collectibles.power(-3, 24, "life");
  const lamps = [];
  for (let z = 22; z < 103; z += 4)
    for (const side of [-1, 1])
      lamps.push([side * 15.8, 0.28, z, 0.18, 0.4, 0.18]);
  instanced(w, "sphere", index === 3 ? 0x7fe8f2 : 0xffc27b, lamps, 0.65);
  for (let section = 0; section < 3; section++) {
    const z = 38 + section * 27;
    if (index === 0) {
      for (const side of [-1, 1]) {
        mesh(
          w,
          "box",
          section % 2 ? 0xb57783 : 0x598d9d,
          [side * 20, 3, z],
          [7, 6, 18],
        );
        mesh(w, "box", 0xffc776, [side * 16.4, 2.4, z], [0.1, 1.6, 2.1], 0.35);
        mesh(
          w,
          "box",
          0xe4b35f,
          [side * 16.4, 4.6, z + 5],
          [0.1, 0.7, 2],
          0.35,
        );
      }
      builder.hazard("puddle", section % 2 ? 5 : -5, z, 2);
      builder.solid(section % 2 ? -6 : 6, z + 5, 4, 1.6, 0.9, 0x9d6551);
      for (let x = -14; x <= 14; x += 2)
        mesh(
          w,
          "sphere",
          x % 4 ? 0xffba60 : 0xf2a3bf,
          [x, 6 + Math.abs(x) * 0.035, z],
          [0.11, 0.16, 0.11],
          0.7,
        );
      flatRing(w, 0, z + 7, 2, 0xf2c3c6);
      flatRing(w, 0, z + 7, 1.5, 0xffd676);
    } else if (index === 1) {
      for (const side of [-1, 1]) {
        for (let j = 0; j < 4; j++)
          mesh(
            w,
            "cylinder",
            0xab957b,
            [side * 17.7, 2.3, z - 8 + j * 5],
            [0.55, 4.6, 0.55],
          );
        mesh(w, "box", 0xc9b595, [side * 17.7, 4.8, z], [3, 0.5, 21]);
      }
      builder.hazard("pot", 0, z, 0.8);
      builder.hazard("pot", 0, z + 9, 0.65);
      builder.solid(-6, z + 3, 5, 1.6, 1, 0xa07d61);
      builder.solid(6, z - 4, 5, 1.6, 1, 0xa07d61);
      if (section === 1) builder.gopuram(21, z, 1.4);
    } else if (index === 2) {
      for (const side of [-1, 1])
        for (let j = 0; j < 4; j++) {
          const stem = group(w, side * (18 + (j % 2) * 2), 0, z - 9 + j * 6);
          mesh(stem, "cylinder", 0x476e44, [0, 2, 0], [0.26, 4, 0.26]);
          for (let k = 0; k < 7; k++) {
            const a = (k / 7) * Math.PI * 2,
              l = mesh(
                stem,
                "sphere",
                0x578f57,
                [Math.cos(a) * 1.7, 3.7, Math.sin(a) * 1.7],
                [2, 0.16, 0.52],
              );
            l.rotation.y = -a;
            l.rotation.z = 0.16;
          }
        }
      for (const x of [-9, -3, 3, 9]) builder.hazard("lava", x, z, 2.6);
      builder.solid(-5, z + 6, 3, 3, 0.85, 0x746e61);
      builder.solid(4, z - 6, 3, 3, 1.15, 0x746e61);
    } else {
      builder.hazard("crater", -5, z, 2.4);
      builder.hazard("crater", 6, z + 8, 2.2);
      for (const side of [-1, 1]) {
        mesh(w, "sphere", 0x9a5e51, [side * 20, 0, z], [6, 3, 8]);
        mesh(w, "cylinder", 0xa4b3b6, [side * 13.5, 2, z], [0.16, 4, 0.16]);
        mesh(w, "oct", 0x8bf4e6, [side * 13.5, 4.2, z], [0.32, 0.5, 0.32], 0.8);
      }
      builder.solid(0, z + 4, 4, 4, 1.6, 0x9ba9ab);
    }
  }
}

export function updateRoute(builder, dt) {
  const g = builder.game,
    p = g.player.pos;
  const zone = p.z > 70 ? 0 : p.z > 38 ? 1 : p.z > 8 ? 2 : 3;
  if (g.zone !== zone) {
    g.zone = zone;
    g.hud.toast(ZONES[g.levelIndex][zone], 2.5);
  }
  for (const c of builder.checkpoints || []) {
    if (!c.active && Math.hypot(p.x, p.z - c.z) < 2.5 && p.y < 1) {
      c.active = true;
      c.root.material = c.root.material.clone();
      c.root.material.color.setHex(0xd7f96a);
      g.spawn.set(0, 0, c.z);
      g.saveCheckpoint();
      g.hud.toast(
        g.campaign.available
          ? "Checkpoint lit · progress saved"
          : "Checkpoint lit · saved for this session",
        3,
      );
      g.audio.play("power");
      g.particles.emit(p, 0xffdc7a, 35, 3, 1);
    }
  }
  for (const token of builder.tokens || []) {
    if (!token.alive) continue;
    token.root.rotation.y += dt * 1.5;
    token.root.position.y = 2.2 + Math.sin(g.elapsed * 2) * 0.12;
    if (Math.hypot(p.x - token.x, p.z - token.z) < 1 && p.y > 0.45) {
      token.alive = false;
      token.root.visible = false;
      g.tokens++;
      g.score += 250;
      g.audio.play("power");
      g.hud.toast(`Festival token ${g.tokens} / 3 · +250`, 2);
    }
  }
}
