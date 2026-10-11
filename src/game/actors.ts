import { Mat } from "../engine/materials";
import { hash2, mulberry32, noise2 } from "../engine/noise";
import type { BeamMode } from "../store";
import type { SpriteLayer } from "./sprites";
import type { World } from "./world";

export type GirlState = "pace" | "notice" | "approach" | "search";

export interface MiloView {
  x: number;
  y: number;
  hidden: boolean;
}

/** Her size relative to the authored silhouette (~37 rows): ~19 rows. Well under the pines, ~3.5× Milo. */
const SCALE = 0.52;
const PACE_MIN = 98;
const PACE_MAX = 136;

/**
 * The girl, as Milo sees her: "the Shape". A huge faceless silhouette with a flashlight.
 * Prototype behaviour: paces the north bank sweeping the pond, notices Milo when he's in
 * the open, swings the light onto him and walks closer; loses him if he hides.
 * The flashlight fields (x, y, angle, halfAngle, range, on) are what the light pass reads.
 */
export class Girl {
  feetX = 116;
  feetY = 46;
  facing = 1;
  state: GirlState = "pace";
  // Flashlight.
  x = 0;
  y = 0;
  angle = Math.PI / 2;
  readonly halfAngle = 0.32;
  readonly range = 72;
  on = true;
  /**
   * 0 = how Milo perceives her: a blurry, boiling dark mass with a light. Her shape is never
   * readable, so the twist isn't spoiled. 1 = clear (reserved for the reveal).
   */
  clarity = 0;

  private stateT = 0;
  private hiddenT = 0;
  private lastSeen = { x: 0, y: 0 };

  update(dt: number, t: number, mode: BeamMode, aim: { x: number; y: number } | null, milo: MiloView, world: World) {
    this.on = mode !== "off";
    this.stateT += dt;
    const dx = milo.x - this.feetX;
    const dy = milo.y - this.feetY;
    const dist = Math.hypot(dx, dy);
    const toMilo = Math.atan2(milo.y - this.y, milo.x - this.x);
    const sees = this.on && !milo.hidden && dist < 60 && (dist < 22 || this.inCone(milo));
    let target = this.angle;
    let turnRate = 2;

    switch (this.state) {
      case "pace": {
        this.walk(this.facing * 3.5 * dt, 0, world);
        if (this.feetX <= PACE_MIN) this.facing = 1;
        if (this.feetX >= PACE_MAX) this.facing = -1;
        target = Math.atan2(70 - this.y, 92 - this.x) + Math.sin(t * 0.45) * 0.7;
        if (sees) this.enter("notice");
        break;
      }
      case "notice": {
        // She freezes and the light snaps onto him. Nothing else happens, which is the scary part.
        target = toMilo;
        turnRate = 5;
        if (milo.hidden) this.enter("search");
        else if (this.stateT > 1.5) this.enter("approach");
        break;
      }
      case "approach": {
        target = toMilo;
        turnRate = 3;
        if (dist > 11) this.walk((dx / dist) * 4 * dt, (dy / dist) * 4 * dt, world);
        this.hiddenT = milo.hidden ? this.hiddenT + dt : 0;
        if (this.hiddenT > 1.2 || dist > 70) this.enter("search");
        break;
      }
      case "search": {
        // Sweep around where he was last seen, then give up.
        const toLast = Math.atan2(this.lastSeen.y - this.y, this.lastSeen.x - this.x);
        target = toLast + Math.sin(this.stateT * 1.6) * 0.8;
        if (sees && this.stateT > 0.5) this.enter("notice");
        else if (this.stateT > 4.5) this.enter("pace");
        break;
      }
    }
    if (sees) this.lastSeen = { x: milo.x, y: milo.y };
    if (mode === "pointer" && aim) target = Math.atan2(aim.y - this.y, aim.x - this.x);

    let da = Math.atan2(Math.sin(target - this.angle), Math.cos(target - this.angle));
    da = Math.max(-turnRate * dt, Math.min(turnRate * dt, da));
    this.angle += da;
    if (this.state !== "pace") this.facing = Math.cos(this.angle) >= 0 ? 1 : -1;

    // The flashlight sits in her hand, too big for it.
    const hx = this.feetX + this.facing * 9 * SCALE;
    const hy = this.feetY - 17 * SCALE;
    this.x = hx + Math.cos(this.angle) * 2;
    this.y = hy + Math.sin(this.angle) * 2;
  }

  private enter(state: GirlState) {
    this.state = state;
    this.stateT = 0;
    this.hiddenT = 0;
  }

  private inCone(p: { x: number; y: number }) {
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (d > this.range) return false;
    const da = Math.atan2(p.y - this.y, p.x - this.x) - this.angle;
    return Math.abs(Math.atan2(Math.sin(da), Math.cos(da))) < this.halfAngle;
  }

  /** She walks on land only. */
  private walk(mx: number, my: number, world: World) {
    const nx = this.feetX + mx;
    const ny = this.feetY + my;
    for (const [x, y] of [[nx, ny], [nx, this.feetY], [this.feetX, ny]]) {
      const cx = Math.round(x);
      const cy = Math.round(y);
      if (!world.inside(cx, cy) || world.solid[world.idx(cx, cy)]) continue;
      if (world.mat[world.idx(cx, cy + 2)] === Mat.Water) continue;
      this.feetX = x;
      this.feetY = y;
      return;
    }
  }

