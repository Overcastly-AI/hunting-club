# Design: Map-first

The owner approved this direction on 2026-11-27. It is the visual source of truth for the app, the club admin and the public site, and it supersedes the visual spec in docs/UI_REDESIGN.md (whose structure, layout and accessibility requirements still apply). The values below live in `packages/design` (see "Tokens in code" at the end); the static mockups, their screenshots and the tools that built them are on the `design-map-first` branch under `docs/redesign/directions/map-first/`.

One direction for the site, the club admin and the phone app. It follows the owner's note after the P1b kit, First Light and Tag Board were turned down: "Go more onX and research what is out there." The research is in [docs/redesign/research/README.md](redesign/research/README.md). These are static mockups, not production code. Member names, counts and dates are sample data.

## The idea

The map is the product, so the map is every screen's background and everything else is equipment bolted over it. There is no illustration and no decoration. The chrome is small, dark and dense, like the face of a handheld GPS, and it reads out numbers.

What makes it ours and not a copy of onX is what is on the map. Their map shows land. Ours shows people: who is out, where, and how long ago their radio was heard.

## Palette

Dark is the default. The aerial picture is the same in both themes; only the chrome changes.

Dark, "gunmetal":

| Token | Hex | Job |
|---|---|---|
| pit | #0B0E10 | Page, tab bar, admin rail, text fields |
| plate | #14191C | Anything floating on the map; sheets; panels |
| raised | #232B30 | Secondary buttons, table heads, the selected row |
| edge | #7F8B91 | Outlines of controls (5.1:1 on plate) |
| ink | #F3F1EA | Text (15.7:1 on plate) |
| quiet | #AEB7B6 | Second-line text (8.6:1 on plate) |
| blaze | #FF7A1F | You, the main action, the selected item. Text on it is #160E06 (7.3:1) |
| lantern | #F5C04E | Ask for a Hand; a position that has gone stale |
| fresh | #4ADE80 | A position heard just now; "Open"; mesh connected |
| wind | #8EC5FF | The wind arrow |

Daylight, "overcast": a cool grey-green white, chosen for glare. It is not cream.

| Token | Hex | Job |
|---|---|---|
| pit | #DCE1DF | Page, tab bar, rail |
| plate | #FBFCFB | Floating chrome, sheets, panels |
| raised | #E7EBE9 | Secondary buttons, table heads |
| edge | #66706C | Outlines of controls |
| ink | #0E1416 | Text (18.1:1 on plate) |
| quiet | #45504D | Second-line text |
| blaze | #FF7A1F | Same orange, always with an ink outline so its edge passes 3:1. Orange text becomes #A8420A |
| lantern | #6B4C00 on #FBE7B0 | Ask for a Hand |
| fresh / wind | #157F3C / #1B5EA6 | Darkened to pass on white |

Every pair the direction draws (text 4.5:1, control edges and rings 3:1) is checked in both themes by `packages/design/scripts/__tests__/theme.test.ts`, which fails the build if one drops under its threshold. On the branch, `node docs/redesign/directions/tools/contrast.mjs` checks the mockups' own copy of the tokens.

## Archivo

One family, with a rule that carries meaning: words are set at normal width, and anything measured is set condensed with tabular figures.

| Role | Size | Width | Weight |
|---|---|---|---|
| Site headline | 50 px (36 on a phone) | 88 | 800 |
| Page and sheet titles | 23 to 38 px | 88 | 800 |
| Body | 17 px / 1.5 (16 in the phone) | 100 | 450 |
| Buttons | 17 to 20 px | 92 | 750 to 800 |
| Readouts: times, distances, counts, "2 min" | 17 to 23 px (46 for a price) | 76 | 700 |
| Marker plate, first line | 15 px | 86 | 800 |
| Marker plate, second line; map labels | 13 to 14 px | 78 to 90 | 600 to 750 |
| Tab labels | 14 px | 90 | 650 |

Text is left aligned everywhere. Mixed case throughout; no capitals-only labels.

## Layout

