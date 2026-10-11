/**
 * Keyboard (WASD / arrows, Shift = crouch) plus a floating touch stick:
 * put a thumb down anywhere and drag. Mouse hover is tracked separately
 * so the debug flashlight can aim at it.
 */
export class Input {
  private keys = new Set<string>();
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private stickVec = { x: 0, y: 0 };
  /** Mouse position in CSS px relative to the canvas, or null. */
  mouse: { x: number; y: number } | null = null;
  usingTouch = false;

  constructor(
    private el: HTMLElement,
    private stickEl: HTMLElement | null,
  ) {
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
    window.addEventListener("blur", this.onBlur);
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onUp);
    el.addEventListener("pointerleave", this.onLeave);
  }

  dispose() {
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
    window.removeEventListener("blur", this.onBlur);
    this.el.removeEventListener("pointerdown", this.onDown);
    this.el.removeEventListener("pointermove", this.onMove);
    this.el.removeEventListener("pointerup", this.onUp);
    this.el.removeEventListener("pointercancel", this.onUp);
    this.el.removeEventListener("pointerleave", this.onLeave);
  }

  /** Movement direction, length ≤ 1. */
  move(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    const k = this.keys;
    if (k.has("ArrowLeft") || k.has("KeyA")) x -= 1;
    if (k.has("ArrowRight") || k.has("KeyD")) x += 1;
    if (k.has("ArrowUp") || k.has("KeyW")) y -= 1;
    if (k.has("ArrowDown") || k.has("KeyS")) y += 1;
    if (this.stickId !== null) {
      x += this.stickVec.x;
      y += this.stickVec.y;
    }
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  crouch() {
    return this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
  }

  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.closest?.("input, select, button")) return;
    if (e.type === "keydown") this.keys.add(e.code);
    else this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.releaseStick();
  };

  private local(e: PointerEvent) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse") return;
    this.usingTouch = true;
    if (this.stickId !== null) return;
    this.stickId = e.pointerId;
    this.stickOrigin = this.local(e);
    this.stickVec = { x: 0, y: 0 };
    this.el.setPointerCapture(e.pointerId);
    this.drawStick();
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      this.mouse = this.local(e);
      return;
    }
    if (e.pointerId !== this.stickId) return;
    const p = this.local(e);
    const radius = 48;
    let dx = (p.x - this.stickOrigin.x) / radius;
    let dy = (p.y - this.stickOrigin.y) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    this.stickVec = len < 0.15 ? { x: 0, y: 0 } : { x: dx, y: dy };
    this.drawStick();
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId === this.stickId) this.releaseStick();
  };

  private onLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse") this.mouse = null;
  };

  private releaseStick() {
    this.stickId = null;
    this.stickVec = { x: 0, y: 0 };
    this.drawStick();
  }

  // Drawn with direct DOM writes so React never re-renders per pointer move.
  private drawStick() {
    const s = this.stickEl;
    if (!s) return;
    if (this.stickId === null) {
      s.style.opacity = "0";
      return;
    }
    s.style.opacity = "1";
    s.style.transform = `translate(${this.stickOrigin.x}px, ${this.stickOrigin.y}px)`;
    const knob = s.firstElementChild as HTMLElement | null;
    if (knob) knob.style.transform = `translate(${this.stickVec.x * 36}px, ${this.stickVec.y * 36}px)`;
  }
}
