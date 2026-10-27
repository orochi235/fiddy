# First build implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: being executed 2026-10-27 under gogogo. Delete this file once every box is ticked; anything
durable moves to `README.md` first.**

**Goal:** Roadmap pieces 0–2 of `docs/superpowers/specs/2026-10-27-fiddy-design.md`: weasel's
vertical rack, the foundation, and the deterministic L-system with its lab.

**Architecture:** `packages/fiddy` is pure TS: a `Design` is a stack of plain-data stages, each a
stage kind that takes buds and grows nodes; `growSteps` returns the skeleton after every stage;
`animate` runs growth reveal and param motions on one blits mix. `apps/lab` draws the stack with
`@weasel-js/diagram`'s `EffectEditor` (rack, `direction: 'down'`), the tree on a 2D canvas, and the
selected stage's inspector.

**Tech Stack:** TypeScript, vitest, `@msb235/blits` 0.14.0, Vite, React 19, `@weasel-js/labkit` and
`@weasel-js/diagram` linked from `~/src/weasel` by `file:` until a weasel release carries the rack
direction, playwright-core for smoke and shots.

Decisions made while planning (2026-10-27):

- **Absolute stage start times, not blits anchors.** `Mix.project` cannot read back through anchored
  voices without a history tape; a stack's start times are a sum of durations anyway.
- **One looping growth voice** writes every stage's `grow.<id>` channel, holding 1 after the stage
  finishes. A voice per stage would leave at its end and drop its channel back to rest, emptying the tree.
- **The lab builds the `EffectRun` itself** from `growSteps`, rather than using the diagram's async
  evaluator runner: fiddy already evaluates the whole stack synchronously.
- **`n` and `δ` are number params**, not grammar text, so they can carry a motion. Lines `n = …` and
  `δ = …` pasted into the grammar are read by the parser as `defines`, and the lab moves them into the
  params.
- **`born` is arc length from the stage's start**, so growth reveal spreads outward from the trunk.
  `module` gives the turtle-order reveal.
- The lab lays out its own CSS grid inside the instrument body rather than `WorkspaceGrid`, because
  the pipeline column, tree, inspector, and transport all belong to one trial.

## Tasks

- [ ] **0. weasel rack direction** — delegated to a subagent in a weasel worktree; merged to weasel
  `main`, diagram `dist` rebuilt. Not pushed or published.
- [ ] **1. Scaffold** — root `package.json` (workspaces, scripts `dev test typecheck build smoke
  shots`), `packages/fiddy` (`package.json`, `tsconfig.json`, `vitest.config.ts`), `apps/lab`
  (`package.json`, `tsconfig.json`, `vite.config.ts` on port 5199 with `host: '::'`, `index.html`,
  `weasel.vite.ts` adapted from astv's). `npm install`.
- [ ] **2. Math and randomness** — `src/vec.ts` (Vec3 ops), `src/frame.ts` (turtle frame and its
  rotations about H, L, U), `src/random.ts` (`streamFor(seed, stageId)`: string hash into
  mulberry32). Tests: rotations keep the frame orthonormal; `+` then `-` returns the frame; streams
  differ by stage id and repeat for the same id.
- [ ] **3. Skeleton and design** — `src/skeleton.ts` (types, `emptySkeleton`, `skeletonHash`),
  `src/design.ts` (`Design`, `Stage`, `Selector`, `selectBuds`, `sanitizeDesign`), `src/codec.ts`
  (base64url JSON for the URL hash). Tests: selector by order and height; hash changes when one
  coordinate moves; codec round trip.
- [ ] **4. L-system parser** — `src/lsystem/parse.ts`: ABOP notation and ASCII stand-ins to
  `Grammar { axiom, rules, defines }`; later-piece syntax refused with a positioned `ParseError`
  naming the piece. Tests: every preset parses; `(0.5)`, `A(l)`, `:`-conditions, and `<` context are
  refused with line and column.
- [ ] **5. Rewriter** — `src/lsystem/rewrite.ts`: `derive(grammar, n, cap)` over module arrays,
  memoized by grammar text and `n`; `ModuleCapError` past the cap. Tests: Fig 1.24c string at n=1;
  module counts for every preset match an independent symbol-count recurrence; the cap throws.
- [ ] **6. Turtle** — `src/lsystem/turtle.ts`: interpret from each bud's frame into nodes (`order` =
  bracket depth, `module` index, `born` arc length, `radius` thinned by `!`), and buds at the stage's
  leaf nodes. Tests: `F+F` at δ=90° lands where expected; `[`/`]` restores position and frame;
  `f` starts a new root; `!` thins.
- [ ] **7. Stage kinds and grow** — `src/kinds/` (`seed`, `lsystem`, registry with param specs),
  `src/grow.ts` (`grow`, `growSteps` with per-stage errors and unreached downstream). Tests: editing one
  stage leaves another stage's nodes byte-identical; a thrown stage marks later ones unreached; unselected
  buds pass through.
- [ ] **8. Presets** — `src/presets.ts`: ABOP Fig. 1.24a–f, plus a two-stage example where a second
  L-system grows from the first one's order-≥2 buds. Test: skeleton hash per preset, by snapshot.
- [ ] **9. animate** — `src/animate.ts`: growth voice plus a voice per motion on one blits mix;
  `at(seconds) → { design, grown }`. Tests: same `t` gives the same result reached forward or
  backward; growth is 0 at the stage's start, 1 after it and holds; a wave motion swings around the set value.
- [ ] **10. Lab shell** — `main.tsx`, `App.tsx`, `instrument.tsx`, `state.ts` (URL hash),
  `session.ts` (edits and undo), `Workspace.tsx` + `.css` (layout B grid).
- [ ] **11. Tree view** — `TreeView.tsx`, `drawTree.ts`: fit to view, line width from radius, reveal by
  `grown` or turtle order, the selected stage's branches highlighted, the hovered node's module reported.
- [ ] **12. Pipeline view** — `pipeline/doc.ts` (Design ↔ EffectDoc, a `tree` port type, params and
  `~` markers on boxes), `pipeline/run.ts` (EffectRun with previews, errors, "0 buds"), `Pipeline.tsx`
  (EffectEditor, rack down, select, reorder, delete), `registerCanvasFont`.
- [ ] **13. Inspector** — `Inspector.tsx`: param fields from the kind's specs, motion toggle per
  number param, add stage. `GrammarPanel.tsx`: editor with positioned error, rule pictures, generation
  strip, linked string.
- [ ] **14. Transport** — `Transport.tsx`: play/pause, scrubber, reveal mode, score bands per stage and
  a curve per motion.
- [ ] **15. Smoke and shots** — `scripts/smoke.mjs` (built lab, every preset, no console errors),
  `scripts/shots.mjs` (each preset to the wall, zone `fiddy`).
- [ ] **16. Close out** — README (what it is, run it, layout), PROJECTS.md status, spec status lines,
  delete this plan, `onto-enlist`, full suite on the fleet.
