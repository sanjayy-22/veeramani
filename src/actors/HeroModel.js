import * as THREE from "three";
import { group, mesh } from "../core/primitives.js";

let faceTexture = null;
const weaveData = new Uint8Array(128 * 128 * 4);
for (let y = 0; y < 128; y++)
  for (let x = 0; x < 128; x++) {
    const n = (x + y * 128) * 4;
    const shade = 175 + ((x + y) % 4 < 2 ? 45 : 0) + ((x * 17 + y * 31) % 13);
    weaveData[n] = weaveData[n + 1] = weaveData[n + 2] = shade;
    weaveData[n + 3] = 255;
  }
const weave = new THREE.DataTexture(weaveData, 128, 128);
weave.needsUpdate = true;
weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
weave.repeat.set(3, 3);
// Front projection preserves the supplied likeness. The unseen profile/back is modeled,
// not a scan. Replace this mesh with a rigged GLB here if a multi-view scan is supplied.
export async function loadCharacterAssets() {
  faceTexture = await new THREE.TextureLoader().loadAsync(
    `${import.meta.env.BASE_URL}assets/veeramani-face.png`,
  );
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  faceTexture.anisotropy = 4;
}

export function makeHero(parent) {
  const root = group(parent),
    body = group(root),
    arms = [],
    legs = [];
  const skin = new THREE.MeshStandardMaterial({
    color: 0x976d53,
    roughness: 0.83,
  });
  const denim = new THREE.MeshStandardMaterial({
    color: 0x477daf,
    roughness: 0.98,
    map: weave,
    bumpMap: weave,
    bumpScale: 0.008,
  });
  const cloth = new THREE.MeshStandardMaterial({
    color: 0xf3eddc,
    roughness: 1,
    bumpMap: weave,
    bumpScale: 0.004,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.92,
  });
  const smooth = (p, material, xyz, scale) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
    m.position.set(...xyz);
    m.scale.set(...scale);
    m.castShadow = true;
    m.receiveShadow = true;
    p.add(m);
    return m;
  };
  const tube = (p, material, xyz, r1, r2, h) => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(r1, r2, h, 24),
      material,
    );
    m.position.set(...xyz);
    m.castShadow = true;
    m.receiveShadow = true;
    p.add(m);
    return m;
  };
  // Natural shoulder-to-head proportions; independent hips, shoulders and elbows.
  smooth(body, denim, [0, 1.96, 0], [0.45, 0.57, 0.27]);
  tube(body, denim, [0, 1.91, 0], 0.39, 0.43, 0.7).scale.z = 0.66;
  tube(body, skin, [0, 2.5, 0], 0.135, 0.15, 0.25);
  const veshti = tube(body, cloth, [0, 0.98, 0], 0.42, 0.48, 1.15);
  veshti.scale.z = 0.69;
  for (let i = 0; i < 13; i++) {
    const a = (i / 12) * Math.PI;
    const pleat = tube(
      body,
      cloth,
      [Math.cos(a) * 0.43, 1, Math.sin(a) * 0.3],
      0.016,
      0.023,
      1.04,
    );
    pleat.rotation.z = Math.cos(a) * 0.035;
  }
  mesh(body, "box", 0xc8a054, [0.12, 0.98, 0.332], [0.035, 1.09, 0.012]);
  mesh(body, "cylinder", 0xc8a054, [0, 0.435, 0], [0.478, 0.045, 0.332]);
  mesh(body, "box", 0xa6b99c, [0, 2.35, 0.22], [0.19, 0.19, 0.035]);
  for (const s of [-1, 1]) {
    const collar = mesh(
      body,
      "box",
      0x578bb6,
      [s * 0.12, 2.34, 0.245],
      [0.17, 0.24, 0.04],
    );
    collar.rotation.z = -s * 0.38;
    mesh(body, "box", 0x3d709a, [s * 0.24, 2.08, 0.247], [0.18, 0.21, 0.03]);
    mesh(body, "box", 0x7395ac, [s * 0.24, 2.17, 0.268], [0.18, 0.012, 0.01]);
    const arm = group(body, s * 0.43, 2.3, 0);
    smooth(arm, denim, [s * 0.045, -0.16, 0], [0.155, 0.26, 0.17]);
    tube(arm, denim, [s * 0.075, -0.3, 0], 0.14, 0.125, 0.3);
    const elbow = group(arm, s * 0.075, -0.43, 0);
    tube(elbow, skin, [0, -0.17, 0.015], 0.105, 0.08, 0.34);
    smooth(elbow, skin, [0, -0.38, 0.025], [0.085, 0.13, 0.065]);
    smooth(elbow, skin, [-s * 0.06, -0.34, 0.055], [0.035, 0.075, 0.033]);
    arm.userData.elbow = elbow;
    arms.push(arm);
    const leg = group(root, s * 0.19, 0.72, 0);
    tube(leg, skin, [0, -0.22, 0], 0.105, 0.085, 0.43);
    smooth(leg, dark, [0, -0.61, 0.075], [0.135, 0.065, 0.23]);
    smooth(leg, skin, [0, -0.55, 0.08], [0.105, 0.07, 0.16]);
    mesh(leg, "box", 0x44382a, [0, -0.51, 0.11], [0.23, 0.04, 0.1]);
    legs.push(leg);
  }
  mesh(body, "box", 0x6693b3, [0, 1.96, 0.275], [0.037, 0.64, 0.015]);
  for (let i = 0; i < 5; i++)
    smooth(body, dark, [0, 2.25 - i * 0.135, 0.29], [0.016, 0.016, 0.009]);
  const head = group(body, 0, 2.79, 0);
  smooth(head, skin, [0, 0, -0.025], [0.255, 0.335, 0.235]);
  // A curved, subdivided facial surface with cheeks, brow, chin and nose relief.
  const face = new THREE.SphereGeometry(1, 64, 48, 0, Math.PI);
  const p = face.attributes.position,
    uv = face.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * 0.265,
      y = p.getY(i) * 0.345;
    const forward = Math.max(0, p.getZ(i));
    const gauss = (cx, cy, sx, sy) =>
      Math.exp(-(((x - cx) / sx) ** 2) - ((y - cy) / sy) ** 2);
    let z = forward * 0.22 - 0.015;
    z +=
      forward *
      (0.085 * gauss(0, -0.035, 0.057, 0.105) +
        0.025 * gauss(0, 0.04, 0.1, 0.13) +
        0.018 * gauss(0.12, -0.07, 0.08, 0.1) +
        0.018 * gauss(-0.12, -0.07, 0.08, 0.1));
    p.setXYZ(i, x, y, z);
    uv.setXY(i, 0.5 + x / 0.79, 0.5 + y / 0.7);
  }
  face.computeVertexNormals();
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTexture,
    color: faceTexture ? 0xffffff : 0x976d53,
    roughness: 0.95,
    alphaTest: 0.15,
  });
  const facialMesh = new THREE.Mesh(face, faceMat);
  facialMesh.castShadow = true;
  head.add(facialMesh);
  for (const s of [-1, 1])
    smooth(head, skin, [s * 0.253, -0.025, -0.01], [0.043, 0.082, 0.045]);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, 1.36),
    dark,
  );
  cap.position.set(0, 0.015, -0.04);
  cap.scale.set(0.26, 0.34, 0.235);
  head.add(cap);
  cap.castShadow = true;
  // The reference already supplies the swept fringe. Keep the modeled cap behind it.
  const bag = smooth(
    body,
    new THREE.MeshStandardMaterial({ color: 0xb38b50, roughness: 1 }),
    [0.48, 1.25, -0.15],
    [0.24, 0.3, 0.15],
  );
  mesh(
    body,
    "box",
    0x725a36,
    [0.3, 1.99, -0.24],
    [0.08, 0.86, 0.035],
  ).rotation.z = 0.3;
  mesh(
    body,
    "box",
    0x725a36,
    [0.3, 1.99, 0.24],
    [0.08, 0.86, 0.035],
  ).rotation.z = 0.3;
  mesh(bag, "sphere", 0xffbc3e, [0, 0.85, 0.1], [0.22, 0.22, 0.22]);
  return { root, body, head, arms, legs };
}
