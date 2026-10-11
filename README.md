# RPG Easy Map Generator

Sketch the outline of your continents and get a parchment-style tabletop RPG map.

Everything inside a closed outline becomes land and the rest becomes sea. The generator then adds
mountains, hills, forests, deserts, swamps and rivers, and you can drop kingdoms, cities, villages and
other landmarks on the result with a click. It all runs in the browser.

A second tab generates **tavern interiors** as battle maps on the 5-foot D&D grid: pick a size and get a
common room with a bar, fireplace and tables, a kitchen, a storeroom and, in the larger sizes, guest rooms,
stairs and a stage. The picture exports at 70 pixels per square, ready for a virtual tabletop.

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

## Project layout

```
src/
  generator/   Pure map generation: land mask, elevation, rivers, biomes
  structures/  Model, name suggestions and roads for user-placed structures
  regions/     Names for seas, landmasses, forests, mountain ranges
  tavern/      Tavern interior generation on a battle grid
  project/     Save format and undo history
  render/      Canvas painting of the map and structure icons
  ui/          Sketch board, menus, sliders and the tavern screen
  main.ts      Wires the page together
```

Coding, testing and commit conventions live in [.claude/skills](.claude/skills).