```
Phone, Map                          Phone, layers open
+----------------------------+      +----------------------------+
| 2:24                       |      | Sunrise|Sunset| Wind | Temp |
| [Pine Ridge v][Mesh: 3 rad]|      |          map               |
| Sunrise|Sunset| Wind | Temp|      |   (DB) Creek Stand         |
| 6:52   | 4:38 | NW 6 | 34  |      +----------------------------+
|                    [Layers]|      | Map layers          [Done] |
|  (DB) Creek Stand  [North ]|      | [Aerial] [Topo] [Hybrid]   |
|       Dale B., 2m  [Findme]|      | Property line and areas On |
|     On the move (RT)       |      | Stands                  On |
|          (o) You  \ scent  |      | Hunters checked in      On |
| |_500 ft_| (JH) Hickory    |      | Wind and your scent     On |
+----------------------------+      | Saved on this phone        |
| Not checked in   2 h 14 min|      +----------------------------+
| [ Check In ][Ask for a Hand|      | Map | Chat | Check In |Club|
| Map | Chat | Check In |Club|      +----------------------------+
+----------------------------+

Admin, My club (1280)
+---------+------------------------------------+------------------+
| mark    | [Pine Ridge Hunt Club        ]     | Out now   5 of 14|
| My club | [412 acres, 7 stands, 2 areas]     | (DB) Dale B. 2min|
| Roster  | [Sunrise|Sunset|Wind|Temp    ]     | (RT) Ray T.  9min|
| Stands  |                                    | (JH) June H. 3min|
| Harvests|        the property, live          | ...              |
| Packs   |     line, areas, stands, people    | Alert at 5:08 pm |
| Billing |                                    | Needs you       3|
|         | |_500 ft_|     [Clubhouse radio]   | row     [Review] |
| Dale B. |                                    | row     [Extend] |
+---------+------------------------------------+------------------+

Site, home (1280)
+-----------------------------------------------------------------+
| mark Hunt Club Mesh  The map For clubs Pricing  [Sign in] [Get] |
| +------------------+        the same live map, full width       |
| | See where        |   (DB) Creek Stand       (TA) My spot      |
| | everyone is      |        On the move (RT)                    |
| | hunting ...      |           (o) You        (MW) Powerline    |
| | [Get the app]    |                  [Sunrise|Sunset|Wind|Temp]|
| +------------------+                  [Mesh: 3 radios, 12s ago ]|
| What you see on the map      legend: you, fresh, stale, stand,  |
|                              property line, club area           |
| phone screenshot             1 Pair  2 Scan  3 Check in         |
| Free for hunters         |   For hunting clubs                  |
+-----------------------------------------------------------------+
```

On a 390 px screen the same pieces stack: the map on top, the panel rising over it as a sheet.

## Principles

1. The map is the page. On the phone, the site hero, the sign-in page and My club, the map runs edge to edge and the interface floats on it. Nothing frames the map.
2. Plates, not cards. A plate exists only because something has to float over imagery. Away from the map (roster, pricing) the content is a table with hairlines, with no boxes around the parts.
3. Read out, do not decorate. A value that matters is a number in a labelled cell. The same four-cell strip (sunrise, sunset, wind, temperature) appears on the phone, the site hero and My club.
4. A ring that tells the truth. Solid green means the radio was heard just now. Broken gold means it was not, and the plate says how long ago. An old position is never drawn as a live one.
5. Orange has three jobs: you, the main action, the selected item. One orange dot on any map.
6. A word on every control, at 48 px or more.

## The one memorable element

The freshness ring with its plate: "Creek Stand / Dale B., 2 min ago". It is the only thing here that no other hunting app has, because none of them hears from people by radio. It is on the map, in the admin's "Out now" list, in the roster table and in the site's legend, always drawn the same way.

## What it draws from the research

| Finding | Where it shows |
|---|---|
| The genre is a full-screen map, floating controls and a bottom sheet | Every map screen |
| Charcoal and orange is the genre's uniform, not onX's own | Kept, with our orange and near-black text on it |
| Readouts in hairline-divided cells (Gaia, Garmin, BaseMap) | The conditions strip |
| Layers as a sheet: three basemap thumbnails, then on/off rows | Phone, layers open |
| A right-edge stack of map controls | Layers, North, Find me |
| A ring around a person, a tag with the name | Made to mean freshness |
| Sites sell with the map and one sentence per feature | The hero is the live map; features are a legend |
| A plan comparison table with ticks | Pricing |
| Nobody shows sunrise and sunset on the map | We do, first in the strip |

## Deliberately different from onX

