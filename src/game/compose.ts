import { Mat } from "../engine/materials";
import { noise2 } from "../engine/noise";
import type { Settings } from "../store";
import type { Fireflies, Girl } from "./actors";
import type { Kitten } from "./kitten";
import type { SpriteLayer } from "./sprites";
import type { World } from "./world";

export interface View {
  camX: number;
  camY: number;
  gridW: number;
  gridH: number;
}

export interface Frame {
  world: World;
  sprites: SpriteLayer;
  kitten: Kitten;
  girl: Girl;
  fireflies: Fireflies;
  settings: Settings;
  fear: number;
  t: number;
}

const MOON_LIGHT = [0.62, 0.72, 1.0];
const BEAM_LIGHT = [1.0, 0.93, 0.75];
const FLY_LIGHT = [0.45, 0.55, 0.15];

/** CPU light map + scene composition into the renderer's RGBA8 cell buffer. */
export class Composer {
  private light = new Float32Array(0);
  private tmp = new Float32Array(4);
  lightAtKitten = 0;

  /** glyphs/glyphId: per-cell forced glyphs (sprites like the sleeping `z`s), see AsciiRenderer.glyphs. */
  compose(f: Frame, view: View, out: Uint8Array, glyphs: Uint8Array, glyphId: (ch: string) => number) {
    const { gridW, gridH } = view;
    if (this.light.length !== gridW * gridH * 3) this.light = new Float32Array(gridW * gridH * 3);
    this.computeLight(f, view);

    const { world, sprites, kitten, settings, fear, t } = f;
    const kx = kitten.x;
    const ky = kitten.y;
    // Fear narrows what Milo can see; past 0.6 the edge pulses with a heartbeat.
    const beat = fear > 0.6 ? Math.max(0, Math.sin(t * (6 + fear * 4))) ** 8 * 4 : 0;
    const vision = 150 - fear * 132 - beat;
    const cold = Math.max(0, fear) * 0.55;
    const c = this.tmp;
    const safe = settings.safeArea ? this.safeRect(view) : null;

    for (let vy = 0; vy < gridH; vy++) {
      for (let vx = 0; vx < gridW; vx++) {
        const o = (vy * gridW + vx) * 4;
        const li = (vy * gridW + vx) * 3;
        const wx = vx + view.camX;
        const wy = vy + view.camY;
        if (!world.inside(wx, wy)) {
          out[o] = out[o + 1] = out[o + 2] = 0;
          out[o + 3] = Mat.Void;
          continue;
        }
        const wi = world.idx(wx, wy);
        let mat: number = world.mat[wi];
        let r = world.rgb[wi * 3];
        let g = world.rgb[wi * 3 + 1];
        let b = world.rgb[wi * 3 + 2];
        let emissive = false;
        const lr = this.light[li];
        const lg = this.light[li + 1];
        const lb = this.light[li + 2];

        if (sprites.has(wi)) {
          mat = sprites.mat[wi];
          r = sprites.rgb[wi * 3];
          g = sprites.rgb[wi * 3 + 1];
          b = sprites.rgb[wi * 3 + 2];
          emissive = sprites.emissive[wi] === 1;
          const forced = sprites.glyph[wi];
          if (forced) glyphs[vy * gridW + vx] = glyphId(String.fromCharCode(forced));
          if (!emissive && mat === Mat.Fur) {
            // Milo stays readable in the dark: partly self-lit.
            const k = 0.5 + 0.5 * Math.min(1, (lr + lg + lb) / 3);
            r *= k;
            g *= k;
            b *= k;
            emissive = true;
          }
        } else if (mat === Mat.Grass || mat === Mat.TallGrass || mat === Mat.Foliage) {
          // Wind gusts roll across the field as bands of brightness (= glyph changes).
          const gust = noise2(wx * 0.05 - t * 0.35, wy * 0.05);
          const wave = Math.sin(wx * 0.3 + wy * 0.12 - t * 2.2);
          const k = 1 + wave * gust * (mat === Mat.Foliage ? 0.12 : 0.3);
          r *= k;
          g *= k;
          b *= k;
        }

        if (mat === Mat.Water && !sprites.has(wi)) {
          const shoreY = world.shoreY[wi];
          const d = wy - shoreY;
          // Whole-cell ripple offsets keep the grid crisp.
          // Mostly 0, occasionally ±1, so the moon wobbles instead of shredding.
          const ripple = Math.round(Math.sin(wy * 0.9 + t * 1.3) * 0.45 + Math.sin(wy * 0.31 - t * 0.7) * 0.35);
          const rx = wx + ripple;
          const ry = shoreY - (d - 1);
          const skyY = world.waterTop - (wy - world.waterTop - 1);
          this.reflectedAt(f, rx, ry, skyY, shoreY, c);
          const fade = Math.max(0.3, 1 - d / 32);
          // Slow drifting bands on the surface so open water isn't a flat sheet of one glyph.
          const band = 0.55 + 0.9 * noise2(wx * 0.12 + t * 0.25, wy * 0.45 - t * 0.1);
          r *= band;
          g *= band;
          b *= band;
          r = r * lr * 0.9 + c[0] * 0.8 * fade;
          g = g * lg * 0.9 + c[1] * 0.8 * fade;
          b = b * lb * 0.9 + c[2] * 0.8 * fade;
          if (c[3] === 1 && Math.max(c[0], c[1], c[2]) > 0.5) mat = Mat.Glow;
          // Wake rings around a wading kitten.
          const kd = Math.hypot(wx - kx, (wy - ky) * 1.4);
          if (kitten.wading && kd > 1.5 && kd < 3.5) {
            const ring = 0.5 + 0.5 * Math.sin(kd * 3 - t * 8);
            r += 0.12 * ring;
            g += 0.16 * ring;
            b += 0.22 * ring;
          }
          emissive = true;
        }

        if (!emissive) {
          r *= lr;
          g *= lg;
          b *= lb;
        }

        // Fear grade: vision falloff + colder, desaturated colors.
        const dist = Math.hypot(wx - kx, wy - ky);
        let vis = Math.min(1, Math.max(0.12, (vision - dist) / (vision * 0.45)));
        // The Shape never fades into the dark: fear makes you see the threat, not lose it.
        if (mat === Mat.Shade) vis = Math.max(vis, 0.85);
        if (cold > 0) {
          const l = r * 0.3 + g * 0.59 + b * 0.11;
          r += (l * 0.7 - r) * cold;
          g += (l * 0.8 - g) * cold;
          b += (l * 1.25 - b) * cold;
        }
        r *= vis;
        g *= vis;
        b *= vis;

        if (safe && (vx === safe.x0 || vx === safe.x1 || vy === safe.y0 || vy === safe.y1)) {
          if (vx >= safe.x0 && vx <= safe.x1 && vy >= safe.y0 && vy <= safe.y1) {
            mat = Mat.Debug;
            r = 0.9;
            g = 0.2;
            b = 0.3;
          }
        }

        out[o] = r >= 1 ? 255 : r <= 0 ? 0 : (r * 255) | 0;
        out[o + 1] = g >= 1 ? 255 : g <= 0 ? 0 : (g * 255) | 0;
        out[o + 2] = b >= 1 ? 255 : b <= 0 ? 0 : (b * 255) | 0;
        out[o + 3] = mat;
      }
    }
  }

