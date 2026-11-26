# Web font

`Archivo-Latin.woff2` is the app's Archivo variable font (`app/assets/fonts/Archivo-Variable.ttf`, SIL OFL 1.1, license in `app/assets/fonts/Archivo-OFL.txt`) cut down to the Latin range and compressed for the web: about 95 KB instead of 659 KB. Both variable axes (`wght` 100–900, `wdth` 62–125) and all layout features are kept.

It was generated once and committed; nothing in the build depends on the tool. To make it again (for example after the TTF changes), with fonttools 4.55.3 and brotli 1.1.0 in a throwaway Python environment, from the repo root:

```sh
pyftsubset app/assets/fonts/Archivo-Variable.ttf \
  --output-file=packages/design/fonts/Archivo-Latin.woff2 --flavor=woff2 --layout-features='*' \
  --unicodes='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
```

The web admin and the public site load it through `@huntclub/design/fonts/Archivo-Latin.woff2` (Vite fingerprints it), preload it and use `font-display: swap` (`fontFaceCss` in `src/css.ts`).
