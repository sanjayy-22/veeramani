import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  // legacy/single-file.html loads its own Three.js from a CDN import map; keep it out of the scan.
  optimizeDeps: { entries: ["index.html", "experiments/hero-viewer/index.html"] },
  build: { target: "es2022", chunkSizeWarningLimit: 1600 },
});
