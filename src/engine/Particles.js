// Fixed-capacity additive spark pool rendered as one billboarded SolidParticleSystem.
// Same API as before: emit(pos, colour, count, speed, life, size).
import {
  SolidParticleSystem,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Constants,
} from "./babylon.js";
import { Vec3 } from "../core/math.js";
import { softDot } from "./textures.js";
import { hex } from "./prims.js";

const rand = (a, b) => a + Math.random() * (b - a);

export class Particles {
  constructor(scene, headless = false, max = 700) {
    this.max = max;
    this.cursor = 0;
    this.data = Array.from({ length: max }, () => ({
      life: 0,
      max: 1,
      p: new Vec3(),
      v: new Vec3(),
      size: 0.2,
      color: new Color3(),
      drag: 0,
      gravity: 1.7,
    }));
    if (headless) return;
    const quad = MeshBuilder.CreatePlane("spark", { size: 1 }, scene);
    const sps = (this.sps = new SolidParticleSystem("sparks", scene, { updatable: true, isPickable: false }));
    sps.addShape(quad, max);
    quad.dispose();
    const mesh = (this.mesh = sps.buildMesh());
    sps.billboard = true;
    sps.computeParticleRotation = false;
    sps.computeParticleTexture = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.applyFog = false;
    const m = new StandardMaterial("sparkMat", scene);
    m.disableLighting = true;
    m.emissiveColor = new Color3(1, 1, 1);
    m.diffuseTexture = softDot();
    m.opacityTexture = softDot();
    m.alphaMode = Constants.ALPHA_ADD;
    m.disableDepthWrite = true;
    m.backFaceCulling = false;
    mesh.material = m;
    mesh.hasVertexAlpha = true;
    sps.updateParticle = (p) => {
      const d = this.data[p.idx];
      if (d.life <= 0) {
        p.scaling.setAll(0);
        return p;
      }
      const t = d.life / d.max;
      p.position.set(d.p.x, d.p.y, d.p.z);
      p.scaling.setAll(d.size * 2.2 * (0.35 + 0.65 * t));
      p.color.set(d.color.r, d.color.g, d.color.b, Math.min(1, t * 1.6));
      return p;
    };
    for (const p of sps.particles) p.scaling.setAll(0);
    sps.setParticles();
  }
  emit(pos, color, n = 10, speed = 3, life = 0.7, size = 0.24) {
    const c = hex(color, false);
    for (let i = 0; i < n; i++) {
      const d = this.data[this.cursor++ % this.max];
      d.p.copy(pos);
      d.v.set(rand(-1, 1), rand(-0.2, 1.6), rand(-1, 1)).multiplyScalar(speed);
      d.life = d.max = life * rand(0.6, 1.2);
      d.color.copyFrom(c);
      d.size = size;
      d.gravity = 1.7;
    }
  }
  /** Ground-hugging dust for footsteps and landings. */
  dust(pos, n = 6, color = 0xd9c8b0, spread = 1.4) {
    const c = hex(color, false).scale(0.55);
    for (let i = 0; i < n; i++) {
      const d = this.data[this.cursor++ % this.max];
      const a = Math.random() * Math.PI * 2;
      d.p.set(pos.x + Math.cos(a) * 0.2, pos.y + 0.08, pos.z + Math.sin(a) * 0.2);
      d.v.set(Math.cos(a) * spread * rand(0.5, 1), rand(0.3, 0.9), Math.sin(a) * spread * rand(0.5, 1));
      d.life = d.max = rand(0.35, 0.6);
      d.color.copyFrom(c);
      d.size = rand(0.18, 0.3);
      d.gravity = -0.4;
    }
  }
  update(dt) {
    for (const d of this.data) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.p.addScaledVector(d.v, dt);
      d.v.y -= dt * d.gravity;
      d.v.multiplyScalar(1 - Math.min(1, dt * 1.2));
    }
    this.sps?.setParticles();
  }
  clear() {
    this.data.forEach((d) => (d.life = 0));
  }
}
