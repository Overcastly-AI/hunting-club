# Design directions

Two directions for the full redesign: the public site, the club admin and the phone app as one system. They replace the look in docs/UI_REDESIGN.md, which the owner rejected. Nothing here is production code; these are static mockups to choose from.

## Why the last one failed

The P1b kit is the look any product gets: a cream page (#F4F1EA), white rounded cards with a soft shadow, pills and badges. It would suit a payroll tool. Nothing in it comes from hunting, the woods, dawn, radios or a club. Both directions below start from things that exist in this product's world and nowhere else.

## What stays fixed in both

- Archivo only, using its weight and width axes. Loaded from `packages/design/fonts/Archivo-Latin.woff2`.
- Every colour is a token (the top of each `styles.css`). `tools/contrast.mjs` reads those tokens and checks 74 pairs: text at 4.5:1, control edges at 3:1, both themes. All pass.
- Tap targets 48 px or more, body 16 px or more, map text 13 px or more.
- Sunrise and sunset only. No legal shooting hours anywhere.
- Ask for a Hand is gold, has a hand icon and says who it pings. No red, no siren, no "SOS", no "emergency".
- Dark first, with a daylight theme that is not cream.
- Hunter orange #FF7A1F keeps its three jobs: you, the main action, the selected item. In First Light it is also the sun.
- The dawn wildlife scene stays. Each direction recolours it with its own tokens.

## What is replaced from docs/UI_REDESIGN.md

Everything in that brief was treated as open, not only colour.

| In the brief | First Light | Tag Board |
|---|---|---|
| Cream light theme | Frost: pale blue sky over white ground | Manila: tag stock, with white tags |
| Neutral grey-black dark theme | Blue hour: slate blues | Clubhouse: stained-board browns |
| Cards with 1 px borders | No cards. A sky above, the ground below, one ridge line between | No cards. Tags hanging on rails |
| Stat tiles | One sentence that carries the counts | The roster itself, as tags, and tally marks |
| Left sidebar in the admin | Top navigation on the sky | Left sidebar painted on the board |
| Badges and status pills | Plain words in the sentence or the row | What kind of tag it is (member, guest, you) |
| Topo contour texture | Dropped | Dropped |
| Rounded 52 px map controls | One panel with square-ish corners | Plates with hard corners |
| Circle hunter markers | Kept: circles with a freshness ring | Tags with a freshness edge |
| lucide icons | A small sprite drawn for the mockups, always with a word | Same sprite |

---

## Direction 1: First Light

The owner likes the dawn scene, so this direction makes the whole product out of it. The scene is paper-cut layers: sky, far ridge, near ground. The interface uses the same three layers and nothing else.

### Palette

Dark, "blue hour" (the default):

| Token | Hex | Job |
|---|---|---|
| Sky | #1C2B3F | Page top, navigation, hero |
| Ridge | #2B3F58 | Raised things, dividers |
| Ground | #111B28 | Where the work is |
| Night | #0A121C | Foreground, footer, tab bar |
| Frost | #EEF3F6 | Text (12.8:1 on sky, 15.5:1 on ground) |
| Haze | #B3C1CF | Quieter text (7.8:1 on sky) |
| Blaze | #FF7A1F | The sun, you, the main action (ink on it 6.7:1) |
| Lantern | #F5C04E | Ask for a Hand |

Daylight, "hard frost":

| Token | Hex | Job |
|---|---|---|
| Sky | #C6DBEA | Page top, navigation, hero |
| Ridge | #A9C4D8 | Raised things, dividers |
| Ground | #F6F9FB | Where the work is: frosted ground, near white and cool |
| Night | #DFE9F0 | Footer, tab bar |
| Frost (ink) | #0D1A29 | Text (12.3:1 on sky, 16.6:1 on ground) |
| Haze | #34485C | Quieter text (6.6:1 on sky) |
| Blaze | #FF7A1F | Same orange, with an ink outline so its edge is 12.3:1 |
| Lantern | #6B4C00 on #FBE7B0 | Ask for a Hand |

In daylight the scene becomes a frost morning: blue sky, pale trees, dark animals on white ground.

### Archivo

Wide and light above the horizon, steady below it.

| Role | Size | Width | Weight |
|---|---|---|---|
| Display (hero, sign-in) | 34 to 60 px | 118 | 300 |
| Title, club name, sheet title | 27 to 38 px | 112 to 114 | 350 |
| Section heading | 21 px | 108 | 600 |
| Body | 17 px / 1.5 | 100 | 450 |
| Buttons | 17 to 20 px | 104 | 650 |
| Sunrise and sunset times | 26 px | 116 | 400 |
| Map labels | 13 and 15 px | 100 | 650 and 800 |

Text is left aligned. The one exception is the club name, centred under the sun's arc.

### Layout

The horizon. Every screen has a sky and a ground, and one ridge line between them. The sky holds what is true right now (where the sun is, sunrise, sunset, who you are). The ground holds the work.

```
Admin, My club (1280)                      Phone, Map
+----------------------------------------+ +------------------+
| mark  My club Roster Stands ...  Invite| | [Club] .-o--.    |
|            . - o - - - .               | |  6:52     4:38   |
|        .       sky         .           | |  wind NW 6  34F  |
|     .   Pine Ridge Hunt Club   .       | | Mesh: 3 radios   |
| 6:52 a.m.  ~~ridge, deer, turkeys~ 4:38| |      map         |
|~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~| |   o you          |
| 12 members and 2 guests. 8 stands in   | |~~~ridge edge~~~~~|
| 3 areas. 12 harvests this season.      | | Not checked in   |
|                                        | | [   Check In   ] |
| Needs you           Harvests           | | [Ask for a Hand] |
| row ........ [act]  Bucks ====== 7     | | Map Chat In Club |
| row ........ [act]  Club plan, active  | +------------------+
+----------------------------------------+

Site, home (1280)
+----------------------------------------+
| mark Hunt Club Mesh   Features ... CTA |
| Keep track of your                     |
| hunting party with      sky            |
| no cell service                        |
| [Get the free app] [For hunting clubs] |
|~~~~~~ridge, sun, deer, turkeys~~~~~~~~~|
| phone   What it does ... (a list)      |
| 1  2  3  How it works                  |
| sky band: For hunting clubs            |
|~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|
| Questions                     footer   |
+----------------------------------------+
```

### Principles

1. Three layers, no boxes. Depth comes from the layer a thing sits on, as in the scene.
2. The sun is the only orange in the sky. On the ground, orange is the one thing to press.
3. Say it in a sentence before reaching for a widget. The club's counts are one line of text with links.
4. One ridge line per view. It marks the horizon and is never used as decoration between ordinary sections.

### The one memorable element

The day arc. The sun sits on a dotted arc between today's sunrise and sunset, where it really is right now. It is the admin's header, and the same arc, small, is the phone's conditions panel. It carries real product meaning: the overdue alert is sunset plus the grace time, so the admin page states that time beside it.

### Self-critique against the generic tells

- Cream and terracotta: avoided. Daylight is blue and white.
- Near-black with one bright accent: the nearest risk, since this is dark with orange. The dark is a real blue (not tinted black), there are four tonal layers, and gold and green carry meaning beside the orange.
- Broadsheet with hairlines: no.
- SaaS cards: none, and no drop shadows.
- Template chrome: no eyebrow labels, no all caps, no middle-dot strings (the mesh line reads "Mesh: 3 radios, heard 12s ago"), no arrows on links, no monospace.
- Hero of big number plus small label: the first draft had four stat figures under the horizon. That is the default, so it became the sentence.

Changed after reviewing the plan and the first screenshots:

- Stat row replaced by the summary sentence.
- A ridge edge on every section was cut back to one horizon per view, plus one sky band on long site pages.
- The club name collided with the arc at the top left, so it moved under the arch and is centred.
- The sunset label ran into a turkey; the overdue time moved to its own line on the ground.
- In daylight the mid-distance trees fought the navigation; they were lightened.
- The slide-to-check-out control was a pill; it is now square-cornered, like every other control.
- Map marks keep fixed colours in both themes, because the aerial picture is the same in both.

Known weak points: the scene sits behind navigation text, so every new scene colour needs a contrast check against text (the checker covers the current ones). Light 300-weight display type is only used at 34 px and up; it must never be used for body text or in the app's field screens. The arc needs the club's location, which the web admin only has once the property line is drawn.

---

## Direction 2: Tag Board

The product replaces the paper sign-in sheet and the board on the clubhouse wall where every member hangs a tag. This direction is that board. People are tags. Things hang from rails. Type looks painted through a stencil.

### Palette

Dark, "clubhouse before light" (the default):

| Token | Hex | Job |
|---|---|---|
| Board | #2A2019 | Page: stained plywood |
| Rail | #453528 | Rails, dividers, raised things |
| Pit | #1A130E | Footer, tab bar |
| Paint | #F4ECDC | Text on the board (13.6:1) |
| Chalk | #CDBDA6 | Quieter text (8.7:1) |
| Manila | #DCC391 | A member's tag, with ink #1F1610 on it (10.4:1) |
| Blaze | #FF7A1F | Your tag, the main action |
| Brass | #E8BD45 | Nails, Ask for a Hand |

Daylight, "manila":

| Token | Hex | Job |
|---|---|---|
| Board | #E8D09C | Page: the whole page is tag stock |
| Rail | #CFB271 | Rails, dividers |
| Pit | #D9BE85 | Footer, tab bar |
| Paint (ink) | #1F1610 | Text (11.8:1) |
| Chalk | #4A3823 | Quieter text (7.4:1) |
| Tag | #FFFFFF | A member's tag, outlined in ink (17.8:1) |
| Guest tag | #FFF0B8 | A guest's tag |
| Blaze | #FF7A1F | Same orange, with an ink outline (11.8:1 edge) |

### Archivo

Narrow and heavy for anything painted on the board, normal width for anything you read.

| Role | Size | Width | Weight |
|---|---|---|---|
| Stencil display | 50 to 104 px | 62 | 800 |
| Title | 34 to 48 px | 66 | 800 |
| Section heading | 24 px | 75 | 800 |
| Tag initials, prices, tallies, times | 34 to 132 px | 62 | 900 |
| Navigation, buttons | 19 to 23 px | 78 to 80 | 700 to 800 |
| Body | 17 px / 1.45 | 100 | 500 |
| Map labels | 13 and 15 px | 100 | 650 and 800 |

Sentence case throughout. A real stencil would be all caps; that is exactly the default this project already bans, so it is not used. Text is left aligned everywhere.

### Layout

Rails and tags. A rail is a thick horizontal bar with nails. Whatever belongs to a person or a choice hangs from it as a tag. Everything else is painted straight on the board.

```
Admin, My club (1280)                      Phone, Map
+----------+-----------------------------+ +------------------+
| HCM      | Pine Ridge Hunt Club        | |Club| 6:52 | 4:38 |
| |My club | 12 members and 2 guests ... | |    | NW 6    34F |
|  Roster  |                    [Invite] | | Mesh: 3 radios   |
|  Stands  | The roster                  | |   [DH]  map      |
|  Harvests| ==o====o====o====o====o==== | |        [RT]      |
|  Map pack| [JS] [MAL] [DH] [RT] [ED]   | |   o you          |
|  Billing | ==o====o====o====o====       | |==================|
|          | [LA] [PS] [BO] [SR] [+]     | | Not checked in   |
|          |                             | |[JS> slide to   o]|
| Jake     | Needs you       Harvests    | |[Else][Ask a Hand]|
| Sign out | row ... [act]   Bucks ||||/  | | Map Chat In Club |
+----------+-----------------------------+ +------------------+

Site, home (1280)                          Site, pricing
+----------------------------------------+ +------------------+
| mark Hunt Club Mesh   Features ... CTA | | Free for hunters.|
| Keep track of your    ==o====o====o==  | | One plan ...     |
| hunting party with    [DH] [RT] [You]  | | ===o=======o==== |
| no cell service       a free party     | | [Free ] [Club  ] |
| [Get the free app] [For hunting clubs] | | [ $0  ] [ $100 ] |
|========================================| | side by side     |
|     the dawn scene, as a strip         | | ledger rows      |
|========================================| +------------------+
| phone   What it does ... (a list)      |
| ==1==   ==2==   ==3==  How it works    |
+----------------------------------------+
```

### Principles

1. A tag is a person or a price. Nothing else gets the shape.
2. Painted or hung: if it does not hang, it is paint on the board, with no container.
3. Heavy and plain. Thick rails, 3 px outlines, hard corners. It should survive noon sun and bad eyes.
4. Count the way hunters count. Harvests are tally marks with the number beside them.

### The one memorable element

Your tag. The roster is a wall of hanging tags, and yours is the orange one. In the app, checking in is sliding your tag onto the peg, and the sheet then shows it hanging at Creek Stand. Checking out slides it back. The spec already asks for slide-to-confirm; this gives the slide a meaning. The pricing page hangs two price tags, which is the same object doing an honest job.

### Self-critique against the generic tells

- Cream and terracotta: the real risk here. Daylight is warm. It is a saturated buff (#E8D09C), a long way from #F4F1EA, with white tags and black ink, and it reads as tag stock, not as a cream web page. If the owner reads any warm light page as "cream again", swap daylight to white tags on a zinc-grey board; the system survives that.
- Near-black with one accent: the dark is a visible brown, and manila, brass and white tags sit beside the orange.
- Broadsheet with hairlines and zero radius: corners are hard, but rules are 6 px rails with nails, not hairlines, and there are no newspaper columns.
- SaaS cards: tags could turn into cards if used for everything. Rule 1 exists to stop that.
- Template chrome: no eyebrows, no all caps, no middle dots, no arrows, no monospace.

Changed after reviewing the plan and the first screenshots:

- The first daylight idea was a birch-plywood board. That was cream by another name, so it became saturated manila with white tags.
- Stencil headings were all caps in the plan; changed to sentence case.
- Stands were going to be a second wall of tags. That broke rule 1, so stands stay in their own page and the dashboard keeps tags for people only.
- The sheet's check-in controls were too tall and hid an open stand on the map; "Somewhere else" moved beside Ask for a Hand.
- Hunters on the map were circles in the plan; they became small tags so the map and the roster use one object.
- The numbered steps on the home page are kept because pairing a radio really is a sequence.

Known weak points: 62-width type is only safe large; nothing under 19 px is condensed below 78. Fifteen tags is fine, a 50-member club needs the roster page to switch to a denser list. The one-step slide on the Map (check in at the nearest open stand) is a product change from the spec, which sends you to the Check In tab first; it needs an owner decision. The dawn scene is a guest here: a strip on the home page and a window on sign-in.

---

## The dawn scene

- First Light: it is the system. Full-bleed hero on the home page and sign-in, and the admin header. Recoloured as blue hour in the dark theme and as a frost morning in daylight.
- Tag Board: kept, but framed. A strip under the home hero and the right half of sign-in, printed in the board's browns (dark) or as a sepia print (daylight).
- The mockups show a still frame. Production keeps the motion, the pause button and the reduced-motion still that `dawnScene.ts` already has.
- Recolouring needs one change in `packages/design`: the scene's paints become theme tokens instead of the fixed Design D colours. `tools/build.mjs` shows the mapping (sky, far, mid, near, tree, front, animal, fog, sun).

## Recommendation

First Light. It is built from the one thing the owner already likes, its daylight theme is the furthest from cream, and it is the calmer of the two for a 60-year-old reading a phone at dawn. Its memorable element, the day arc, is also useful: sunrise, sunset and the overdue time are what a hunter and an admin both check.

Tag Board is the bolder identity and the better story for selling to clubs. If the owner wants the product to be unmistakable on a shelf of outdoor apps, pick it, and settle the daylight colour first.

A sensible mix if neither wins outright: First Light as the system, with the tag as the shape for people in the roster and for the check-in slide.

## Files

Each direction has the same five pages and one stylesheet. `shared.css` holds what both use (font, reset, icon and scene plumbing, the phone's fixed geometry).

| Page | First Light | Tag Board |
|---|---|---|
| Site home | `first-light/home.html` | `tag-board/home.html` |
| Site pricing | `first-light/pricing.html` | `tag-board/pricing.html` |
| Admin sign-in | `first-light/signin.html` | `tag-board/signin.html` |
| Admin My club | `first-light/club.html` | `tag-board/club.html` |
| App Map and sheet | `first-light/map.html` | `tag-board/map.html` |

Screenshots sit beside the pages, each in `-dark` and `-daylight`: `home-1280`, `home-390`, `pricing-1280`, `pricing-390`, `signin-1280`, `club-1280`, `club-390`, `map` (the phone at 390 by 844 with the sheet before check-in, and the sheet after check-in) and `map-phone` (the phone alone, which the home pages show). They were taken at deviceScaleFactor 2 and then reduced to a 256-colour palette to keep the repo small.

To rebuild, from the repo root:

```sh
node docs/redesign/directions/tools/build.mjs      # fills the scene, map, icons and ridge into the pages
node docs/redesign/directions/tools/contrast.mjs   # checks every token pair
NODE_PATH=/opt/node-tools/node_modules node docs/redesign/directions/tools/shoot.mjs
```

`build.mjs` takes the dawn scene from `packages/design/src/dawnScene.ts` (bundled with the workspace's esbuild), so the mockups show the real art. The aerial map is a drawn stand-in. Member names, counts and dates are sample data; the summary, the "Needs you" rows and the sunrise and sunset line on My club are proposals, not things the admin shows today.