  /** Silhouette relative to her feet: dx right, dy up. */
  private inShape(dx: number, dy: number) {
    const f = this.facing;
    if (dy <= 1) return (dx >= -5 && dx <= -1) || (dx >= 1 && dx <= 5); // rain boots
    if (dy === 2) return (dx >= -4 && dx <= -2) || (dx >= 2 && dx <= 4);
    if (dy <= 8) return (dx >= -3 && dx <= -2) || (dx >= 2 && dx <= 3); // legs
    if (dy <= 20 && Math.abs(dx) <= 8 - (dy - 9) * 0.4) return true; // dress
    if (dy <= 25 && Math.abs(dx) <= 4) return true; // torso
    if (dy <= 27 && Math.abs(dx) <= 1) return true; // neck
    if (dx * dx + (dy - 32) ** 2 <= 25) return true; // head
    // Pigtails: in the water, upside down, these read as horns.
    for (const s of [-1, 1]) {
      if ((dx - s * 7) ** 2 + (dy - 31) ** 2 <= 4.8) return true;
      if ((dx - s * 8.5) ** 2 + (dy - 28) ** 2 <= 2.3) return true;
    }
    // Arms: one hanging, one holding the flashlight out.
    if (segDist(dx, dy, -f * 5, 24, -f * 6, 13) <= 1.1) return true;
    if (segDist(dx, dy, f * 5, 24, f * 9, 17) <= 1.1) return true;
    return false;
  }

  draw(sprites: SpriteLayer, t: number, milo: { x: number; y: number }) {
    if (!this.on) return;
    const fx = Math.round(this.feetX);
    const fy = Math.round(this.feetY);
    const dist = Math.hypot(milo.x - this.feetX, milo.y - this.feetY);
    // The further away, the less Milo can make out; she never gets sharp until the reveal.
    const blur = (1 - this.clarity) * (1.4 + Math.min(1.6, dist / 35));
    const halfW = Math.ceil(10 * SCALE + blur + 1);
    const height = Math.ceil(37 * SCALE + blur + 1);
    const inside = (dx: number, dy: number) => this.inShape(dx / SCALE, dy / SCALE);

    for (let dy = -2; dy <= height; dy++) {
      for (let dx = -halfW; dx <= halfW; dx++) {
        const x = fx + dx;
        const y = fy - dy;
        if (this.clarity >= 0.99) {
          if (!inside(dx, dy)) continue;
          const rim = !inside(dx - 1, dy) || !inside(dx + 1, dy) || !inside(dx, dy + 1) || !inside(dx, dy - 1);
          const moonSide = dx < 0 || !inside(dx, dy + 1) ? 1.25 : 0.85;
          if (rim) sprites.put(x, y, 0.36 * moonSide, 0.38 * moonSide, 0.44 * moonSide, Mat.Shade, true, fy);
          else sprites.put(x, y, 0.008, 0.01, 0.018, Mat.Shade, true, fy);
          continue;
        }
        // Fogged: sample the shape at a few noise-displaced points, so the edges boil and smear.
        let hits = 0;
        for (let k = 0; k < 4; k++) {
          const n1 = noise2(x * 0.35 + t * 0.9 + k * 7.1, y * 0.35 - t * 0.7);
          const n2 = noise2(x * 0.35 - t * 0.6 + k * 5.7 + 3.3, y * 0.35 + t * 0.8 + 1.7);
          if (inside(dx + (n1 - 0.5) * 2 * blur, dy + (n2 - 0.5) * 2 * blur)) hits++;
        }
        if (hits === 0) continue;
        // A pale, moonlit mist: something is there, but Milo can't make out what (or who).
        const swirl = noise2(x * 0.5 - t * 1.1, y * 0.5 + t * 0.8);
        if (hits === 4) {
          const b = 0.3 + swirl * 0.14;
          sprites.put(x, y, b * 0.95, b, b * 1.12, Mat.Shade, true, fy);
        } else {
          const b = (0.08 + 0.12 * hash2(x + Math.floor(t * 6), y)) * (hits / 3);
          sprites.put(x, y, b * 0.9, b * 0.95, b * 1.15, Mat.Shade, true, fy);
        }
      }
    }
    // The light is the one thing Milo sees clearly.
    sprites.put(Math.round(this.x), Math.round(this.y), 1, 0.97, 0.85, Mat.Glow, true, fy);
  }
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

interface Fly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
}

export class Fireflies {
  readonly flies: Fly[] = [];

  constructor(count = 16) {
    const rand = mulberry32(3);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = 40 + rand() * 14;
      this.flies.push({
        x: 90 + Math.cos(a) * r,
        y: 72 + Math.sin(a) * r * 0.55,
        vx: 0,
        vy: 0,
        phase: rand() * 10,
      });
    }
  }

  update(dt: number, t: number, world: World) {
    for (const f of this.flies) {
      // Lazy wander, gently pulled back toward the pond.
      f.vx += (Math.sin(t * 0.7 + f.phase * 3) * 2 + (90 - f.x) * 0.01) * dt;
      f.vy += (Math.cos(t * 0.6 + f.phase * 5) * 2 + (72 - f.y) * 0.01) * dt;
      f.vx *= 0.98;
      f.vy *= 0.98;
      f.x = Math.min(world.w - 1, Math.max(0, f.x + f.vx * dt));
      f.y = Math.min(world.h - 1, Math.max(0, f.y + f.vy * dt));
    }
  }

  brightness(f: Fly, t: number) {
    return Math.max(0, Math.sin(t * 1.3 + f.phase)) ** 2;
  }

  draw(sprites: SpriteLayer, t: number) {
    for (const f of this.flies) {
      const b = this.brightness(f, t);
      if (b < 0.15) continue;
      // Fireflies hover; base far below so they never show up in reflections.
      sprites.put(Math.round(f.x), Math.round(f.y), 0.8 * b, 1.0 * b, 0.35 * b, Mat.Glow, true, -999);
    }
  }
}
