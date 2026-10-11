import { Mat } from "../engine/materials";
import { fbm, hash2, mulberry32, noise2 } from "../engine/noise";

/**
 * The pond clearing (beat 3), laid out by hand for M2 look-dev.
 *
 * Value plan, following the reel: the water is the darkest thing on screen so the
 * moon and reflections stand out; the clearing is a quiet, dim stage; the forest
 * falls off into darkness; the brightest values are kept for light sources.
 * Real levels will come from LDtk; this file stands in for one.
 */
export class World {
  readonly w: number;
  readonly h: number;
  readonly mat: Uint8Array;
  readonly rgb: Float32Array;
  /** Blocks light and shows up in water reflections (trees, wall, boulders). */
  readonly tall: Uint8Array;
  /** For tall cells: the row its object stands on. Reflections only show objects near the shore. */
  readonly base: Int16Array;
  /** Blocks movement. */
  readonly solid: Uint8Array;
  /** Bush cells: hiding spots (tree canopies are foliage too, but you can't hide in a tree). */
  readonly bush: Uint8Array;
  /** For water cells: the last non-water row above (the shoreline it mirrors around), else -1. */
  readonly shoreY: Int16Array;
  /** One waterline for the whole pond: the sky must mirror around a straight horizon or the moon warps. */
  waterTop = 0;
  /** Beat 1: Milo wakes from a nap at the foot of a pine in the dark south-west of the yard. */
  readonly spawn = { x: 57, y: 109 };
  /** Where the moon sits in "sky space" (only ever seen in the reflection). */
  readonly moon = { x: 114, y: 45, r: 7 };

