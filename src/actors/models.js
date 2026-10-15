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
import { makeHero } from "./HeroModel.js";
function makeAlien(parent, scale = 1) {
  const root = group(parent);
  root.scale.setScalar(scale);
  const body = group(root);
  mesh(body, "sphere", 0x79d64e, [0, 0.8, 0], [0.43, 0.51, 0.34]);
  mesh(body, "sphere", 0xa6e66a, [0, 1.42, 0], [0.62, 0.47, 0.43]);
  for (const s of [-1, 1]) {
    const eye = mesh(
      body,
      "sphere",
      0x142e35,
      [s * 0.23, 1.47, 0.36],
      [0.18, 0.25, 0.095],
    );
    eye.rotation.z = s * -0.2;
    mesh(
      body,
      "sphere",
      0xf8fff3,
      [s * 0.2, 1.56, 0.435],
      [0.04, 0.055, 0.025],
    );
    mesh(body, "sphere", 0x68bd40, [s * 0.48, 0.92, 0.26], [0.17, 0.18, 0.27]);
  }
  mesh(body, "sphere", 0x2e6240, [0, 1.21, 0.39], [0.09, 0.035, 0.02]);
  const antennae = [];
  for (const s of [-1, 1]) {
    const a = group(body, s * 0.31, 1.76, 0);
    mesh(a, "cylinder", 0x70bb40, [0, 0.2, 0], [0.035, 0.4, 0.035]);
    mesh(a, "sphere", 0xd7f96a, [0, 0.42, 0], [0.105, 0.105, 0.105], 0.6);
    antennae.push(a);
  }
  const feet = [
    mesh(root, "sphere", 0x4eac46, [-0.25, 0.18, 0.08], [0.19, 0.18, 0.29]),
    mesh(root, "sphere", 0x4eac46, [0.25, 0.18, 0.08], [0.19, 0.18, 0.29]),
  ];
  const box = group(body, 0, 0.88, 0.57);
  mesh(box, "box", 0xf5c752, [0, 0, 0], [0.67, 0.48, 0.45], 0.25);
  mesh(box, "box", 0xfff4b3, [0, 0.04, 0.24], [0.1, 0.5, 0.025], 0.45);
  mesh(box, "box", 0xfff4b3, [0, 0.25, 0], [0.69, 0.07, 0.47], 0.4);
  const stars = group(root, 0, 2.35, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i * TAU) / 4;
    mesh(
      stars,
      "oct",
      0xffe779,
      [Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55],
      [0.13, 0.18, 0.13],
      1,
    );
  }
  stars.visible = false;
  return { root, body, antennae, feet, box, stars };
}
export { makeHero, makeAlien };
