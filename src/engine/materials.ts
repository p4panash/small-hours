// Material ids live in the low 4 bits of each cell's alpha byte.
export const Mat = {
  Void: 0,
  Grass: 1,
  TallGrass: 2,
  Water: 3,
  Stone: 4,
  Dirt: 5,
  Foliage: 6,
  Bark: 7,
  Wood: 8,
  Fur: 9,
  Glow: 10,
  Debug: 11,
  /** The girl's silhouette: black inside, a thin moonlit rim. */
  Shade: 12,
  /** Cutscene close-ups. */
  Skin: 13,
  Cloth: 14,
} as const;
export type Mat = (typeof Mat)[keyof typeof Mat];

export const MAT_COUNT = 16;
export const RAMP_LEN = 16;

// Glyph ramps, sparse → dense. Picked by cell brightness in the shader.
// `fear` ramps swap in sharper shapes; the shader mixes them per cell by the fear value.
// Only glyphs covered by the bundled JetBrains Mono subsets (no ≈ ∘ ○ ◦ ∙).
const RAMPS: Record<number, { calm: string; fear: string }> = {
  [Mat.Void]: { calm: "   ..,", fear: "   .,'" },
  // Ground stays quiet: mostly empty, sparse ticks. Loud `"` and `:` made it read as one big grid texture.
  [Mat.Grass]: { calm: "    ..,,'`;i|", fear: "   ..,'/\\|x" },
  [Mat.TallGrass]: { calm: " .'\";|!lI", fear: " ,'/|\\!xX" },
  [Mat.Water]: { calm: " .-~~=", fear: " .~/\\x=" },
  [Mat.Stone]: { calm: " .:-=+*#%@", fear: " :/\\x#%@" },
  [Mat.Dirt]: { calm: " .,:;-=o", fear: " .,/\\x" },
  [Mat.Foliage]: { calm: " .:;+*%#&@", fear: " ./\\xX#@" },
  [Mat.Bark]: { calm: " .|!I#", fear: " /|\\X#" },
  [Mat.Wood]: { calm: " .-_=#", fear: " ./\\#" },
  [Mat.Fur]: { calm: " .:oO0@", fear: " :xX0@" },
  [Mat.Glow]: { calm: " .·°*oO0@", fear: " .*xX#@" },
  [Mat.Debug]: { calm: " .+#", fear: " .+#" },
  // Thin, dotted outline: reads as a ghostly contour, distinct from the dense stone behind her.
  // Soft, fine texture so facial features (placed glyphs) stand out against it.
  [Mat.Skin]: { calm: "  ..··::", fear: "  ..··::" },
  [Mat.Cloth]: { calm: " .:;=+*#", fear: " .:/\\x#" },
  [Mat.Shade]: { calm: "   ..::;;+", fear: "   ..:/\\x" },
};

export function allRampChars(): string[] {
  const set = new Set<string>();
  for (const r of Object.values(RAMPS)) for (const c of r.calm + r.fear) set.add(c);
  return [...set];
}

/** Resample a ramp string to RAMP_LEN glyph indices. */
function resample(ramp: string, index: Map<string, number>): number[] {
  const chars = [...ramp];
  return Array.from({ length: RAMP_LEN }, (_, i) => {
    const c = chars[Math.round((i / (RAMP_LEN - 1)) * (chars.length - 1))];
    return index.get(c) ?? 0;
  });
}

/** RAMP_LEN × (MAT_COUNT*2) bytes: rows 0..15 calm, rows 16..31 fear. */
export function buildRampData(index: Map<string, number>): Uint8Array {
  const data = new Uint8Array(RAMP_LEN * MAT_COUNT * 2 * 4);
  for (let m = 0; m < MAT_COUNT; m++) {
    const r = RAMPS[m] ?? RAMPS[Mat.Void];
    const rows = [resample(r.calm, index), resample(r.fear, index)];
    rows.forEach((glyphs, variant) => {
      const row = m + variant * MAT_COUNT;
      glyphs.forEach((g, i) => {
        data[(row * RAMP_LEN + i) * 4] = g;
      });
    });
  }
  return data;
}
