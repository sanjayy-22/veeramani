// Babylon.js rendering layer: engine, scene, lights, shadows, sky, post-processing.
// Gameplay code never touches Babylon directly except through this module and
// the helpers in prims.js; the same Game runs on a NullEngine in Node tests.
import {
  Engine,
  NullEngine,
  Scene,
  Color3,
  Color4,
  Vector3,
  FreeCamera,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  GlowLayer,
  DefaultRenderingPipeline,
  SSAO2RenderingPipeline,
  ImageProcessingConfiguration,
  MeshBuilder,
  ShaderMaterial,
  Effect,
  TransformNode,
  PointLight,
} from "./babylon.js";
import { initPrims, hex } from "./prims.js";

const SKY_VERTEX = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;
const SKY_FRAGMENT = `
precision highp float;
varying vec3 vDir;
uniform vec3 top;
uniform vec3 horizon;
uniform vec3 glow;
uniform vec3 sunDir;
uniform float stars;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(horizon, top, pow(smoothstep(-0.05, 0.75, h), 0.8));
  float sun = max(dot(d, normalize(sunDir)), 0.0);
  col += glow * (pow(sun, 6.0) * 0.55 + pow(sun, 60.0) * 0.8);
  // Procedural star field: hashed cells with twinkle-free point stars.
  vec3 cell = floor(d * 140.0);
  float s = hash(cell);
  vec3 local = fract(d * 140.0) - 0.5;
  float star = smoothstep(0.08, 0.0, length(local)) * step(0.985, s) * smoothstep(0.02, 0.35, h);
  col += vec3(1.0, 0.95, 0.85) * star * stars * (0.5 + s * 2.0);
  gl_FragColor = vec4(col, 1.0);
}`;

