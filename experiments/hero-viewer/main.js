// Hero / alien turntable for iterating on the sculpt, rig and animation states.
import { Vector3, MeshBuilder } from "@babylonjs/core";
import { Renderer } from "../../src/engine/Renderer.js";
import { pbr } from "../../src/engine/prims.js";
import { textureSet } from "../../src/engine/textures.js";
import { loadCharacterAssets, makeHero, makeAlienRig } from "../../src/actors/hero/HeroBuilder.js";

await loadCharacterAssets("/");
const r = new Renderer(document.getElementById("c"));
r.setSky({ top: 0x101c3a, horizon: 0x40557a, glow: 0xffb070, stars: 0.6, fogDensity: 0.004, sunDir: [-0.5, 0.55, 0.6] });
const ground = MeshBuilder.CreateGround("g", { width: 30, height: 30 }, r.scene);
const cob = textureSet("cobble");
ground.material = pbr("ground", { color: 0x9aa0ad, albedo: cob.albedo, bump: cob.normal, rough: 0.9 });
cob.albedo.uScale = cob.albedo.vScale = cob.normal.uScale = cob.normal.vScale = 4;
ground.receiveShadows = true;
const hero = makeHero(r.root);
hero.meshes.forEach((m) => r.addCaster(m, false));
const alien = makeAlienRig(r.root);
alien.root.position.set(2.2, 0, -1);
alien.meshes.forEach((m) => r.addCaster(m, false));
const params = new URLSearchParams(location.search);
let mode = params.get("mode") || "idle", angle = Number(params.get("angle") || 0), close = params.has("face");
const ui = document.getElementById("ui");
for (const m of ["idle", "run", "jump", "dash", "throw", "wave", "hurt"]) {
  const b = document.createElement("button"); b.textContent = m; b.onclick = () => { mode = m; if (m === "throw") hero.animator.throw(); if (m === "hurt") hero.animator.hurt(); }; ui.append(b);
}
for (const [t, f] of [["⟲", () => (angle -= 0.6)], ["⟳", () => (angle += 0.6)], ["face", () => (close = !close)]]) {
  const b = document.createElement("button"); b.textContent = t; b.onclick = f; ui.append(b);
}
let last = performance.now();
r.engine.runRenderLoop(() => {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  const run = mode === "run" || mode === "dash";
  const pose = hero.animator.update(dt, { speed: mode === "dash" ? 17 : run ? 6.7 : 0, grounded: mode !== "jump", vy: mode === "jump" ? Math.sin(now / 400) * 8 : 0, dashing: mode === "dash", turnRate: 0, celebrate: mode === "wave" });
  hero.applyPose(pose, hero.animator.hipY);
  hero.root.rotation.y = angle;
  alien.animate(now / 1000, run ? 1 : 0.2, false, Math.abs(Math.sin(now / 160)) * 0.15 * (run ? 1 : 0));
  r.camera.position.copyFrom(close ? new Vector3(0, 2.85, 1.7) : new Vector3(1.2, 2.2, 6.2));
  r.camera.setTarget(close ? new Vector3(0, 2.8, 0) : new Vector3(0.6, 1.55, 0));
  r.follow({ x: 0, y: 0, z: 0 });
  r.render();
});
addEventListener("resize", () => r.resize());
window.viewerReady = true;
