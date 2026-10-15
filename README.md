# Mars Sweet Heist

A complete four-era browser campaign starring Veeramani. The project uses Three.js, local assets, Web Audio, and a Vite production build.

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

**Meet Veeramani** on the title screen opens a rotating full-body / face viewer. The hero has a curved 3D face mesh with nose and cheek relief, a photo-derived face texture, modeled hair and ears, articulated shoulders and elbows, blue shirt, white veshti, sandals and a cloth bag.

The supplied photograph establishes the frontal likeness. The face texture was generated from that reference with the built-in image-generation tool. The profile, back of the head and body are approximations, not a photogrammetric scan. See `docs/character-art.md` for the exact prompt and asset provenance.

## Develop

Requires Node.js 22.12+ (tested with 22.22.1).

```text
npm install
npm run dev
npm test
npm run build
```

`npm run preview` previews the production build. Vite's [official guide](https://vite.dev/guide/) describes its development/build workflow. Dependencies are locked in `package-lock.json`.

## Source map

- `src/config.js`: stage targets, timing, speed and gravity.
- `src/Game.js`: state machine, campaign transitions, snapshots, camera and projectiles.
- `src/core/`: audio, input, particles, persistence and primitive helpers.
- `src/actors/`: hero model, movement, thieves and Chief.
- `src/world/`: environment builders, authored extended routes, collectibles and courtyard.
- `src/ui/`: HUD, journal, map and responsive styles.
- `public/assets/veeramani-face.png`: local face texture.
- `tests/campaign.test.js`: production-code integration checks for progression, conservation, saves, boss, pause, movement and stun timing.
- `legacy/single-file.html`: preserved earlier edition.

Each level has 36 ground sweets, four carried per thief, and twelve extra in the Mars boss box. Keep that conservation rule when changing targets or layouts. Required sweets stay reachable from ground level; raised platforms hold optional tokens. One moving shadow light, fog, instanced sweets and decorations, a capped particle pool and a pixel-ratio limit keep rendering costs bounded.

## Research provenance

This is original game code and original environment/alien art. It uses genre ideas such as portal progression, readable obstacle timing and turning chase routes. REA was actually attempted earlier, but native Windows provider/source-import limitations prevented original-game binary analysis. No recovered Crash or Spyro code or assets are used. The earlier investigation is recorded in `.research/REA-REPORT.md`.

## Verification limits

The automated campaign traversal exercises the actual game systems with a lightweight rendering/DOM facade; it does not measure human difficulty or phone frame rates. Browser checks separately cover rendering, menus, the character viewer, courtyard, stage entry and responsive layout. This is a browser game project, not an Unreal/Unity photorealistic production or an exact recreation of either reference game.
