# Agent Notes

This is a static personal portfolio. Keep it vanilla: plain HTML, CSS, and JavaScript only.

## Files

index.html            page shell: header, about copy, footer and contact links
styles.css            design tokens, typography, layout, responsive styles
app.js                project data (PROJECTS), slideshow, about toggle, cursor
images/*.png          project screenshots
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
| Change about copy or contact links | `index.html` |
| Add or edit a project | `PROJECTS` in `app.js` and `images/*.png` |
| Adjust layout, colors, type, or breakpoints | `styles.css` |
| Tune slideshow, wheel/keyboard or cursor behavior | `app.js` |
| Update project instructions | `README.md` or `CLAUDE.md` |

## Layout Notes

The page is a single, non-scrolling viewport: header, a three-column `.main` (project list, image card, detail), and a footer with the progress bar and large project title. The mouse wheel and ← → keys switch projects. Below 760px wide the layout stacks into one column and the page scrolls normally (wheel switching is disabled there). The custom cursor is hidden on touch devices.

## Verification

Use:

```bash
node --check app.js
git diff --check
```

For visual changes, open `index.html` or run a simple static server and check the page in a browser.
