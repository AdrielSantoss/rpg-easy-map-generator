/**
 * Draws a portrait as a round tabletop token: the picture cropped to a circle
 * inside a metal ring. Everything outside the ring is left transparent, so the
 * saved PNG drops straight onto a battle map.
 */
export function drawToken(
  canvas: HTMLCanvasElement,
  portrait: CanvasImageSource & { width: number; height: number },
): void {
  const size = canvas.width;
  const ctx = canvas.getContext('2d')!;
  const center = size / 2;
  const outer = size / 2 - size * 0.01;
  const ring = size * 0.055;
  ctx.clearRect(0, 0, size, size);

  // The portrait, filling the circle whatever its proportions.
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, outer - ring / 2, 0, Math.PI * 2);
  ctx.clip();
  const scale = Math.max(size / portrait.width, size / portrait.height);
  const w = portrait.width * scale;
  const h = portrait.height * scale;
  ctx.drawImage(portrait, (size - w) / 2, (size - h) / 2, w, h);
  // Shade gathering under the rim, so the picture sits inside the ring rather than on it.
  const shade = ctx.createRadialGradient(center, center, outer * 0.72, center, center, outer);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // The ring: bronze lit from the upper left, edged dark inside and out.
  const metal = ctx.createLinearGradient(0, 0, size, size);
  metal.addColorStop(0, '#f6dc98');
  metal.addColorStop(0.35, '#c9963f');
  metal.addColorStop(0.7, '#7a531d');
  metal.addColorStop(1, '#c49a4a');
  ctx.beginPath();
  ctx.arc(center, center, outer - ring / 2, 0, Math.PI * 2);
  ctx.lineWidth = ring;
  ctx.strokeStyle = metal;
  ctx.stroke();
  ctx.lineWidth = size * 0.008;
  ctx.strokeStyle = 'rgba(30, 18, 6, 0.9)';
  for (const radius of [outer, outer - ring]) {
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  // A thin highlight along the top of the band.
  ctx.beginPath();
  ctx.arc(center, center, outer - ring * 0.3, Math.PI * 1.05, Math.PI * 1.7);
  ctx.lineWidth = size * 0.006;
  ctx.strokeStyle = 'rgba(255, 246, 214, 0.6)';
  ctx.stroke();
}