  /**
   * What the water mirrors at sky-space (x, y): sprites and tall things, else sky.
   * Only objects whose feet are near this shoreline reflect, so trees far behind it
   * don't cover the sky (and the moon).
   */
  private reflectedAt(f: Frame, x: number, y: number, skyY: number, shore: number, out: Float32Array) {
    const { world, sprites, t, settings } = f;
    const nearShore = (base: number) => shore - base >= -2 && shore - base <= 14;
    if (world.inside(x, y)) {
      const i = world.idx(x, y);
      if (sprites.has(i) && nearShore(sprites.base[i])) {
        const r = sprites.rgb[i * 3];
        const g = sprites.rgb[i * 3 + 1];
        const b = sprites.rgb[i * 3 + 2];
        // Her mist reflects as a pale smudge; the water would otherwise swallow it.
        const k = sprites.mat[i] === Mat.Shade ? 1.1 : sprites.emissive[i] ? 0.9 : 0.6;
        out[0] = r * k;
        out[1] = g * k;
        out[2] = b * k;
        out[3] = sprites.mat[i] === Mat.Glow ? 1 : 0;
        return;
      }
      if (world.tall[i] && nearShore(world.base[i])) {
        const k = settings.ambient * 0.55;
        out[0] = world.rgb[i * 3] * k * MOON_LIGHT[0];
        out[1] = world.rgb[i * 3 + 1] * k * MOON_LIGHT[1];
        out[2] = world.rgb[i * 3 + 2] * k * MOON_LIGHT[2];
        out[3] = 0;
        return;
      }
    }
    world.sky(x, skyY, t, out);
  }

