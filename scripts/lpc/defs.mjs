// Fetches the definitions of the chosen items and prints what matters: layers, z order, recolors, credits.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const RAW =
  'https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master/';
const all = readFileSync('paths.txt', 'utf8').split('\n');
const wanted = [
  'body/body.json',
  'head/heads/human/heads_human_male.json',
  'head/heads/human/heads_human_female.json',
  'head/heads/human/heads_human_male_elderly.json',
  'head/heads/human/heads_human_female_elderly.json',
  'head/heads/fantasy/heads_orc_male.json',
  'head/heads/fantasy/heads_orc_female.json',
  'head/heads/reptile/heads_lizard_male.json',
  'head/heads/reptile/heads_lizard_female.json',
  'head/ears/head_ears_elven.json',
  'head/appendages/head_horns_curled.json',
  'hair/short/hair_plain.json',
  'feet/boots/feet_boots_basic.json',
  'legs/pants/legs_pants.json',
  'legs/skirts/legs_skirts_plain.json',
  'torso/armour/torso_armour_leather.json',
  'torso/armour/torso_armour_plate.json',
  'torso/cape/cape_solid.json',
  'torso/shirts/longsleeve/torso_clothes_longsleeve.json',
  'headwear/coverings/hoods/hat_hood_cloth.json',
  'headwear/hats/magic/hat_magic_wizard.json',
  'headwear/helmets/helmets/hat_helmet_nasal.json',
];
const find = (re) => all.filter((p) => p.startsWith('sheet_definitions/') && re.test(p));
for (const extra of [
  /hair_(long|buzzcut|bangs|balding|shorthawk|bob|messy1|ponytail)\.json$/,
  /beard_(medium|winter)\.json$/,
  /eyes_human|\/eyes\.json|eye_color/,
  /leather_cap\.json$/,
  /arming\.json$/,
  /bow_normal\.json$|weapon_ranged_bow\.json|\/bow\.json$/,
  /legs_armour|legs_plate/,
  /feet_armour|feet_plate\.json|plate\.json$/,
]) {
  for (const p of find(extra)) wanted.push(p.slice('sheet_definitions/'.length));
}
mkdirSync('defs', { recursive: true });
const credits = {};
for (const name of [...new Set(wanted)]) {
  const response = await fetch(RAW + 'sheet_definitions/' + name);
  if (!response.ok) {
    console.log('MISSING', name);
    continue;
  }
  const def = await response.json();
  writeFileSync('defs/' + name.replaceAll('/', '__'), JSON.stringify(def, null, 1));
  const layers = Object.entries(def)
    .filter(([k]) => k.startsWith('layer_'))
    .map(
      ([, v]) =>
        `z${v.zPos}${v.custom_animation ? ' custom:' + v.custom_animation : ''} ${Object.entries(v)
          .filter(([k]) => !['zPos', 'custom_animation'].includes(k))
          .map(([k, val]) => k + '=' + val)
          .slice(0, 3)
          .join(' ')}`,
    );
  const other = Object.keys(def).filter(
    (k) =>
      !k.startsWith('layer_') &&
      ![
        'name',
        'credits',
        'animations',
        'priority',
        'variants',
        'type_name',
        'path',
        'preview_row',
        'preview_column',
        'preview_x_offset',
        'preview_y_offset',
        'tags',
        'required_tags',
        'excluded_tags',
        'required',
      ].includes(k),
  );
  console.log(
    `\n${name}\n  ${layers.join('\n  ')}\n  variants: ${(def.variants ?? []).slice(0, 8).join(',')}${(def.variants ?? []).length > 8 ? '…' : ''}\n  other: ${other.map((k) => k + '=' + JSON.stringify(def[k]).slice(0, 160)).join(' | ')}`,
  );
  credits[name] = def.credits;
}
writeFileSync('defs/credits.json', JSON.stringify(credits, null, 1));
