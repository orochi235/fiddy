# fiddy design

**Status: every piece built (0–3 on 2026-10-27, 4–10 on 2026-10-28).** The lab waits on a weasel
release for its vertical rack (see Lab).

fiddy generates trees, the arboreal kind: a JS library (`fiddy` on npm, free as of 2026-10-27) and a
labkit lab for designing them. This document is for whoever builds or extends it, and answers what the
pieces are and how they fit.

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
| 7 | Space colonization | 1 | built |
| 8 | 3D: tube and leaf meshes, three.js view, glTF export | 1 | built |
| 9 | Light competition (Palubicki-style) | 1, ideally 8 | built |
| 10 | Wind: a time-dependent bend on the finished skeleton, on the blits mix | 1 | built |

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

## Space colonization

Piece 7, the `colonize` kind (Runions, Lane and Prusinkiewicz 2007, "Modeling Trees with a Space
Colonization Algorithm"). Attraction points fill a crown; each iteration every point pulls on its
nearest node within the influence distance, each pulled node grows one step along the mean direction
to its points, and points within the kill distance of a node are removed. It stops when no points
remain, nothing grows, or at the iteration cap. The algorithm is in `src/colonize/`.

- **The crown sits on the buds' mean heading** (2026-10-28): its axis is the mean of the selected
  buds' headings, its base `gap` beyond their mean position along it. Shapes are `ellipsoid`, `cone`
  (widest at the base), and `cylinder`, `width` across and `height` along the axis.
- **Only the selected buds' nodes take part** (2026-10-28), not the rest of the incoming tree, so an
  earlier stage's trunk neither attracts nor kills points.
- **A trunk phase** (2026-10-28): while no point is in reach of anything grown from a bud, that bud
  grows straight along its heading, at most as far as the crown's far side.
- **`born` is the iteration** that grew a node (2026-10-28), so playback follows the simulation.
- **A node's first child keeps its order; each later child is one more** (2026-10-28).
- **Radii follow the pipe model** (2026-10-28): tips get `tip`, and a node's radius to the `pipe`
  exponent is the sum of its children's. Only the stage's own nodes are sized, so a crown on an
  L-system trunk does not thicken that trunk.
- A node that would grow onto one of its existing children is skipped instead (2026-10-28), so two
  points balanced either side of a node stall it rather than piling up duplicate nodes.
- Neighbor search is a uniform grid of the points, cell side the influence distance; each new node
  updates the nearest-node record of the points around it (2026-10-28). The presets grow in 15–25 ms.

## Light competition

Piece 9, the `light` stage kind (`kinds/light.ts`, simulation in `light/`): a simplified Palubicki et al.
2009, *Self-organizing tree models for image synthesis*. Every selected bud grows its own tree, and all of
them share one shadow grid, so two seeds side by side shade each other. Each growth cycle:

1. Each bud's light `Q` is read from the shadow grid.
2. `Q` is summed from the tips down; a tree's base gets `vigor × Q` of resource, handed back up by
   Borchert–Honda: at each branching, in proportion to light, the main axis weighted by λ and each
   lateral by 1 − λ.
3. A bud grows ⌊share⌋ metamers, capped at `burst`, each one heading along a blend of its old heading,
   the direction of least shade, the sky, gravity, and a random wander. Every new node gets a lateral
   bud, rolled by the divergence angle from the last and turned out by the branch angle.

Decisions:

- **The shadow grid is sparse** (a `Map` keyed by voxel), its voxels one metamer long. A bud shades its
  own voxel by `shadow` and a pyramid below it, fading linearly to nothing past `depth` layers, rather
  than Palubicki's geometric falloff, so `depth` is where the shadow actually ends (2026-10-28).
- **A bud's exposure leaves out its own shadow** and is capped at 1; the direction of best light is the
  negative gradient of the grid at the bud, by central differences (2026-10-28).
- **Gravity bends only lateral branches**, those of a higher order than the bud the tree grew from; the
  sky weight (phototropism) bends every axis. The heading counts 1 against both (2026-10-28).
- **`burst` caps metamers per bud per cycle.** Borchert–Honda with a high λ pours most of a large tree's
  resource into the leader, which otherwise shoots up in one cycle (2026-10-28).
- **Randomness is only the wander term**, drawn per metamer from the stage's stream; with wander 0 the
  tree is the same for every seed (2026-10-28).
- **Shedding** removes a lateral branch whose buds' mean exposure falls below `shed`, before resource is
  handed out; 0 sheds nothing (2026-10-28).
- **`born` is the growth cycle**, fractional along the metamers a bud grew in it, so playback grows
  cycle by cycle. Radii follow the pipe model from `width` at the tips, exponent `pipe`. A returned bud's
  `vigor` is its last share over the largest share any tip got (2026-10-28).
- **A node cap** (default 4,000) stops growth, so a big cycle count stays interactive. The default preset
  grows about 2,100 nodes in under 50 ms (2026-10-28).

## 3D

Piece 8 (2026-10-28). The library builds meshes and writes glTF with no DOM; the lab draws them with
three.js.

- **Tubes** (`tubeMesh`): the skeleton splits into runs, each continuing through a node's thickest
  child, and every node of a run gets a ring, carried along by parallel transport so tubes do not
  twist. A node's other children start runs of their own from its position, at their own radius.
- **Leaves** (`leafMesh`): one flat leaf at every open bud, along the bud's heading, each rolled by
  the golden angle from the last. ABOP's polygon leaves (`{ … }`) are not drawn (2026-10-28).
- **glTF** (`toGlb`): one binary file, a node, mesh, and material per part, Y up. Khronos's
  validator reports no errors or warnings on an exported Weber–Penn tree (2026-10-28).
- **The lab's 3D view** builds tubes at half the 2D view's line weight per unit of radius, so the two
  views agree on thickness, with leaves sized as a share of the finished tree (the Leaves slider). It
  frames the finished tree, keeping the orbit unless the tree's size or place changes by a tenth.
  Export glTF writes the finished tree as the view dresses it. three.js loads only once the 3D view
  is first shown (2026-10-28).

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

## Wind

Piece 10. Wind is a stage kind, `wind`, placed after the tree it bends, rather than a pass outside
the stack: it then reaches previews, the URL, and `grow` like any stage, and needs nothing from the
lab (2026-10-28).

- **The clock is a channel on the blits mix.** `animate` writes `clock`, 0–1 through the loop, and
  `at(t)` puts it on the design as `design.clock`; `growSteps` hands it to every kind as `ctx.clock`,
  and a design without one stands at 0. A kind marked `clocked` makes the design count as `moving`, so
  the lab regrows it every frame as it does for a motion (2026-10-28).
- **It takes no time and bends everything.** The kind is `instant`, so it has no band in the score, and
  `whole`, so its selector is ignored and every incoming bud is moved with its node (2026-10-28).
- **The bend.** Every segment turns about one level axis across the wind, so the turns add down the
  chain from root to tip and each node costs one rotation. A segment's share is its length times the
  length it carries, over its girth to the flex exponent; girth is radius times √(length carried), the
  pipe model, so an L-system drawn at one radius still stiffens toward the root. Shares are scaled so
  the most pliant chain sums to 1, which makes `strength` the lean of the most pliant tip at the top of
  a gust (2026-10-28).
- **Gusts, sway, and turbulence come in whole cycles per loop**, as a wave motion's `cycles` do, so the
  wind meets itself where the loop wraps. Gusts lower the whole tree's push by up to `gustiness`; each
  branch (a run of nodes at one order) sways on its own phase, with a flutter at three times the sway
  on another, both hashed from the stage's stream and the branch's first node (2026-10-28).
- **Nodes without a parent stay put**, so the root never moves, and neither does anything hung from an
  `f` anchor. Wind belongs last: a stage after it grows from the bent buds, unbent itself (2026-10-28).
- **Cost** (measured 2026-10-28, vitest on this machine): the wind pass takes about 1 ms a frame on
  the 4,119 nodes of the `Fig. 1.24d, in wind` preset, beside 1.5 ms to regrow the L-system under it.

## Lab

Layout (2026-10-27, mockup B), a CSS grid inside the one instrument's body:

| Area | Contents |
|---|---|
| Left column | The preset menu, then the pipeline: `EffectEditor`, `look="rack"`, `direction: 'down'`, `showPreviews`. Each stage box shows a thumbnail of the tree after that stage, and a `~` on any animated param. |
| Center | The tree, in 2D (the selected stage's branches highlighted) or in 3D (see 3D), switched at the pane's top left. |
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

- `npm run smoke` loads the built lab headless, visits every preset in the 2D view and then the 3D
  one, and fails on any console error or a tree that draws nothing.
- `npm run shots` screenshots every preset and posts them to the wall under the `fiddy` zone.

The library suite is enlisted on the onto fleet (`.onto/tests`). Typecheck runs there too, as a
detached `onto run`, since this machine refuses `tsc`.

The weasel packages are pinned to an exact npm version (2026-10-27). Linking the local checkout with
`file:` was tried and dropped: that checkout's dists are built piecemeal, so `diagram` from today needed
exports the older `core` and `geom` dists lacked.
