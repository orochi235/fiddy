# fiddy design

**Status: designed 2026-10-27, nothing built.** This spec covers the whole roadmap; the first build is
roadmap pieces 1 and 2 plus the weasel prerequisite. Everything past piece 2 is unbuilt and gets its
own spec when its turn comes.

fiddy generates trees, the arboreal kind: a JS library (`fiddy` on npm, free as of 2026-10-27) and a
labkit lab for designing them. This document is for whoever builds or extends it, and answers what the
pieces are, how they fit, and what the first build contains.

## Goals

In priority order (2026-10-27):

1. **One design space across generators.** L-systems, recursive parametric trees, space colonization,
   and later light competition all produce the same skeleton and can be chained, so one generator's
   trunk hands its tips to another.
2. **An instrument for making images**: finished SVG, plotter output, and renders.
3. **A library others build on**, with the lab as its testbed.

Working through *The Algorithmic Beauty of Plants* (ABOP) with it is a welcome side effect, not a goal.
Everything with structure is shown as a picture of that structure: the pipeline, the grammar, the
timeline (2026-10-27).

## Roadmap

| # | Piece | Builds on | Status |
|---|---|---|---|
| 0 | weasel: `direction: 'down'` on the diagram `rack` look | — | unbuilt, first build |
| 1 | Foundation: skeleton, buds, stages, seeded streams, blits timing, 2D renderer, lab shell | — | unbuilt, first build |
| 2 | L-system, deterministic, with grammar workbench | 1 | unbuilt, first build |
| 3 | Stochastic rules | 2 | unbuilt |
| 4 | Parametric rules: numbers, conditions, expressions | 3 | unbuilt |
| 5 | Context-sensitive rules | 4 | unbuilt |
| 6 | Recursive parametric generator (Weber–Penn style) | 1 | unbuilt |
| 7 | Space colonization | 1 | unbuilt |
| 8 | 3D: tube and leaf meshes, three.js view, glTF export | 1 | unbuilt |
| 9 | Light competition (Palubicki-style) | 1, ideally 8 | unbuilt |
| 10 | Wind: a time-dependent bend on the finished skeleton, on the blits mix | 1 | unbuilt |

Pieces 6 to 8 are independent of the L-system work and of each other.

## Repo

npm workspaces, set up like agnew and rosee:

- `packages/fiddy` — the library. Pure TypeScript, no DOM, no weasel. Depends on `@msb235/blits`, pinned
  exactly (0.14.0 at design time).
- `apps/lab` — `@fiddy/lab`, Vite and React on `@weasel-js/labkit` and `@weasel-js/diagram` from npm,
  pinned exactly. Port 5199, `server.host: '::'`. The whole lab state lives in the URL hash.

## Data model

```ts
type Frame = { pos: Vec3; heading: Vec3; left: Vec3; up: Vec3 };  // ABOP's H, L, U

interface Skeleton {
  nodes: { id: number; parent: number | null; pos: Vec3; radius: number;
           order: number; stage: string; born: number; module?: number }[];
  buds:  { node: number; frame: Frame; order: number; vigor: number }[];
}

interface Stage {
  id: string;
  kind: string;
  params: Record<string, unknown>;
  motion?: Record<string, Motion>;          // per number param: a wave or keyframes, agnew's shape
  input: { from: string[]; select?: Selector };
}

interface Design { seed: number; stages: Stage[] }

grow(design: Design): Skeleton
growSteps(design: Design): { stage: string; skeleton: Skeleton }[]
animate(design: Design): { moving: boolean; at(seconds: number): Design }
```

- **A bud** is an open growing tip. Every generator takes buds, grows branches from them, and leaves new
  buds. That is the whole contract between generators.
- **A bud carries a full turtle frame**, so a 3D L-system continues another generator's tip with the
  right roll as well as heading.
- **`input.from` is explicit** even though the stack always fills it with the previous stage. A node
  graph later wires it differently, with no format change (2026-10-27: stack now, graph later).
