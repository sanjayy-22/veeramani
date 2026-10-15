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
class Particles {
  constructor(scene) {
    this.max = 650;
    this.data = Array.from({ length: this.max }, () => ({
      life: 0,
      p: v3(),
      v: v3(),
      max: 1,
      color: new THREE.Color(),
    }));
    this.cursor = 0;
    this.positions = new Float32Array(this.max * 3);
    this.colors = new Float32Array(this.max * 3);
    this.sizes = new Float32Array(this.max);
    this.g = new THREE.BufferGeometry();
    this.g.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.g.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    this.g.setAttribute("size", new THREE.BufferAttribute(this.sizes, 1));
    this.m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      uniforms: { pixel: { value: Math.min(devicePixelRatio, 1.6) } },
      vertexShader:
        "attribute float size; varying vec3 vColor; uniform float pixel; void main(){vColor=color;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*pixel*210.0/max(1.0,-p.z),0.0,45.0);}",
      fragmentShader:
        "varying vec3 vColor; void main(){float d=length(gl_PointCoord-0.5)*2.0; if(d>1.0)discard; gl_FragColor=vec4(vColor,(1.0-d)*0.85);}",
    });
    this.points = new THREE.Points(this.g, this.m);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  emit(pos, color, n = 10, speed = 3, life = 0.7, size = 0.24) {
    for (let i = 0; i < n; i++) {
      const p = this.data[this.cursor++ % this.max];
      p.p.copy(pos);
      p.v.set(rand(-1, 1), rand(-0.2, 1.6), rand(-1, 1)).multiplyScalar(speed);
      p.life = p.max = life * rand(0.6, 1.2);
      p.color.set(color);
      p.size = size;
    }
  }
  update(dt) {
    this.data.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= dt;
        p.p.addScaledVector(p.v, dt);
        p.v.y -= dt * 1.7;
        p.p.toArray(this.positions, i * 3);
        p.color.toArray(this.colors, i * 3);
        this.sizes[i] = p.size * Math.max(0, p.life / p.max);
      } else this.sizes[i] = 0;
    });
    for (const name of ["position", "color", "size"])
      this.g.attributes[name].needsUpdate = true;
  }
  clear() {
    this.data.forEach((p) => (p.life = 0));
  }
}
export { Particles };
