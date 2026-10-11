# 02 — Vision: *Small Hours* (working title)

> A 2–3 minute game. A kitten is lost in the dark, and something huge with one glowing eye is looking for it.
> At the end you find out the "monster" was the person who loves it most.

## The anthology (long-term)

These are **short-format games**, the game version of short-form video. Each episode:
- takes **2–3 minutes** to play from start to end;
- delivers **one emotion** (scary, happy or wholesome), and should land whichever one it is;
- ends on a **shareable end card**;
- is built on the **same engine** (ASCII renderer, mood system, water, light, audio, cutscene timeline), so later episodes are mostly new maps, palette, script and sound.

*Small Hours* is episode 1: **scary turning wholesome.**

## Pillars

1. **Feel small.** You're a kitten. The world is big, dark and loud. The camera, sounds and pacing all serve that.
2. **Fear is visible.** One `fear` value drives the look and sound: glyph sharpness, color temperature, visibility radius and heartbeat. You can *see* the kitten getting scared.
3. **The truth is in the reflection.** The pond shows what's really there. Attentive players can work out the twist; everyone else gets a surprise that holds up on a replay.
4. **Never cruel.** It's scary but never gory or mean. The kitten can't really die: failure means a short retreat to a checkpoint, so the 3-minute pacing holds.
5. **Wordless, no voice acting** (decided). At most a few lines of text in the whole game. The first is "Where is everyone?" and the last is "Miloooo!" on a white screen.

## Characters

- **Milo**, a small **brown tabby** kitten with glowing amber eyes. A few cells across. Simple, readable silhouette; tail and ear animation carry the emotion (tail puffs up when scared).
- **The Shape**, really **the girl**: Milo's owner, a little girl (about 6–7) in pajamas and rain boots, out after bedtime with a flashlight that is too big for her hands. To Milo she is enormous. Never shown fully until the end (faceless, like *Little Kitty, Big City*). Seen as: a sweeping beam, giant footsteps shaking the grass glyphs, a looming silhouette in reflections, and a muffled voice.
- **Fireflies** are gentle guides. Light means glyphs appear, so they literally draw the path.

## Beat sheet (target ~2:30)

