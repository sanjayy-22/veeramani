# Engine comparison: Three.js → ? (2026-10-15)

Goal from the request: stop using Three.js and make the game feel like a real game, with a better character.

## Options considered

| Option | Verdict |
| --- | --- |
| **Keep Three.js, add post-processing and better art** | Rejected. The request explicitly asks to move away from Three.js. |
| **Babylon.js 9.31 (`@babylonjs/core`)** | **Chosen.** Full game engine in the browser: PBR, sheen and clear-coat, shadow generator, glow layer, a default post pipeline (ACES, bloom, vignette, grain, sharpen, chromatic aberration), SSAO2, skeletons and bones, GPU instances and thin instances, solid particle system, `NullEngine` for headless tests. |
| **PlayCanvas 2.23.3** | Spike built in `experiments/engine-playcanvas/` (details in `notes/engine-playcanvas.md`). Strong renderer, but ~3.8× the old bundle and close to a full rewrite. |
| **Godot/Unity web export** (high-risk option) | Not prototyped. It would mean rewriting all gameplay in another language and a 10–40 MB WASM download. It also can't be built or verified in this container (no editor, no GPU). Listed for completeness. |

## Measured numbers (this container, Vite 7 production build)

| Build | Main JS (minified) | gzip | Notes |
| --- | ---: | ---: | --- |
| Old Three.js game (`three@0.170`) | 568 kB | 151 kB | baseline, measured before the port |
| Babylon port, `import … from "@babylonjs/core"` | 5,336 kB | 1,234 kB | root barrel pulls in the whole engine |
| **Babylon port, deep imports via `src/engine/babylon.js`** | **1,522 kB** | **385 kB** | shipped; plus lazily loaded shader chunks |
| PlayCanvas spike (`import * as pc`) | 2,220 kB | 568 kB | from the spike notes |
| PlayCanvas, minimal named imports | 2,067 kB | 532 kB | tree-shaking saves ~7% |

Baked character asset `public/assets/models.bin`: 2.5 MB (hero body, photo-matched head, alien).

## Why Babylon won

1. **Headless tests keep working.** `NullEngine` runs the real `Game`, real skeletons and real skinned meshes in Node. All 5 campaign tests pass, and they now also build the actual character rigs. PlayCanvas has `NullGraphicsDevice` too (verified by the spike), so this was a tie.
2. **Hemisphere light, skeletal skinning from raw vertex data, thin instances and SPS** map one-to-one onto how the old game was built. The gameplay files kept their logic, and only the scene-graph calls changed.
3. **Bundle**: deep imports bring Babylon to 385 kB gzip, below PlayCanvas' 532 kB minimum.
4. A single file (`src/engine/babylon.js`) owns every engine import, so changing engines again only touches `src/engine/` and the two builders.

## What did not change

Gameplay rules, stage layouts, sweet conservation, checkpoints, saves, HUD/DOM UI and the input mapping are the same code paths. The 5 existing integration tests still pass unchanged in intent; only the harness moved from Three objects to a headless Babylon renderer.

## Caveats (honest)

- Visual checks ran under SwiftShader (software GL) in a headless browser. Frame rate on real GPUs and phones was **not** measured here.
- `?quality=low|medium|high` switches shadow resolution, MSAA, SSAO, sharpen, grain and chromatic aberration. Touch devices default to `medium`.
- The first frame compiles many shaders, which is noticeably slow under software rendering.
