# Agent Notes

This is a static personal portfolio. Keep it vanilla: plain HTML, CSS, and JavaScript only.

## Files

index.html            overlay content: header, About panel, project rows, footer links
styles.css            design tokens, glass panels, layout, responsive styles
scene.js              three.js Tulum diorama (tree, birds, leaves, house, cenote, scatter)
images/               project screenshots (not used by the current page)
README.md             user-facing project notes

There is no build step, package manager, linter, test suite, or CI.

## Editing Rules

- Do not add analytics, or trackers.
- Do not introduce React, Tailwind, npm, TypeScript, ES modules, or a bundler.
- three.js is loaded as the global `THREE` from the r159 `three.min.js` CDN build (the last non-module build) with an SRI hash. Update the hash if the version changes.
- Use system fonts only (`--font-sans`, `--font-mono`); do not add web font requests.
- Prefer existing CSS tokens in `:root` before adding new colors, spacing, or typography values.
- Keep scripts loaded with plain `<script src="..."></script>`.

## Common Changes

| Task | File |
| --- | --- |
| Change copy, links, or sections | `index.html` |
| Add or edit a project row | `.projects` in `index.html` |
| Adjust layout, colors, type, or breakpoints | `styles.css` |
| Tune the 3D scene (tree, birds, colors, camera) | `CONFIG` at the top of `scene.js` |
| Update project instructions | `README.md` or `CLAUDE.md` |

## Scene Notes

`scene.js` renders into `#scene`. All tweakable values live in the `CONFIG` object at the top of the file. The scene re-reads `CONFIG` every frame, so `tulumScene.config.<key> = value` in the browser console previews changes live, and `tulumScene.startPsychedelic()` starts psychedelic mode.

- The default horizon is a floating rock: an irregular island outline (`islandRadius()`) with voxel stone columns underneath, shaped by a grayscale depth map. `onIsland()` keeps rocks, bushes and the capybara on it.
- The capybara wanders, avoiding obstacles, and walks to the cenote to drink. Clicking the diamond above it starts psychedelic mode (night palette, stars, boid radius rings, a countdown bar whose tag returns to day).
- The pointer pushes branches and scares birds; vertical movement tilts the camera, and the mouse wheel zooms a little.
- Performance: voxel models are merged meshes that keep only faces touching empty space (`buildVoxelGeometry()`); the tree also merges coplanar faces (`buildGreedyVoxelGeometry()`) and gets its colors from shader uniforms, and the floating rock only draws column bottoms and exposed side strips. Repeated moving things are InstancedMeshes (falling leaves, vines, and the birds and capybara, whose Object3Ds only hold transforms); the psychedelic rings share two line buffers. `syncConfig()` runs only when a CONFIG value changes. The pixel ratio adapts to the frame rate (capped at 1.5 on touch devices, 2 elsewhere). `tulumScene.renderer.info` shows draw calls (about 21 in the main pass, plus one per shadow caster) and triangles (about 310k in the main pass; `renderer.info` resets after the shadow pass, so shadow draws are not counted).

Without `THREE` or WebGL2 the CSS gradient on `.scene` stays as the backdrop. The overlay panels sit on top of the canvas; `showOverlay` in `CONFIG` shifts the camera framing to leave room for them.

## Verification

Use:

```bash
node --check scene.js
git diff --check
```

For visual changes, open `index.html` or run a simple static server and check the page in a browser.
