import { Input } from "../engine/input";
import { Purr } from "../engine/purr";
import { Mat } from "../engine/materials";
import { AsciiRenderer, type GridInfo } from "../engine/render/renderer";
import { useStore } from "../store";
import { Fireflies, Girl } from "./actors";
import { Composer, type View } from "./compose";
import { ENDING, EndingPainter } from "./ending";
import { Kitten } from "./kitten";
import { SpriteLayer } from "./sprites";
import { World } from "./world";

const STEP = 1 / 60;
const SAFE_CELLS = 64;

// Ending timeline, seconds after she reaches Milo.
const FLASH_END = 1.2; // her light floods the screen white
const SCENE_START = 4.4; // "Miloooo!" has typed out and held; fade into the close-up
// She catches him when he's visible and close to any part of her: near → after a moment,
// touching → at once. Measured to her whole body (feet to head), not just her feet.
const CATCH_SECS = 0.4;
const CATCH_DIST = 12;
const TOUCH_DIST = 5;
const GIRL_HEIGHT = 19;

export class Game {
  private renderer: AsciiRenderer;
  private input: Input;
  private world = new World();
  private sprites = new SpriteLayer(this.world.w, this.world.h);
  private kitten = new Kitten(this.world);
  private girl = new Girl();
  private painter = new EndingPainter();
  private purr = new Purr();
  private mode: "play" | "ending" = "play";
  private endingT = 0;
  private caughtT = 0;
  private purring = false;
  private seenEndingRequest = useStore.getState().endingRequest;
  private seenReplayRequest = useStore.getState().replayRequest;
  private fireflies = new Fireflies();
  private composer = new Composer();
  private grid: GridInfo = { gridW: 0, gridH: 0, cellPx: 0 };
  private view: View = { camX: 0, camY: 0, gridW: 0, gridH: 0 };
  private fear = 0;
  private t = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private disposed = false;
  private resizeObs: ResizeObserver;
  private sizeKey = "";
  // Stats, published to React a few times per second.
  private frames = 0;
  private composeMs = 0;
  private statsAt = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    stickEl: HTMLElement | null,
  ) {
    this.renderer = new AsciiRenderer(canvas);
    this.input = new Input(canvas, stickEl);
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(canvas);
  }

  async start() {
    await this.renderer.init();
    if (this.disposed) return; // StrictMode unmounted us while the font loaded
    this.resize();
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  dispose() {
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.input.dispose();
    this.purr.stop();
    this.renderer.dispose();
  }

  private startEnding() {
    if (this.mode === "ending") return;
    this.mode = "ending";
    this.endingT = 0;
    this.purring = false;
    useStore.getState().setEnding("flash");
  }

  private replay() {
    this.purr.stop();
    this.kitten = new Kitten(this.world);
    this.girl = new Girl();
    this.mode = "play";
    this.fear = 0;
    this.caughtT = 0;
    this.sizeKey = ""; // back to gameplay cell size
    useStore.getState().setEnding("none");
  }

  private inCloseUp() {
    return this.mode === "ending" && this.endingT >= SCENE_START;
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    // Shrink cells on narrow screens so the 64×64 safe area (where story beats happen) always fits.
    // The ending close-up fills the screen with the 64×64 safe area: big, chunky glyphs.
    const fit = Math.min(r.width, r.height) / SAFE_CELLS;
    const cellCss = this.inCloseUp() ? fit * 0.97 : Math.min(useStore.getState().settings.cellCss, fit);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const key = `${r.width}x${r.height}@${dpr}/${cellCss}`;
    if (key === this.sizeKey || r.width === 0) return;
    this.sizeKey = key;
    this.grid = this.renderer.resize(r.width, r.height, dpr, cellCss);
  }

  private tick = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    this.resize(); // cheap no-op unless size or cell size changed
    const store = useStore.getState();
    const settings = store.settings;
    if (store.endingRequest !== this.seenEndingRequest) {
      this.seenEndingRequest = store.endingRequest;
      this.startEnding();
    }
    if (store.replayRequest !== this.seenReplayRequest) {
      this.seenReplayRequest = store.replayRequest;
      this.replay();
    }

    this.acc += Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    while (this.acc >= STEP) {
      this.update(STEP);
      this.acc -= STEP;
    }

    const c0 = performance.now();
    if (this.inCloseUp()) {
      this.painter.paint(this.endingT - SCENE_START, {
        gridW: this.grid.gridW,
        gridH: this.grid.gridH,
        cells: this.renderer.cells,
        glyphs: this.renderer.glyphs,
        glyphId: (ch) => this.renderer.glyphId(ch),
      });
      this.composeMs += performance.now() - c0;
      // The close-up is painted in final values, so no exposure boost and no fear.
      this.renderer.render(this.t, 0, settings.bloom, 1);
      this.publishStats(now);
      return;
    }
    this.renderer.glyphs.fill(0);
    this.updateCamera();
    this.sprites.begin();
    this.fireflies.draw(this.sprites, this.t);
    this.girl.draw(this.sprites, this.t, this.kitten);
    this.kitten.draw(this.sprites, this.fear, this.t, this.miloHidden());
    this.composer.compose(
      {
        world: this.world,
        sprites: this.sprites,
        kitten: this.kitten,
        girl: this.girl,
        fireflies: this.fireflies,
        settings,
        fear: this.fear,
        t: this.t,
      },
      this.view,
      this.renderer.cells,
      this.renderer.glyphs,
      (ch) => this.renderer.glyphId(ch),
    );
    this.composeMs += performance.now() - c0;
    this.renderer.render(this.t, this.fear, settings.bloom, settings.exposure);
    this.publishStats(now);
  };

  private update(dt: number) {
    const settings = useStore.getState().settings;
    this.t += dt;
    if (this.mode === "ending") {
      this.updateEnding(dt);
      return;
    }
    this.kitten.inBush = this.miloInHideout();
    this.kitten.update(dt, this.input);
    const hidden = this.miloHidden();
    const noise = this.miloNoise();
    this.kitten.rustling = noise >= 1;
    this.girl.update(dt, this.t, settings.beam, this.mouseWorld(), { x: this.kitten.x, y: this.kitten.y, hidden, noise }, this.world);
    if (settings.fireflies) this.fireflies.update(dt, this.t, this.world);

    // She reaches him → the ending. Hiding (bush, crouching in tall grass) still saves him.
    const g = this.girl;
    const bodyY = Math.min(g.feetY, Math.max(g.feetY - GIRL_HEIGHT, this.kitten.y));
    const reach = Math.hypot(g.feetX - this.kitten.x, bodyY - this.kitten.y);
    // Hidden but pushing through a bush right next to her still gets him caught.
    const exposed = g.on && (!hidden || noise >= 1);
    this.caughtT = exposed && reach < CATCH_DIST ? this.caughtT + dt : 0;
    if (exposed && (reach < TOUCH_DIST || this.caughtT > CATCH_SECS)) this.startEnding();

    if (settings.autoFear) {
      // Prototype rule: the beam and her noticing him scare Milo; hiding calms him.
      const g = this.girl;
      const near = Math.hypot(g.feetX - this.kitten.x, g.feetY - this.kitten.y) < 30;
      const watched = g.state === "notice" || g.state === "approach" || g.state === "investigate";
      if (this.composer.lightAtKitten > 0.3) this.fear += dt * 0.7;
      else if (near && watched) this.fear += dt * 0.4;
      else this.fear -= dt * (hidden ? 0.35 : 0.12);
      this.fear = Math.min(1, Math.max(0, this.fear));
    } else {
      this.fear = settings.fear;
    }
  }

  private updateEnding(dt: number) {
    const before = this.endingT;
    this.endingT += dt;
    const setEnding = useStore.getState().setEnding;
    const crossed = (at: number) => before < at && this.endingT >= at;
    if (crossed(FLASH_END)) setEnding("title");
    if (crossed(SCENE_START)) setEnding("scene");
    const sceneT = this.endingT - SCENE_START;
    if (!this.purring && sceneT >= ENDING.purrStart) {
      this.purring = true;
      this.purr.start();
    }
    if (crossed(SCENE_START + ENDING.endCard)) setEnding("card");
    // While the light floods in, fear peaks one last time.
    if (this.endingT < SCENE_START) this.fear = Math.min(1, this.fear + dt);
  }

  /** How loud Milo is: still or crouch-walking is (nearly) silent; pushing through leaves is loud. */
  private miloNoise() {
    const k = this.kitten;
    if (k.asleep || !k.moving) return 0;
    if (k.crouching) return 0.2;
    if (k.inBush) return 1;
    const x = Math.round(k.x);
    const y = Math.round(k.y);
    const grass = this.world.inside(x, y) && this.world.mat[this.world.idx(x, y)] === Mat.TallGrass;
    return grass ? 0.6 : 0.35;
  }

  /** Hideouts: inside a bush, or in a dark void (under the porch, the castle gate). */
  private miloInHideout() {
    const x = Math.round(this.kitten.x);
    const y = Math.round(this.kitten.y) - 2; // body, not feet
    if (!this.world.inside(x, y)) return false;
    const i = this.world.idx(x, y);
    const m = this.world.mat[i];
    return this.world.bush[i] === 1 || m === Mat.Void;
  }

  /** In a hideout, or crouched in tall grass. Hidden Milo is drawn as just his glowing eyes. */
  private miloHidden() {
    const k = this.kitten;
    if (k.asleep) return false; // the opening shows him, curled up
    const x = Math.round(k.x);
    const y = Math.round(k.y);
    if (this.miloInHideout()) return true;
    return k.crouching && this.world.inside(x, y) && this.world.mat[this.world.idx(x, y)] === Mat.TallGrass;
  }

  private updateCamera() {
    const { gridW, gridH } = this.grid;
    const { camera } = useStore.getState().settings;
    const { w, h } = this.world;
    const k = this.kitten;
    const axis = (pos: number, size: number, worldSize: number) => {
      if (size >= worldSize) return Math.floor((worldSize - size) / 2);
      const raw = camera === "rooms" ? Math.floor(pos / size) * size : Math.round(pos - size / 2);
      return Math.min(worldSize - size, Math.max(0, raw));
    };
    this.view = { camX: axis(k.x, gridW, w), camY: axis(k.y - 2, gridH, h), gridW, gridH };
  }

  private mouseWorld() {
    const m = this.input.mouse;
    if (!m) return null;
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const { gridW, gridH, cellPx } = this.grid;
    const ox = (r.width * dpr - gridW * cellPx) / 2;
    const oy = (r.height * dpr - gridH * cellPx) / 2;
    return {
      x: Math.floor((m.x * dpr - ox) / cellPx) + this.view.camX,
      y: Math.floor((m.y * dpr - oy) / cellPx) + this.view.camY,
    };
  }

  private publishStats(now: number) {
    this.frames++;
    if (now - this.statsAt < 500) return;
    const secs = (now - this.statsAt) / 1000;
    useStore.getState().setStats({
      fps: Math.round(this.frames / secs),
      composeMs: +(this.composeMs / this.frames).toFixed(2),
      gridW: this.grid.gridW,
      gridH: this.grid.gridH,
      cellPx: this.grid.cellPx,
      fear: +this.fear.toFixed(2),
    });
    this.frames = 0;
    this.composeMs = 0;
    this.statsAt = now;
  }
}
