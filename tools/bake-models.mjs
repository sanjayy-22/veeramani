// Offline asset bake: sculpt → Surface Nets → skin weights → public/assets/models.bin.
// Run with `npm run bake` after editing heroDesign.js or alienDesign.js.
import { writeFile } from "node:fs/promises";
import { buildBodyData, buildHeadData } from "../src/actors/hero/heroDesign.js";
import { buildAlienData } from "../src/actors/alienDesign.js";
import { encodeModels } from "../src/engine/modelFormat.js";

const t = performance.now();
const meshes = {
  heroBody: buildBodyData(0.02),
  heroHead: buildHeadData(0.0095),
  alien: buildAlienData(0.03),
};
const buffer = encodeModels(meshes);
await writeFile(new URL("../public/assets/models.bin", import.meta.url), buffer);
for (const [name, m] of Object.entries(meshes))
  console.log(`${name}: ${m.count} vertices, ${m.indices.length / 3} triangles`);
console.log(`models.bin ${(buffer.byteLength / 1024).toFixed(0)} KiB in ${((performance.now() - t) / 1000).toFixed(1)}s`);
