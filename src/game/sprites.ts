import type { Mat } from "../engine/materials";

/**
 * World-sized overlay for moving things (kitten, the girl, fireflies). Stamped per
 * frame instead of cleared, so reflections can look up sprites anywhere in the world.
 */
export class SpriteLayer {
  readonly rgb: Float32Array;
  readonly mat: Uint8Array;
  readonly emissive: Uint8Array;
  /** Row of the owning object's feet; reflections only show objects standing near the shore. */
  readonly base: Int16Array;
  /** Forced glyph as a char code (0 = pick by brightness). */
  readonly glyph: Uint16Array;
  private stamp: Uint32Array;
  private frame = 1;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    const n = w * h;
    this.rgb = new Float32Array(n * 3);
    this.mat = new Uint8Array(n);
    this.emissive = new Uint8Array(n);
    this.base = new Int16Array(n);
    this.glyph = new Uint16Array(n);
    this.stamp = new Uint32Array(n);
  }

  begin() {
    this.frame++;
  }

  put(x: number, y: number, r: number, g: number, b: number, mat: Mat, emissive = false, base = y, glyph = "") {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.stamp[i] = this.frame;
    this.rgb[i * 3] = r;
    this.rgb[i * 3 + 1] = g;
    this.rgb[i * 3 + 2] = b;
    this.mat[i] = mat;
    this.emissive[i] = emissive ? 1 : 0;
    this.base[i] = base;
    this.glyph[i] = glyph ? glyph.charCodeAt(0) : 0;
  }

  has(i: number) {
    return this.stamp[i] === this.frame;
  }
}
