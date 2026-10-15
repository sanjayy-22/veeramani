# Recommended next experiments

1. **Real-GPU performance pass**: measure frame time on a mid-range phone and laptop for each `?quality` level. Consider a cascaded shadow generator and capping SSAO at `high`.
2. **Facial animation**: blink and mouth movement via a second baked texture or morph targets on the head mesh, built with the same SDF pipeline and two parameter sets.
3. **Fingers**: add three finger capsules per hand, plus a grip pose for the throw.
4. **Verlet cloth for the veshti hem**: 12–16 hem particles driving extra bones, instead of linear skinning.
5. **glTF export of the baked models** (`models.bin` → `.glb`), so they can be opened and touched up in Blender.
6. **Light baking for static levels**: render ambient occlusion into vertex colours at build time; it is cheaper than SSAO on phones.
7. **Audio**: replace the synth melody with layered loops (nadaswaram/tavil motifs) and use positional audio for the aliens.
8. **Gamepad support** through the Babylon `DeviceSourceManager`.
