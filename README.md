# RPG Easy Map Generator

Sketch the outline of your continents and get a parchment-style tabletop RPG map.

**Try it: https://rpg-easy-map-generator.pages.dev**

Everything inside a closed outline becomes land and the rest becomes sea. The generator then adds
mountains, hills, forests, deserts, swamps and rivers, and you can drop kingdoms, cities, villages and
other landmarks on the result with a click. It all runs in the browser.

A second tab generates **tavern interiors** as battle maps on the 5-foot D&D grid: pick a size and get a
common room with a bar, fireplace and tables, a kitchen, a storeroom and, in the larger sizes, guest rooms,
stairs and a stage. The picture exports at 70 pixels per square, ready for a virtual tabletop.

A third tab makes **NPC tokens**: pick a race and a gender and get a painted portrait, cropped into a round
token with a transparent background. The portraits are painted by an image model on Cloudflare Workers AI,
which has a limited free daily allowance, so this tab is locked behind a password.

Each token comes with a **D&D 5e character sheet** written by rule, no AI involved: the NPC's trade decides
class and background, age the level, wealth the purse. The complete sheet follows the official layout, can be
edited in place and saves as a PDF; a short version is a card styled after the class and saves as a PNG.

## How the world map works

1. **Sketch**: draw the coastlines on the board. Small gaps are closed for you, and an outline drawn inside
   a continent becomes a lake.
2. **Generate**: the same sketch with the same seed always gives the same map; a new seed gives a new
   variation of the same continents.
3. **Populate**: pick a structure (kingdom, city, village, tower, port, ruins, dungeon) and click on land.
   Each one gets a suggested name; click it again to rename it.
4. **Export**: save the map as a 2400×1600 PNG.

## Development

Requires Node 22 or newer.

```bash
npm install
npm run dev      # http://localhost:5173 (add ?demo to open on a sample map)
npm run check    # typecheck, lint, format check and tests
npm run build    # production build in dist/
```

## Deployment

The site is hosted on Cloudflare Pages at https://rpg-easy-map-generator.pages.dev.

Every push to `main` that passes the checks is published automatically by the CI workflow. It needs a
`CLOUDFLARE_API_TOKEN` repository secret (a Cloudflare API token with the "Cloudflare Pages: Edit"
permission); without it the workflow still checks and builds, and says that nothing was published.

The NPC tab needs two things on the Cloudflare side, both already described in `wrangler.toml`: the Workers
AI binding, and a password stored as a secret, which is never in the repository:

```bash
npx wrangler pages secret put NPC_PASSWORD --project-name rpg-easy-map-generator
```

Without that secret the NPC tab refuses everyone. The local dev server (`npm run dev`) serves the site but
not the function behind that tab, so NPC tokens only work on the deployed site.

To publish from your own machine instead:

```bash
npm run deploy   # checks, builds and uploads dist/ as the new production version
```

The first time on a machine, run `npx wrangler login` to authorize the Cloudflare account.

## Project layout

```
src/
  generator/   Pure map generation: land mask, elevation, rivers, biomes
  structures/  Model, name suggestions and roads for user-placed structures
  regions/     Names for seas, landmasses, forests, mountain ranges
  tavern/      Tavern interior generation on a battle grid
  npc/         What an NPC portrait should show, its character sheet, and the password check
  project/     Save format and undo history
  render/      Canvas painting of the map and structure icons
  ui/          Sketch board, menus, sliders and the tavern screen
  main.ts      Wires the page together
functions/     The one server-side piece: checks the password and calls the image model
```

Coding, testing and commit conventions live in [.claude/skills](.claude/skills).