  constructor(w = 180, h = 140, seed = 7) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.mat = new Uint8Array(n);
    this.rgb = new Float32Array(n * 3);
    this.tall = new Uint8Array(n);
    this.base = new Int16Array(n);
    this.solid = new Uint8Array(n);
    this.bush = new Uint8Array(n);
    this.shoreY = new Int16Array(n).fill(-1);
    this.generate(mulberry32(seed));
  }

  idx(x: number, y: number) {
    return y * this.w + x;
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  private set(x: number, y: number, m: Mat, r: number, g: number, b: number) {
    if (!this.inside(x, y)) return;
    const i = this.idx(x, y);
    this.mat[i] = m;
    this.rgb[i * 3] = r;
    this.rgb[i * 3 + 1] = g;
    this.rgb[i * 3 + 2] = b;
  }

  private markTall(x: number, y: number, base: number) {
    const i = this.idx(x, y);
    this.tall[i] = 1;
    this.base[i] = base;
  }

  private dim(i: number, k: number) {
    this.rgb[i * 3] *= k;
    this.rgb[i * 3 + 1] *= k;
    this.rgb[i * 3 + 2] *= k;
  }

  /** < 1 inside the open clearing (the main ellipse plus a nook up to the castle gate), > 1 in the forest. */
  private clearing(x: number, y: number) {
    const wobble = (fbm(x * 0.07, y * 0.07) - 0.5) * 0.45;
    const main = ((x - 90) / 64) ** 2 + ((y - 80) / 48) ** 2;
    const nook = ((x - 90) / 38) ** 2 + ((y - 24) / 20) ** 2;
    return Math.min(main, nook) + wobble;
  }

  private isPond(x: number, y: number) {
    const dx = (x - 92) / 33;
    const dy = (y - 70) / 14;
    return dx * dx + dy * dy + (fbm(x * 0.12, y * 0.12) - 0.5) * 0.3 < 1;
  }

  private pathDist(x: number, y: number) {
    // Porch → south bank, and north bank → castle gate.
    const south = y >= 84 && y <= 120 ? Math.abs(x - (89 + Math.sin(y * 0.11 + 1) * 4)) : 99;
    const north = y >= 22 && y <= 56 ? Math.abs(x - (90 + Math.sin(y * 0.15) * 3)) : 99;
    return Math.min(south, north);
  }

  private generate(rand: () => number) {
    const { w, h } = this;

    // 1. Ground. Grass is dim and quiet (mostly '.' and ','); detail is saved for the tall grass.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = fbm(x * 0.08, y * 0.08);
        const fine = hash2(x, y);
        const c = this.clearing(x, y);
        if (c > 1) {
          // Forest floor: almost black, fading out with depth.
          const k = Math.max(0.08, 0.3 - (c - 1) * 0.6);
          this.set(x, y, Mat.Grass, 0.1 * k, 0.2 * k, 0.17 * k);
          continue;
        }
        this.set(x, y, Mat.Grass, 0.17 + v * 0.06, 0.32 + v * 0.1 + fine * 0.05, 0.26 + fine * 0.04);
        if (this.isTallGrass(x, y)) {
          this.set(x, y, Mat.TallGrass, 0.24 + fine * 0.06, 0.48 + v * 0.14, 0.32);
        }
        if (fine > 0.994) this.set(x, y, Mat.Grass, 0.75, 0.7, 0.85); // tiny pale flowers
        if (this.pathDist(x, y) < 2 + noise2(x * 0.3, y * 0.3)) {
          this.set(x, y, Mat.Dirt, 0.4 + fine * 0.06, 0.36, 0.31);
        }
      }
    }

    // 2. Pond: near-black water, rimmed with pale pebbles.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this.isPond(x, y)) {
          const d = fbm(x * 0.2, y * 0.2);
          this.set(x, y, Mat.Water, 0.025, 0.045 + d * 0.02, 0.1 + d * 0.03);
        } else if (
          this.isPond(x + 1, y) || this.isPond(x - 1, y) || this.isPond(x, y + 1) || this.isPond(x, y - 1)
        ) {
          if (hash2(x + 9, y) > 0.4) this.set(x, y, Mat.Stone, 0.42, 0.44, 0.5);
        }
      }
    }

    // The pond itself stays clean (no stones, no boulders, no bushes on the banks):
    // only the moon, the sky and what stands on the north bank should show in it.
    this.buildWall();
    this.buildPorch();

    // 3. Bushes: hiding spots every few cells along Milo's route, from the nap tree round the
    //    west side of the pond (well clear of the water) to where the girl paces. Never more
    //    than a hop from cover.
    const bushes: [number, number, number][] = [];
    const hedge = (route: number[][]) => {
      for (let r = 0; r < route.length - 1; r++) {
        const [ax, ay] = route[r];
        const [bx, by] = route[r + 1];
        const len = Math.hypot(bx - ax, by - ay);
        for (let d = 0; d < len; d += 6) {
          // Zig-zag slightly either side of the route so it reads as a hedge, not a line.
          const side = (bushes.length % 2 ? 1 : -1) * (1 + rand() * 2);
          const nx = -(by - ay) / len;
          const ny = (bx - ax) / len;
          const x = Math.round(ax + ((bx - ax) * d) / len + nx * side);
          const y = Math.round(ay + ((by - ay) * d) / len + ny * side);
          bushes.push([x, y, 3.4 + rand() * 1.2]);
        }
      }
    };
    // West: from the nap tree, round the west side of the pond, to the north bank.
    hedge([[62, 104], [66, 98], [56, 90], [46, 80], [44, 69], [48, 58], [58, 49], [70, 44], [82, 40], [94, 37], [104, 35]]);
    // East: from the south field, round the east side of the pond, up to her end of the north bank.
    hedge([[98, 108], [112, 104], [126, 98], [138, 88], [144, 76], [143, 64], [146, 54]]);
    // Cover right where she paces (north bank, east of the path): the riskiest stretch,
    // so the bushes sit closer together. They stay on the bank, clear of the water.
    bushes.push([97, 46, 3.4], [104, 51, 3.6], [111, 45, 3.6], [118, 50, 3.8], [125, 44, 3.6], [132, 49, 3.8], [139, 44, 3.6]);
    for (const [x, y, r] of bushes) this.buildBush(x, y, r);

    // 5. Trees, drawn top to bottom so nearer (lower) trees overlap farther ones.
    const pines: [number, number, number, number][] = [
      // Framing pines on the north bank; these are the ones the pond reflects.
      // To a kitten, trees tower: about 2× the girl's height.
      [56, 58, 40, 0], [79, 52, 32, 0], [142, 59, 42, 0],
      // A couple standing in the field.
      [50, 105, 36, 0], [148, 104, 38, 0], // the first is Milo's nap tree
    ];
    for (let gy = 0; gy < h + 30; gy += 11) {
      for (let gx = (gy / 11) % 2 ? 6 : 0; gx < w; gx += 12) {
        const x = gx + Math.floor(rand() * 4);
        const y = gy + Math.floor(rand() * 4);
        const c = this.clearing(x, y);
        if (c < 0.92) continue;
        // Keep the nap spot open: Milo should be seen sleeping at the foot of his tree.
        if (Math.hypot(x - this.spawn.x, y - this.spawn.y) < 18) continue;
        pines.push([x, y, 28 + Math.floor(rand() * 12), Math.min(1, Math.max(0, (c - 1) * 2.2))]);
      }
    }
    pines.sort((a, b) => a[1] - b[1]);
    // Deep forest stays black: only the first rows of trees catch the moon.
    for (const [x, y, size, depth] of pines) if (depth < 0.75) this.buildPine(x, y, size, depth);

    // 4. The moonlit pond is the stage: everything further out falls off into darkness.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = this.idx(x, y);
        if (this.mat[i] === Mat.Water) continue;
        const e = ((x - 92) / 58) ** 2 + ((y - 62) / 42) ** 2;
        // A pool of moonlight through the canopy, so the nap tree and Milo read in the dark.
        const pool = 0.85 * Math.max(0, 1 - Math.hypot(x - 54, (y - 100) * 0.8) / 24);
        // Bushes are cover (gameplay), so they always stay readable.
        const cover = this.bush[i] ? 0.8 : 0;
        this.dim(i, Math.min(1, Math.max(0.3, pool, cover, 1 - (e - 0.5) * 0.78)));
      }
    }

    // 6. Water cells remember the shoreline they mirror around.
    for (let x = 0; x < w; x++) {
      let shore = -1;
      for (let y = 0; y < h; y++) {
        const i = this.idx(x, y);
        if (this.mat[i] === Mat.Water) {
          if (shore < 0) shore = y - 1;
          if (this.waterTop === 0 || shore < this.waterTop) this.waterTop = shore;
          this.shoreY[i] = shore;
        } else {
          shore = -1;
        }
      }
    }
  }

  private isTallGrass(x: number, y: number) {
    const n = fbm(x * 0.06 + 40, y * 0.06);
    // A band along the north bank (cover for the reflection beat) and patches in the south field.
    const northBank = y > 44 && y < 58 && !this.isPond(x, y + 2) && n > 0.42;
    const field = y > 88 && y < 116 && n > 0.55;
    return northBank || field;
  }

  /** Darken the ground in a soft oval (trees and bushes sit on their shadow). */
  private shadow(cx: number, cy: number, r: number) {
    for (let y = Math.floor(cy - r * 0.5); y <= cy + r * 0.5; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (!this.inside(x, y)) continue;
        const d = Math.hypot((x - cx) / r, ((y - cy) / r) * 2);
        if (d > 1) continue;
        const i = this.idx(x, y);
        if (this.tall[i] || this.mat[i] === Mat.Water) continue;
        this.dim(i, 0.35 + 0.65 * d);
      }
    }
  }

  /** depth 0 = clearing edge (moonlit), 1 = deep forest (nearly black). */
  private buildPine(bx: number, by: number, size: number, depth: number) {
    const fade = 1 - depth * 1.1;
    this.shadow(bx + 3, by, size * 0.5);
    const trunkH = 2 + Math.round(size * 0.08);
    const trunkHalf = size > 20 ? 1 : 0;
    for (let y = by - trunkH + 1; y <= by; y++) {
      for (let x = bx - trunkHalf; x <= bx + trunkHalf; x++) {
        if (!this.inside(x, y)) continue;
        const lit = x < bx ? 1.2 : x > bx ? 0.7 : 1;
        this.set(x, y, Mat.Bark, 0.3 * fade * lit, 0.2 * fade * lit, 0.14 * fade * lit);
        this.markTall(x, y, by);
        if (y === by) this.solid[this.idx(x, y)] = 1;
      }
    }
    // Stacked tiers like a real pine: each tier flares out, with a dark underside.
    const tiers = Math.max(3, Math.round(size / 6));
    const top = by - trunkH - size + 1;
    for (let y = top; y <= by - trunkH; y++) {
      const p = (y - top) / size;
      const tierPos = (p * tiers) % 1;
      const half = Math.round(size * 0.36 * (0.15 + 0.85 * p) * (0.55 + 0.45 * tierPos));
      for (let x = bx - half; x <= bx + half; x++) {
        if (!this.inside(x, y)) continue;
        const edge = Math.abs(x - bx) / (half + 1);
        // A darker rim keeps each tree's silhouette readable against its neighbours.
        const rim = Math.abs(x - bx) === half ? 0.5 : 1;
        const lit = x < bx ? 1.15 : 0.8;
        const underside = tierPos > 0.8 ? 0.6 : 1;
        const tip = y === top ? 1.4 : 1;
        const needles = 0.9 + hash2(x, y) * 0.2;
        const shade = (0.7 + 0.35 * (1 - edge)) * rim * lit * underside * tip * needles * fade;
        this.set(x, y, Mat.Foliage, 0.11 * shade, 0.4 * shade, 0.33 * shade);
        this.markTall(x, y, by);
      }
    }
  }

  private buildBush(cx: number, cy: number, r: number) {
    this.shadow(cx + 1, cy + r * 0.6, r * 1.1);
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy) / r + (hash2(x, y) - 0.5) * 0.3;
        if (d > 1 || !this.inside(x, y)) continue;
        const berry = hash2(x + 3, y + 7) > 0.92;
        const lit = 0.75 + 0.35 * (1 - d) + (x < cx ? 0.1 : -0.1);
        if (berry) this.set(x, y, Mat.Foliage, 0.62, 0.16, 0.3);
        else this.set(x, y, Mat.Foliage, 0.16 * lit, 0.4 * lit, 0.25 * lit);
        this.markTall(x, y, Math.round(cy + r));
        this.bush[this.idx(x, y)] = 1;
      }
    }
  }

  private buildWall() {
    const base = 24;
    for (let x = 52; x <= 128; x++) {
      const tower = (x >= 52 && x <= 62) || (x >= 118 && x <= 128);
      // Ruined: the top edge is broken by noise.
      const top = (tower ? 4 : 10) + Math.floor(noise2(x * 0.3, 1) * (tower ? 2 : 4));
      for (let y = top; y <= base; y++) {
        const crenel = y === top && Math.floor(x / 2) % 2 === 0;
        if (crenel) continue;
        const mortar = y % 3 === 0 || (x + (Math.floor(y / 3) % 2) * 3) % 6 === 0;
        // Moonlight from above: the top of the wall is brightest.
        const v = (0.46 + hash2(x, y) * 0.08 - (mortar ? 0.14 : 0)) * (1 - ((y - top) / (base - top)) * 0.35);
        this.set(x, y, Mat.Stone, v, v * 1.03, v * 1.15);
        this.markTall(x, y, base);
        this.solid[this.idx(x, y)] = 1;
      }
    }
    // Arched gate, black inside.
    for (let y = 13; y <= base; y++) {
      for (let x = 84; x <= 96; x++) {
        if (Math.hypot(x - 90, Math.max(0, 17 - y) * 1.4) <= 6.3) {
          this.set(x, y, Mat.Void, 0.01, 0.01, 0.015);
          this.solid[this.idx(x, y)] = 0;
        }
      }
    }
    for (const wx of [57, 123]) for (let y = 8; y <= 10; y++) this.set(wx, y, Mat.Void, 0.01, 0.01, 0.015);
  }

  private buildPorch() {
    for (let y = 120; y <= 134; y++) {
      for (let x = 66; x <= 114; x++) {
        const plank = x % 4 === 0;
        const v = 0.56 + hash2(x, y) * 0.06 - (plank ? 0.16 : 0);
        if (y >= 131) this.set(x, y, Mat.Void, 0.02, 0.015, 0.01); // the dark gap under the porch
        else this.set(x, y, Mat.Wood, v, v * 0.74, v * 0.5);
      }
    }
  }

  /** Night sky for the reflection: gradient, twinkling stars, the moon. */
  sky(x: number, y: number, t: number, out: Float32Array) {
    const m = this.moon;
    const d = Math.hypot(x - m.x, y - m.y);
    if (d < m.r) {
      // Limb darkening + soft maria, so the disc gets a range of glyphs instead of a solid blob.
      const limb = 0.6 + 0.4 * Math.sqrt(1 - (d / m.r) ** 2);
      const maria = fbm(x * 0.35 + 3, y * 0.35) > 0.58 ? 0.72 : 1;
      const k = limb * maria;
      out[0] = 0.95 * k;
      out[1] = 0.94 * k;
      out[2] = 0.86 * k;
      out[3] = 1; // emissive / glow
      return;
    }
    const halo = Math.max(0, 1 - (d - m.r) / 6) ** 2 * 0.18;
    let r = 0.05 + halo * 0.7;
    let g = 0.08 + halo * 0.75;
    let b = 0.2 + halo * 0.8;
    const s = hash2(x * 7 + 1, y * 13 + 5);
    if (s > 0.975) {
      const tw = 0.55 + 0.45 * Math.sin(t * 2.3 + s * 60);
      r = g = b = 0.75 * tw;
      b *= 1.1;
    }
    out[0] = r;
    out[1] = g;
    out[2] = b;
    out[3] = 0;
  }
}
