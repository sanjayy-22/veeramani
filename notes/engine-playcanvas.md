# Engine spike: PlayCanvas

Spike location: `experiments/engine-playcanvas/` (self-contained `package.json`, `vite.config.js`, `index.html`, `main.js`, `shots/`).
Date: 2026-10-15. Measured in the cloud container (4 vCPU, Chromium + SwiftShader, no GPU).

## Version

- `playcanvas` **2.23.3** (latest on npm at time of spike, pinned exactly).
- `vite` 6.4.4 (dev dependency), Node 22.22.0.

## What was built (main.js, 444 lines)

Night-time Madurai Diwali street, all procedural (no asset files):

- Cobblestone ground: canvas-drawn stones (tileable, 3x3 wrap), plus a height canvas turned into a tangent-space normal map in JS (central differences). `StandardMaterial` with `diffuseMap` + `normalMap` + tiling.
- Two rows of buildings (boxes) with 7 canvas-drawn facade variants: windows, shutters, arched door, thoranam garland, and a separate emissive canvas so lit windows glow (`emissiveMap`). Roof trim and plinth boxes.
- Bulb strings: 12 zig-zag catenary strings of emissive spheres + thin wire boxes; one warm omni light per string.
- Diyas: clay bowl + flickering flame (scale animated) on both plinths, 1 omni light per 4 lamps (~22 lamp lights + 12 string lights, all clustered).
- Night sky: equirect canvas (gradient, stars, moon) -> `EnvLighting.generateSkyboxCubemap` -> `scene.skybox`. Separate dim hemisphere gradient (cool sky / warm ground) -> `EnvLighting.generateLightingSource` + `generateAtlas` -> `scene.envAtlas` for image-based ambient fill (PlayCanvas has no hemisphere light type; the env atlas is the idiomatic replacement).
- Temple gopuram silhouette at the end of the street.
- Stand-in hero (blue shirt capsule, white veshti cylinder, skin head/arms, hair, sandals) with walk cycle (arm swing, foot slide, bob), WASD movement, Space jump with gravity, smooth yaw, damped chase camera behind/above.
- Static + dynamic batch groups (`app.batcher.addGroup`) for bulbs, wires, plinths and flames.
- URL toggles for perf comparison: `?post=0`, `?ssao=0`, `?lights=0`, `?shadows=0`, `?scale=0.5`, `?aniso=1`.

## APIs used (all checked against `node_modules/playcanvas/build/playcanvas.d.ts`)

Post-processing — `CameraFrame` (exported from the main package, no extras import needed):

```js
const frame = new pc.CameraFrame(app, camera.camera);
frame.rendering.toneMapping = pc.TONEMAP_ACES;  // also ACES2, NEUTRAL, FILMIC, HEJL
frame.rendering.samples = 4;                    // MSAA on the HDR target
frame.rendering.renderTargetScale = 1;          // render-scale knob for low-end devices
frame.bloom.intensity = 0.025; frame.bloom.blurLevel = 14; frame.bloom.threshold = 0.6;
frame.ssao.type = pc.SSAOTYPE_LIGHTING; frame.ssao.radius = 1.2; frame.ssao.samples = 12;
frame.grading.enabled = true; frame.grading.saturation = 1.15;
frame.vignette.intensity = 0.45;
frame.update();                                 // must be called after changing settings
```

Also available in 2.23.3 but not used here: TAA (`frame.taa`), DoF (`frame.dof`), color LUT with cross-fade (`frame.colorLUT`), chromatic fringing, `colorEnhance` (shadows/highlights/vibrance/dehaze), **volumetric fog** with light shafts from the directional shadow map and optional scattering from clustered omni/spot lights (`frame.volumetricFog`), and sharpening.

Shadows: directional light component with `castShadows`, `shadowType: pc.SHADOW_PCF5_16F` (soft; `SHADOW_PCSS_32F` and VSM also exist), `shadowResolution: 2048`, `numCascades: 2`, `cascadeDistribution`, `shadowDistance`, `shadowBias`, `normalOffsetBias`, `shadowIntensity`.

Fog: `scene.fog.type = pc.FOG_EXP2; scene.fog.color; scene.fog.density`.
Lighting: clustered lighting is on by default, so ~34 omni lights needed no configuration.
Textures: `new pc.Texture(device, { format: PIXELFORMAT_SRGBA8 | RGBA8, mipmaps, anisotropy, addressU/V, projection })` + `tex.setSource(canvas)`.

## Verification results

- `npx vite build`: **succeeds**. Output: `index.js 2,220.37 kB minified, 568.30 kB gzip` (single chunk, `import * as pc`).
- Tree-shaking check (measured): a minimal app using only named imports `{ Application, Entity, StandardMaterial }` builds to **2,066.65 kB min / 532.08 kB gzip**. So tree-shaking saves only ~7%; the `Application` class pulls in essentially the whole engine (all component systems, loaders, gsplat, XR...). A custom `AppBase` with a hand-picked component-system list may shrink it further (unverified).
- For comparison, the current Three.js game's whole `dist/assets/index-*.js` on disk is 568 kB min / 150 kB gzip (game + three 0.170). PlayCanvas alone is ~3.8x that size gzipped.
- Screenshots (Playwright, Chromium, SwiftShader, 1280x720): `shots/start.png`, `shots/walk.png` (KeyW held 1.5 s), plus `shots/walk-8s.png` (KeyW held 8 s) and `shots/shadow-diff.png` (pixel diff of default vs `?shadows=0`, amplified). Scene renders correctly: textured cobbles with normal-mapped relief, coloured facades with glowing windows, bloom on bulbs/flames, sky with stars and gopuram silhouette, ACES tone mapping, vignette. The shadow diff confirms the moon casts building shadows across the street and a hero shadow.
- **Console errors: none** (no errors, no warnings, no page errors) in every run.
- Movement: the hero moves and animates (camera follows) but under SwiftShader the game runs in slow motion: with ~2 s frames and the engine's default `maxDeltaTime` clamp of 0.1 s, a 1.5 s key hold produced 0 to 0.5 m of movement (in the final `walk.png` run, 0 m, so it is visually identical to `start.png`); an 8 s hold moved 1.56 m (`walk-8s.png`).
- Time to first frame under SwiftShader: 13 to 25 s (dominated by shader compilation; unverified on GPU hardware).

