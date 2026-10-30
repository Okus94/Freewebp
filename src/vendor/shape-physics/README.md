Shape Physics v3.0.0 from ReactDrops (https://reactdrops.dev/components/background/shape-physics),
added from https://reactdrops.dev/r/shape-physics.json. Licensed under the ReactDrops Component
License 1.0 (LICENSE.txt in this folder): free to use in this site, not to be redistributed as a
reusable component.

Local changes:
- solid-engine.ts `draw()`: clears the canvas before painting the background, so a transparent
  background (used here, so the page shows through) doesn't leave trails behind moving shapes.
