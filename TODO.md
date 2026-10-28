# TODO

- **Move the weasel pins to the first release with the rack's `direction` option** (merged in weasel
  as `d9896bbe3`, 2026-10-27) and `EffectEditor`'s `maxScale`, `bounded`, and `refit` (2026-10-28).
  Until then the pipeline column draws a horizontal rack, and the lab's typecheck against the
  published weasel rejects those three props. After bumping,
  load the lab and check the vertical rack. Seen through `WEASEL=~/src/weasel` (2026-10-27) it stacks
  top to bottom, but the last stage's unwired output port sits on the box's right side rather than
  its bottom, which looks like a weasel bug to raise there. Drag-to-reorder along it is untested.
