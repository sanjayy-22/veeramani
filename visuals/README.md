# Visuals

- `baseline-threejs/`: the previous Three.js edition, captured before the port.
- `babylon-port/`: the same tour on the Babylon.js edition (production build, `?quality=high`). `overview-grid.jpg` combines them.
- `hero-babylon/`: the new skinned Veeramani in the hero viewer (`experiments/hero-viewer/`).

Every screenshot was captured in headless Chromium with SwiftShader software rendering (`tools/shoot.mjs`, `tools/snap.mjs`). A real GPU renders the same scenes, but frame rates were not measured.
