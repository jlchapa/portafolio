# Agent Notes

This is a static personal portfolio. Keep it vanilla: plain HTML, CSS, and JavaScript only.

## Files

index.html            overlay content: header, About panel, project rows, footer links
styles.css            design tokens, glass panels, layout, responsive styles
scene.js              three.js Tulum diorama (tree, birds, leaves, house, cenote, scatter)
images/*.svg          legacy project cover art (unused by the current page)
README.md             user-facing project notes

There is no build step, package manager, linter, test suite, or CI.

## Editing Rules

- Do not add analytics, or trackers.
- Do not introduce React, Tailwind, npm, TypeScript, ES modules, or a bundler.
- three.js is loaded as the global `THREE` from the r159 `three.min.js` CDN build (the last non-module build) with an SRI hash. Update the hash if the version changes.
- Prefer existing CSS tokens in `:root` before adding new colors, spacing, or typography values.
- Keep scripts loaded with plain `<script src="..."></script>`.

## Common Changes

| Task | File |
| --- | --- |
| Change copy, links, or sections | `index.html` |
| Add or edit a project card | `index.html` and optionally `images/*.svg` |
| Adjust layout, colors, type, or breakpoints | `styles.css` |
| Tune the 3D scene (tree, birds, colors, camera) | `CONFIG` at the top of `scene.js` |
| Update project instructions | `README.md` or `CLAUDE.md` |

## Scene Notes

`scene.js` renders into `#scene`. All tweakable values live in the `CONFIG` object at the top of the file. The scene re-reads `CONFIG` every frame, so `tulumScene.config.<key> = value` in the browser console previews changes live.

Without `THREE` or WebGL2 the CSS gradient on `.scene` stays as the backdrop. The overlay panels sit on top of the canvas; `showOverlay` in `CONFIG` shifts the camera framing to leave room for them.

## Verification

Use:

```bash
node --check scene.js
git diff --check
```

For visual changes, open `index.html` or run a simple static server and check the page in a browser.
