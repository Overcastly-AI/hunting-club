# @huntclub/site

The public marketing site: static HTML, no client JavaScript, no analytics.

- **Route registry** (`src/routes.ts`): the one list of pages. Navigation, the footer, canonical URLs, Open Graph meta and the prerender list come from it; later also `sitemap.xml` and the CloudFront allowlist. Add a page there and in `src/pages.tsx`.
- **Build** (`npm run build -w @huntclub/site`): Vite builds `src/prerender.tsx` for Node with the Archivo font emitted to `dist/assets`, then running it writes `dist/<path>/index.html` for every route with `react-dom/server` `renderToStaticMarkup`. No hydration.
- **Styles** (`src/styles.ts`): inlined in each page, generated from `@huntclub/design` tokens (dark bands, and light bands with `lightColors`).
- **Copy**: only what the app does today (docs/SPEC.md). No range numbers, ratings, quotes or night mode. 911 appears only in the footer safety note (`SAFETY_NOTE`).
- **Tests** (`npm test -w @huntclub/site`): registry rules (unique paths, title ≤ 60, description 70–160), one H1, canonical and Open Graph meta, links that resolve, no scripts, copy rules and light-band contrast.
