# @huntclub/site

The public marketing site in the map-first design (docs/DESIGN.md): static HTML, no analytics. The only scripts are the home page's old-bookmark forward and the /join page's invite reader, both self-hosted files.

- **Route registry** (`src/routes.ts`): the one list of pages. Navigation, the footer, canonical URLs, Open Graph meta, the prerender list, `sitemap.xml` and the CloudFront allowlist come from it. Add a page there and in `src/pages.tsx`.
- **Build** (`npm run build -w @huntclub/site`): Vite builds `src/prerender.tsx` for Node with the Archivo font emitted to `dist/assets`, then running it writes `dist/<path>/index.html` for every route with `react-dom/server` `renderToStaticMarkup`. No hydration.
- **Styles** (`src/styles.ts`, `src/map/mapCss.ts`): one content-hashed stylesheet, generated from `@huntclub/design`: the theme CSS (`--theme-*`, dark by default, daylight when the device prefers light) for the chrome, and the map's own colours (`--color-*`) on the aerial. Nothing inline, under the strict CSP.
- **Home hero** (`src/map/`): the example club (`sampleClub.ts`) on the aerial stand-in (`@huntclub/design/aerial`, written to `assets/aerial-<hash>.svg`), with marker plates and the readout strip worded by the shared freshness and readout functions. Positions are generated classes, never style attributes.
- **Copy**: only what the app does today (docs/SPEC.md). No range numbers, ratings, quotes or night mode; wind is always "last known wind"; sunrise and sunset only. 911 appears only in the safety note (`SAFETY_NOTE`).
- **Tests** (`npm test -w @huntclub/site`): registry rules, one H1, canonical and Open Graph meta, links that resolve, the CSP checker, 48 px targets, the 360 px fit, theme contrast pairs in both themes, the map hero and legend, the pricing table and copy rules.
- **Screenshots** (`NODE_PATH=/opt/node-tools/node_modules node site/scripts/shoot.mjs docs/redesign/m4` after a build): home, pricing and /join at 1280 and 390, dark and daylight, plus a real-browser check that no page scrolls sideways at 360 px.
