# TODO

- **Raise the rack's sideways output port with weasel** (2026-10-29, on weasel 1.14.0). In the
  pipeline's vertical rack the last stage's unwired output port sits on the box's right side rather
  than its bottom. Drag-to-reorder along the vertical rack is untested.
- **Hide `Pipe exponent` while `Girth` is `drawn`** (2026-10-28). The L-system and Weber–Penn
  inspectors show it under both choices, though only `pipe` reads it; a param spec has no way yet to
  show itself only when another param holds a given value.
- **Escape doesn't close the preset menu** (2026-10-29, weasel 1.14.0). The kit `Select`'s listbox
  stays open, with focus on its selected option; clicking outside or picking an option closes it.
  Find whether labkit's shell or the `Select` swallows the key, and raise it in weasel.
  `scripts/serve.mjs` closes the menu by picking the current preset meanwhile.
- **One work budget across every stage kind** (filed 2026-11-15 from automated review). Only the
  L-system expander has a cap (`ModuleCapError`); colonization, light competition, the tube and leaf
  meshes, and `animate` have none, so a valid but adversarial chain (a large `colonize` crown under a
  deep `lsystem`) can hang the lab tab with nothing to report. `packages/fiddy/src/grow.ts:growSteps`
  would carry a shared node/polygon budget and a cancellation signal into each `kind.apply`, keeping
  per-stage errors and `unreached`. Each stage already draws from its own seeded stream
  (`streamFor(seed, stage.id)`), and a budget must not change that.

- **Behind on blits.** It pins a blits 0.x release (agnew 0.8.1, fiddy 0.14.0, read 2026-11-25) against the current 1.4.0, a real migration rather than a bump. Closes when it builds on blits 1.x.

## Use labkit's hash links and bare view

weasel's labkit is gaining `@weasel-js/labkit/link` and `bareOf` (weasel batch 2026-11-26, unreleased).
- `packLink`/`unpackLink`/`useHashLink` keep a lab's state in the URL hash. They're versioned: a link
  from a newer version is refused with a report of what was dropped, and an older one goes through
  `migrate`. The codec is JSON or a binary one you supply. Writing the hash never creates undo steps.
- `bareOf` reads `?bare`, `?bare=still[=<ms>]` and `bg` (3, 4, 6 or 8 hex digits), beside labkit's
  `still` and `present`.

Old links with no version prefix read as version 0 and go through `migrate`, so existing shared links
can keep working. Once a weasel release carries this, drop this repo's own copy: `apps/lab/src/state.ts` and `bare/Bare.tsx`.  Closes when the
lab uses labkit's.
