export const FONT_FAMILY = '"JetBrains Mono", monospace';

export interface GlyphAtlas {
  canvas: HTMLCanvasElement;
  cols: number;
  cellPx: number;
  index: Map<string, number>;
}

/**
 * Bake every glyph into a grid of cellPx × cellPx squares (device pixels),
 * so the shader can texelFetch them 1:1 with no filtering.
 */
export function bakeAtlas(chars: string[], cellPx: number): GlyphAtlas {
  const ordered = [" ", ...chars.filter((c) => c !== " ")];
  const cols = 16;
  const rows = Math.ceil(ordered.length / cols);
  const canvas = document.createElement("canvas");
  canvas.width = cols * cellPx;
  canvas.height = rows * cellPx;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Monospace glyphs are ~0.6em wide; size by height so they fill the square cell.
  const fontPx = Math.max(4, Math.round(cellPx * 1.05));
  ctx.font = `500 ${fontPx}px ${FONT_FAMILY}`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const m = ctx.measureText("M");
  const ascent = m.fontBoundingBoxAscent ?? fontPx * 0.8;
  const descent = m.fontBoundingBoxDescent ?? fontPx * 0.2;
  const baselineOffset = (ascent - descent) / 2;

  const index = new Map<string, number>();
  ordered.forEach((c, i) => {
    index.set(c, i);
    const x = (i % cols) * cellPx + cellPx / 2;
    const y = Math.floor(i / cols) * cellPx + cellPx / 2 + baselineOffset;
    ctx.save();
    ctx.beginPath();
    ctx.rect((i % cols) * cellPx, Math.floor(i / cols) * cellPx, cellPx, cellPx);
    ctx.clip();
    ctx.fillText(c, x, y);
    ctx.restore();
  });
  return { canvas, cols, cellPx, index };
}

export async function loadFont(chars: string[]): Promise<void> {
  try {
    await document.fonts.load(`500 16px ${FONT_FAMILY}`, chars.join(""));
  } catch {
    // Fall back to the system monospace; the atlas still bakes.
  }
}
