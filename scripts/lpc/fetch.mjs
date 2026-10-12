// Downloads the chosen LPC layers: for each, the sheets of the animations used.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const RAW =
  'https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master/spritesheets/';
const known = new Set(readFileSync('paths.txt', 'utf8').split('\n'));
const out = process.argv[2] ?? 'assets';
const ANIMATIONS = ['idle', 'walk', 'slash', 'shoot'];

/** id -> directory holding one sheet per animation. */
export const LAYERS = {
  'body-male': 'body/bodies/male',
  'body-female': 'body/bodies/female',
  'head-human-male': 'head/heads/human/male',
  'head-human-female': 'head/heads/human/female',
  'head-human-male-elder': 'head/heads/human/male_elderly',
  'head-human-female-elder': 'head/heads/human/female_elderly',
  'head-orc-male': 'head/heads/orc/male',
  'head-orc-female': 'head/heads/orc/female',
  'head-lizard-male': 'head/heads/lizard/male',
  'head-lizard-female': 'head/heads/lizard/female',
  'ears-elven': 'head/ears/elven/adult',
  horns: 'head/horns/curled/adult',
  eyes: 'eyes/human/adult/neutral',
  'hair-plain': 'hair/plain/adult',
  'hair-long': 'hair/long/adult',
  'hair-buzzcut': 'hair/buzzcut/adult',
  'hair-bangs': 'hair/bangs/adult',
  'hair-balding': 'hair/balding/adult',
  'hair-shorthawk': 'hair/shorthawk/adult',
  'hair-bob': 'hair/bob/adult',
  'hair-messy': 'hair/messy1/adult',
  'hair-ponytail-bg': 'hair/ponytail/adult/bg',
  'hair-ponytail-fg': 'hair/ponytail/adult/fg',
  'beard-medium': 'beards/beard/medium',
  'beard-winter': 'beards/beard/winter/male',
  'torso-shirt-male': 'torso/clothes/longsleeve/longsleeve/male',
  'torso-shirt-female': 'torso/clothes/longsleeve/longsleeve/female',
  'torso-plate-male': 'torso/armour/plate/male',
  'torso-plate-female': 'torso/armour/plate/female',
  'torso-leather-male': 'torso/armour/leather/male',
  'torso-leather-female': 'torso/armour/leather/female',
  'legs-pants-male': 'legs/pants/male',
  'legs-pants-female': 'legs/pants/thin',
  'legs-plate-male': 'legs/armour/plate/male',
  'legs-plate-female': 'legs/armour/plate/thin',
  'legs-skirt-male': 'legs/skirts/plain/male',
  'legs-skirt-female': 'legs/skirts/plain/thin',
  'feet-boots-male': 'feet/boots/basic/male',
  'feet-boots-female': 'feet/boots/basic/thin',
  'feet-plate-male': 'feet/armour/plate/male',
  'feet-plate-female': 'feet/armour/plate/thin',
  'cape-bg': 'cape/solid/bg',
  'cape-fg': 'cape/solid/fg',
  'hat-hood': 'hat/cloth/hood/adult',
  'hat-wizard': 'hat/magic/wizard/base/adult',
  'hat-helm': 'hat/helmet/nasal/adult',
  'hat-cap': 'hat/cloth/leather_cap/adult',
};
/** Single files: id/animation -> path. */
const FILES = {
  'sword-fg/slash': 'weapon/sword/arming/attack_slash/fg.png',
  'sword-bg/slash': 'weapon/sword/arming/attack_slash/bg.png',
  'bow-fg/shoot': 'weapon/ranged/bow/normal/universal/shoot/foreground.png',
  'bow-bg/shoot': 'weapon/ranged/bow/normal/universal/shoot/background.png',
  'arrow/shoot': 'weapon/ranged/bow/arrow/shoot/arrow.png',
};

// The wizard's hat is not recolored by ramp: it comes ready in each color.
for (const color of ['blue', 'navy', 'purple', 'teal']) {
  for (const animation of ANIMATIONS)
    FILES[`hat-wizard-${color}/${animation}`] = `hat/magic/wizard/base/adult/${animation}/${color}.png`;
}

const jobs = [];
for (const [id, dir] of Object.entries(LAYERS)) {
  for (const animation of ANIMATIONS) {
    const path = `${dir}/${animation}.png`;
    if (!known.has(`spritesheets/${path}`)) console.log('NOT IN REPO', id, path);
    else jobs.push([`${id}/${animation}.png`, path]);
  }
}
for (const [target, path] of Object.entries(FILES)) {
  if (!known.has(`spritesheets/${path}`)) console.log('NOT IN REPO', target, path);
  else jobs.push([`${target}.png`, path]);
}

let bytes = 0;
const sources = {};
for (const [target, path] of jobs) {
  const file = join(out, target);
  sources[target] = path;
  if (existsSync(file)) continue;
  const response = await fetch(RAW + path);
  if (!response.ok) {
    console.log('FAILED', response.status, path);
    continue;
  }
  const data = Buffer.from(await response.arrayBuffer());
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  bytes += data.length;
}
writeFileSync(join(out, 'sources.json'), JSON.stringify(sources, null, 2));
console.log(jobs.length, 'files,', Math.round(bytes / 1024), 'KB downloaded now');
