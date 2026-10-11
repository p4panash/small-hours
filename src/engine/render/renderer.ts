import * as THREE from "three";
import { BloomEffect, EffectComposer, EffectPass, RenderPass } from "postprocessing";
import { MAT_COUNT, RAMP_LEN, allRampChars, buildRampData } from "../materials";
import { bakeAtlas, loadFont, type GlyphAtlas } from "./atlas";

const VERT = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;
precision highp int;

out vec4 fragColor;

uniform sampler2D uCells;   // RGBA8, row 0 = top. rgb = color, a = material | INK<<4
uniform sampler2D uAtlas;   // glyph squares, uCellPx device px each
uniform sampler2D uRamp;    // R = glyph index; rows 0..15 calm, 16..31 fear
uniform sampler2D uGlyphs;  // R8 per cell: 0 = pick by brightness, n = force atlas glyph n-1 (faces, text)
uniform ivec2 uGrid;
uniform float uCellPx;
uniform vec2 uOrigin;       // grid top-left, device px from canvas top-left
uniform vec2 uCanvas;
uniform int uAtlasCols;
uniform float uFear;
uniform float uTime;
uniform float uExposure;  // night scenes are dim; spread them across the whole glyph ramp

const int RAMP_LEN = ${RAMP_LEN};
const int MAT_COUNT = ${MAT_COUNT};
const int MAT_WATER = 3;
const int MAT_GLOW = 10;
const int MAT_FUR = 9;
const int MAT_SKIN = 13;
const int INK = 16; // draw the glyph as dark ink over the cell's color (faces on skin)

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 p = frag - uOrigin;
  vec2 cf = floor(p / uCellPx);
  ivec2 cell = ivec2(cf);
  if (any(lessThan(cell, ivec2(0))) || any(greaterThanEqual(cell, uGrid))) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec4 t = texelFetch(uCells, cell, 0);
  vec3 col = t.rgb;
  int alpha = int(t.a * 255.0 + 0.5);
  int mat = alpha & 15;
  bool ink = (alpha & INK) != 0;

  // Value (not luminance) so saturated colors still get dense glyphs.
  // Light sources and Milo are already bright; exposing them would flatten them into solid '@'.
  float v = min(1.0, max(col.r, max(col.g, col.b)) * (mat == MAT_GLOW || mat == MAT_FUR ? 1.0 : uExposure));
  float h2 = hash(cf.yx + 1.91);
  float shimmer = mat == MAT_WATER ? floor(uTime * 2.5 + h2 * 7.0) : 0.0;
  float h = hash(cf + 0.37 + shimmer);
  float level = clamp(pow(v, 0.8) + (h - 0.5) * 0.14, 0.0, 1.0);
  int idx = int(level * float(RAMP_LEN - 1) + 0.5);
  int row = mat + (h2 < uFear ? MAT_COUNT : 0);
  int glyph = int(texelFetch(uRamp, ivec2(idx, row), 0).r * 255.0 + 0.5);
  int forced = int(texelFetch(uGlyphs, cell, 0).r * 255.0 + 0.5);
  if (forced > 0) glyph = forced - 1;

  int cpx = int(uCellPx);
  ivec2 local = clamp(ivec2(p - cf * uCellPx), ivec2(0), ivec2(cpx - 1));
  ivec2 g = ivec2(glyph % uAtlasCols, glyph / uAtlasCols);
  float mask = texelFetch(uAtlas, g * cpx + local, 0).r;

  // Glyph keeps the cell's hue; density carries brightness, so lift dim glyphs.
  vec3 hue = col / max(max(col.r, max(col.g, col.b)), 1e-4);
  vec3 glyphCol = hue * mix(0.3, 1.1, sqrt(v));
  if (mat == MAT_GLOW) glyphCol *= 1.6;
  // Skin gets a pale fill behind its glyphs; a few dots on black would read as dark skin.
  vec3 bg = col * (mat == MAT_SKIN ? 0.74 : 0.09);
  if (ink) glyphCol = vec3(0.24, 0.13, 0.09);
  fragColor = vec4(mix(bg, glyphCol, mask), 1.0);
}
`;

export interface GridInfo {
  gridW: number;
  gridH: number;
  cellPx: number;
}

export class AsciiRenderer {
  private gl: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: BloomEffect;
  private material: THREE.ShaderMaterial;
  private cellsTex: THREE.DataTexture | null = null;
  private glyphsTex: THREE.DataTexture | null = null;
  private atlasTex: THREE.Texture | null = null;
  private atlas: GlyphAtlas | null = null;
  // Ramp glyphs plus the ones cutscenes place by hand (faces, text).
  private chars = [...new Set([...allRampChars(), ..."^ωvuo•·*Milo!z-"])];
  private grid: GridInfo = { gridW: 0, gridH: 0, cellPx: 0 };
  cells: Uint8Array = new Uint8Array(0);
  /** Per-cell forced glyph (see glyphId); 0 = automatic. Cleared by whoever composes the frame. */
  glyphs: Uint8Array = new Uint8Array(0);

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;

    const rampTex = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uCells: { value: null },
        uAtlas: { value: null },
        uRamp: { value: rampTex },
        uGlyphs: { value: null },
        uGrid: { value: new THREE.Vector2(1, 1) },
        uCellPx: { value: 1 },
        uOrigin: { value: new THREE.Vector2() },
        uCanvas: { value: new THREE.Vector2(1, 1) },
        uAtlasCols: { value: 16 },
        uFear: { value: 0 },
        uTime: { value: 0 },
        uExposure: { value: 2 },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.composer = new EffectComposer(this.gl, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(scene, camera));
    // Toggled via intensity: disabling the last pass would leave nothing rendering to screen.
    this.bloom = new BloomEffect({ luminanceThreshold: 0.55, luminanceSmoothing: 0.25, intensity: 1.1, mipmapBlur: true });
    this.composer.addPass(new EffectPass(camera, this.bloom));
  }

  async init(): Promise<void> {
    await loadFont(this.chars);
  }

  /** Size the canvas and grid; rebakes the atlas when the device cell size changes. */
  resize(cssW: number, cssH: number, dpr: number, cellCss: number): GridInfo {
    const cellPx = Math.max(3, Math.round(cellCss * dpr));
    this.gl.setPixelRatio(dpr);
    this.gl.setSize(cssW, cssH, false);
    this.composer.setSize(cssW, cssH, false);
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    const gridW = Math.max(1, Math.floor(w / cellPx));
    const gridH = Math.max(1, Math.floor(h / cellPx));

    if (!this.atlas || this.atlas.cellPx !== cellPx) this.rebakeAtlas(cellPx);
    if (gridW !== this.grid.gridW || gridH !== this.grid.gridH) {
      this.cellsTex?.dispose();
      this.cells = new Uint8Array(gridW * gridH * 4);
      this.cellsTex = new THREE.DataTexture(this.cells, gridW, gridH, THREE.RGBAFormat, THREE.UnsignedByteType);
      this.cellsTex.magFilter = this.cellsTex.minFilter = THREE.NearestFilter;
      this.material.uniforms.uCells.value = this.cellsTex;
      this.glyphsTex?.dispose();
      this.glyphs = new Uint8Array(gridW * gridH);
      this.glyphsTex = new THREE.DataTexture(this.glyphs, gridW, gridH, THREE.RedFormat, THREE.UnsignedByteType);
      this.glyphsTex.magFilter = this.glyphsTex.minFilter = THREE.NearestFilter;
      this.glyphsTex.unpackAlignment = 1; // rows are gridW bytes, not a multiple of 4
      this.material.uniforms.uGlyphs.value = this.glyphsTex;
    }

    const u = this.material.uniforms;
    u.uGrid.value.set(gridW, gridH);
    u.uCellPx.value = cellPx;
    u.uOrigin.value.set(Math.floor((w - gridW * cellPx) / 2), Math.floor((h - gridH * cellPx) / 2));
    u.uCanvas.value.set(w, h);
    this.grid = { gridW, gridH, cellPx };
    return this.grid;
  }

  private rebakeAtlas(cellPx: number) {
    this.atlas = bakeAtlas(this.chars, cellPx);
    this.atlasTex?.dispose();
    const tex = new THREE.CanvasTexture(this.atlas.canvas);
    tex.flipY = false;
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    this.atlasTex = tex;

    const ramp = new THREE.DataTexture(buildRampData(this.atlas.index), RAMP_LEN, MAT_COUNT * 2);
    ramp.magFilter = ramp.minFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
    const u = this.material.uniforms;
    (u.uRamp.value as THREE.Texture).dispose();
    u.uRamp.value = ramp;
    u.uAtlas.value = tex;
    u.uAtlasCols.value = this.atlas.cols;
  }

  /** Value to write into `glyphs` to force a character (0 if it isn't in the atlas). */
  glyphId(ch: string): number {
    const i = this.atlas?.index.get(ch);
    return i === undefined ? 0 : i + 1;
  }

  render(time: number, fear: number, bloom: boolean, exposure: number) {
    if (!this.cellsTex || !this.glyphsTex) return;
    this.cellsTex.needsUpdate = true;
    this.glyphsTex.needsUpdate = true;
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uFear.value = Math.max(0, fear);
    u.uExposure.value = exposure;
    this.bloom.intensity = bloom ? 1.1 : 0;
    this.composer.render();
  }

  dispose() {
    this.composer.dispose();
    this.cellsTex?.dispose();
    this.glyphsTex?.dispose();
    this.atlasTex?.dispose();
    this.gl.dispose();
  }
}
