# Character comparison: how Veeramani is built (2026-10-15)

## A. Baseline (Three.js edition): primitive assembly

~60 separate spheres, cylinders and boxes grouped into "arms" and "legs" that rotate rigidly. The face was a photo on a half-sphere, so it read as a flat sticker (`visuals/baseline-threejs/03-hero-face.jpg`). Shoulders, elbows and the neck showed visible gaps, and there was no real skeleton.

## B. Shipped: SDF sculpt → Surface Nets → skinned mesh on a real skeleton

Pipeline (`src/actors/hero/`):

1. **Sculpt** (`heroDesign.js`): about 40 signed-distance primitives (capsules, round cones, ellipsoids, rounded boxes). Each one is tagged with a bone and a material region (skin, shirt, collar, veshti, sandal). Smooth-union blend radii give soft anatomy, and smooth subtraction carves the flat veshti hem and the eye sockets.
2. **Mesh** (`sdf.js`): Naive Surface Nets over the field (2 cm cells for the body, 9.5 mm for the head), with Newton projection onto the true surface and analytic-gradient normals. The result is watertight and has no seams between limbs.
3. **Skin weights**: each primitive adds `exp(-(d - dmin)/σ)` to its bone, and the top 4 bones are kept and normalised. The veshti gets custom weights, hanging from the hips and swinging with the thighs toward the hem.
4. **Bake** (`tools/bake-models.mjs`, `npm run bake`): about 6 s in Node, written to `public/assets/models.bin`. At runtime the game only decodes a binary file. Generating the mesh in the browser was measured at 4.5 s, too slow, which is why it is baked offline.
5. **Head texture** (`HeroBuilder.js`): the head gets a cylindrical UV layout. At load, every head triangle is rasterised in UV space and coloured by projecting its 3D surface point onto the supplied front photo. Front-facing points take the photo; sides and back take procedural salt-and-pepper hair and skin sampled from the photo's cheeks. The likeness now wraps a sculpted nose, brow, cheeks, lips and ears.
6. **Materials**: a multi-material split by region. Woven-cotton albedo/normal with PBR sheen for the shirt and veshti, plus skin and leather. Rigid attachments: buttons, a strap that hugs the torso (projected onto the SDF surface), and a cloth bag with a laddu on a spring-driven bone.
7. **Animation** (`HeroAnimator.js`): procedural and engine-neutral. Covers idle breathing and weight shift, a distance-driven run cycle (knee flex, counter-rotation, arm swing, turn lean), jump rise/fall, landing squash, dash, overhand throw, hurt recoil and a celebration wave. Footstep and landing events drive dust and sound.

The aliens use the same pipeline (`src/actors/alienDesign.js`), each with its own skeleton (body, head, arms, feet).

## Trade-offs

| | Primitive assembly | SDF skinned (shipped) |
| --- | --- | --- |
| Silhouette | blobby, gaps at joints | continuous, sculpted |
| Face | flat photo decal | photo wrapped on modelled relief |
| Animation | rigid part rotation | 21-bone skinning, 4 influences |
| Cost | ~60 draw calls | 2 skinned meshes + ~12 small attachments |
| Asset size | 0 (code) | 2.5 MB binary |
| Editability | edit code | edit `heroDesign.js`, then `npm run bake` |

## Limits (not claimed)

- This is not a photogrammetric scan. The profile and back of the head are modelled approximations, and only the front comes from the photograph (same provenance as before; see `docs/character-art.md`).
- Hands are mitten shapes with a thumb, with no fingers.
- Cloth is skinned, not simulated.
