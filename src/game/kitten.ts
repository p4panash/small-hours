import { Mat } from "../engine/materials";
import type { Input } from "../engine/input";
import type { World } from "./world";
import type { SpriteLayer } from "./sprites";

// Placeholder sprite, facing right. Bottom row = feet; (FOOT_X, last row) sits on the kitten's position.
//   t tail · e ear · h head · i eye · c closed eye · n nose · b body · s stripe · w cream chest/paws · l leg
// Milo is a brown tabby: stripes on the forehead ("M"), back and tail rings.
const FRAMES = {
  sleep: [".....e.e", ".bsbshch", "tsbsbshh"], // curled up, tail tucked
  walkA: [".....e.e", "t...hshh", "s.bshihn", ".tsbswh.", "..l.l.w."],
  walkB: [".....e.e", ".s..hshh", "t.bshihn", ".tsbswh.", ".l.l..w."],
  idle: [".....e.e", "t...hshh", "s.bshihn", "tbsbswh.", ".l..l.w."],
  crouch: [".....e.e", "ts.bhihn", ".bsbswh.", ".lsll.w."],
};
const FOOT_X = 4;

// Brown tabby palette (warm grey-brown, dark stripes, cream muzzle and chest) with amber eyes.
// Tones vary on purpose: glyph density follows brightness, so shading draws Milo's shape.
const COLORS: Record<string, [number, number, number, Mat]> = {
  t: [0.58, 0.47, 0.34, Mat.Fur],
  e: [0.66, 0.55, 0.4, Mat.Fur],
  h: [0.74, 0.63, 0.47, Mat.Fur],
  i: [1.0, 0.6, 0.16, Mat.Glow],
  c: [0.42, 0.32, 0.22, Mat.Fur],
  n: [0.82, 0.52, 0.48, Mat.Fur],
  b: [0.64, 0.53, 0.39, Mat.Fur],
  s: [0.3, 0.22, 0.15, Mat.Fur],
  w: [0.9, 0.83, 0.68, Mat.Fur],
  l: [0.56, 0.46, 0.34, Mat.Fur],
};

export class Kitten {
  x: number;
  y: number;
  facing = 1;
  moving = false;
  crouching = false;
  wading = false;
  /** Set by the game each step: inside a bush (slower, and noisy unless crouching). */
  inBush = false;
  rustling = false;
  /** The game opens on Milo napping; a direction (or a few seconds) wakes him. */
  asleep = true;
  private sleepT = 0;
  private wakeT = 0;
  private walkT = 0;

  constructor(private world: World) {
    this.x = world.spawn.x;
    this.y = world.spawn.y;
  }

  update(dt: number, input: Input) {
    const dir = input.move();
    if (this.asleep) {
      this.sleepT += dt;
      if (Math.hypot(dir.x, dir.y) > 0.05 || this.sleepT > 6) {
        this.asleep = false;
        this.wakeT = 1.1;
      }
      return;
    }
    if (this.wakeT > 0) {
      // Blinking awake: a moment before he can move.
      this.wakeT -= dt;
      this.moving = false;
      return;
    }
    this.crouching = input.crouch();
    const fx = Math.round(this.x);
    const fy = Math.round(this.y);
    this.wading = this.world.inside(fx, fy) && this.world.mat[this.world.idx(fx, fy)] === Mat.Water;

    const speed = this.crouching ? 4 : this.wading ? 4.5 : this.inBush ? 6.5 : 10;
    this.moving = Math.hypot(dir.x, dir.y) > 0.05;
    if (dir.x !== 0) this.facing = dir.x > 0 ? 1 : -1;
    // Cells are square, so vertical speed matches horizontal.
    this.tryMove(this.x + dir.x * speed * dt, this.y);
    this.tryMove(this.x, this.y + dir.y * speed * dt);
    if (this.moving) this.walkT += dt * (this.wading ? 4 : 8);
  }

  private tryMove(nx: number, ny: number) {
    const cx = Math.round(nx);
    const cy = Math.round(ny);
    const w = this.world;
    if (!w.inside(cx, cy) || w.solid[w.idx(cx, cy)]) return;
    this.x = nx;
    this.y = ny;
  }

  /** hidden: only his glowing eyes peek out of the leaves, the dark, the grass. */
  draw(sprites: SpriteLayer, fear: number, t: number, hidden = false) {
    const frame = this.asleep
      ? FRAMES.sleep
      : this.crouching
      ? FRAMES.crouch
      : !this.moving
        ? FRAMES.idle
        : Math.floor(this.walkT) % 2 === 0
          ? FRAMES.walkA
          : FRAMES.walkB;
    const px = Math.round(this.x);
    const py = Math.round(this.y);
    // Wading hides the legs under the surface.
    const rows = this.wading ? frame.slice(0, -1) : frame;
    const top = py - frame.length + 1;
    const puff = fear > 0.6 ? 1.25 : 1; // tail fluffs up when scared
    const blink = Math.sin(t * 0.9) > 0.985;

    const cells: [number, number, string][] = [];
    rows.forEach((row, ry) => {
      [...row].forEach((ch, rx) => {
        if (!COLORS[ch]) return;
        const dx = this.facing > 0 ? rx - FOOT_X : FOOT_X - rx;
        cells.push([px + dx, top + ry, ch]);
      });
    });

    if (hidden) {
      if (blink) return;
      for (const [x, y, ch] of cells) if (ch === "i") {
        sprites.put(x, y, ...COLORS.i.slice(0, 3) as [number, number, number], Mat.Glow, true, py);
        sprites.put(x - this.facing * 2, y, ...COLORS.i.slice(0, 3) as [number, number, number], Mat.Glow, true, py);
      }
      return;
    }

    // A dark outline separates Milo from the ground, the way pixel-art sprites do.
    const occupied = new Set(cells.map(([x, y]) => `${x},${y}`));
    for (const [x, y] of cells) {
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const key = `${x + ox},${y + oy}`;
        if (occupied.has(key)) continue;
        occupied.add(key);
        sprites.put(x + ox, y + oy, 0.012, 0.01, 0.01, Mat.Void, true, py);
      }
    }

    if (this.asleep) {
      // Little z's drifting up and fading.
      for (let k = 0; k < 3; k++) {
        const p = (t * 0.45 + k / 3) % 1;
        const fade = Math.sin(p * Math.PI);
        const zx = px + this.facing * (3 + Math.round(p * 3));
        const zy = top - 1 - Math.round(p * 5);
        sprites.put(zx, zy, 0.7 * fade, 0.8 * fade, 1 * fade, Mat.Glow, true, -999, "z");
      }
    }
    const eyesShut = this.asleep || this.wakeT > 0.45;

    for (const [x, y, ch0] of cells) {
      const ch = ch0 === "i" && eyesShut ? "c" : ch0;
      if (ch === "c") {
        sprites.put(x, y, ...(COLORS.c.slice(0, 3) as [number, number, number]), Mat.Fur, false, py, "-");
        continue;
      }
      let [r, g, b, mat] = COLORS[ch];
      if (ch === "t") [r, g, b] = [r * puff, g * puff, b * puff];
      if (ch === "i" && blink) [r, g, b, mat] = COLORS.h;
      sprites.put(x, y, r, g, b, mat, ch === "i" && !blink, py);
    }
  }
}