## Frame time under SwiftShader (wall-clock, 1280x720, noisy, 4 vCPU)

| Config | Approx. ms/frame | Draw calls |
| --- | ---: | ---: |
| Full (CameraFrame MSAA4 + SSAO + bloom, shadows, 34 omni lights) | 1,200 to 1,900 | 329 to 339 |
| `?ssao=0` | ~1,050 to 1,500 | 223 |
| `?lights=0` (no omni lights) | ~1,000 to 1,100 | 339 |
| `?scale=0.5` (half-res render target) | ~600 | 337 |
| `?post=0` (no CameraFrame) | ~1,200 | 206 |
| `?post=0&lights=0&shadows=0` | ~270 to 400 | 114 |

SwiftShader numbers say nothing about real GPU performance (unverified on hardware). They do show that the cost is fill-rate bound (render scale halves it) and that shadows + clustered lights + post each add a lot in software rendering. For automated visual tests in this container, use a low-quality URL preset and expect several seconds per frame.

## Node / headless testability (verified)

Yes. PlayCanvas ships `NullGraphicsDevice` (`DEVICETYPE_NULL`) in the main package. Verified in plain Node 22, with no DOM, jsdom or canvas polyfill:

```js
import * as pc from 'playcanvas';
const device = new pc.NullGraphicsDevice({ width: 640, height: 360 });
const app = new pc.AppBase({ width: 640, height: 360 });
const opts = new pc.AppOptions();
opts.graphicsDevice = device;
opts.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem, pc.ScriptComponentSystem];
app.init(opts);
// ...entities with render/camera/light (castShadows) components...
app.start();
for (let i = 0; i < 10; i++) app.tick(performance.now() + i * 16);  // update handlers ran 10x, transforms correct
new pc.CameraFrame(app, cam.camera).update(); app.tick(...);       // also no throw
```

Result: 10 update ticks ran, entity transforms were correct, and a `CameraFrame` constructed and ticked without throwing. Caveats: `pc.Application` (rather than `AppBase`) creates a WebGL device, so tests must build the app via `AppBase` + `AppOptions`. Anything that draws to a DOM canvas (the procedural textures here) needs to be injectable or stubbed. The null device renders nothing, so it covers logic, scene graph and update loops, not pixels.

## Pros for porting the ~3,000-line Three.js game

- A complete "real game" look is built in: HDR pipeline with bloom, SSAO, TAA, DoF, LUT grading, vignette, volumetric fog/light shafts, all behind one `CameraFrame` object. With Three.js the same needs `postprocessing`/`EffectComposer` and manual pass wiring.
- Clustered lighting by default: dozens of local lights (diyas, bulbs, lanterns) worked with no tuning, which suits the festival levels.
- Cascaded soft shadows (PCF/PCSS/VSM), IBL from a generated env atlas, and static/dynamic batching are all first-party.
- An ECS (entities + components + scripts), a keyboard/mouse/gamepad/touch input layer, a sound component and an asset system come in the box.
- Headless logic tests in Node work out of the box via `NullGraphicsDevice`. In Three.js, `WebGLRenderer` cannot run in Node without a GL shim.
- Types ship in the package; WebGPU is available via `createGraphicsDevice` (unverified in this spike).

## Cons

- **Bundle size**: ~2.2 MB min / ~568 kB gzip for the engine, and tree-shaking barely helps (~7%). The current whole game is ~150 kB gzip.
- **Full rewrite**: there is no API overlap with Three.js. Scene graph (`Entity` vs `Object3D`), materials (`StandardMaterial` vs `MeshStandardMaterial`), geometry, input, the update loop and the camera all change. The custom hero mesh (curved face mesh, face texture, articulated joints) would need porting to `Mesh`/`createMesh` or a glTF export. Realistically, most of the ~3,000 lines are touched.
- Procedural primitive UVs and orientation differ (e.g. box faces each map 0..1). Facades worked here, but per-face UV control needs custom meshes.
- Heavy under software rendering: default-quality frames took 1 to 2 s in SwiftShader, so Playwright visual tests in CI need a low-quality preset.
- No hemisphere light type; it needs an env atlas or ambient SH, which is more setup than `THREE.HemisphereLight`.
- Smaller community and fewer examples than Three.js. Many docs and examples assume the PlayCanvas Editor (hosted), not engine-only npm usage.

## Not verified

- Real-GPU frame times, mobile performance, WebGPU path.
- The custom `AppBase` + minimal component systems bundle size.
- glTF import of the existing hero model; audio, touch joystick and the physics (ammo.js) integration.
- PCSS shadows and volumetric fog visuals (APIs exist in the typings but were not exercised).
