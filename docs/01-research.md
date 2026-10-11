# 01 — Research notes

Research done on 2026-10-11 to decide how to build *Small Hours*, a 2–3 minute ASCII-rendered narrative game.

## 1. The reference

The reel is Senje (@ansenjeo), "Making the ASCII MMORPG of my dreams — Water reflection test" (2026-10-10).
Caption: *"I realized the water looked artificial without reflections, so I spent today fixing that. The sky is now faked too, especially the moon."*

What the frame shows:
- A top-down pixel-art scene (castle, grass, pond, pines). **Every pixel is replaced by a glyph tinted with that pixel's color.**
- The glyph grid is very dense, so from a distance it reads as pixel art and up close it reads as text.
- Grass uses vertical-stroke glyphs and stone uses dense ones, so the **glyph choice depends on the material**, not only on brightness.
- The pond reflects the moon and the trees. The sky is never on screen; it exists only inside the reflection ("faked").

**Takeaway:** this is a normal 2D renderer with an ASCII pass at the end. It is not a terminal or text-mode game.

## 2. ASCII rendering techniques

| Approach | Verdict |
|---|---|
| DOM text (drei `AsciiRenderer`, three.js `AsciiEffect`) | Too slow for about 15–20k colored glyphs per frame. Rejected. |
| Canvas2D `fillText` per cell | Works for a few hundred cells and gets too slow at our density. Rejected. |
| `@react-three/postprocessing` `<ASCII>` | Maps brightness to one color with one glyph ramp, so no per-cell color and no materials. **Use as a reference only.** |
| **Custom shader + font atlas** | One fullscreen fragment shader: cell → color + material → glyph index → atlas lookup → tint. Every serious implementation uses this. **Chosen.** |

