# Fonts

| File                   | What                                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Archivo-Variable.ttf` | Archivo variable font, axes `wght` 100–900 and `wdth` 62–125. Unmodified copy of `ofl/archivo/Archivo[wdth,wght].ttf` from [google/fonts](https://github.com/google/fonts). |
| `Archivo-OFL.txt`      | Its license: SIL Open Font License 1.1. Ship it with the app.                                                                                                               |

Source: google/fonts `main`, built from [Omnibus-Type/Archivo](https://github.com/Omnibus-Type/Archivo) commit `b5d63988ce19d044d3e10362de730af00526b672`.
SHA-256 of the TTF: `0e094a7d3c7c4c25cf1310c4b30014f1dae9332220b1c2c88f4fa996f0b05053`.

The app loads it once with expo-font (`src/app/_layout.tsx`) under the family name in `src/theme/typography.ts`. Weight and width are set per text style with `fontVariationSettings`; see that file.
