// Lists the LPC repository directory by directory (the whole tree is too large for one call).
import { writeFileSync } from 'node:fs';

const API =
  'https://api.github.com/repos/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/git/trees/';
const get = async (sha, recursive = false) => {
  const response = await fetch(API + sha + (recursive ? '?recursive=1' : ''), {
    headers: { 'user-agent': 'lpc-explore' },
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
};

const root = await get('master');
const paths = [];
const want = process.argv.slice(2);
for (const top of root.tree.filter((e) => e.type === 'tree' && want.includes(e.path))) {
  const level = await get(top.sha);
  for (const sub of level.tree) {
    if (sub.type !== 'tree') {
      paths.push(`${top.path}/${sub.path}`);
      continue;
    }
    const deep = await get(sub.sha, true);
    if (deep.truncated) console.log('TRUNCATED', top.path, sub.path);
    for (const e of deep.tree) if (e.type === 'blob') paths.push(`${top.path}/${sub.path}/${e.path}`);
  }
}
writeFileSync('paths.txt', paths.join('\n'));
console.log(paths.length, 'files');
