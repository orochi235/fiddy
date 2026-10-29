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