- **`select`** filters the incoming buds, such as `order ≥ 2` or `height ≥ 0.4` (a fraction of the tree's height so far).
- **Each stage has its own random stream**, derived from `seed` and the stage `id`, so editing one stage
  never reshuffles another's output.
- **`node.stage`** records which stage grew a node; **`node.module`** records which L-system module
  drew it; **`node.born`** orders growth for playback.

A **stage kind** is one file in `packages/fiddy/src/kinds/`: its params declared as data (the lab builds
panels from them) and `apply(skeleton, buds, params, rng)`. The first build ships two kinds: `seed`
(one bud at the origin, pointing up) and `lsystem`.

## L-system

**Notation is ABOP's own**, with ASCII stand-ins:

```
n = 4   δ = 22.5°
ω: F
p1: F → FF-[-F+F+F]+[+F-F-F]
```

`w:` for `ω:`, `->` for `→`, and `delta =` for `δ =` are accepted.

**The parser** produces a syntax tree with room for the whole family:

```ts
interface Rule {
  pred: { symbol: string; params?: string[] };
  left?: Module[]; right?: Module[];                    // piece 5
  condition?: Expr;                                     // piece 4
  succ: { prob?: number; body: ModuleTemplate[] }[];    // more than one: piece 3
}
```

The first build evaluates only deterministic rules. Syntax from a later piece gets an error at its
position naming the piece that adds it.

**The rewriter** works on an array of modules, never a JS string. It stops at a module cap (200,000 by
default, adjustable); hitting the cap is a stage error.

**The turtle** uses ABOP's commands: `F` draw a step, `f` move without drawing, `+ -` yaw, `& ^` pitch,
`\ /` roll, `|` turn around, `[ ]` push and pop, `!` thin the branch. Other symbols draw nothing. It
starts from each selected bud's frame; bracket depth is branch order.

**Derivation and interpretation are cached separately.** The derived string depends only on the
grammar and `n`; an animated angle or step length reruns only the turtle.

## Timing

blits is in from the start (2026-10-27):

- **Growth playback.** Pipeline order is the score: each stage a voice, anchored to start at the end of
  the one before it. A `grown` channel goes from 0 to 1 per stage and reveals that stage's nodes in
  `born` order. Turtle playback is the same reveal in module order.
- **Animated params.** Any number param can carry a `motion`. Each motion is a looping voice on that
  param's channel, set up as agnew's `animate.ts` does it.
- **Scrubbing** reads the mix at any time through blits `project` and `seek`, so going backward is exact.

## Lab

Layout (2026-10-27, mockup B), on labkit's `WorkspaceGrid`:

| Area | Contents |
|---|---|
| Left column | The pipeline: `EffectEditor`, `look="rack"`, `direction: 'down'`, `showPreviews`. Each stage box shows a thumbnail of the tree after that stage, and a `~` on any animated param. |
| Center | The tree, 2D. The selected stage's branches are highlighted. |
| Right | The inspector for the selected stage: its params panel, and for an L-system the grammar editor, rule pictures, generation strip, and linked string. |
| Bottom | The transport: the blits score drawn as one band per stage and a curve per motion, with the playhead. |

**The pipeline adapter** (`apps/lab/src/pipeline/`) turns a `Design` into an `EffectDoc` and back, and
registers one `EffectEvaluator` per stage kind. The port type is `tree` (a skeleton and its open buds).
A stage's `select` shows on its box as a param. Call `registerCanvasFont('sans-serif')` once at startup,
or every diagram label renders blank.

**L-system views:**

| View | Shows | First build? |
|---|---|---|
| Rule pictures | Each rule as its symbol, an arrow, and a small turtle drawing of its successor | yes |
| Generation strip | Thumbnails of n = 0 up to the current n | yes |
| Linked string | The derived string; hovering a module lights its segment, and hovering the tree lights its module | yes |
| Derivation tree | A weasel diagram of what each module rewrote into, first few generations, folded | no |

**Presets** are designs in the library, including ABOP figures labeled by figure number.

## Failures

| Failure | Shown as |
|---|---|
| Grammar parse error | Underlined at its line and column in the editor; the stage box shows the error; the tree keeps the last good result, dimmed. |
| A stage throws (module cap, bad param) | The diagram's error state on that box; stages downstream draw as unreached; the tree shows everything up to it. |
| A selector matches no buds | Not an error: the box reads "0 buds" and its preview is empty. |

## Testing

Library, vitest:

- Every ABOP preset parses, derives the exact module count at its `n`, and matches a stored skeleton
  hash.
- Editing one stage leaves every other stage's nodes byte-identical.
- `animate(design).at(t)` is the same design for the same `t`, whether `t` is reached forward or back.

Lab:

- `npm run smoke` loads the built lab headless, visits every preset, and fails on any console error.
- `npm run shots` screenshots every preset and posts them to the wall under the `fiddy` zone.

The repo is enlisted on the onto fleet, and the full suite runs there after each merge.
