export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Smoothstep from `a` to `b`. Also works with a > b (falling edge). */
export function sstep(a: number, b: number, v: number): number {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Approximate euclidean distance (in cells) from every cell to the nearest
 * cell where `source` is set. Stays huge everywhere if there is no source.
 */
export function chamferDistance(source: Uint8Array, w: number, h: number): Float32Array {
  const D = Math.SQRT2;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = source[i] ? 0 : 1e9;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - w] + 1);
        if (x > 0) v = Math.min(v, d[i - w - 1] + D);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + D);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 1);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + D);
        if (x > 0) v = Math.min(v, d[i + w - 1] + D);
      }
      d[i] = v;
    }
  }
  return d;
}

/** Averages each cell with its neighbors up to `radius` cells away (box blur, edges clamped). */
export function boxBlur(values: Float32Array, w: number, h: number, radius: number): Float32Array {
  const pass = (src: Float32Array, length: number, lines: number, step: number, lineStep: number) => {
    const out = new Float32Array(src.length);
    for (let line = 0; line < lines; line++) {
      const base = line * lineStep;
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += src[base + clamp(k, 0, length - 1) * step];
      for (let p = 0; p < length; p++) {
        out[base + p * step] = sum / (2 * radius + 1);
        sum += src[base + clamp(p + radius + 1, 0, length - 1) * step];
        sum -= src[base + clamp(p - radius, 0, length - 1) * step];
      }
    }
    return out;
  };
  const horizontal = pass(values, w, h, 1, w);
  return pass(horizontal, h, w, w, 1);
}

/** Value at the given fraction (0..1) of the sorted values. */
export function percentile(sorted: Float32Array, fraction: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}
