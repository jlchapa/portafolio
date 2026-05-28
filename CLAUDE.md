# Agent Notes

This is a static personal portfolio. Keep it vanilla: plain HTML, CSS, and JavaScript only.

## Files

index.html            page content, project rows, contact links, scroll fade script
styles.css            design tokens, typography, layout, responsive styles
shader-bg.js          <shader-bg> WebGL background and fallback tiers
images/*.svg          project cover art
README.md             user-facing project notes

There is no build step, package manager, linter, test suite, or CI.

## Editing Rules

- Do not add analytics, or trackers.
- Do not introduce React, Tailwind, npm, TypeScript, ES modules, or a bundler.
- Prefer existing CSS tokens in `:root` before adding new colors, spacing, or typography values.
- Keep scripts loaded with plain `<script src="..."></script>`.

## Common Changes

| Task | File |
| --- | --- |
| Change copy, links, or sections | `index.html` |
| Add or edit a project card | `index.html` and optionally `images/*.svg` |
| Adjust layout, colors, type, or breakpoints | `styles.css` |
| Tune background detection or shader behavior | `shader-bg.js` |
| Update project instructions | `README.md` or `CLAUDE.md` |

## Background Notes

`<shader-bg>` supports three tiers:

- `animated`: WebGL canvas
- `static`: CSS gradient fallback
- `solid`: no shader rendering

`detectTier()` in `shader-bg.js` chooses a tier from URL override, reduced motion, Save-Data, device memory/CPU, WebGL support, and touch-device heuristics. Preserve all three tiers when changing shader code.

The hero fade is driven by the inline scroll script in `index.html`, which updates `--scroll-fade` on `<html>`. The stacking order depends on `.page-bg`, `<shader-bg>`, `.bg-blend`, `.grain`, and `.shell`.

## Verification

Use:

```bash
node --check shader-bg.js
git diff --check
```

For visual changes, open `index.html` or run a simple static server and check the page in a browser.
