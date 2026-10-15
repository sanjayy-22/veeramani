// Shared helpers for gameplay modules. Rendering helpers come from the Babylon
// layer (src/engine/prims.js); math is engine-neutral (src/core/math.js).
import { Vec3, clamp } from "./math.js";
export { mesh, group, flatRing, instanced, mat, label, setVisible } from "../engine/prims.js";
const $ = (id) => document.getElementById(id),
  rand = (a, b) => a + Math.random() * (b - a),
  TAU = Math.PI * 2;
const v3 = (x = 0, y = 0, z = 0) => new Vec3(x, y, z);
const fmt = (s) =>
  `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;
/** Copies an engine-neutral vector onto a scene node's position. */
const place = (node, v) => node.position.set(v.x, v.y, v.z);
export { $, clamp, rand, TAU, v3, fmt, place };
