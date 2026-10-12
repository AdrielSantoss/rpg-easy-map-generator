# A collection of illustrated figures

The sprite screen offers a third style, "Ilustrada", when it finds a collection
of figures drawn whole by an artist: a folder of pictures on a transparent
ground and a `catalog.json` saying whom each one suits (see `src/npc/tokens.ts`
for its shape).

The screen looks for it in `/tokens/` (published with the site, from
`public/tokens/`) and, on the dev server only, in `/acervo/tokens/`. The
`acervo/` folder is ignored by Git and is never built into the site: it is where
pictures stay until it is certain they may be published.

**Publish a collection only with its author's permission**, and with the author
named in the catalog (`author`, `source`) and in a `CREDITS.md` beside it. A
picture being free to look at or to download is not permission to republish it.

`cut.mjs` cuts the figures out of a sheet on a light ground. It drives a
headless Edge against the dev server, so it is tied to the machine it was
written on; it is kept as the record of how the pictures were cut:

    node cut.mjs acervo/originais/sheet.jpg C:/path/to/acervo/tokens prefix-
