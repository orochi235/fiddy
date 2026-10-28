# fiddy design

**Status: pieces 0–3 built 2026-10-27; pieces 4–10 unbuilt**, each to get its own spec when its turn
comes. The lab waits on a weasel release for its vertical rack (see Lab).

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
| 0 | weasel: `direction: 'down'` on the diagram `rack` look | — | built, merged in weasel; unreleased |
| 1 | Foundation: skeleton, buds, stages, seeded streams, blits timing, 2D renderer, lab shell | — | built |
| 2 | L-system, deterministic, with grammar workbench | 1 | built |
| 3 | Stochastic rules | 2 | built |
| 4 | Parametric rules: numbers, conditions, expressions | 3 | built |
| 5 | Context-sensitive rules | 4 | built |
| 6 | Recursive parametric generator (Weber–Penn style) | 1 | built |
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

Syntax from an unbuilt piece gets an error at its position naming the piece that adds it.

**Stochastic rules** (piece 3, 2026-10-27). Several rules for one symbol are alternatives, each
optionally weighted as `F (.33) → …`, the probability ABOP prints over the arrow:

- Unweighted alternatives split what the weighted ones leave, evenly; with none weighted, all are equal.
  Weights past 1 are a parse error.
- When every alternative is weighted and they sum short of 1, the rest is the chance the module stays
  as it is.
- Each bud a stage grows from derives its own string, from a seed drawn from the stage's stream in bud
  order, so a crown on many buds varies from branch to branch. A deterministic grammar draws nothing and
  every bud shares one string.
- Choices are drawn in string order, generation by generation, so raising `n` keeps the earlier
  generations as they were.
- A stochastic stage's nodes carry `bud`, which bud's string their `module` indexes. The lab's grammar
  views show the first bud's string, and hover links only within it.

**Parametric rules** (piece 4, 2026-10-28) are ABOP's chapter 1.10 notation: `A(l,w) : l > 1 → F(l)[+A(l*r,w)]`.

- Expressions have `+ - * / % ^`, comparisons, `&& || !`, `?:`, and functions (`sin`, `cos`, `sqrt`,
  `min`, `max`, …). Trigonometry is in degrees, like the turtle's angles (2026-10-28).
- `#define name value` declares a constant, as ABOP writes it. `#` starts a comment anywhere else, and
  `/* */` is a comment. `//` is not a comment: ABOP's 3D grammars write `////` as four rolls (2026-10-28).
- The turtle reads a module's first parameter: `F(l)` steps `l` × step, `+(a)` and the other turns use
  `a` degrees, `!(w)` sets the radius to `w` × width. `$` rolls the turtle until its left axis is
  level.
- For each module, the first rule (in the order written) whose predecessor, arity, contexts, and
  condition hold rewrites it. Lines with the same left side are one stochastic rule's alternatives.
  A module whose arity matches no rule stays as it is.

**Context-sensitive rules** (piece 5, 2026-10-28): `left < pred > right`, either side optional or `*`.
Contexts skip `#ignore` symbols. A left context steps over whole branches and out of the one the
module is in; a right context steps over branches it doesn't name, may name one (`A > [B]C`), and a
`]` in it skips to the end of the current branch. Context parameters bind before the predecessor's,
then after, in reading order.

**The rewriter** works on an array of modules, never a JS string. It stops at a module cap (200,000 by
default, adjustable); hitting the cap is a stage error.

**The turtle** uses ABOP's commands: `F` draw a step, `f` move without drawing, `+ -` yaw, `& ^` pitch,
`\ /` roll, `|` turn around, `[ ]` push and pop, `!` thin the branch. Other symbols draw nothing. It
starts from each selected bud's frame; bracket depth is branch order.

**Derivation and interpretation are cached separately.** The derived string depends only on the
grammar and `n`; an animated angle or step length reruns only the turtle.

## Weber–Penn

The `weberpenn` kind (piece 6) grows a simplified Weber & Penn (1995) tree from each selected bud: a
trunk along the bud's heading, then up to three levels of branches. Each stem is a polyline of
`segments` pieces that bends by its curve, tapers, and carries its children spread evenly along it.

- **Params are flat**, per-level ones suffixed with their level: `branches1`, `length1`, `angle1`, and so
  on to 3 (2026-10-28).
