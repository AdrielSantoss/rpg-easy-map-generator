// Drives the NPC sheet in headless Edge. The image API is faked with a saved portrait.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const edge = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${join(here, 'cdp-profile-cut')}`,
  'about:blank',
]);
let page;
for (let i = 0; i < 40 && !page; i++) {
  await sleep(250);
  try {
    page = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page');
  } catch {}
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let nextId = 1;
const pending = new Map();
const errors = [];
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id) pending.get(msg.id)?.(msg);
  if (msg.method === 'Runtime.exceptionThrown')
    errors.push(msg.params.exceptionDetails.exception?.description ?? 'exception');
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error')
    errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const r = (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result;
  if (r.exceptionDetails)
    console.log('EXCEPTION', r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const shot = async (name, full = false) => {
  const { result } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full });
  writeFileSync(join(here, `${name}.png`), Buffer.from(result.data, 'base64'));
};
const click = async (selector) => {
  const box = await evaluate(
    `(() => { const e = document.querySelector(${JSON.stringify(selector)}); e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return {x: r.x + r.width/2, y: r.y + r.height/2}; })()`,
  );
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: box.x,
    y: box.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: box.x,
    y: box.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
  await sleep(120);
};
const clickText = (container, text) =>
  evaluate(
    `[...document.querySelectorAll('${container} button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}).id = 'probe'`,
  )
    .then(() => click('#probe'))
    .then(() => evaluate(`document.querySelector('#probe').removeAttribute('id')`));
const type = async (text) => {
  for (const ch of text) {
    await send('Input.insertText', { text: ch });
  }
  await sleep(80);
};
const key = async (k, code, vk, modifiers = 0) => {
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: k,
    code,
    windowsVirtualKeyCode: vk,
    modifiers,
  });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers });
};
const val = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).value`);

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1366,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});

import { mkdirSync } from 'node:fs';
await send('Page.navigate', { url: 'http://localhost:5173/?screen=world' });
await sleep(1200);
const sheet = '/' + process.argv[2];
const outDir = process.argv[3];
mkdirSync(outDir, { recursive: true });
// Cuts every figure out of a sheet on a light ground: the ground (and the soft shadows on it) is
// whatever light, colorless area can be reached from the border; what is left falls into figures.
const result = await evaluate(`(async () => {
  const image = new Image();
  await new Promise((r, j) => { image.onload = r; image.onerror = j; image.src = '${sheet}'; });
  const W = image.width, H = image.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
  const px = ctx.getImageData(0, 0, W, H); const d = px.data;
  const ground = (i) => { const r = d[i], g = d[i + 1], b = d[i + 2]; return Math.min(r, g, b) > 150 && Math.max(r, g, b) - Math.min(r, g, b) < 26; };
  const bg = new Uint8Array(W * H); const stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) { const p = stack.pop(); if (bg[p] || !ground(p * 4)) continue; bg[p] = 1; const x = p % W, y = (p / W) | 0;
    if (x > 0) stack.push(p - 1); if (x < W - 1) stack.push(p + 1); if (y > 0) stack.push(p - W); if (y < H - 1) stack.push(p + W); }
  // Figures: connected areas of what is not ground, joined across small gaps.
  const GAP = 3; const label = new Int32Array(W * H); const boxes = [];
  for (let start = 0; start < W * H; start++) {
    if (bg[start] || label[start]) continue;
    const id = boxes.length + 1; const box = { x0: W, y0: H, x1: 0, y1: 0, area: 0 }; const todo = [start]; label[start] = id;
    while (todo.length) { const p = todo.pop(); const x = p % W, y = (p / W) | 0; box.area++;
      if (x < box.x0) box.x0 = x; if (x > box.x1) box.x1 = x; if (y < box.y0) box.y0 = y; if (y > box.y1) box.y1 = y;
      for (let dy = -GAP; dy <= GAP; dy++) for (let dx = -GAP; dx <= GAP; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const q = ny * W + nx; if (!bg[q] && !label[q]) { label[q] = id; todo.push(q); } } }
    boxes.push(box);
  }
  const figures = boxes.map((b, i) => ({ ...b, id: i + 1 })).filter((b) => b.area > 1200 && b.y1 - b.y0 > 45);
  // In reading order: rows first, then left to right.
  figures.sort((a, b) => (Math.abs(a.y0 + a.y1 - b.y0 - b.y1) > 120 ? a.y0 - b.y0 : a.x0 - b.x0));
  const out = [];
  for (const f of figures) {
    const pad = 3; const w = f.x1 - f.x0 + 1 + pad * 2, h = f.y1 - f.y0 + 1 + pad * 2;
    const t = document.createElement('canvas'); t.width = w; t.height = h; const tc = t.getContext('2d'); const img = tc.createImageData(w, h);
    for (let y = f.y0; y <= f.y1; y++) for (let x = f.x0; x <= f.x1; x++) { const p = y * W + x; if (label[p] !== f.id) continue; const o = ((y - f.y0 + pad) * w + (x - f.x0 + pad)) * 4; img.data[o] = d[p * 4]; img.data[o + 1] = d[p * 4 + 1]; img.data[o + 2] = d[p * 4 + 2]; img.data[o + 3] = 255; }
    tc.putImageData(img, 0, 0);
    out.push({ w, h, data: t.toDataURL('image/png') });
  }
  // A contact sheet, to look the cuts over.
  const cols = 8, cell = 130; const sheetCanvas = document.createElement('canvas'); sheetCanvas.width = cols * cell; sheetCanvas.height = Math.ceil(out.length / cols) * cell;
  const sc = sheetCanvas.getContext('2d'); sc.fillStyle = '#8fa25c'; sc.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
  for (const [i, f] of figures.entries()) { const pad = 3; sc.drawImage(await createImageBitmap(await (await fetch(out[i].data)).blob()), (i % cols) * cell + (cell - out[i].w) / 2, Math.floor(i / cols) * cell + (cell - out[i].h) / 2); sc.fillStyle = '#000'; sc.font = '12px sans-serif'; sc.fillText(String(i + 1), (i % cols) * cell + 4, Math.floor(i / cols) * cell + 14); sc.fillStyle = '#8fa25c'; }
  return JSON.stringify({ size: [W, H], count: out.length, tokens: out, contact: sheetCanvas.toDataURL('image/png') });
})()`);
if (typeof result !== 'string') {
  const raw = await send('Runtime.evaluate', { expression: 'window.__cutError', returnByValue: true });
  console.log('eval failed', JSON.stringify(result).slice(0, 300), JSON.stringify(raw).slice(0, 300));
}
const parsed = JSON.parse(result);
console.log('sheet', parsed.size.join('x'), '| figures cut:', parsed.count);
const prefix = process.argv[4] ?? 't';
parsed.tokens.forEach((token, index) =>
  writeFileSync(
    join(outDir, prefix + String(index + 1).padStart(2, '0') + '.png'),
    Buffer.from(token.data.split(',')[1], 'base64'),
  ),
);
writeFileSync(join(here, 'cut-contact.png'), Buffer.from(parsed.contact.split(',')[1], 'base64'));
console.log('sizes:', parsed.tokens.map((t) => t.w + 'x' + t.h).join(' '));
console.log('errors:', errors.length ? errors : 'none');
ws.close();
edge.kill();
