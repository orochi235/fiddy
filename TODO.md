# TODO

- **Move the weasel pins to the first release with the rack's `direction` option** (merged in weasel
  as `d9896bbe3`, 2026-10-27). Until then the pipeline column draws a horizontal rack. After bumping,
  load the lab and check the vertical rack. Seen through `WEASEL=~/src/weasel` (2026-10-27) it stacks
  top to bottom, but the last stage's unwired output port sits on the box's right side rather than
  its bottom, which looks like a weasel bug to raise there. Drag-to-reorder along it is untested.
- **Hide `Pipe exponent` while `Girth` is `drawn`** (2026-10-28). The L-system and Weber–Penn
  inspectors show it under both choices, though only `pipe` reads it; a param spec has no way yet to
  show itself only when another param holds a given value.
- **Merge the `pipeline-fit` branch after weasel's next release** (2026-10-28). It passes
  `maxScale`, `bounded`, and `refit="always"` to the pipeline's `EffectEditor`. Those props are on
  weasel `main` but aren't published yet, so fiddy's typecheck rejects them until a release.
