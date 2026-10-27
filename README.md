# fiddy

Tree generation, the arboreal kind: a TypeScript library and a lab for designing trees with it.

A design is a stack of **stages**. Each stage takes the open growing tips (**buds**) the stages before it
left, grows branches from them, and leaves new buds, so different generators chain: one stage's trunk
hands its tips to the next stage's crown. The first generator is the L-system, written in the notation
of *The Algorithmic Beauty of Plants* (ABOP); the design and roadmap are in
`docs/superpowers/specs/2026-10-27-fiddy-design.md`.

## Layout

| Path | What it is |
|---|---|
| `packages/fiddy` | The library, `fiddy` on npm (unpublished). Pure TypeScript, no DOM. `grow`, `growSteps`, `animate`, stage kinds, the L-system parser, rewriter, and turtle, and the presets. |
| `apps/lab` | The lab: Vite, React, `@weasel-js/labkit`, and `@weasel-js/diagram`'s pipeline editor. |
| `scripts` | `smoke.mjs` and `shots.mjs`, which drive the built lab through every preset. |

## Running it

```
npm install
npm run dev        # the lab on http://localhost:5199 (and the LAN address vite prints)
npm run smoke      # bundle the lab, load every preset headless, fail on a console error or an empty tree
npm run shots      # bundle the lab, post each preset's tree to the transom wall
onto test          # the library suite, on the fleet
```

The weasel packages are pinned to an exact npm version. `WEASEL=~/src/weasel npm run dev` serves that
checkout's built `dist` instead, once its dists are current.

## The lab

The pipeline runs down the left, with each stage's box showing the tree as it stands after that stage.
Drag a stage to reorder it, or press Delete to remove it. The tree fills the middle. The selected stage's
settings are on the right, and for an L-system so is its grammar, drawn three ways: each rule's
successor, every generation, and the derived string, where hovering a symbol lights the segment it drew.
The bottom bar plays the design's loop and draws its score, one band per stage's growth and one curve per
moving param (`~` beside a setting). The whole design lives in the URL hash.

The pipeline column wants the diagram's vertical rack, `direction: 'down'`, which is merged in weasel but
not yet in a release. Until one ships, the pinned 1.13.0 draws the rack horizontally.
