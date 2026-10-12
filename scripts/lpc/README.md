# Bringing in the LPC sprite sheets

The character sprites under `public/lpc` are not drawn by this project: they are
chosen sheets of the
[Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator).
These scripts are how they got here, kept so that a layer can be added or
refreshed. Run them with Node, from a scratch folder, in this order:

1. `node tree.mjs spritesheets sheet_definitions palette_definitions` lists the
   repository into `paths.txt` (it is too large to clone for a few files).
2. `node fetch.mjs assets` downloads the layers named in `fetch.mjs` into
   `assets/`. To add a layer, add its folder there.
3. `node defs.mjs` downloads the definitions of the items, which hold the
   credits. The palettes (`palette_definitions/<material>/<material>_ulpc.json`)
   are fetched by hand into the same scratch folder.
4. `node install.mjs <path to this project>` copies the sheets to `public/lpc`
   and writes `src/npc/sprite-sheets.ts`, `src/npc/sprite-palettes.ts` and
   `public/lpc/CREDITS.md`.

The art keeps its own licenses (see `public/lpc/CREDITS.md`); every author of
every sheet used must stay credited there.
