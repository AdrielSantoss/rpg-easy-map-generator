---
name: project-standards
description: Architecture, coding and testing standards for the RPG Easy Map Generator. Use before adding or changing any code in this repository - new features, bug fixes, refactors, new files, or tests - and when deciding where code belongs or how to verify a change.
---

# Project standards

A browser-only TypeScript app (Vite, Canvas 2D, no backend, no runtime dependencies) with one screen per
generator, switched by tabs. On the world map screen the user sketches continent outlines; the app turns
them into a parchment-style tabletop RPG map and lets the user place settlements on it. The tavern screen
needs no sketch: it generates a tavern interior as a battle map on a 5-foot grid. The product goal is an **easy** map generator: every feature must work with one or two
clicks and sensible automatic results. Prefer generating a good default over adding an option.

## Language

- Code, identifiers, comments, tests, commits and docs: **English**.
- Text shown in the app UI: **Brazilian Portuguese** (`index.html`, status messages, generated place
  names).

## Layout

```
src/
  generator/   Pure map generation: sketch mask in, MapData out. No DOM, no canvas.
  structures/  Pure model for user-placed structures: kinds, hit testing, name suggestions.
  regions/     Pure naming of map features: seas, landmasses, forests, mountain ranges.
  project/     Pure save format: turning the user's work into text and back, validated.
  tavern/      Pure tavern interiors on a 5-foot battle grid: rooms, doors, furniture.
  site/        Pure generator of maps of single places (town, port, tower, ruins, dungeon).
  npc/         Pure NPC descriptions (the prompt for the image model), the D&D character sheet
               (rules data in sheet-data.ts, generator in sheet.ts) and the password check.
  view/        Pure zoom and pan math for the map frame.
  render/      Canvas 2D painting: the world map and what goes on it, and the tavern battle map.
  ui/          DOM widgets: sketch board, sliders, zoom, structure and region menus.
  testing/     Helpers shared by tests. Never imported by app code.
  main.ts      Wires the DOM to the modules above. The only file that reads the page.
functions/     Cloudflare Pages Functions: the only code that runs on a server.
```

Dependencies point one way: `main.ts` → `ui`, `render` → the pure folders (`project`, `regions`,
`structures`, `tavern`, `site`, `npc`, `view`, `generator`). Nothing in a pure folder may touch `document`, `window` or a canvas.
That keeps them testable in Node, so put logic there and keep `render/`, `ui/` and `main.ts` thin.

## The server-side piece

Everything runs in the browser except the NPC portraits, which are painted by an image model on Cloudflare
Workers AI. That model has a small free daily allowance shared by everyone, so:

- `functions/api/npc.ts` is the only way to reach it, and it answers only with the right password. The
  password is a Cloudflare secret (`NPC_PASSWORD`); it must never appear in the repository, in the built
  site, or in a log.
- The picture is described on the server from fixed lists in `src/npc/` (race, gender and a seed are all
  the browser may send). Never pass text from the browser into the prompt.
- Keep the function thin: logic goes in `src/npc/`, where it is tested.
- It does not run under `npm run dev`. Verify changes to it on a deployment.

## Core rules

- **Determinism**: the same sketch and seed must always produce the same map. In `generator/` and
  `render/`, take randomness from `seededRng` / a passed-in `Rng`, never `Math.random`. Each consumer
  derives its own stream (`seededRng(seed + ':icons')`) so adding random calls in one place does not
  reshuffle another.
- **Coordinates**: everything is stored in grid cells (600×400), with cell `(x, y)` centered at
  `(x + 0.5, y + 0.5)`. Renderers take a `scale` (pixels per cell) and must look the same at any scale;
  the screen uses 2 and PNG export uses 4. Never store pixel coordinates.
- **Grids**: map layers are flat typed arrays indexed `y * w + x`. Keep them typed arrays; do not
  introduce per-cell objects.
- **Tunable numbers** get a named constant with a comment saying what they control and in which unit.

## TypeScript

- `strict` is on, plus `erasableSyntaxOnly`: no `enum`, no namespaces, no constructor parameter
  properties. Use `as const` objects and union types instead.
- Relative imports include the `.ts` extension. Use `import type` / inline `type` for type-only imports.
- Named exports only. One module, one responsibility; split a file when it grows a second one.
- No `any`. No non-null `!` outside the DOM lookups in `main.ts`, canvas `getContext`, and tests.
- Comments explain why or state a contract (units, ranges, invariants). Do not narrate what the code does.
- Formatting is Prettier's job (`npm run format`); do not hand-format or argue with it.

## Tests

Vitest, in Node, colocated with the code as `<module>.test.ts`.

- Every module in a pure folder has tests. New behavior there comes with a test, and a bug fix comes with
  a test that fails without the fix.
- Test behavior a user would recognize ("closes a small gap in the outline"), not implementation details.
  Test names read as a sentence after `it`.
- Build inputs with the helpers in `src/testing/` (for example `ringSketch`) rather than hand-written
  arrays. Add a helper when a second test needs the same setup.
- Keep tests deterministic and fast: fixed seeds, small grids (about 150×100), no timers, no network.
  To test shape logic without noise, pass a noise function that returns 0.
- `render/`, `ui/` and `main.ts` need a browser and are not unit tested. Verify changes there by running
  the app; `http://localhost:5173/?demo` opens directly on a generated map with sample structures.

## Before calling a change done

1. `npm run check` passes (typecheck, lint, format check, tests).
2. `npm run build` passes.
3. For anything visual, look at the result in the browser (`npm run dev`), in both the sketch and the map
   view, and say so explicitly if it could not be checked.

CI (`.github/workflows/ci.yml`) runs the same commands on every push and pull request.

## Commands

| Command          | What it does                               |
| ---------------- | ------------------------------------------ |
| `npm run dev`    | Dev server at http://localhost:5173        |
| `npm run check`  | Typecheck + lint + format check + tests    |
| `npm test`       | Tests once (`npm run test:watch` to watch) |
| `npm run format` | Format everything with Prettier            |
| `npm run build`  | Typecheck and build to `dist/`             |

For commit messages and branch names, follow the `commit` skill.
