# Mars Sweet Heist

A complete four-era browser campaign starring Veeramani. It runs on the **Babylon.js** game engine (PBR materials, real-time shadows, bloom, SSAO, ACES tone mapping, skeletal animation) with local assets, Web Audio and a Vite production build. The earlier Three.js edition was replaced; `legacy/single-file.html` still holds the original prototype.

## Play on this PC

Double-click **Start Game.cmd**. It serves the included `dist` build and opens your browser. Keep its window open while playing; close it or press Ctrl+C to stop. Node.js is required and is already installed on this PC. The compiled game makes no CDN requests and needs no internet connection.

Opening the source HTML directly is no longer the launch method: this edition is a modular application with local assets. You can also run `node tools/serve.mjs` and open the printed address. Saved progress belongs to the browser and local address you use.

## Campaign

Enter the Time Courtyard, then walk into the glowing Madurai portal or select **Enter era**. Complete each stage to unlock the next portal. Revisit completed eras for a better score and medal.

| Era | Sweets | Thieves | Time | Route features |
| --- | ---: | ---: | ---: | --- |
| Madurai Diwali Street | 48 | 3 | 7:00 | Festival lane, lantern market, puddles, stalls, rangoli and fireworks |
| Ancient Tamil Kingdom | 52 | 4 | 7:30 | Causeway, rolling pots, pillared gardens and gopuram square |
| Prehistoric Jungle | 52 | 4 | 8:00 | Fern valley, lava crossings, side paths and a moving friendly dinosaur |
| Mars | 60 | 3 | 8:20 | Low gravity, craters, base perimeter and the Alien Chief |

Recover all **212 sweets**. Each stage also has **three optional festival tokens** on raised platforms. Tokens award 250 points each. Three tokens and more than 35% time remaining earn gold; two tokens earn silver; finishing earns bronze. Unused time awards five points per second. Replays retain your best-scoring result, so campaign totals never count the same era twice.

Light the three checkpoint rings along each route by walking through their centers. Checkpoints save your sweets, caught aliens, remaining loot, tokens and time. Damage respawns you at the last lit checkpoint while keeping your current pickups. Retry restores the checkpoint snapshot with at least four lives and 90 seconds. The title screen's **Continue checkpoint** button resumes it after closing the browser. The boss restarts from the last safe checkpoint.

## Controls

WASD / arrows move; Space jumps; Shift dashes; E or click throws a homing sparkler at nearby aliens. Touch a stunned alien within two seconds, then collect its scattered sweets. Esc pauses. The pause menu can retry the checkpoint or return to the courtyard. Touch devices have a joystick and Jump, Dash and Sparkler buttons.

Coffee increases speed for 12 seconds. Jasmine attracts sweets for 14 seconds. An Extra Diya restores one life. The Chief's shield alternates between four seconds closed and four seconds open. Stun him three times, touch his golden box, collect its twelve sweets, and enter the exit portal.

## Character

**Meet Veeramani** on the title screen opens a rotating full-body / face viewer.

Veeramani is a single continuous skinned mesh on a 21-bone skeleton. He was sculpted from signed-distance shapes, meshed with Surface Nets and baked offline into `public/assets/models.bin`. His head is a separate sculpt with a nose, brow, cheeks, lips and ears. At load time the supplied face texture is wrapped onto it, with procedural hair and skin on the sides and back. His blue shirt (pockets, placket, collar), white veshti with gold border, sandals, cross-body strap and spring-swinging cloth bag use woven-cotton PBR materials with sheen.

He is animated procedurally: idle breathing and weight shifts, a distance-driven run cycle, jump and fall poses, landing squash, a dash lean, an overhand sparkler throw, a hurt recoil and a celebration wave. Footsteps raise dust and play sounds. The aliens are built the same way.

The supplied photograph establishes the frontal likeness. The face texture was generated from that reference with the built-in image-generation tool. The profile, back of the head and body are modelled approximations, not a photogrammetric scan. See `docs/character-art.md` for the exact prompt and asset provenance, and `notes/comparison-character.md` for the pipeline.

## Graphics quality

Add `?quality=low`, `?quality=medium` or `?quality=high` to the address. Desktop defaults to high (MSAA, SSAO, sharpening, film grain); touch devices default to medium.

## Develop

Requires Node.js 22.12+ (tested with 22.22.1).

```text
npm install
npm run dev
npm test
npm run build
npm run bake   # only after editing src/actors/hero/heroDesign.js or src/actors/alienDesign.js
```

`npm run preview` previews the production build. Vite's [official guide](https://vite.dev/guide/) describes its development/build workflow. Dependencies are locked in `package-lock.json`.

## Source map

- `src/config.js`: stage targets, timing, speed, gravity and each era's lighting mood.
- `src/Game.js`: state machine, campaign transitions, snapshots, chase camera, shake and hit-stop, projectiles.
- `src/engine/`: the only Babylon.js code. `babylon.js` (tree-shaken engine imports), `Renderer.js` (lights, shadows, sky shader, post-processing), `prims.js` (instanced geometry, PBR materials, textured slabs, labels), `textures.js` (procedural tileable PBR textures), `Particles.js` and `modelFormat.js`.
- `src/core/`: audio, input, persistence, engine-neutral vector math.
- `src/actors/`: player, thieves and Chief gameplay; `hero/` holds the SDF sculpt, mesher, skinning, builder and procedural animator.
- `src/world/`: environment builders, authored extended routes, collectibles and courtyard.
- `src/ui/`: HUD, journal, map and responsive styles.
- `public/assets/`: face texture and baked character meshes.
- `tests/campaign.test.js`: integration checks for progression, conservation, saves, boss, pause, movement and stun timing. They run the real game and character rigs on Babylon's headless `NullEngine`.
- `experiments/`, `notes/`, `visuals/`: the engine and character exploration (PlayCanvas spike, hero viewer, comparisons, before/after screenshots).
- `legacy/single-file.html`: preserved earlier edition.

Each level has 36 ground sweets, four carried per thief, and twelve extra in the Mars boss box. Keep that conservation rule when changing targets or layouts. Required sweets stay reachable from ground level; raised platforms hold optional tokens. One moving shadow light, fog, instanced sweets and decorations, a capped particle pool and a pixel-ratio limit keep rendering costs bounded.

## Research provenance

This is original game code and original environment/alien art. It uses genre ideas such as portal progression, readable obstacle timing and turning chase routes. REA was actually attempted earlier, but native Windows provider/source-import limitations prevented original-game binary analysis. No recovered Crash or Spyro code or assets are used. The earlier investigation is recorded in `.research/REA-REPORT.md`.

## Verification limits

The automated campaign traversal exercises the actual game systems with a lightweight rendering/DOM facade; it does not measure human difficulty or phone frame rates. Browser checks separately cover rendering, menus, the character viewer, courtyard, stage entry and responsive layout. Screenshots in `visuals/` were captured with software rendering (SwiftShader). Frame rates on real GPUs and phones have not been measured. This is a browser game project, not an Unreal/Unity photorealistic production or an exact recreation of either reference game.
