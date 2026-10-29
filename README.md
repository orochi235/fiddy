# fiddy

Tree generation, the arboreal kind: a TypeScript library and a lab for designing trees with it.

A design is a stack of **stages**. Each stage takes the open growing tips (**buds**) the stages before it
left, grows branches from them, and leaves new buds, so different generators chain: one stage's trunk
hands its tips to the next stage's crown. The design is in `docs/superpowers/specs/2026-10-27-fiddy-design.md`.

| Stage kind | What it grows |
|---|---|
| `seed` | A root with one bud pointing up |
| `lsystem` | An L-system in the notation of *The Algorithmic Beauty of Plants* (ABOP): bracketed, stochastic, parametric, and context-sensitive |
| `weberpenn` | A Weber–Penn tree: a trunk and up to three levels of branches |
| `colonize` | A crown by space colonization: branches grow toward points scattered in an envelope |
| `light` | A tree grown by light competition: buds in shade get less of the tree's resource |
| `wind` | Not growth: bends the whole tree in a gusting wind as the loop plays |

## Layout

| Path | What it is |
|---|---|
| `packages/fiddy` | The library, `fiddy` on npm (unpublished). Pure TypeScript, no DOM. `grow`, `growSteps`, `animate`, the stage kinds, tube and leaf meshes, a glTF writer, and the presets. |
| `apps/lab` | The lab: Vite, React, `@weasel-js/labkit`, `@weasel-js/diagram`'s pipeline editor, and three.js for the 3D view. |
| `scripts` | `smoke.mjs` and `shots.mjs`, which drive the built lab through every preset. |

## Running it

```
npm install
npm run dev        # the lab on http://localhost:5199 (and the LAN address vite prints)
npm run smoke      # bundle the lab, load every preset headless in 2D and 3D, fail on a console error or an empty tree
npm run shots      # bundle the lab, post each preset's tree to the transom wall
onto test          # the library suite, on the fleet
```

The weasel packages are pinned to an exact npm version. `WEASEL=~/src/weasel npm run dev` serves that
checkout's built `dist` instead, once its dists are current.

## The lab

The pipeline runs down the left, with each stage's box showing the tree as it stands after that stage.
Drag a stage to reorder it, press Delete to remove it, or add one after the selected stage from the
inspector's menu. The tree fills the middle, in 2D or 3D (switched at its top left); the 3D view orbits
with the mouse, dresses the tree in leaves, and exports it as glTF. The selected stage's
settings are on the right, and for an L-system so is its grammar, drawn three ways: each rule's
successor, every generation, and the derived string, where hovering a symbol lights the segment it drew.
The bottom bar plays the design's loop and draws its score, one band per stage's growth and one curve per
moving param (`~` beside a setting). The whole design lives in the URL hash.

It is live at [michaelbaker.tech/fiddy/](https://michaelbaker.tech/fiddy/), deployed from `main` by
`.github/workflows/pages.yml`. `?bare` is the chromeless view for embedding: the hash's tree alone,
growing on a loop over a transparent page. `?bare=still` shows it finished, and `&bg=rrggbb` paints a
backdrop.
