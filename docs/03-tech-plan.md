# 03 — Technical plan

## Stack (proposed)

| Layer | Choice | Why |
|---|---|---|
| Build | Vite 8 + TypeScript | Fast, standard |
| App shell / UI | React 19 | Title screen, overlays, text cards, end card, settings |
| UI state | zustand 5 | Bridges game ↔ React without per-frame re-renders |
| Game core | **Framework-free TS** (`src/engine`, `src/game`) | Fixed-step loop, grid world, systems. Testable and React-agnostic |
| Rendering | **three.js + `postprocessing`** | One fullscreen ASCII shader + bloom. R3F isn't needed for one quad |
| Levels | LDtk (JSON) + PNG decals | Materials, collision and entities in LDtk; landmarks painted |
| Audio | Howler.js + raw Web Audio nodes | Stems/SFX + heartbeat + low-pass voice sweep |
| Deploy | Static build → itch.io (HTML5) + own domain | Zero backend |

## Architecture

```
React <App>
 ├─ <GameCanvas>  mounts engine once, never re-renders per frame
 ├─ <Overlay>     text cards, QTE prompts, touch controls  ← zustand
 └─ <EndCard>

engine/
 ├─ loop.ts        fixed 60 Hz update, rAF render, pause on blur
 ├─ grid.ts        CellBuffer: Float32/Uint8 arrays (rgb, material, light, flags)
 ├─ render/
 │   ├─ atlas.ts       bake glyph atlas from font at device pixel ratio
 │   ├─ ascii.frag     cell → glyph ramp(material, brightness, fear) → tint
 │   └─ renderer.ts    three.js quad + DataTexture upload + bloom
 ├─ light.ts       ambient + kitten radius + flashlight cones (shadowcasting)
 ├─ water.ts       reflection compose (mirror, ripple, tint, sky-only layer)
 ├─ audio.ts       Howler stems, heartbeat, lowpass voice
 └─ input.ts       keyboard + touch stick + context button

game/
 ├─ kitten.ts      controller, states (walk/crouch/pounce/wade/scared)
 ├─ shape.ts       the girl: beam path, scripted pursuit
 ├─ mood.ts        fear value + derived params
 ├─ scenes/        porch, field, pond, thorns, wall, ending
 └─ timeline.ts    tiny async cutscene sequencer (await wait(), pan(), say(), fade())
```

### Frame pipeline

1. **Update:** input → kitten → shape/beam → mood → triggers/timeline.
2. **Compose (CPU, about 14k cells):** base layer (LDtk materials + palette + noise) → decals → sprites (kitten, shape, fireflies) → water reflection → lighting multiply → mood color grade. The result is `cellRGB` + `cellMaterial` + `cellLight`.
3. **Upload** as one RGBA8 texture (RGB = color, A = material×16 + fear-bucket, or a second texture).
4. **GPU:** the ASCII shader picks glyph = `ramp[material][brightness + hash jitter]`, samples the atlas and tints it; then bloom on bright cells (moon, flashlight, fireflies).

The CPU compose is deliberate: gameplay already lives on the grid, it's easy to debug (you can dump a frame as text), and 14k cells is tiny. If profiling disagrees, steps 2c–2e can move to a GPU pass later.

### Key details to settle in the spike

- **Cell size and grid:** about 8–10 CSS px square cells. Portrait 390×844 → about 45×95 visible cells at 9 px. *Need to test whether that's too coarse; the reel is denser.* Alternative: a fixed logical grid (e.g. 72×128) scaled to fit.
- **Camera:** whole-cell scrolling vs. fixed rooms with cuts. Test both.
- **Font:** one bundled monospace or bitmap font with full coverage of our glyph set. Check coverage at build time.
- **Atlas rebaking** on DPR/resize.

## Milestones

Each milestone ends with a **gate**: something to look at or play, and a yes/no from you.

| # | Milestone | Output | Gate |
|---|---|---|---|
| M0 | **Vision lock** | These docs + answers to open questions | You sign off |
| M1 | **Renderer spike** (1–2 days) | Grid → ASCII shader, material ramps, static test scene, runs on your phone | Readable and pretty on a real phone at 60 fps? Pick cell size and camera approach |
| M2 | **Look-dev: the pond** (2–3 days) | One still-but-alive scene: grass sway, pond reflection with the fake moon, flashlight cone, fear slider (debug) | "Does a screenshot look like the reel?" |
| M3 | **Kitten feel** (2 days) | Movement, crouch, pounce, wading, tail/ear animation | Feels cute and responsive? |
| M4 | **Systems** (3–4 days) | Beam stealth, stones, chase, QTE, timeline, audio (heartbeat + low-pass voice) | Each beat playable in isolation |
| M5 | **Content pass** (3–4 days) | All 7 beats laid out in LDtk, script, ending cutscene, end card | Full playthrough, 2–3 min |
| M6 | **Polish + playtest** (3–5 days) | 5+ fresh playtesters, tune timing, accessibility, perf | Success criteria in 02-vision met |
| M7 | **Ship** | itch.io page + share card + trailer-length capture | Live |

Rough total: **~3–4 weeks** of focused work.

## Asset needs

- **Font:** 1 monospace or bitmap font (license check).
- **Art:** pixel-art decals at 1 px = 1 cell (porch, wall, the girl's silhouette and face for the ending, the lap end card), plus the kitten sprite sheet. Small: the kitten is maybe 4×3 cells.
- **Audio:**
  - crickets / night ambience loop
  - wind-in-grass
  - water wade/splash
  - heartbeat
  - footsteps (heavy)
  - hiss
  - ~~the girl's lines~~ (no voice acting; see 02-vision). Purr: synthesized in code (`src/engine/purr.ts`) + phone vibration
  - a soft music sting for the ending

  Sources: CC0 libraries (freesound / Sonniss GDC bundles) + record the voice lines ourselves.

## Accessibility and comfort

- No strobing: flashlight intensity changes over ≥250 ms.
- Settings: reduce motion (no screen shake or ripple), audio on/off. **No cozy mode** (decided: the tension is the point).
- Text cards stay until tapped, plus captions for the voice lines.
- **Brightness calibration** screen before the game ("turn brightness up until Milo's eyes are visible but the shape is not"), since the look changes a lot with screen brightness.

## Orientation handling (decided: phone portrait + desktop landscape equally)

- Fixed **cell size in CSS px** (tuned in M1). The viewport decides how many cells are visible, and the camera keeps the scene's 64×64 safe area fully on screen. If the safe area doesn't fit at the chosen cell size, cells shrink for that device.
- Controls adapt by input type, not by orientation: a touch stick + context button appears on the first touch, keyboard works always.
- M1 gate is tested on **both** a phone in portrait and a desktop window.
