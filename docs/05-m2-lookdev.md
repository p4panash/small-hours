# 05 — M2 look-dev: the pond scene

Status: **first pass done, waiting for your visual feedback.**

## Goal

Fix "too green, hard to tell what's around" and get the pond scene to screenshot quality, using the reel's frame as the reference.

## What the reel does (and we now copy)

- **The water is the darkest thing on screen**, so the moon and reflections stand out.
- The clearing is a lit "stage"; the surroundings fall off into grey and black.
- Only a few big value groups, with distinct landmarks (the castle wall and gate).

## Changes in this pass

| Problem | Change |
|---|---|
| Random noise world | **Hand-designed clearing:** ruined castle wall + gate (top), path to the north bank, pond with stepping stones, boulders, bushes (hiding spots) along the north bank, tall-grass field to the south, porch at the bottom |
| Everything the same green | Dimmer, bluer ground; teal pines; near-black water; grey-blue stone. The brightest values go only to the moon, flashlight, fireflies and Milo |
| Ground read as one grid texture | Grass ramp is mostly empty with sparse ticks (the loud `"` and `:` are gone) |
| Forest was a noise field | Trees on a staggered grid with dark gaps, branch tiers, a bright tip, a dark rim. Depth fades to black; the deep forest isn't drawn |
| Moon cut in half by reflections | Only things within 14 rows of the shore reflect |
| Phone narrower than the 64×64 safe area | Cells shrink on narrow screens so 64 cells always fit (phone: 55 → 65 columns) |
| Milo was a blob | New 8×5 sprite: ears, glowing eye, pink nose, white chest and paws, stripe, with tones chosen so the glyphs draw his shape |
| Silhouette read as a blob | 15×21 figure: pigtails, arms, dress, rain boots, oversized flashlight. It appears 10 cells behind Milo |

## Open for feedback

- Overall mood and palette: still too green? Too dark?
- Is the scene readable now (wall, path, pond, bank, field)?
- Milo: cute and readable?
- The silhouette in the water: creepy enough? Too much?
- Moon size and position.

## Round 2 (after feedback: "trees and the shape are too small", "I can't see the girl")

**Setting:** the scene is now a **backyard at night**: porch, garden wall, garden pond. At a kitten's scale that makes the sizes believable.

| Feedback | Change |
|---|---|
| Milo: "shape is top, could be better defined" | 1-cell dark outline around him. Inside a bush, only his glowing eyes peek out |
| Trees too small | Pines are now 22–36 cells tall (2–4× the girl) with stacked tiers, dark undersides and thicker trunks. Bushes are big enough to hide Milo |
| The shape too small | The girl is ~20×37 cells, about 4× Milo's height |
| "I can't see the girl, nothing happens" | **She's on land now, as the Shape:** a faceless black silhouette with a pale dotted moonlit outline (pigtails, dress, rain boots, oversized flashlight). The beam comes from her hand |
| | **She reacts:** paces the north bank sweeping the pond → **notices** Milo in the open (freezes, light snaps onto him for 1.5 s) → **approaches** slowly → if he hides (bush, or crouching in tall grass) she **searches** around where she last saw him, then gives up |
| | Fear rises in her beam and when she's watching him nearby. She never fades into the fear darkness: you always see the threat |
| Reflections | Per object: only things standing near the shore reflect. Her reflection appears as a dark shape eating into the moon's reflection |

The "girl" debug option replaces the old flashlight toggle: `sweep` = her behaviour, `pointer` = aim the light with the mouse, `off` = remove her.

## Round 3 (feedback: "girl too large vs trees", "show the eyes more", "fog of war: Milo shouldn't see her shape")

- **Size:** the girl is scaled to ~25 rows. That's under the pines (22–36) but still ~3× Milo.
- **Fog over the girl (key decision):** Milo never sees her clearly. She's a blurry dark mass with boiling, smoky edges, and the blur grows with distance. Her flashlight is the only crisp thing about her. `clarity` (0 → 1) is reserved for the ending reveal, when she sharpens into the girl. Reflections inherit the blur, so the water doesn't spoil the twist either.
- **Hiding = glowing eyes:** in any hideout (bush, under the porch, the dark castle gate) or crouched in tall grass, only Milo's eyes show.
- **Opening:** Milo now spawns under the porch, so the game opens on two eyes in the dark (beat 1).
- **More cover:** bushes placed a few jumps apart along the route porch → pond → north bank, and on the west and east banks.

## Round 4: the ending cutscene (built)

Flow (`src/game/game.ts` timeline, `src/game/ending.ts` painter, `src/ui/EndingOverlay.tsx`):

1. **Trigger:** the girl stays within reach (13 cells) of Milo for 1.5 s while approaching. Or use **Play ending** in the debug panel.
2. **Flash (0–1.2 s):** the screen fades to warm white; fear peaks one last time.
3. **Title (1.2–4.4 s):** "Miloooo!" types itself out, with the o's stretched.
4. **Close-up (4.4 s+):** the white fades into a glyph painting authored in the 64×64 safe area, using bigger cells so it fills the screen. Milo sits in the grass looking up (glowing eyes) → she lifts him (1.4–3.4 s) → hug: both close their eyes `^ ^`, her head tilts toward him.
5. **Purr (from 4 s into the close-up):** three slow breaths. Android: the phone vibrates in a purr pattern. Everywhere: the fur glyphs ripple and a soft synthesized rumble plays (brown noise, 220 Hz low-pass, 24 Hz flutter). No voice, no samples.
6. **End card (9.5 s):** "Small Hours · Episode 1 · Milo" + Play again (resets the scene in place).