| # | Time | Scene | Player does | Emotion | Renderer and audio |
|---|---|---|---|---|---|
| 1 | 0:00–0:20 | **Nap tree.** Milo wakes from a nap, curled at the foot of a pine (decided in M2). Text: *"Where is everyone?"* | Learn to move, crouch and pounce (on a firefly) | Alone, curious | Dark yard, a pool of moonlight on Milo, `z`s drifting up. Crickets. |
| 2 | 0:20–0:50 | **Tall grass field.** A beam sweeps in the distance. | Stealth: hide in tall grass when the beam passes. Getting caught startles the kitten, and the beam lingers before moving on | Unease | Grass `' " , ; \|` sways. Glyphs in the beam are bright and sharp. Muffled distant "voice" (low-passed). |
| 3 | 0:50–1:30 | **The pond.** It has to be crossed. | Timed jumps across wobbling stepping stones. One stone sinks: **hold to be brave** while the kitten wades (it hates water) | Dread → courage | **Reflections:** the moon, which is really the flashlight, and the shape behind you show up in the water *before* you see them on land. |
| 4 | 1:30–2:05 | **Thorn bushes.** The shape follows. | Short chase: break line of sight and squeeze through gaps | Panic | Fear rises: glyphs turn jagged `/ \ x #`, colors go cold, vision shrinks. Hiding calms it. Heartbeat. |
| 5 | 2:05–2:30 | **"Boss": dead end at the old wall.** | The shape fills the screen and the light floods in. Hiss and swipe (quick-time prompts). **Every hit lands and it keeps coming.** You can't win, and you don't need to | Cornered terror | Dense `@ # %`, screen shake, bloom without flashing. The voice is clearer but still muffled. |
| 6 | 2:30–2:50 | **The flip** (decided, built in M2) | Nothing (cutscene) | Relief, warmth | Her light floods the screen **white**. On the white, ***"Miloooo!"*** types itself out (no voice). The white fades into a glyph close-up: the girl, finally clear (dark pigtails with red ties, pajamas with stars, puffy eyes from crying), kneels and **picks Milo up** into a hug. Both close their eyes `^ ^`. **The phone vibrates: Milo purrs** (visual fur ripple + soft synthesized rumble where vibration isn't supported, e.g. iPhone). |
| 7 | End | **End card** | Play again | Wholesome | Over the hug: "Small Hours · Episode 1 · Milo". Her flashlight lies in the grass, still on. |

## Core loop and controls

- **Verbs:** move, crouch/hide, pounce/jump, hold-to-brave, swipe (boss).
- **Mobile:** virtual stick on the left thumb, one context button on the right (pounce / brave / swipe).
- **Desktop:** WASD or arrows + Space.
- Each challenge is introduced in a safe spot first, then tested once. **No challenge repeats more than twice.**

## Mood system (the main idea)

```
fear ∈ [0..1]    rises: in beam, near shape, in water, chase
                 falls: hiding in grass/bushes, near fireflies, standing still

fear → glyph ramp      soft  · • ° ' "    →   sharp  / \ x # @
fear → color grade     warm amber          →   cold blue/violet
fear → vision radius   wide                →   narrow
fear → audio           crickets            →   heartbeat + low drone
```

The ending is fear smoothly going to −1, a "warmth" state below zero that only the final scene reaches.

## Explicitly out of scope (v1)

- Multiplayer, saves, inventory, dialogue trees, multiple endings, procedural levels.
- Death or a game-over screen. Failure is a 2-second setback.
- Any combat that can be won.

## Success criteria

- A first-time player finishes in **2:00–3:30** (median ~2:30).
- In playtests, people **flinch** at least once (beat 4 or 5) and **smile** or say "aww" at the flip.
- Runs at 60 fps on a mid-range phone (~2022 Android) in both portrait and landscape.
- The end card is something people want to screenshot.

## Tension: "a touch too tense" (decided)

No cozy mode. The scare should go slightly past comfortable, so the flip lands harder. Tools, all non-gory:
- **Silence as a weapon.** The crickets stop a second before the shape shows up. Silence becomes the warning, and players learn to dread it.
- **The beam lingers.** When the light finds Milo in beat 2, it *stops* on him for an uncomfortably long 1.5 s before moving on. Nothing happens, and that's the scary part.
- **The reflection tells the truth first.** In beat 3, the shape appears in the water *behind* Milo while the land around him still looks empty. No music sting, just a ripple.
- **The boss holds too long.** In beat 5, after the last swipe the screen sits in full light and near-silence for ~3 s with only the heartbeat. Then the hand comes down. That held moment is the "too tense" part.
- **Limits:** no gore, no injury, no jump-scare sound blasts (startles come from silence and motion, not volume spikes), and no strobing.

## Framing across orientations (decided: both equally)

- Every scene is authored around a **safe area** (~64×64 cells) that is always visible. Portrait shows extra world above and below; landscape shows extra on the sides.
- Story-critical things (the reflection reveal, the boss, the ending) happen **inside the safe area**, so they're never cropped.
- The extra margin is atmosphere only: more grass, more dark, more pond.

## The girl (decided)

Making her a little girl strengthens the twist: the "monster" turns out to be the most harmless person there is, and she's out in the dark too, probably just as scared.
- **Clues hidden in plain sight** (for replays):
  - the flashlight beam wobbles at her height and swings unsteadily, like a small arm holding something heavy;
  - her footsteps are **rain boots**: squelchy and uneven, not heavy and stomping. Pitched down and low-passed they still sound huge to Milo;
  - she's **always fogged**: to Milo she's a blurry, smoky dark mass with a light, never a readable figure (decided in M2 look-dev). Clues that survive the blur: the light sits low, at a child's height; the mass is small next to the pines; she *searches* rather than hunts, giving up and wandering off.
- **Reveal (beat 6):** the light lowers, she kneels down to Milo's level, her face comes out of the glyphs with puffy eyes because she has been crying, and she says *"Milo! There you are."* She was scared for him the whole time.
- **End card:** Milo asleep in her lap on the porch steps, her flashlight lying in the grass, still on.

## Her calling during gameplay (open proposal)

No voice acting means the muffled "voice through a low-pass filter" idea is gone. Proposed replacement: **her calls appear as text fragments drifting from the light**, broken and unreadable to Milo:

- early: `. . o . .`  ·  `.i.o`
- mid: `M . l o`  ·  `. i l o o`
- the end completes it: **"Miloooo!"** on white.

So the player half-reads the name all along, and the ending makes it whole.