export class Renderer {
  constructor(canvas, { headless = false, quality } = {}) {
    this.headless = headless;
    if (headless) this.engine = new NullEngine();
    else {
      this.engine = new Engine(canvas, true, {
        powerPreference: "high-performance",
        stencil: true,
        preserveDrawingBuffer: false,
      });
      this.engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio || 1, 1.5));
    }
    const coarse =
      !headless &&
      (matchMedia("(pointer:coarse)").matches || navigator.maxTouchPoints > 0);
    const requested = !headless && new URLSearchParams(location.search).get("quality");
    this.quality = quality || requested || (coarse ? "medium" : "high");
    const scene = (this.scene = new Scene(this.engine));
    scene.useRightHandedSystem = true;
    scene.metadata = { renderer: this };
    scene.clearColor = new Color4(0.08, 0.12, 0.2, 1);
    scene.ambientColor = new Color3(0.2, 0.2, 0.25);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.012;
    scene.skipPointerMovePicking = true;
    scene.autoClear = true;
    this.camera = new FreeCamera("camera", new Vector3(14, 15, 28), scene);
    this.camera.fov = 0.9;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 400;
    this.camera.inputs.clear();
    this.hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), scene);
    this.hemi.intensity = 0.65;
    this.sun = new DirectionalLight("sun", new Vector3(0.45, -1, -0.5).normalize(), scene);
    this.sun.intensity = 2.2;
    this.sun.position = new Vector3(-12, 30, 13);
    // Fixed orthographic shadow window that follows the player.
    Object.assign(this.sun, {
      orthoLeft: -24,
      orthoRight: 24,
      orthoTop: 24,
      orthoBottom: -24,
      shadowMinZ: 1,
      shadowMaxZ: 90,
    });
    this.fill = new PointLight("heroFill", new Vector3(0, 4, 0), scene);
    this.fill.intensity = 0;
    this.fill.range = 12;
    initPrims(scene, headless);
    if (!headless) this.buildEffects();
    this.root = new TransformNode("world", scene);
    this.makeSky();
  }
  buildEffects() {
    const scene = this.scene,
      high = this.quality === "high",
      low = this.quality === "low";
    this.shadows = new ShadowGenerator(low ? 1024 : 2048, this.sun);
    this.shadows.usePercentageCloserFiltering = true;
    this.shadows.filteringQuality = high
      ? ShadowGenerator.QUALITY_HIGH
      : ShadowGenerator.QUALITY_MEDIUM;
    this.shadows.bias = 0.0012;
    this.shadows.normalBias = 0.02;
    this.shadows.darkness = 0.15;
    this.glow = new GlowLayer("glow", scene, {
      mainTextureSamples: high ? 4 : 1,
      blurKernelSize: high ? 32 : 16,
      mainTextureRatio: high ? 0.5 : 0.35,
    });
    this.glow.intensity = 0.38;
    const p = (this.pipeline = new DefaultRenderingPipeline(
      "post",
      true,
      scene,
      [this.camera],
    ));
    p.samples = high ? 4 : 1;
    p.fxaaEnabled = !high;
    p.bloomEnabled = !low;
    p.bloomThreshold = 0.85;
    p.bloomWeight = 0.3;
    p.bloomKernel = 64;
    p.bloomScale = 0.5;
    p.sharpenEnabled = high;
    if (high) p.sharpen.edgeAmount = 0.18;
    p.chromaticAberrationEnabled = high;
    if (high) p.chromaticAberration.aberrationAmount = 6;
    p.grainEnabled = high;
    if (high) p.grain.intensity = 6;
    p.imageProcessingEnabled = true;
    const ip = p.imageProcessing;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.25;
    ip.contrast = 1.18;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 2.2;
    ip.vignetteStretch = 0.4;
    ip.vignetteColor = new Color4(0.02, 0.03, 0.08, 0);
    if (high && this.engine.webGLVersion >= 2) {
      try {
        this.ssao = new SSAO2RenderingPipeline("ssao", scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [this.camera]);
        this.ssao.radius = 1.6;
        this.ssao.totalStrength = 1.15;
        this.ssao.samples = 12;
        this.ssao.maxZ = 90;
        this.ssao.expensiveBlur = false;
      } catch (error) {
        console.warn("SSAO unavailable", error);
      }
    }
  }
  makeSky() {
    if (this.headless) return;
    Effect.ShadersStore.skyVertexShader = SKY_VERTEX;
    Effect.ShadersStore.skyFragmentShader = SKY_FRAGMENT;
    const m = (this.skyMaterial = new ShaderMaterial("sky", this.scene, { vertex: "sky", fragment: "sky" }, {
      attributes: ["position"],
      uniforms: ["worldViewProjection", "top", "horizon", "glow", "sunDir", "stars"],
    }));
    m.backFaceCulling = false;
    m.disableDepthWrite = true;
    this.sky = MeshBuilder.CreateSphere("sky", { diameter: 600, segments: 24, sideOrientation: 1 }, this.scene);
    this.sky.material = m;
    this.sky.infiniteDistance = true;
    this.sky.isPickable = false;
    this.sky.applyFog = false;
    this.sky.renderingGroupId = 0;
    this.setSky({ top: 0x0b1530, horizon: 0x2c4166, glow: 0xffa060, stars: 1 });
  }
  /** Mood per era: sky gradient, fog, light colours and intensities. */
  setSky({ top, horizon, glow = 0xffa060, stars = 1, fog, fogDensity = 0.012, sun = 0xffffff, sunIntensity = 2.2, hemiSky = 0xc7dfff, hemiGround = 0x5b4a44, hemiIntensity = 0.65, sunDir }) {
    const c = (h) => hex(h, false);
    if (this.skyMaterial) {
      this.skyMaterial.setColor3("top", c(top));
      this.skyMaterial.setColor3("horizon", c(horizon));
      this.skyMaterial.setColor3("glow", c(glow));
      this.skyMaterial.setFloat("stars", stars);
      const d = sunDir || [-0.45, 0.35, 0.5];
      this.skyMaterial.setVector3("sunDir", new Vector3(...d));
    }
    if (sunDir) this.sun.direction = new Vector3(-sunDir[0], -Math.max(0.35, sunDir[1] * 2.2), -sunDir[2]).normalize();
    this.scene.fogColor = c(fog ?? horizon);
    this.scene.fogDensity = fogDensity;
    this.scene.clearColor = Color4.FromColor3(c(horizon), 1);
    this.sun.diffuse = c(sun);
    this.sun.intensity = sunIntensity;
    this.hemi.diffuse = c(hemiSky);
    this.hemi.groundColor = c(hemiGround);
    this.hemi.intensity = hemiIntensity;
  }
  /** Keeps the shadow frustum centred on the action. */
  follow(target) {
    const d = this.sun.direction;
    this.sun.position.set(target.x - d.x * 40, target.y - d.y * 40, target.z - d.z * 40);
    this.fill.position.set(target.x, target.y + 3.5, target.z + 3);
  }
  addCaster(mesh, descendants = true) {
    this.shadows?.addShadowCaster(mesh, descendants);
  }
  removeCaster(mesh) {
    this.shadows?.removeShadowCaster(mesh, true);
  }
  resize() {
    this.engine.resize();
  }
  render() {
    this.scene.render();
  }
}