Renderer: new per-cell **glyph override** channel (R8 texture), so faces and text can use exact glyphs (`^ • u ω v *`). New materials: Skin (fine dotted texture so features pop) and Cloth.

Limits: iOS Safari has no Vibration API. Android requires a prior tap, which normal play provides.

## Round 5 (feedback: blonde girl, bushes on the way to her, darker surroundings, clean lake, nap opening)

- **The girl in the ending:** pale straw-blonde hair (kept clearly apart from Milo's orange) and fair skin.
- **Clean lake:** the stepping stones, boulders and bank bushes are gone. Only the moon, the sky, and the pines and the girl standing on the north bank reflect. If beat 3 (crossing) is kept, it can bring stones back.
- **Bush route:** a chain of 9 bushes, a few hops apart, from the nap tree → round the west side of the pond (well clear of the water) → along the north side → to where the girl paces. Three more on the east side for balance.
- **Darker surroundings:** everything outside the moonlit pond area falls off to 30% brightness.
- **Opening:** Milo naps curled up at the foot of a pine in a pool of moonlight (closed `-` eye, `z`s drifting up). A direction, or 6 s, wakes him; he blinks awake for a second, then you have control. He's never "hidden" while asleep, so you always see him. Only bushes and dark voids count as hiding spots now (tree canopies don't), and random forest trees keep clear of the nap spot.
- Sprites can now force glyphs (the `z`s, the closed eye), like the cutscene.

## Round 6: Milo is a brown tabby (reference: a photo of tabby kittens provided by the user)

- **Palette:** warm grey-brown fur, dark mackerel stripes, cream muzzle, chest and paws, pink-brown nose. **Eyes: glowing amber/orange** (user's call; they also read well in the dark).
- **Gameplay sprite:** forehead stripe, back stripes, ringed tail. The hiding-eyes use the same amber.
- **Close-up:** a tabby "M" on the forehead, cheek stripes, mackerel stripes down the sides, ringed tail, dark ear tips, cream muzzle. Amber `o` eyes while looking up at her, closed `^` in the hug.

## Round 7 (feedback: "the girl should have white skin, now she's black", "still bigger than the trees", "not enough bushes")

- **Skin:**
  - *Ending:* on a black background, sparse skin dots read as dark skin. Skin cells now get a pale fill behind the glyph (shader: Skin material background), and her eyes and mouth are drawn as dark **ink** on top (new INK flag in the cell alpha). Result: fair skin, `^ ^` eyes, pink blush and smile.
  - *Gameplay:* the fogged girl is now a **pale, moonlit mist** instead of a black mass. It's still unreadable (no face, no outline), but it no longer reads as a dark figure. Her reflection is a pale smudge.
- **Size:** she's ~19 rows (scale 0.52) with a tighter blur. Trees are taller (forest 28–40, bank pines 32–42, nap tree 36), so the pines are ~2× her height.
- **Bushes:** generated along Milo's whole route (nap tree → west side of the pond → north side → the girl), one every ~6 cells, zig-zagging like a hedge. Never more than a hop from cover.

## Round 8: cover where she paces

- Feedback (screenshot): Milo caught in the open tall grass on the north bank, east of the path, with no bush nearby.
- Added 7 bushes in a zig-zag across the north bank from the path to the east end of her pacing range, closer together than elsewhere since it's the riskiest stretch. They sit on the bank, clear of the water.

## Round 9: east-side cover

- Feedback (screenshot): no bushes on the east side.
- Added an **east hedge** mirroring the west one: from the south field, round the east side of the pond (clear of the water) up to her end of the north bank. Milo can now go either way around the pond.
- Bushes are exempt from most of the edge darkening (min 80% brightness). They're cover, so they must always read, even out in the dark.

## Round 10: night sky in the ending

- The **moon** (the same one that was in the pond all night) sits upper right, beside her pigtails. It's a shaded disc (limb darkening, soft maria) with a soft halo, placed inside the safe area so it shows on phone and desktop.
- **More stars:** twinkling `·` across the whole sky, with the occasional brighter `*`. On portrait screens they fill the tall sky above her.

## Round 11: the flashlight vs. the bushes

- Feedback (screenshot): with bushes all around her pacing route, her light "stopped working". Every bush cast a shadow, so the cone was cut off at her feet.
- Fix: she holds the light above bush height, so **bushes no longer block the flashlight**. Only trees and the wall cast shadows. Bushes still hide Milo (hiding is a separate check from light).

## Round 12: she catches Milo reliably

- Feedback: Milo could walk past her without triggering the ending.
- Before: she had to notice (1.5 s stare) → approach → keep him within 13 cells of her *feet* for 1.5 s.
- Now: she catches him whenever he's **visible and within 12 cells of any part of her body** (feet to head) for 0.4 s, or **instantly within 5 cells**. Hiding still saves him. Her stare is shortened to 0.5 s when he's close.
- Tested: sprinting past in the open → caught 7 cells before reaching her. Same sprint while hidden → passes.