| onX | Map-first |
|---|---|
| Red-orange #FF3300 with white text, used across the brand | Hunter orange #FF7A1F with near-black text, three jobs only |
| A wordmark bar across the top of the map | No logo on the map. The top is the club button, mesh status and the strip |
| A floating pill tab bar with five tools | A docked bar with four tabs: Map, Chat, Check In, Club |
| Round floating buttons | One squared plate of three controls, each with a word |
| Teardrop pins | Hunters are circles, stands are rounded squares, each with a plate |
| Photo avatars with a decorative ring | Initials, and the ring states how fresh the position is |
| White sheets over the map | Dark sheets by default; white only in the daylight theme |
| Parcel lines, owner names, agency tints | One line: the club's own, white with an orange inner line. Dotted club areas |
| Atlas Grotesk; condensed capitals for posters | Archivo; mixed case; condensed only for numbers |
| Charcoal with contour-line texture | No texture anywhere |
| Phones cropped in circles; a sale strip | The hero is the map at full width with live markers on it |
| Wind as a dial and a calendar of good and bad days | Wind as a readout and a scent cone from your own dot |
| An SOS add-on, sold in the tools sheet | Ask for a Hand: gold, a hand, "Pings club members". No red, no siren, no "SOS" |

## Hard rules, checked

- Archivo only (`packages/design/fonts/Archivo-Latin.woff2`).
- Every colour is a token (`packages/design`; in the mockups, the top of `styles.css`). The aerial stand-in's picture values are in the mockups' `tools/build.mjs`, since they are imagery, not interface.
- Body text is 16 px or more; map text is 13 px or more; tab labels and second lines in sheets are 14 px.
- Buttons, tabs, switches, list rows and the slider are 48 px or taller. Hunter markers are drawn at 42 px and stands at 38 px so the map stays readable; in the build their tap area must be padded to 48 px.
- Sunrise and sunset only. "2 h 14 min until sunset" and "5:08 pm, sunset plus 30 minutes" are the only derived times. No legal shooting hours, no first or last light.
- Ask for a Hand is gold on a dark gold wash with a hand icon and names who it pings. The only red is the unread badge and the north arrow.
- Dark first. Daylight is cool white and grey, not cream.
- Location: the sheet says "Nobody can see you yet" until check-in.

## Self-critique against the generic tells

- Cream with a serif and terracotta: none of it.
- Near-black with one bright accent: this is the nearest risk, and the brief asks for it. What keeps it from being the default: the dark is only the chrome, the page is mostly aerial green and tan; there are four working colours with fixed meanings (orange, gold, green, blue); and the daylight theme is a full second look.
- Broadsheet hairlines and zero radius: no. Hairlines only divide cells and rows.
- The SaaS card kit: no cards. Three radii with jobs: 6 px for a marker plate, 10 to 12 px for controls and plates, 16 px for the top of a sheet. Shadows only under things floating on imagery.
- Template chrome: no eyebrow labels, no capitals-only labels, no middle dots, no arrows on links, no monospace. Numbers are condensed Archivo.
- Big number with a small label as a hero: the strip is small and is real, checked-every-morning data, not a vanity stat.
- Numbered markers: used once, for the three steps, which are a real sequence.

Changed after reviewing the plan and the first screenshots:

- The first aerial read as camouflage cloth. The canopy is now small lit crowns over a slow tone, which reads as timber from above.
- The plan had a contour-line backdrop on the site. Research showed four competitors using it, so it was cut.
- Toggles were orange. With five in a row that broke the three-jobs rule, so "on" is now ink.
- The roster had a Role column. It pushed the table under the locator map, and the role reads better under the name.
- The hero's strip covered a stand at the top right, so it moved to the lower right where the property is empty.
- Chat was a plain thread. A strip of the map now sits above it, so a message and a position are read together.

## Mockup files (on the `design-map-first` branch)

| File | Shows |
|---|---|
| `phones.html` | The app: Map, Map with layers open, Chat, Check In |
| `home.html` | Site home |
| `pricing.html` | Pricing |
| `signin.html` | Admin sign-in |
| `club.html` | Admin, My club |
| `roster.html` | Admin, roster |
| `styles.css` | Tokens, the map, shared chrome, the phone |
| `pages.css` | Site and admin layout |