Common elements across implementations (Acerola's video, the 5weetdev Minecraft shader, Babylon and vfx-js versions):
- A **font atlas** texture, either baked at startup with Canvas2D (so it's crisp at the device's pixel ratio) or a bitmap font.
- A **brightness → glyph ramp**, ordered from sparse to dense.
- Optional **edge pass** (Sobel, Difference of Gaussians) that swaps in `/ \ | _ -` along outlines. Nice to have, not needed for v1.
- A per-cell hash adds variation so flat areas don't look like a repeating pattern.

## 3. Water reflection (2D top-down)

Standard trick, also in the reel:
1. For each water cell, sample the scene **mirrored around the shoreline** (the row above the water's top edge).
2. Offset the sample sideways with `sin(row * k + time)` for ripples. **Shift whole cells**, never fractions, so the grid stays crisp.
3. Darken the result, tint it toward the water color, and fade it with distance from the shore.
4. Draw "sky-only" sprites (moon, stars) **only into the reflection layer**.

Known issue: non-symmetric sprites look wrong when flipped. Fix it by fading the reflection toward a flat color plus ripple, which hides the mismatch.

**For our story:** the "moon" in the pond is really the girl's flashlight. The reflection layer can show things that aren't drawn on land (the looming figure). Here the fake-sky trick also tells the story.

## 4. Light, flashlight and visibility

- The world is a grid, so we can use **roguelike field-of-view algorithms** (symmetric shadowcasting) for the flashlight cone. Cast only across the cone's angles, and recompute only when the light moves or turns.
- `rot.js` has FOV helpers, but our case is simple enough (one or two cones plus the kitten's small vision radius) to write ourselves in about 100 lines.
- Lighting is computed per cell on the CPU: ambient + kitten night-vision radius + flashlight cone (with occlusion) + fireflies. That gives a light value per cell, which feeds the glyph ramp directly. **Darkness means sparser glyphs, so the renderer is also the fog of war.**

## 5. Engine / stack

Versions checked on npm on 2026-10-11:

| Package | Version |
|---|---|
| react | 19.3.0 |
| vite | 8.3.4 |
| typescript | 7.0.2 |
| three | 0.186.1 |
| postprocessing | 6.39.5 |
| @react-three/fiber | 9.8.1 |
| pixi.js | 8.22.0 |
| howler | 2.2.4 |
| zustand | 5.0.15 |

Findings:
- PixiJS v8 is the most natural fit for flat 2D sprites and has easy custom GLSL filters. R3F's overhead over plain three.js is a few percent; per-frame React state updates are the real risk.
- **Our renderer barely uses sprites.** The world is a cell grid (about 90×160 = 14,400 cells in portrait). The JS game composes a per-cell color + material buffer (cheap, about 1–2 ms), uploads it as a small texture, and **one fullscreen shader** draws the glyphs. Bloom goes on top.
- So the engine choice comes down to "which library gives a fullscreen shader + data texture + bloom with the least friction". **three.js + `postprocessing` (bloom is built in)**, driven by a framework-free TS game loop and mounted in a React component. R3F isn't needed for one quad; React handles menus, the HUD, text cards and the end card.

## 6. Level authoring

| Tool | Notes |
|---|---|
| **LDtk** | Plain JSON. IntGrid layers (good for material and collision), typed entities (triggers, stones, checkpoints), auto-tile rules, world view. Collision is DIY, which suits us since our collision is the grid. |
| Tiled | Mature, built-in collision shapes. Single map per file. More than we need. |
| Pixel editor (Aseprite) PNG layers | Best for hand-painted landmarks (porch, castle wall, the final scene). |

**Plan:** LDtk for materials, collision and entities. Ground color comes from per-material palettes plus noise. Hand-painted PNG "decals" (1 px = 1 cell) for landmarks and cutscene frames.

## 7. Audio

- **Howler.js** for loading and looping ambient stems and SFX. It handles autoplay unlocking on mobile and audio sprites.
- **Raw Web Audio nodes** for the two story-critical effects:
  - **Heartbeat** whose rate and volume follow `fear`.
  - **The girl's voice calling, behind a low-pass filter.** The cutoff starts around 400 Hz (muffled, unrecognizable, scary) and opens to full range in the final cutscene, when it becomes *"Milo! There you are."* The scare-to-wholesome flip is also an audio filter sweep.
- Tone.js isn't needed; we have no procedural music.

## 8. Design references

- **Little Kitty, Big City:** small, sheltered cat with a personal goal. The cat **hates water, and puddles are used as barriers.** Humans are **deliberately faceless** because "from the cat's point of view, you're just dealing with *the thing*". That's exactly our approach: the girl is "the shape" until the reveal.
- **Stray:** criticized for a self-important tone. Note for us: keep it small and gentle, not epic.
- **Short narrative browser games** (Bitsy games, *The Company of Myself*, Now Play This collections). Lessons:
  - Tiny scope is a feature.
  - **The core action should be the story beat** (A Dark Room's "stoke fire").
  - Audio carries most of the dread for very little cost.
  - Respect the player's time.
  - Multiple endings drive replays (possible later, not needed for v1).

## 9. Risks found

| Risk | Mitigation |
|---|---|
| Glyphs unreadable or noisy on small phone screens | Early spike on a real phone. Tune cell size (about 8–10 CSS px). Limit glyph ramps to shapes that read well small. |
| Smooth camera scrolling under a fixed glyph grid shimmers | Scroll the world in whole cells (looks retro and intended), or use mostly fixed-screen rooms. Decide in the spike. |
| Unicode glyphs missing from the chosen font | **Confirmed in M1:** the bundled JetBrains Mono subsets lack `≈ ∘ ○ ◦ ∙`. Ramps use only covered glyphs (`· ° •` and `~ = -` for water). |
| Mobile audio autoplay | The start screen needs a tap anyway ("tap to begin"), which unlocks audio. |
| Flashlight "blinding" moments and photosensitivity | No strobing. Fades over ≥250 ms. Reduce-motion setting. |
| Square pixel-art cells vs. tall monospace glyphs | Use **square cells** with the glyph centered. 1 art pixel = 1 cell keeps authoring trivial. |

## Sources

- [Senje's reel](https://www.instagram.com/reel/DeUqed7xIoO/)
- [react-postprocessing ASCII effect](https://react-postprocessing.docs.pmnd.rs/effects/ascii)
- [Drei docs (AsciiRenderer)](https://drei.docs.pmnd.rs/llms-full.txt)
- [three.js forum: ASCII post-processing](https://discourse.threejs.org/t/asci-threejs-post-processing/89064)
- [vfx-js AsciiEffect](https://amagi.dev/vfx-js/docs/classes/_vfx-js_effects.AsciiEffect.html)
- [Godot ASCII shader (Acerola-style)](https://godotshaders.com/shader/ascii-shader/)
- [ASCII Minecraft shader (DoG + Sobel)](https://modrinth.com/shader/K5CUBBea)
- [Babylon.js ASCII post-process](https://forum.babylonjs.com/t/ascii-shader-using-glsl-postprocessing/56666)
- [2D water reflections (top down)](https://foxyofjungle.itch.io/water-reflective)
- [2D reflections, quick & dirty](https://jacobknispel.itch.io/flowa/devlog/261753/2d-reflections-quick-dirty)
- [Defold 2D water reflection sample](https://github.com/FlexYourBrain/sample_2d_water_reflection)
- [Pixel-art-safe distortion (Godot forums)](https://godotforums.org/d/22847-shader-for-pixel-art-that-doesn-t-warp-the-pixels)
- [PixiJS filters docs](https://pixijs.download/release/docs/filters.html)
- [PixiJS v8 launch](https://pixijs.com/blog/pixi-v8-launches)
- [R3F scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- [JS game rendering benchmark](https://github.com/Shirajuki/js-game-rendering-benchmark)
- [LDtk](https://ldtk.io)
- [Tiled vs LDtk discussion](https://redlib.hackliberty.org/r/gamedev/comments/1l5vhrw/tiled_vs_ldtk/mwk0zd4/?context=3)
- [Kontra: LDtk vs Tiled formats](https://github.com/straker/kontra/issues/273)
- [Howler.js for browser game audio](https://dinogame.gg/blog/how-to-use-howler-js-audio/)
- [Howler vs Tone.js comparison](https://www.pistack.xyz/posts/2026-08-23-javascript-audio-libraries-howler-tonejs-wavesurfer-comparison/)
- [Grid shadow casting (Love2D forum)](https://love2d.org/forums/viewtopic.php?p=25019)
- [HxLightMask](https://github.com/larsiusprime/HxLightMask)
- [Cone of vision + lighting (Godot forum)](https://forum.godotengine.org/t/2d-top-down-is-it-possible-to-have-both-a-cone-of-vision-and-lighting/59447)
- [Little Kitty, Big City: faceless humans](https://gonintendo.com/contents/22933-little-kitty-big-city-dev-explains-the-game-s-faceless-humans)
- [Little Kitty, Big City review (water as barrier)](https://nintendoworldreport.com/review/67736/little-kitty-big-city-switch-review)
- [Designing narrative browser games in 5 minutes](https://dev.to/aguier/designing-branching-narratives-in-5-minutes-how-i-built-two-narrative-browser-games-5a39)
- [Best browser games with great stories](https://dinogame.gg/blog/best-browser-games-with-great-stories/)
- [Bitsy narrative game guide](https://www.421.news/en/make-your-first-narrative-game-with-bitsy/)
