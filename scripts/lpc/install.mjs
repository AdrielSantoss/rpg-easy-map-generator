// Copies the chosen LPC layers into the project, and writes the palettes and the credits that go with them.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const project = process.argv[2];
const RAW =
  'https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master/';
const SKIP = new Set(['eyes', 'hat-cap', 'hat-wizard', 'sources.json']);

// 1. The sheets.
const target = join(project, 'public', 'lpc');
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
const layers = readdirSync('assets').filter((name) => !SKIP.has(name));
for (const layer of layers) cpSync(join('assets', layer), join(target, layer), { recursive: true });
console.log(layers.length, 'layers copied');

// 1b. What was copied, for the code to know which sheets exist without asking the server.
const inventory = Object.fromEntries(
  layers.sort().map((layer) => [
    layer,
    readdirSync(join('assets', layer))
      .map((file) => file.replace('.png', ''))
      .sort(),
  ]),
);
writeFileSync(
  join(project, 'src', 'npc', 'sprite-sheets.ts'),
  `/**
 * The sheets under public/lpc: for each layer, the animations it was drawn for.
 * Written when the sheets are brought in; see public/lpc/CREDITS.md for whose they are.
 */
export const SPRITE_SHEETS: Record<string, readonly string[]> = ${JSON.stringify(inventory, null, 2)};
`,
);

// 2. The palettes: only the ramps the generator uses.
const palette = (material) =>
  JSON.parse(readFileSync(`palette_definitions/${material}/${material}_ulpc.json`, 'utf8'));
const lower = (ramps) =>
  Object.fromEntries(Object.entries(ramps).map(([name, ramp]) => [name, ramp.map((c) => c.toLowerCase())]));
const body = palette('body');
const keepBody = [
  'light',
  'amber',
  'olive',
  'taupe',
  'bronze',
  'brown',
  'black',
  'blue',
  'bright_green',
  'dark_green',
  'green',
  'lavender',
  'pale_green',
  'fur_copper',
  'fur_gold',
  'fur_grey',
];
const hair = palette('hair');
const keepHair = [
  'orange',
  'black',
  'raven',
  'dark_brown',
  'chestnut',
  'light_brown',
  'blonde',
  'sandy',
  'ginger',
  'redhead',
  'red',
  'gray',
  'white',
  'platinum',
  'ash',
  'dark_gray',
];
const pickRamps = (ramps, names) =>
  Object.fromEntries(
    names.map((name) => {
      if (!ramps[name]) throw new Error('no ramp ' + name);
      return [name, ramps[name]];
    }),
  );
const data = {
  body: lower(pickRamps(body, keepBody)),
  hair: lower(pickRamps(hair, keepHair)),
  cloth: lower(palette('cloth')),
  metal: lower(palette('metal')),
};
const ts = `/**
 * The color ramps of the LPC sprites, darkest first: a layer drawn in one ramp
 * is recolored by replacing each of its colors with the one at the same place
 * in another. Copied from the palette definitions of the Universal LPC
 * Spritesheet Character Generator (see public/lpc/CREDITS.md).
 */
export const SPRITE_PALETTES = ${JSON.stringify(data, null, 2)} as const;

export type SpriteMaterial = keyof typeof SPRITE_PALETTES;
`;
writeFileSync(join(project, 'src', 'npc', 'sprite-palettes.ts'), ts);

// 3. The credits: every author of every sheet used, as the licenses ask.
const sources = JSON.parse(readFileSync('assets/sources.json', 'utf8'));
const usedDirs = new Set(
  Object.entries(sources)
    .filter(([file]) => !SKIP.has(file.split('/')[0]))
    .map(([, path]) => path),
);
const defs = readdirSync('defs').filter((f) => f.endsWith('.json') && f !== 'credits.json');
// The definitions of items whose credits were not fetched yet.
for (const extra of ['weapons/ranged/bow/weapon_ranged_bow_arrow.json']) {
  const file = 'defs/' + extra.replaceAll('/', '__');
  if (!defs.includes(extra.replaceAll('/', '__'))) {
    const response = await fetch(RAW + 'sheet_definitions/' + extra);
    if (response.ok) {
      writeFileSync(file, await response.text());
      defs.push(extra.replaceAll('/', '__'));
    }
  }
}
const entries = [];
const authors = new Set();
const licenses = new Set();
for (const name of defs) {
  const def = JSON.parse(readFileSync(join('defs', name), 'utf8'));
  for (const credit of def.credits ?? []) {
    const used = [...usedDirs].some(
      (path) => path.startsWith(credit.file.replace(/\/$/, '') + '/') || path.startsWith(credit.file),
    );
    if (!used) continue;
    entries.push({ item: def.name, ...credit });
    for (const author of credit.authors ?? []) authors.add(author);
    for (const license of credit.licenses ?? []) licenses.add(license);
  }
}
entries.sort((a, b) => a.file.localeCompare(b.file));
const md = `# Credits for the character sprites

The sprite sheets in this folder come from the **Universal LPC Spritesheet
Character Generator**
(https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator),
a collection of art made for and after the Liberated Pixel Cup. They are the
work of the authors listed below and are **not** covered by the license of the
rest of this project: each sheet is available under the licenses named beside
it (${[...licenses].sort().join(', ')}).

If you use a sprite or a sprite sheet made with this tool, you must credit
these authors too, and share any changed version of the art under the same
license. Linking to this file is a simple way to do so.

Authors: ${[...authors].sort((a, b) => a.localeCompare(b)).join(', ')}.

## By sheet

${entries
  .map(
    (e) =>
      `### ${e.item} — \`${e.file}\`\n\n- Authors: ${(e.authors ?? []).join(', ')}\n- Licenses: ${(e.licenses ?? []).join(', ')}\n${e.notes ? `- Notes: ${e.notes}\n` : ''}${(e.urls ?? []).map((u) => `- ${u}`).join('\n')}\n`,
  )
  .join('\n')}`;
writeFileSync(join(target, 'CREDITS.md'), md);
console.log(entries.length, 'credit entries,', authors.size, 'authors, licenses:', [...licenses].join(', '));
const missing = [...usedDirs].filter(
  (path) => !entries.some((e) => path.startsWith(e.file.replace(/\/$/, ''))),
);
console.log('sheets without a credit entry:', missing.length, missing.slice(0, 12).join(' | '));