Screenshots sit beside each page at deviceScaleFactor 2: `<page>-1280-<theme>.png` and `<page>-390-<theme>.png` for the five web pages, and `phone-map`, `phone-layers`, `phone-chat`, `phone-checkin` (390 by 844 each) plus `phones` (all four) for the app. Themes are `dark` and `daylight`.

To rebuild, from the repo root:

```
node docs/redesign/directions/tools/build.mjs
node docs/redesign/directions/tools/contrast.mjs
NODE_PATH=/opt/node-tools/node_modules node docs/redesign/directions/tools/shoot.mjs map-first
```

The tools and `shared.css` come from the `design-directions` branch and were extended, not forked: `build.mjs` gained the `world` part (the aerial stand-in and the sample club, one list shared by every page) and the `mark` part (the logo from `packages/design`); `shoot.mjs` and `contrast.mjs` gained this direction's pages and pairs. The First Light and Tag Board mockups are not on this branch.

## Open points for the build

- The aerial is a drawn stand-in. Real USGS imagery is busier, so marker plates may need the full 94% backing they have here.
- "2 h 14 min until sunset", the "Needs you" list and the roster's locator map are proposals, not things the product shows today.
- The spec's top bar puts the club button beside the conditions panel. Here they are one plate with two rows, and the mesh line sits in the first row.
- The spec's cream light marketing band (#F4F1EA) is gone. Since M4 the site is drawn in the theme tokens, dark or daylight by the device setting, and `lightColors` is removed.
- The site hero's aerial is `@huntclub/design/aerial` (the same stand-in as the mockups, served as one SVG file); real imagery replaces it later.

## Tokens in code

`packages/design` holds every value above; the web gets them as generated CSS variables (`--theme-*`) and the app as React Native styles. Token names stayed the same wherever the meaning did; the direction's names map to them like this:

| Direction | Theme token (`themes.dark` / `themes.light`) | CSS variable |
|---|---|---|
| pit | `canvas` (page, tab bar, rail, text fields) | `--theme-canvas` |
| plate | `plate` (was `surface0` and `surface1`: cards are gone) | `--theme-plate` |
| raised | `raised` (was `surface2`) | `--theme-raised` |
| (raised while pressed or hovered) | `pressed` (was `surface3`) | `--theme-pressed` |
| hair | `borderSubtle` | `--theme-border-subtle` |
| edge | `borderControl` | `--theme-border-control` |
| ink / quiet | `text` / `textSecondary` (`textTertiary` for disabled only) | `--theme-text`, … |
| blaze, on-blaze, blaze-ink, blaze-edge | `accent`, `onAccent`, `accentText` (and `focusRing`), `accentBorder` | `--theme-accent`, … |
| lantern / lantern-wash | `warning` / `warningTint` (Ask for a Hand) | `--theme-warning`, … |
| fresh / stale | `fresh` / `stale` (new) | `--theme-fresh`, `--theme-stale` |
| wind | `wind` (new; `info` has the same values) | `--theme-wind` |
| alert / on-alert | `alert` / `onAlert` (new; `danger` stays for destructive actions) | `--theme-alert`, … |
| lift (shadow colour) | inside `shadowPlate` (was `shadowCard`), `shadowPopover`, `shadowDialog` | `--theme-shadow-plate`, … |
| map-text, halo, water-text | `colors.text`, `colors.mapHalo`, `colors.waterLabel` (the map's own colours) | `--color-*` |

Type: `textScale.readout` (23 px) and `readoutInline` (17 px) are condensed to 76% with tabular figures; titles are 88%, buttons (`button`) 92%, tab labels 90%, marker plates (`markerName`, `markerDetail`) 86% and 78%; words (`body`, `bodyLarge`, `label`, `caption`) are at normal width. Body is weight 450. No monospace: invite codes are Archivo with tabular figures.

Shape: `radii.sm` 6 (marker plate, badges), `md` 10 (controls), `lg` 12 (plates), `xl` 16 (sheet tops, dialogs), `full` for round things; `sizes.controlBorder` 1.5 px and `selectedBorder` 2 px; markers `hunterMarker` 42, `standMarker` 38 (radius 9), `youDot` 24, `opacity.markerPlate` 0.94; buttons `BUTTON_HEIGHT` 48 / 52 / 64.

The web component kit (`web/src/components/ui`, dev-only page at `/app/#/_kit`) is drawn in this look; screenshots at 1280 and 390, dark and daylight, are in `docs/redesign/m1/`.
