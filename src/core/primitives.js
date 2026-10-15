import * as THREE from "three";
const $ = (id) => document.getElementById(id),
  clamp = THREE.MathUtils.clamp,
  rand = (a, b) => a + Math.random() * (b - a),
  TAU = Math.PI * 2;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const fmt = (s) =>
  `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;
const mats = new Map(),
  geos = new Map();
function mat(color, glow = 0) {
  const key = color + ":" + glow;
  if (!mats.has(key))
    mats.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.83,
        flatShading: true,
        emissive: color,
        emissiveIntensity: glow,
      }),
    );
  return mats.get(key);
}
function geo(kind) {
  if (!geos.has(kind)) {
    const g =
      kind === "box"
        ? new THREE.BoxGeometry(1, 1, 1)
        : kind === "sphere"
          ? new THREE.SphereGeometry(1, 12, 8)
          : kind === "ico"
            ? new THREE.IcosahedronGeometry(1, 1)
            : kind === "cone"
              ? new THREE.ConeGeometry(1, 1, 8)
              : kind === "cylinder"
                ? new THREE.CylinderGeometry(1, 1, 1, 12)
                : kind === "torus"
                  ? new THREE.TorusGeometry(1, 0.12, 6, 32)
                  : new THREE.OctahedronGeometry(1);
    geos.set(kind, g);
  }
  return geos.get(kind);
}
function mesh(
  parent,
  kind,
  color,
  pos = [0, 0, 0],
  scale = [1, 1, 1],
  glow = 0,
) {
  const m = new THREE.Mesh(geo(kind), mat(color, glow));
  m.position.set(...pos);
  m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
function flatRing(parent, x, z, r, color) {
  const m = mesh(parent, "torus", color, [x, 0.03, z], [r, r, r], 0.25);
  m.rotation.x = -Math.PI / 2;
  return m;
}
function instanced(parent, kind, color, items, glow = 0) {
  const m = new THREE.InstancedMesh(geo(kind), mat(color, glow), items.length),
    o = new THREE.Object3D();
  items.forEach((a, i) => {
    o.position.set(a[0], a[1], a[2]);
    o.scale.set(a[3] ?? 1, a[4] ?? a[3] ?? 1, a[5] ?? a[3] ?? 1);
    o.rotation.set(0, a[6] || 0, 0);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  });
  m.instanceMatrix.needsUpdate = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export {
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
};
