# Mars Sweet Heist — investigation record

Date: 15 October 2026

## What actually ran

The official npm package `rea-agents@6.5.0` was downloaded and executed. Its CLI lives in npm's transient cache; no persistent Codex MCP registration was changed.

- `providers --json` succeeded. Saved output: `rea-providers.json`. Ghidra and IDA are unconfigured; Hopper is unavailable on this host. No native game-analysis session was opened.
- `inspect-artifact` on each downloaded source directory failed with `directory_requires_file`. These error receipts are `rea-spyro-artifact.json` and `rea-warped-artifact.json`; they are not successful analysis evidence.
- `import-reference-source` on the Spyro source failed with `unsupported_host`: native Windows lacks the safe file-open support required by this operation. Receipt: `rea-source-import.json`.
- The available WSL distribution is Docker Desktop; its Linux engine was not running. No Linux distribution, native decompiler, or commercial game was installed.

**REA did not recover either game's mechanics.** Its successful use in this task was availability discovery; attempted target/source analysis was blocked. Manual review below is explicitly separate.

## Downloaded references

- [Spyro the Dragon public decompilation](https://github.com/TheMobyCollective/spyro-1), commit `0d228ab704a1e24e65e5180adab062197d123d81`, saved in `spyro-1/`.
- [Warped reconstruction setup](https://github.com/alexbeavs-ps1-ports/crash-bandicoot-3-warped-recomp), commit `4f28550188177c1699065f0d00d5f82a5ed61e78`, saved in `warped-reference/`.

The Warped project's README explicitly excludes the disc, retail BIOS and generated retail code. It requires an original SCUS-94244 disc image to proceed. Its setup files cannot establish the game's hub, dinosaur, movement or boss algorithms. An official retail download found during research was the remastered N. Sane Trilogy, not the 1998 executable. No original-game download was obtained.

## Manual source findings and limits

`spyro-1/src/moby_helpers.c`, function `MoveMobyAlongPath`, describes and implements general object movement along a closed node path. It limits angular turning, stops forward movement when the target is too far off-heading, limits travel to remaining distance, supports optional velocity smoothing, and wraps the current-node index.

This function is a general helper. The investigation did **not** establish the egg thief's call site, its precise speed/awareness rules, or matching behavior in a running original game. No original code or assets were pasted into the browser game.

## Changes made to our game

- Original alien controller now has bounded turning and gradual acceleration; sharp corners provide slower interception opportunities. Parameters and the stun/catch/snack system remain original design decisions. This was informed by manual review, not a successful REA trace.
- Veeramani was remodeled from the user's photo as a stylized primitive character: short swept hair, fuller face, mustache/stubble, blue collared shirt, white veshti and cloth bag. No photo texture or external model is used.
- Added a character viewer with rotation, close-up and return controls.

## Remaining requirement

Actual Warped reverse engineering still requires a supplied original game executable/disc and a compatible configured native-analysis engine (with PS1/MIPS loading verified). Exact thief-specific reconstruction similarly needs a verified source routine or executable investigation. The existing portal, dinosaur and boss logic is original and must not be described as recovered from Crash or Spyro.

## Verification

The updated game passed JavaScript syntax checking. The focused `check-update.mjs` harness uses the game's pinned Three.js geometry/math module and tests the actual extracted character builder and Alien class. It passed at 30, 60 and 120 updates per second: route wrapping, bounded angular speed, slower corners, finite bounded positions, conserved loot, two-second stun/catch behavior and no duplicate collection after capture. Geometry checks confirmed articulated limbs and instanced stubble. This harness does not emulate the original games or establish equivalence to them.

The character viewer was also rendered in the browser; the game console reported no errors during inspection. No full manual replay of all four chapters was performed for this update.
