# Portafolio

A small static personal portfolio template for side projects.

## Current Shape

- `index.html` contains the page content, sections, links, and scroll-fade script.
- `styles.css` contains tokens, typography, layout, responsive rules, and background layering.
- `shader-bg.js` defines the `<shader-bg>` WebGL background with `animated`, `static`, and `solid` tiers.
- `images/*.svg` contains the three project cover images.

There is no framework, bundler, package manager, build step, test suite, or CI.

## Personalize

Search for `YOUR_HANDLE` in `index.html` and replace it with your name or handle. Then update the nearby `TODO` comments for links, email, timezone/location, and project URLs.

## Run

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## Background Testing

Force a background tier with:

- `?bg=animated`
- `?bg=static`
- `?bg=solid`

## Deploy

Deploy the repo root to GitHub Pages, Vercel, or any static host.

## License

MIT.