  private safeRect(view: View) {
    const half = 32;
    const cx = Math.floor(view.gridW / 2);
    const cy = Math.floor(view.gridH / 2);
    return { x0: cx - half, x1: cx + half - 1, y0: cy - half, y1: cy + half - 1 };
  }

  private computeLight(f: Frame, view: View) {
    const { gridW, gridH, camX, camY } = view;
    const L = this.light;
    const amb = f.settings.ambient;
    for (let i = 0; i < gridW * gridH; i++) {
      L[i * 3] = MOON_LIGHT[0] * amb;
      L[i * 3 + 1] = MOON_LIGHT[1] * amb;
      L[i * 3 + 2] = MOON_LIGHT[2] * amb;
    }

    const add = (wx: number, wy: number, k: number, col: number[]) => {
      const vx = wx - camX;
      const vy = wy - camY;
      if (vx < 0 || vy < 0 || vx >= gridW || vy >= gridH) return;
      const i = (vy * gridW + vx) * 3;
      L[i] += col[0] * k;
      L[i + 1] += col[1] * k;
      L[i + 2] += col[2] * k;
    };

    // Milo's tiny warm aura.
    this.radial(f.kitten.x, f.kitten.y, 5, (x, y, k) => add(x, y, k * 0.35, [1, 0.8, 0.55]));

    if (f.settings.fireflies) {
      for (const fly of f.fireflies.flies) {
        const b = f.fireflies.brightness(fly, f.t);
        if (b > 0.05) this.radial(fly.x, fly.y, 4.5, (x, y, k) => add(x, y, k * b, FLY_LIGHT));
      }
    }

    const beam = f.girl;
    this.lightAtKitten = 0;
    if (beam.on) {
      const x0 = Math.max(camX, Math.floor(beam.x - beam.range));
      const x1 = Math.min(camX + gridW - 1, Math.ceil(beam.x + beam.range));
      const y0 = Math.max(camY, Math.floor(beam.y - beam.range));
      const y1 = Math.min(camY + gridH - 1, Math.ceil(beam.y + beam.range));
      const kx = Math.round(f.kitten.x);
      const ky = Math.round(f.kitten.y);
      for (let wy = y0; wy <= y1; wy++) {
        for (let wx = x0; wx <= x1; wx++) {
          const dx = wx - beam.x;
          const dy = wy - beam.y;
          const d = Math.hypot(dx, dy);
          if (d > beam.range || d < 0.5) continue;
          let da = Math.atan2(dy, dx) - beam.angle;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          const edge = 1 - Math.abs(da) / beam.halfAngle;
          if (edge <= 0) continue;
          if (this.occluded(f.world, beam.x, beam.y, wx, wy)) continue;
          const k = (1 - d / beam.range) ** 1.2 * Math.min(1, edge * 3) * 1.9;
          add(wx, wy, k, BEAM_LIGHT);
          if (wx === kx && wy === ky) this.lightAtKitten = k;
        }
      }
    }
  }

  private radial(cx: number, cy: number, r: number, fn: (x: number, y: number, k: number) => void) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < r) fn(x, y, (1 - d / r) ** 2);
      }
    }
  }

  /** Grid ray march from the light to the target; tall cells (trees, wall) cast shadows. */
  private occluded(world: World, sx: number, sy: number, tx: number, ty: number) {
    const dx = tx - sx;
    const dy = ty - sy;
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
    // She holds the flashlight above bush height, so ignore blockers right at the lens.
    const skip = Math.ceil((4 * steps) / Math.max(1, Math.hypot(dx, dy)));
    for (let s = skip; s < steps; s++) {
      const x = Math.round(sx + (dx * s) / steps);
      const y = Math.round(sy + (dy * s) / steps);
      if (x === tx && y === ty) return false;
      // She holds the light above bush height: only trees and the wall cast shadows.
      if (world.inside(x, y)) {
        const i = world.idx(x, y);
        if (world.tall[i] && !world.bush[i]) return true;
      }
    }
    return false;
  }
}
