import { Mat } from "../engine/materials";
import { fbm, hash2 } from "../engine/noise";

/** Seconds into the close-up when each beat lands. */
export const ENDING = {
  liftStart: 1.4,
  hug: 3.4,
  purrStart: 4.0,
  endCard: 9.5,
};

const SIZE = 64; // authored in the 64×64 safe area
// The same moon that was in the pond all night, upper right beside her pigtails (fits portrait too).
const MOON = { x: 55, y: 8, r: 4.6 };
// Pale blonde (more straw than gold, so she never reads as "orange like Milo"); fair skin,
// kept dim so the placed features pop against its fine dotted texture.
const HAIR = [0.78, 0.7, 0.42];
const SKIN = [0.98, 0.86, 0.8]; // fair; skin cells get a pale fill (see the shader)
const INK = 16;

interface Target {
  gridW: number;
  gridH: number;
  cells: Uint8Array;
  glyphs: Uint8Array;
  glyphId: (ch: string) => number;
}

function smooth(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** 0..1 purr strength: three slow breaths of rumbling. */
export function purrEnvelope(t: number) {
  const p = t - ENDING.purrStart;
  if (p < 0) return 0;
  return Math.max(0, Math.sin((p / 2.2) * Math.PI)) ** 0.6 * Math.min(1, p * 2);
}

/**
 * The reveal: the girl, finally clear, kneels and lifts Milo into a hug.
 * Painted straight into the cell buffer; warm palette, no fear, no fog.
 */
export class EndingPainter {
  private target!: Target;
  private ox = 0;
  private oy = 0;

  paint(t: number, target: Target) {
    this.target = target;
    const { gridW, gridH } = target;
    this.ox = Math.floor((gridW - SIZE) / 2);
    this.oy = Math.floor((gridH - SIZE) / 2);

    // Milo's path: on the grass → lifted → held against her chest.
    const lift = smooth((t - ENDING.liftStart) / (ENDING.hug - ENDING.liftStart));
    const mx = 32;
    const my = Math.round(52 - lift * 16);
    const hugging = t >= ENDING.hug;
    const purr = purrEnvelope(t);

    this.background(t);
    this.girlBody(t);
    this.milo(mx, my, t, hugging, purr);
    this.hands(mx, my, t, lift, hugging);
    this.girlHead(hugging ? 1 : 0, t);
  }

  /** ink: draw the glyph in dark ink over the cell's color (eyes on her face). */
  private put(x: number, y: number, r: number, g: number, b: number, mat: Mat, glyph = "", ink = false) {
    const { gridW, gridH, cells, glyphs } = this.target;
    const gx = x + this.ox;
    const gy = y + this.oy;
    if (gx < 0 || gy < 0 || gx >= gridW || gy >= gridH) return;
    const i = gy * gridW + gx;
    cells[i * 4] = Math.max(0, Math.min(255, r * 255));
    cells[i * 4 + 1] = Math.max(0, Math.min(255, g * 255));
    cells[i * 4 + 2] = Math.max(0, Math.min(255, b * 255));
    cells[i * 4 + 3] = mat | (ink ? INK : 0);
    glyphs[i] = glyph ? this.target.glyphId(glyph) : 0;
  }

  private ellipse(cx: number, cy: number, rx: number, ry: number, fn: (x: number, y: number, d: number) => void) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d <= 1) fn(x, y, d);
      }
    }
  }

  /** Night grass, warmed by the flashlight she dropped in the grass (still on). */
  private background(t: number) {
    const { gridW, gridH } = this.target;
    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const x = gx - this.ox;
        const y = gy - this.oy;
        const v = y / SIZE;
        const glow = Math.max(0, 1 - Math.hypot(x - 32, y - 40) / 34) ** 2;
        const beam = Math.max(0, 1 - Math.hypot(x - 2, (y - 58) * 2.2) / 22) ** 1.5;
        const grass = y > 48;
        const fine = hash2(gx, gy);
        const md = Math.hypot(x - MOON.x, y - MOON.y);
        const halo = Math.max(0, 1 - (md - MOON.r) / 7) ** 2 * 0.22;
        let r = 0.03 + v * 0.05 + glow * 0.22 + beam * 0.5 + halo * 0.8;
        let g = 0.04 + v * 0.05 + glow * 0.15 + beam * 0.42 + halo * 0.85;
        let b = 0.09 - v * 0.03 + glow * 0.06 + beam * 0.25 + halo;
        if (grass) {
          const sway = 0.85 + 0.25 * Math.sin(x * 0.5 - t * 1.4 + fine * 2);
          r = (0.1 + glow * 0.3 + beam * 0.4) * sway;
          g = (0.2 + glow * 0.32 + beam * 0.45) * sway;
          b = (0.1 + glow * 0.1 + beam * 0.2) * sway;
        }
        if (md < MOON.r) {
          // Shaded disc: limb darkening and soft maria, like its reflection in the pond.
          const limb = 0.6 + 0.4 * Math.sqrt(1 - (md / MOON.r) ** 2);
          const maria = fbm(x * 0.5 + 3, y * 0.5) > 0.58 ? 0.75 : 1;
          const k = limb * maria;
          this.put(x, y, 0.95 * k, 0.94 * k, 0.86 * k, Mat.Glow);
          continue;
        }
        // Twinkling stars across the sky; a few brighter ones as '*'.
        if (!grass && y < 30 && md > MOON.r + 3 && fine > 0.972) {
          const tw = 0.35 + 0.35 * Math.sin(t * (1.5 + fine * 2) + fine * 50);
          const bright = fine > 0.993;
          this.put(x, y, tw, tw, tw * 1.15, Mat.Glow, bright ? "*" : "·");
          continue;
        }
        this.put(x, y, r, g, b, grass ? Mat.TallGrass : Mat.Void);
      }
    }
    // The flashlight, lying in the grass, still on.
    for (let x = 8; x <= 12; x++) this.put(x, 58, 0.35, 0.36, 0.42, Mat.Stone);
    this.put(7, 58, 1, 0.96, 0.82, Mat.Glow);
    // A few fireflies drifting over the scene.
    for (let i = 0; i < 6; i++) {
      const fx = Math.round(8 + ((i * 11 + t * 1.5 * (i % 2 ? 1 : -1)) % 48 + 48) % 48);
      const fy = Math.round(6 + i * 6 + Math.sin(t * 0.8 + i) * 2);
      const b = Math.max(0, Math.sin(t * 1.3 + i * 2));
      if (b > 0.2) this.put(fx, fy, 0.8 * b, 1 * b, 0.35 * b, Mat.Glow);
    }
  }

  private girlBody(t: number) {
    // Pajamas with little stars; a slow breath.
    const breath = Math.sin(t * 1.4) * 0.4;
    // On tall (portrait) screens she continues to the bottom edge instead of ending mid-air.
    const bottom = Math.max(63, this.target.gridH - this.oy);
    for (let y = 27; y <= bottom; y++) {
      const half = 9 + (y - 27) * 0.17 + breath;
      for (let x = Math.floor(32 - half); x <= 32 + half; x++) {
        const edge = Math.abs(x - 32) / half;
        const lit = 1.05 - edge * 0.35 + (x < 32 ? 0.08 : -0.05);
        const star = hash2(x * 3, y * 7) > 0.93;
        if (star) this.put(x, y, 0.95, 0.85, 0.45, Mat.Glow, "*");
        else this.put(x, y, 0.5 * lit, 0.6 * lit, 0.85 * lit, Mat.Cloth);
      }
    }
    // Neck.
    for (let y = 25; y <= 27; y++) for (let x = 30; x <= 34; x++) this.put(x, y, SKIN[0] * 0.85, SKIN[1] * 0.85, SKIN[2] * 0.85, Mat.Skin);
  }

  private girlHead(tilt: number, t: number) {
    const cx = 32 + tilt;
    const cy = 16;
    // Pigtails with red ties.
    for (const s of [-1, 1]) {
      this.ellipse(cx + s * 11, cy + 1, 3.6, 3.4, (x, y) => this.put(x, y, HAIR[0], HAIR[1], HAIR[2], Mat.Fur));
      this.ellipse(cx + s * 12, cy + 6, 2.4, 3, (x, y) => this.put(x, y, HAIR[0] * 0.85, HAIR[1] * 0.85, HAIR[2] * 0.85, Mat.Fur));
      this.put(cx + s * 9, cy - 1, 0.95, 0.25, 0.3, Mat.Glow);
    }
    this.ellipse(cx, cy, 9, 9.5, (x, y) => {
      const dx = x - cx;
      const hair = y < cy - 4 + Math.abs(dx) * 0.15 || Math.abs(dx) > 7.2 - Math.max(0, y - cy) * 0.2;
      const bang = y === Math.floor(cy - 4) && hash2(x, 3) > 0.5;
      const lit = dx < 0 ? 1.12 : 0.92;
      if (hair || bang) this.put(x, y, HAIR[0] * lit, HAIR[1] * lit, HAIR[2] * lit, Mat.Fur);
      else this.put(x, y, SKIN[0] - Math.abs(dx) * 0.015, SKIN[1], SKIN[2], Mat.Skin);
    });
    // Puffy eyes: she was crying. Open and wet while lifting; closed and happy in the hug.
    const happy = tilt > 0;
    for (const s of [-1, 1]) {
      const ex = cx + s * 4;
      if (happy) this.put(ex, cy + 1, SKIN[0], SKIN[1], SKIN[2], Mat.Skin, "^", true);
      else {
        this.put(ex, cy + 1, SKIN[0], SKIN[1], SKIN[2], Mat.Skin, "•", true);
        const tear = Math.sin(t * 2 + s) > 0.2;
        if (tear) this.put(ex - s, cy + 2, 0.75, 0.88, 1, Mat.Skin, "·");
      }
      this.put(ex, cy + 2, 1, 0.74, 0.74, Mat.Skin); // puffy, pink under the eyes
      this.put(ex + s * 2, cy + 3, 1, 0.62, 0.64, Mat.Skin, "·"); // blush
      this.put(ex + s * 3, cy + 3, 1, 0.62, 0.64, Mat.Skin, "·");
    }
    this.put(cx, cy + 5, 1, 0.55, 0.58, Mat.Skin, happy ? "u" : "o", true);
  }

  private milo(mx: number, my: number, t: number, hugging: boolean, purr: number) {
    // Purring ripples through the fur: the glyphs churn with the rumble.
    const fur = (x: number, y: number, r: number, g: number, b: number) => {
      const k = 0.62 * (1 + purr * 0.25 * Math.sin(t * 38 + (x + y) * 1.3) + (hash2(x, y) - 0.5) * 0.15);
      this.put(x, y, r * k, g * k, b * k, Mat.Fur);
    };
    // Brown tabby (pre-scale; `fur` dims everything by ~0.6 so the glyphs vary).
    const BASE = [1.0, 0.84, 0.62];
    const LIGHT = [1.12, 0.96, 0.72];
    const STRIPE = [0.48, 0.35, 0.24];
    const CREAM = [1.3, 1.2, 1.0];
    const paint = (x: number, y: number, c: number[]) => fur(x, y, c[0], c[1], c[2]);

    // Tail, curled around, with dark rings.
    for (let i = 0; i < 5; i++) {
      paint(mx + 7 + Math.round(Math.sin(i * 0.8 + t * 0.6)), my + 8 - i, i % 2 ? STRIPE : BASE);
    }
    // Body with mackerel stripes down the sides, cream chest and paws.
    this.ellipse(mx, my + 5, 7, 4.6, (x, y) => {
      const side = Math.abs(x - mx);
      const stripe = side > 2 && (side + Math.round((y - my) * 0.5)) % 3 === 0;
      paint(x, y, stripe ? STRIPE : BASE);
    });
    this.ellipse(mx, my + 4, 3, 2.6, (x, y) => paint(x, y, CREAM));
    for (const s of [-1, 1]) for (let x = 0; x < 2; x++) paint(mx + s * 3 + x * s, my + 9, CREAM);
    // Ears: dark tips, pink insides.
    for (const s of [-1, 1]) {
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i <= row; i++) {
          const x = mx + s * (5 - i + Math.floor(row / 2));
          const inner = row === 2 && i === 1;
          if (inner) this.put(x, my - 7 + row, 0.85, 0.55, 0.55, Mat.Fur);
          else paint(x, my - 7 + row, row === 0 ? STRIPE : BASE);
        }
      }
    }
    // Head: the tabby "M" on the forehead, cheek stripes, a cream muzzle.
    this.ellipse(mx, my - 1, 6.2, 4.4, (x, y) => {
      const dx = x - mx;
      const forehead = y <= my - 3 && (dx === -2 || dx === 0 || dx === 2) && !(dx === 0 && y === my - 3);
      const cheek = Math.abs(dx) >= 5 && (y === my - 1 || y === my + 1);
      const muzzle = (dx / 2.6) ** 2 + ((y - my) / 1.5) ** 2 <= 1;
      if (muzzle) paint(x, y, CREAM);
      else if (forehead || cheek) paint(x, y, STRIPE);
      else paint(x, y, y < my - 2 ? LIGHT : BASE);
    });
    // Face: glowing amber eyes looking up at her, then closed and content in the hug.
    for (const s of [-1, 1]) {
      if (hugging) this.put(mx + s * 2, my - 2, 1, 0.72, 0.4, Mat.Glow, "^");
      else this.put(mx + s * 2, my - 2, 1, 0.6, 0.16, Mat.Glow, "o");
    }
    this.put(mx, my - 1, 0.92, 0.55, 0.5, Mat.Glow, "v");
    this.put(mx, my, 1, 0.9, 0.78, Mat.Glow, "ω");
  }

  private hands(mx: number, my: number, t: number, lift: number, hugging: boolean) {
    // Sleeves from her shoulders to her hands at Milo's sides.
    const reach = hugging ? 7 : 8;
    for (const s of [-1, 1]) {
      const sx = 32 + s * 10;
      const sy = 30;
      const hx = mx + s * reach;
      const hy = my + (hugging ? 4 : 3) + (lift < 1 && !hugging ? 0 : Math.round(Math.sin(t * 1.4) * 0.4));
      const steps = Math.ceil(Math.hypot(hx - sx, hy - sy));
      for (let i = 0; i <= steps; i++) {
        const x = Math.round(sx + ((hx - sx) * i) / steps);
        const y = Math.round(sy + ((hy - sy) * i) / steps);
        for (const w of [0, s]) this.put(x - w, y, 0.46, 0.56, 0.8, Mat.Cloth);
      }
      this.ellipse(hx, hy, 1.8, 1.4, (x, y) => this.put(x, y, SKIN[0], SKIN[1], SKIN[2], Mat.Skin));
    }
  }
}
