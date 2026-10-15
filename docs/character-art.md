# Character asset provenance

Mode: built-in image-generation tool, reference-image workflow.

Saved asset: `public/assets/veeramani-face.png`.

Reference: the user-supplied photograph attached to this conversation. The generated texture is projected from the front onto a sculpted 3D head and baked into a cylindrical head texture at load time (`src/actors/hero/HeroBuilder.js`, `bakeHeadTexture`). Unseen views are modelled approximations with procedural hair and skin.

Exact generation prompt:

Create a game face texture reference from the provided photograph of the user-authorized adult man. Preserve his recognizable face identity, broad face and nose, medium dark brown skin, thick black mustache, short salt-and-pepper stubble beard, short black swept hair and dark eyebrows. Remove the hand and all background and clothing. A single centered straight-on front view of the complete head, including ears and hair and chin, no neck, neutral relaxed closed mouth, eyes looking directly forward. Photorealistic natural skin detail, neutral diffuse studio illumination, no cast shadows, no highlights baked into skin, no perspective distortion. Head fills 92% of square image height. Transparent background outside the silhouette. This is a front projection texture for a 3D game head, not a cartoon, not a character sheet, no text. Only one head. Reconstruct the obscured forehead plausibly while preserving identity.
