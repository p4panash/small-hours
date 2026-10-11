# 04 — M1 renderer spike: results

Status: **✅ gate passed (2026-10-11).**

## Run it

```sh
nvm use            # Node 24.14.1 (.nvmrc); Vite 8 needs ≥ 20.19
npm install
npm run dev        # serves on localhost and the LAN
```

- Desktop: http://localhost:5173
- Phone (same Wi-Fi): the `Network:` URL Vite prints, e.g. `http://192.168.1.180:5173`

Controls: WASD / arrows, or drag anywhere on touch. Shift crouches. The top-right pill opens the debug panel.

## What's in the spike

- **Renderer:** CPU cell buffer → RGBA8 texture → one GLSL3 fullscreen shader (glyph atlas baked at device pixel ratio, glyph ramps per material, a separate "fear" ramp mixed in per cell) → bloom.
- **Test world:** a procedural 180×140 map with the castle wall, pond, stepping stones, pines with shadows, berry bushes, tall grass, path and porch.
- **Lighting:** moonlight ambient, Milo's small aura, fireflies, and the flashlight cone with grid shadowcasting (trees and the wall cast shadows).
- **Water:**
  - Tall things and sprites mirror around their own shoreline, so Milo gets an upside-down reflection.
  - The sky (moon and stars) mirrors around one pond-wide horizon.
  - Whole-cell ripples, drifting surface bands, and wake rings when wading.
- **The girl's silhouette** in the reflection (debug toggle), with the lens glint.
- **Fear:** narrowing vision with a heartbeat pulse, a cold color grade, and jagged glyphs. Auto mode: the beam scares Milo; tall grass and crouching calm him.
- **Debug panel:** cell size, moonlight, glyph exposure, fear, camera (follow / rooms), flashlight (sweep / pointer / off), bloom, fireflies, the 64×64 safe-area overlay, and stats.

## Measured (headless Chrome on the dev Mac)

| Viewport | Grid | Cell (device px) | FPS | CPU compose |
|---|---|---|---|---|
| 390×844 @3× (phone portrait) | 55×120 | 21 | 60 | ~2.7 ms |
| 1280×800 @1× | 182×114 | 7 | 60 | — |
| 1920×1080 @2× | 274×154 | 14 | 60 | — |

A real mid-range phone CPU will be roughly 3–4× slower than this, which still fits in the 16 ms budget. **This needs confirming on your phone.**

## Learned during the spike

1. **Exposure is essential.** Night scenes only reach the bottom of each glyph ramp, so everything showed as `.`. A per-frame exposure (default 2.2) spreads them across the ramp. Light sources and Milo skip it, or they flatten into solid `@`.
2. **Mirror the sky around one horizon.** Using each column's own shoreline warped the moon into a funnel. Tall things still use their local shore, so trees and Milo reflect right at the bank.
3. **The flashlight must not turn water into "glow".** It saturated into a white blob that looked like the moon. Lit water now stays within the water glyphs.
4. **Level-design rule:** the fake reflection only shows things *north* of the water. For the beat-3 "shape behind Milo" moment, Milo has to be on the **north bank**, with the girl behind him (further north).
5. **Contrast between materials matters more than color.** The pines disappeared into the grass until they got their own hue (teal), a darker outline and ground shadows.
6. **The silhouette needs art direction.** At 9×15 cells it reads as "something dark in the water", not yet as a figure with pigtails. That's M2 work.
7. **Font coverage:** the fontsource subsets lack `≈ ∘ ○ ◦ ∙`. Ramps only use covered glyphs.

## Gate review: please check on your phone and on desktop

- [ ] Do the glyphs look good and readable at the default cell size (7 CSS px)? Try 5–9.
- [ ] Is it smooth (60 fps pill) on your phone?
- [ ] Camera: **follow** (scrolls in whole cells) or **rooms** (cuts)? Which feels better?
- [ ] Does the pond + moon reflection give you the feeling of the reel?
- [ ] Turn on "Shape in reflection" and walk Milo along the north bank (top edge of the pond). Is it creepy?
- [ ] Turn off "Auto fear" and drag the Fear slider. Does the mood shift feel right?

## Gate feedback (2026-10-11)

- ✅ Idea comes through. The **fear / panic effect lands** exactly as intended. Keep it.
- ❌ **Too green, and hard to tell what's around.** Carried into M2 as the main problem to solve (value hierarchy, palette, less ground noise).
- ✅ Smooth on the user's phone and desktop.
- ✅ Defaults kept: **follow camera**, **7 CSS px cells**. Rooms mode stays only for deliberate cutscene cuts.
- Note: on the phone at low screen brightness the green felt less harsh, so screen brightness changes the look a lot. → brightness calibration screen added to M6, and look-dev is checked at both bright and dim settings.