- **Branch counts are exact**: every stem at level n − 1 gets `branches{n}` children, so a level holds the
  product of the counts above it. Weber & Penn's count scaling by parent length was left out
  (2026-10-28).
- **Lengths follow the paper**: a first-level branch is `length1` × the trunk's length × the `shape`
  ratio at its height (conical, spherical, flame, and the rest of the paper's eight); a deeper one is
  `length{n}` × (parent length − 0.6 × its offset). A child's radius is the parent's times
  (child length / parent length)^`ratioPower`, capped at the parent's radius where it hangs (2026-10-28).
- **Directions use the turtle's own turns**: a child rolls about its parent's heading by a running
  `rotate` (140° by default, the paper's phyllotaxis), then yaws away by `angle{n}`. At `rotate` 180°
  the tree stays in the screen plane, which suits the 2D view (2026-10-28).
- **One curvature per role**: `curve` bends the trunk, `bend` curls every branch back toward its
  parent's axis; each is the total turn across the stem (2026-10-28).
- **One `vary`** scales every length, angle, rotation, and bend by a random factor in 1 ± `vary`, in
  place of the paper's per-level variation params (2026-10-28).
- **A bud at every stem's tip**, at its order (the incoming bud's plus its level), so a later stage
  can continue from twigs with a selector such as `order ≥ 2` (2026-10-28).
- **`StageKind.brief`** names the params a pipeline box shows, since a box listing every number param
  would run to twenty rows; the L-system's `n` and `δ` moved there from a special case in the lab
  (2026-10-28).

## Timing

blits is in from the start (2026-10-27):

- **Growth playback.** Pipeline order is the score: each stage grows for `time.grow` seconds after the
  one before it, instant kinds (the seed) taking none. One looping voice writes a `grow.<stage>`
  channel per stage, 0 to 1, and holds 1 once the stage is done, so the finished tree stays up for
  the rest of the loop. The tree reveals a stage's nodes by `born` (arc length, so growth spreads
  outward) or, in turtle mode, by module order.
- **Start times are absolute, not blits anchors** (2026-10-27): `Mix.project` cannot read back through
  anchored voices without a history tape, and a stack's starts are a sum of durations anyway.
- **Animated params.** Any number param can carry a `motion`. Each motion is a looping voice on that
  param's channel, set up as agnew's `animate.ts` does it.
- **Scrubbing** reaches an earlier time by wrapping forward to the same point in a later pass of the
  loop, as agnew does, so going backward is exact without a history tape.

## Lab

Layout (2026-10-27, mockup B), a CSS grid inside the one instrument's body:

| Area | Contents |
|---|---|
| Left column | The preset menu, then the pipeline: `EffectEditor`, `look="rack"`, `direction: 'down'`, `showPreviews`. Each stage box shows a thumbnail of the tree after that stage, and a `~` on any animated param. |
| Center | The tree, 2D. The selected stage's branches are highlighted. |
| Right | The inspector for the selected stage: its params panel, and for an L-system the grammar editor, rule pictures, generation strip, and linked string. |
| Bottom | The transport: the blits score drawn as one band per stage and a curve per motion, with the playhead. |

**The pipeline adapter** (`apps/lab/src/pipeline/`) turns a `Design` into an `EffectDoc`, and reads a
reorder or a deletion back out of the doc the editor hands over. The lab builds the `EffectRun` itself
from `growSteps`, previews included, rather than registering evaluators with the diagram's runner. The port type is `tree` (a skeleton and its open buds).
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
- Editing a stage leaves the nodes of every stage before it identical, and a stage's random stream
  depends only on the seed and its own id.
- `animate(design).at(t)` is the same design for the same `t`, whether `t` is reached forward or back.

Lab:

- `npm run smoke` loads the built lab headless, visits every preset, and fails on any console error.
- `npm run shots` screenshots every preset and posts them to the wall under the `fiddy` zone.

The library suite is enlisted on the onto fleet (`.onto/tests`). Typecheck runs there too, as a
detached `onto run`, since this machine refuses `tsc`.

The weasel packages are pinned to an exact npm version (2026-10-27). Linking the local checkout with
`file:` was tried and dropped: that checkout's dists are built piecemeal, so `diagram` from today needed
exports the older `core` and `geom` dists lacked.
