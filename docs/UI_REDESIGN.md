# UI redesign brief

> **Superseded on visuals (owner decision, 2026-11-27).** The visual spec here (colours, the light "sunlight" theme on cream, card styling, radii, shadows, type widths) is replaced by the map-first direction in [docs/DESIGN.md](DESIGN.md). The structural, layout and accessibility requirements below (shell, page structure, component list and behaviour, 48 px targets, contrast, keyboard and axe checks) still apply.

The UI Director's redesign brief of 2026-11-26 (email "Hunt Club Mesh UI feedback — 2026-11-26 — redesign"), copied here as the design spec for phases P1 to P5. The coordinator decisions below override the brief where they differ.

## Coordinator decisions (override the brief)

- **48 px minimum, no exceptions.** Never anything under 48 px for a tap target. There is no 40 px `sm` button size: `sm` is 48 px everywhere (section 6, Button).
- **Sign-in keeps the dawn scene.** The sign-in brand panel keeps the existing animated dawn scene (owner request; `packages/design` `dawnScene`). The topo contour texture is used everywhere else the brief mentions it (empty states, sidebar footer).
- **Approved dependencies:** `lucide-react` and `lucide-react-native` (P1b and P5, not P1a). Radix only per package, after the CSP spike (P1b).
- **Light theme: approved.** docs/SPEC.md says: dark-first, with a light theme for both the app and the admin, and theme choice System / Dark / Light. The "orange is for you, the main action, the selected item" rule and the no letter-spaced all-caps rule stay.

## How P1a implements section 4

- Tokens live in `packages/design`: `src/theme.ts` (dark and light semantic colours, shadows, scrim, theme constants and the contrast rules), `src/type.ts` (type scale), `src/sizes.ts` (spacing, radii, breakpoints, motion), `src/css.ts` (generated CSS and the theme bootstrap script).
- The original Design D tokens (`colors`) stay for the map and the current screens; where one is the same colour as a theme token, it takes its value from the theme.
- CSS variables are generated: `--theme-*` for the semantic theme tokens (for example `--theme-surface-1`, `--theme-text-secondary`, `--theme-shadow-dialog`), `--space-1` … `--space-16` plus the `xs`–`xl` aliases, `--radius-sm` … `--radius-full`, `--motion-fast`, `--motion-base`, `--motion-easing`. The existing `--color-*` variables are unchanged, so current pages look the same until P2 moves them to `--theme-*`. A page adopts the native control colours with `color-scheme: var(--theme-color-scheme)`.
- Theme selection: `:root` is dark, `[data-theme="light"]` is light, and with no attribute ("system") light applies under `@media (prefers-color-scheme: light)`. The choice is stored in localStorage `hcm-theme`; the bootstrap script (its own file, loaded in `<head>`, no inline script) sets `data-theme` before first paint.
- `packages/design/scripts/__tests__/theme.test.ts` checks every text pair at 4.5:1 and every control edge and focus ring at 3:1 on every surface, in both themes (a superset of the pairs in 4.1), and fails the build if any pair drops under its threshold.
- Light theme `surface-0` is not given in the brief; P1a uses white, like cards. The light `accent-hover` is the dark one (#FF8F40, 8.14:1 with on-accent). On-success and on-danger are white in the light theme.

---

## The brief

The current UI isn't good enough; this is a full redesign mandate. The owner looked at the admin and said it plainly: the UI is trash. After going through every screen again, I agree. Stop polishing. Rebuild the look and the structure. This email is the brief. Small items from earlier threads are not repeated here; the ones still open are noted at the end and get absorbed into the redesign.

I reviewed the screens from deploy 4 (signed in, 1280px and about 500px), the repo at main 5da74c8 (packages/design, web/, app/), and your replies. Contrast numbers below come from a script, not by eye.

### 1. The verdict

It reads as an unstyled scaffold, not a product. Three causes:

(a) There is no structure. The only navigation is a row of six grey pills at the top. The pills are #23272B on a #121416 page, which is 1.23:1, so the shapes barely exist. Sign out is the brightest pill and sits in the same row as the destinations. At 500px the row wraps into two ragged lines. There is no page header, no sidebar, no account menu and no icons anywhere in the web admin.

(b) There is no hierarchy. Body is 16/22. The page title is 25px, only 1.5x body. Section h2s are 17px, barely different from body. Everything is the same weight, the same grey, the same size, and every page is a stack of text with one orange button. Brand orange appears only on buttons and one underline, so the product has no personality.

(c) It uses defaults where design should be. Billing is a raw definition list, and the screenshot shows the browser's default 40px indent on "Active" and "February 10, 2027". Dates are native browser inputs. Radios are pills with no preview. Loading is a text line. Empty states are one-line paragraphs. Cards have no border, no header and no elevation (card vs page is 1.09:1), so they read as muddy rectangles.

It also wastes the screen. At 1280px the content is a 620px column hugging the left of centre, with more than half the canvas empty black and 70% of the page below the content empty. It looks like something that finished loading its CSS halfway.

### 2. Screen-by-screen critique

**Sign-in (and code step)**

- A 440px card floats near the top of a black void. No imagery, no product context. A stranger can't tell what this app is.
- The logo is tiny and the tagline is squeezed into a 14px paragraph beside it.
- The code field is a bare empty box. It gives no sense of "enter the code", no auto-submit and no paste affordance.
- "Send a new code" and "Use a different email" are two unframed, unequal buttons side by side. They look like leftovers.
- The first screen of the product is the weakest one. It is the first thing every club admin sees.

**My club**

- A card with the club name at body size (16px, the same as everything else), a grey "Billing and payment" button whose label is indented differently from the heading above it, and an orphaned "Signed in as ..." line under it.
- This is the home page of a paid product and it holds zero information. No member count, no subscription state, no next step. (The summary row from PR #71 is the right idea, built on the same weak primitives. It will be rebuilt as stat tiles.)

**Roster**

- At 500px, one member is shown as a three-row key/value spec sheet (Name / Role / Guest pass until). A person is not a spec sheet.
- A 62px orange "Make an invite" button floats alone below two paragraphs. It looks like a form submit with no form.
- Roles are plain text. There are no avatars or badges.

**Stands and areas**

- Two bare tables stacked, each under a near-body-size h2. Header row is small grey text, no row hover, no icons for tree stand / ladder / ground blind (the app has these icons; the admin doesn't).
- The "In use" column says "Yes" three times. That is noise, not information.

**Harvests**

- Native date pickers, a sentence ("0 harvests from September 1, 2026 to January 31, 2027.") jammed into a row with two buttons, and a disabled Export CSV at 50% opacity that reads as broken.
- It shows nothing to look at. A harvest page needs totals and a breakdown even when it's empty, plus a real empty state.

**Map packs**

- "Topo / Aerial" are radio pills with no preview. "About 46 map tiles, about 1.4 MB" floats as loose text. The big orange button hangs under it. "Map packs" h2 followed by "No map packs yet." in plain text.
- This is the club's best feature (offline maps) and it has the least visual treatment.

**Billing**

- A raw definition list: Status / Active / Paid through / date. Browser-default indent. No plan, no price, no renew/trial date and no primary action. This is the page that makes money, and it looks like debug output. (PR #71 added details; the screens reviewed are from deploy 4. If those details are live, they still ride on the same weak primitives and get the same rebuild.)

**Cross-cutting**

- No icons. No skeleton loaders (0.8 to 2.3 s of "Loading" text). No toasts. No dialogs. No light mode: the user's own phone is in sunlight when they use the app, and hunters will open this on a truck hood at noon.
- "Signed in as ..." repeats at the bottom of every page like a footer error.

**Mobile app (from code only; not seen running, see section 8)**

- `app/src/app/(tabs)/_layout.tsx` literally says "No icons yet; hide the icon slot". The bottom tab bar is four text labels: Map, Chat, Check In, Party/Club. A premium outdoor app with a text-only tab bar reads as a prototype.
- Icons are hand-drawn from View boxes (`app/src/components/icons.tsx`, 278 lines) even though react-native-svg is already a dependency.
- 54 files call StyleSheet.create against a static `colors` import, so a light or sunlight mode is impossible without a theme hook.
- The app (12 components) and the web admin (8 components) share only tokens, not primitives or patterns. They will drift further apart.

**What works (keep it)**

- The accessibility discipline is real and stays: 48px targets, a visible focus ring, dark text on orange at 7.08:1, and the tokens-in-one-package architecture.
- Archivo plus the orange #FF7A1F is the right foundation. The problem is everything built on it.

### 3. Design direction

A rugged, premium outdoor tool. Reference quality: onX Hunt, Garmin Explore. That means:

- Dense, confident, legible. Big numbers, clear labels, little decoration. It feels like instrumentation, not marketing.
- Sunlight first. Dark-first (it is the brand and works at dawn), plus a real high-contrast light mode for daylight. Light is a first-class theme, not an afterthought. All body text >= 7:1 in light mode.
- Orange stays rare and meaningful: the main action, the selected nav item, and "you". One primary button per view. No orange for decoration.
- Surfaces separate by tone steps and a 1px border, not by shadows (dark mode). Shadows only for floating layers.
- Topographic contour lines as the one brand texture: a subtle SVG pattern (about 6% opacity) on empty states and the sidebar footer. (Coordinator: the sign-in brand panel keeps the dawn scene instead.) No stock photos, no gradients, no glassmorphism.
- Real icons everywhere, with a word label always (keep the existing "every control has a word" rule).

Spec change: docs/SPEC.md said "the app and the club admin stay dark". The owner has now decided otherwise. SPEC.md (design section) says: dark-first, with a light theme for both app and admin, theme choice System / Dark / Light. The "orange is for you, the main action, the selected item" rule and the "no letter-spaced all-caps" rule stay.

### 4. Design system spec (exact values; in packages/design so web and Expo share them)

#### 4.1 Color

All pairs below were checked with a script; a test in packages/design fails the build if any pair drops under its threshold, for both themes.

**Dark theme**

| Token | Value | Use and contrast |
|---|---|---|
| canvas (page) | #0B0D0E | New; the sidebar and top bar sit on s0, so content has a darker field behind cards |
| surface-0 | #121416 | Existing "surface"; sidebar, top bar, tab bar |
| surface-1 | #1A1D20 | Cards |
| surface-2 | #23272B | Existing "surfaceRaised"; inputs, secondary buttons, hover rows |
| surface-3 | #2C3136 | Pressed, selected row |
| border-subtle | #2A2E33 | Decorative dividers only; 1.24 on s1 is fine because nothing depends on it |
| border-control | #7A828A | Inputs, checkboxes; 4.74 on s0, 4.34 on s1, 3.86 on s2 |
| text | #FFFFFF | 18.46 on s0, 16.93 on s1, 15.04 on s2 |
| text-secondary | #B8BDC2 | 9.76 on s0, 8.94 on s1, 7.95 on s2 |
| text-tertiary | #9AA2A9 | 7.13 on s0, 6.54 on s1, 5.81 on s2; meta text only |
| accent | #FF7A1F | With on-accent #121416 = 7.08. White on accent is 2.61 and stays banned |
| accent-hover | #FF8F40 | 8.14 with on-accent |
| accent-text | #FF9A4D | Links, selected nav text; 8.05 on s1 |
| focus ring | #FF7A1F | 2px with 2px offset, on :focus-visible only (7.08 on s0, 5.77 on s2) |
| success | #4ADE80 | 9.71 on s1; 6.87 on its 16% tint #223C2F; on-success #121416 = 10.60 |
| warning | #F5C04E | 10.10 on s1; 7.06 on its 16% tint #3D3727 |
| danger | #FF6B5E | 6.06 on s1; 4.81 on its 16% tint #3F292A; on-danger #121416 = 6.61 |
| info | #8EC5FF | 9.34 on s1; 6.58 on its 16% tint #2D3844 |

Note: the existing `alert` #FF5A4E and `fresh`, `help`, `wind` map tokens stay for the map. Admin UI uses the semantic names above. Map `fresh` = success, `help` = warning.

**Light theme ("sunlight")**

| Token | Value | Use and contrast |
|---|---|---|
| canvas | #F4F1EA | Existing bgLight |
| card (s1) | #FFFFFF | |
| raised (s2) | #ECE8DE | Inputs, hover rows, secondary buttons |
| sunk (s3) | #E4DFD3 | Pressed, selected row |
| border-subtle | #D9D3C5 | |
| border-control | #6B737A | 4.27 on canvas, 4.82 on card, 3.94 on raised |
| text | #121416 | 16.37 on canvas, 18.46 on card, 15.09 on raised |
| text-secondary | #3F464C | 8.49 on canvas, 9.58 on card, 7.83 on raised |
| text-tertiary | #586068 | 5.66 on canvas, 6.39 on card, 5.22 on raised; meta only |
| accent fill | #FF7A1F | With on-accent #121416 = 7.08; in light mode add a 1px #A8420A border so the button edge reads on cream (the fill alone is only 2.31 vs canvas) |
| accent-text / links | #A8420A | 5.40 on canvas, 6.09 on card, 4.98 on raised |
| focus ring | #121416 | 2px with 2px offset (16.37 on canvas) |
| success | #0F6B3A | 6.59 on card; 5.50 on 12% tint #E2EDE7 |
| warning | #7A4A00 | 7.48 on card; 6.20 on 12% tint #EFE9E0 |
| danger | #B3261E | 6.54 on card; 5.37 on 12% tint #F6E5E4; filled danger button = white on #B3261E 6.54 |
| info | #0B5CA8 | 6.75 on card; 5.61 on 12% tint #E2EBF5 |

Rules: never put text on a tint unless that exact pair is in the contrast test. Never use opacity to dim text. Status is never color alone (icon + word in every badge).

Implementation: CSS custom properties on :root for dark, `[data-theme="light"]` for light, and `@media (prefers-color-scheme: light)` for theme "system". Set the attribute with a tiny blocking script file (no inline script; CSP is strict) to avoid a flash. Store the choice in localStorage ("hcm-theme"). Add `<meta name="color-scheme" content="dark light">` and update theme-color per theme.

#### 4.2 Type scale

Archivo variable; rem units so reader text size still works; min 14px anywhere (map text 13px); weights 500 to 800 only; no all-caps with letter-spacing.

| Token | Size/line | Weight | Width | Use |
|---|---|---|---|---|
| display | 40/48 | 800 | 82 | Sign-in brand panel, board, marketing only |
| title-1 | 28/36 | 800 | 82 | Page title (24/32 below 640px) |
| title-2 | 22/28 | 700 | 100 | Dialog titles, section titles |
| title-3 | 18/24 | 700 | 100 | Card titles, table group titles |
| stat | 36/40 | 800 | 82 | StatTile value, tabular-nums (30/36 below 640px) |
| body-lg | 17/26 | 500 | 100 | Page descriptions, lead text |
| body | 16/24 | 500 | 100 | Default (line height up from 22 to 24: that alone fixes the cramped look) |
| label | 16/20 | 600 | 100 | Buttons, nav items, field labels |
| caption | 14/20 | 500 | 100 | Hints, table headers (600), meta text |
| badge | 14/20 | 600 | 100 | StatusPill |
| code | 15/24 | 600 | mono | Invite codes; sign-in code field 24/32 tabular-nums |

Paragraph max-width 68ch. Page title weight 800 at width 82 matches the existing sheetTitle so web and app feel the same.

#### 4.3 Spacing

4/8 base; tokens space-1 … space-16: 1=4 2=8 3=12 4=16 5=20 6=24 8=32 10=40 12=48 16=64. The old xs/sm/md/lg/xl (4/8/16/24/32) stay as aliases so nothing breaks.

Usage rules (these matter more than the numbers):

- Card padding 20 (24 at >=1024px). Gap between cards 16 (24 at >=1024px).
- Page header to content: 24. Between page sections: 32.
- Form: label to field 8, field to field 16, hint 4 below the field.
- Page gutters: 16 on mobile, 24 on tablet, 32 on desktop.

#### 4.4 Radii, elevation, borders

- radius-sm 8 (badges, table cells' chips); radius-md 12 (buttons, inputs, selects; keeps the existing 12 and 14 controls working); radius-lg 16 (cards, tiles); radius-xl 20 (dialogs, sheets, existing sheetTop); radius-full 999 (avatars, pills).
- Dark elevation = tone + border, not shadow: e0 canvas; e1 card = s1 + 1px border-subtle; e2 = s2 (hover or raised); popovers/menus: s2 + 1px border-subtle + shadow 0 8px 24px rgba(0,0,0,.45); dialogs: s1 + 1px border-subtle + shadow 0 16px 48px rgba(0,0,0,.6) over a scrim rgba(0,0,0,.6).
- Light elevation: card = white + 1px border-subtle + shadow 0 1px 2px rgba(18,20,22,.08); popover shadow 0 8px 24px rgba(18,20,22,.16); dialog 0 16px 48px rgba(18,20,22,.24) over scrim rgba(18,20,22,.5).
- Borders: 1px. Controls use border-control. Cards use border-subtle. Never a card without a border.
- Motion: 120ms ease-out for hover/press, 200ms for dialogs/menus, honour prefers-reduced-motion (no transforms, instant).

#### 4.5 Icons

- One library: Lucide. lucide-react for web; lucide-react-native for the Expo app (it renders through react-native-svg, which is already installed). Stroke 2, sizes 16 / 20 / 24, color = currentColor.
- Nav: LayoutDashboard (My club), Users (Roster), MapPin (Stands and areas), Crosshair (Harvests), Map (Map packs), CreditCard (Billing), LogOut, Sun/Moon/Monitor (theme).
- Stand types: use distinct Lucide icons (TreePine for tree stand, ArrowUpFromLine or similar for ladder, Tent for ground blind; pick and keep them consistent between the admin and the app).
- Replace the hand-drawn View icons in the app. Map markers (hunter circles, stand squares) stay custom because they are map symbols.
- Icons never carry meaning alone; keep the word label.

### 5. App shell and layout (web admin)

**Desktop (>= 1024px)**

- Left sidebar, 240px wide, on surface-0, with a 1px right border. Top: logo mark + wordmark, then the club block: club name (title-3) with a status pill (Trial / Active / Past due) and a switcher (a dropdown; shows "Create club" and any other clubs; with one club it is just the club name with a chevron).
- Nav items below it: icon + label, 48px tall, 12px radius, 8px gap. Selected: surface-3 fill, accent-text label, a 3px accent bar on the left edge, `aria-current="page"`. Hover: surface-2.
- Bottom of the sidebar: account button (initials avatar 32px + email, truncated). It opens a menu: Theme (System / Dark / Light), Privacy, Terms, Sign out. Sign out lives only here. Remove "Signed in as ..." from every page footer; the account button replaces it.
- Content area: canvas background, max-width 1120px, centered in the space right of the sidebar, 32px gutters, 32px top padding.
- Page header pattern on every page: title-1 on the left with body-lg description under it (max 68ch); the single primary action on the right; secondary actions to its left. Under 640px, actions drop below and the primary goes full width.

**Tablet (640 to 1023px):** a 72px icon rail (icon over a 14px label), account button at the bottom, content gets full width minus the rail with 24px gutters.

**Mobile (< 640px)**

- Top bar, 56px: club name (truncate) and the account menu button on the right.
- Bottom tab bar, 64px plus safe area, 5 slots: My club, Roster, Stands, Harvests, More. More opens a sheet with Map packs, Billing (with a warning dot if past due or trial ending) and Account (theme, privacy, terms, sign out). Icon above a 14px label, selected = accent icon + label, 48px minimum target.
- Content gutters 16. Tables stack into rows (see DataTable).

Also: skip link stays; h1 gets focus on route change but only :focus-visible draws a ring; the real 404 page uses the same shell; Page not found has the shell, not a bare page.

### 6. Component library

Decision: build on the existing generated-CSS pipeline and the design tokens, and adopt Radix primitives only for the hard accessible ones: Dialog, DropdownMenu, Select, Tabs, Toast, Tooltip. Do not adopt Tailwind or a styled kit (shadcn, MUI, Chakra); we have tokens and a strict CSP and they would fight both.

CSP warning (spike first, in P1b): the admin ships with `style-src 'self'` (infra/src/security-headers.ts, tested). Some Radix pieces inject `<style>` tags (scroll locking in Dialog, the Select scrollbar CSS). Test each primitive under the real CSP in a browser with no console violations. Do not loosen style-src to fix it. If a primitive violates CSP, use the native element instead (native `<dialog>`, native `<select>`) or another headless library (React Aria). Report what you chose and why in the PR.

Components (all in web/src/components/ui/, all tokens-only, each with a keyboard + axe test, all in a dev-only /app/#/\_kit page showing every state in both themes):

- Button: variants primary (accent fill; max one per view), secondary (s2 + border-subtle), tertiary (text only, hover s2), danger (outline; filled version for the confirm step only), link. Sizes: md 48 (default), lg 56 (sign-in and page-level CTAs), sm 48 (coordinator: no 40px size anywhere). Loading state: spinner plus label stays, aria-busy, width does not jump. Icon-leading and icon-only (with aria-label and tooltip).
- Field: label (label style) + control + hint (caption, tertiary) + error (danger icon + text, aria-describedby, aria-invalid). Input 48px, 12px radius, border-control, focus = 2px accent border. Same for Select and Textarea. Use native date input styled with the tokens, or a segmented preset Select ("2026-27 season / Custom").
- Select, RadioGroup/Segmented control (for Topo/Aerial and Monthly/Yearly), Checkbox, Switch.
- Card: s1, 1px border, radius-lg, padding 20/24; optional header (title-3 + action) and footer.
- StatTile: label (caption), value (stat), optional delta/hint, optional icon, whole tile a link when it navigates. Four across at >=1024, two across on mobile.
- DataTable: sortable columns (button in th with aria-sort), sticky header, row hover, 56px rows, optional row-action menu, loading skeleton rows, empty slot. Under 640px each row becomes a card: primary cell (name + badge) on top, the rest as caption label/value pairs. Never a key/value spec sheet for one row of people.
- EmptyState: icon (48px, topo texture behind it), title-3, body (max 48ch), one action. No more one-line "No X yet." paragraphs.
- Skeleton: tone shimmer for text lines, tiles, table rows (static under reduced motion). Replace every "Loading" line; keep an aria-live status.
- Toast: bottom-right desktop, bottom-center above the tab bar on mobile; success/danger/info with icon; 5s; Esc/close; `role="status"` (`role="alert"` for danger).
- Dialog: radius-xl, focus trap, Esc, scrim, title-2; full-screen sheet from the bottom under 640px. Used for Invite (QR + copy link), confirmations and Create club.
- Badge/StatusPill: icon + word, semantic tints (success = Active, warning = Trial / Ending, danger = Past due, info = Admin / New, neutral = Member).
- Tabs: underline style with the accent bar; arrow-key support; used on Stands and areas.
- PageHeader: title, description, actions, optional back link, optional status pill.
- Also: Avatar (initials), Banner (inline info/warning/danger with action), CopyButton, ThemeToggle.

Share between web and Expo: the tokens (already shared), the naming and the variants/sizes. Do not try to share component code. Mirror the names in app/src/components so Button / Badge / EmptyState / Field mean the same thing on both platforms.

### 7. Page-by-page redesign

**Sign-in (email step, code step)**

- Desktop: split screen. Left 50% brand panel: the logo mark large, display headline "Run your club. Off the grid." (change if you have better), three plain lines with icons (Radio chat with no cell service / Stand and area check-ins / Offline maps for the whole property). Coordinator: the panel keeps the dawn scene animation rather than the topo texture. Right 50%: the form, centered, max-width 400px, no card box needed.
- Mobile: logo and one-line tagline on top, the form full width below.
- Email step: title-1 "Sign in", description "We'll email you a code. No password.", the field, a lg primary "Send code". Footer: Privacy and Terms as tertiary links at the bottom.
- Code step: title-1 "Check your email", description with the address (and an "Edit" link), code field 24/32 tabular-nums with `autocomplete="one-time-code"` and inputmode numeric, auto-submit when the full code is entered, lg primary "Sign in", "Send a new code" as a tertiary button with a 30s cooldown count ("Send again in 24s"), "Use a different email" as a link. Hint: "The code works for 10 minutes. Check spam." (Use the real number from config; do not hard-code if it can change.)
- Error and loading states with the same Field and Banner components.

**My club (the dashboard)**

- PageHeader: club name as title, status pill beside it, primary action "Invite member".
- Row of four StatTiles: Members, Stands, Areas, Subscription (value "Active", hint "Renews Feb 10, 2027" or "Trial ends Dec 10"). Each links to its page.
- Setup checklist card: "Get your club ready 3 of 5" with a progress bar. Items: Create your club (done), Draw your property line in the app (links to the app/download; says what it unlocks), Add your stands (app), Invite your members (opens the invite dialog), Start your free trial (goes to Billing). Done items get a success check. The card hides itself when all five are done.
- Subscription card: plan, price, renews or trial-ends date, "Manage subscription" or "Start free trial" button.
- Get the app card with the QR/store links, if the links exist. Do not invent data you don't have: if there is no recent-activity API, don't draw an activity feed.
- No-club state: the same layout as an EmptyState with "Create your club" as the primary action, inline-validated.

**Roster**

- PageHeader: "Roster", description "Everyone in your club and who can do what.", primary "Invite member".
- DataTable: avatar + name (email beneath in caption), role badge (Admin / Member), guest-pass-until, row menu only if there are real actions. Search field once there are more than 10 rows.
- Mobile: each member is a row card: avatar, name + role badge, email, guest pass in caption.
- Zero other members: an EmptyState inside the card ("Just you so far", "Invite your members. They scan a code with their phone camera and join the club radio channel even with no cell service.", primary Invite member). The admin's own row still shows above it.
- Invite Dialog: QR code large (min 240px), the invite link with CopyButton and a toast "Invite link copied", expiry, "Make a new invite".

**Stands and areas**

- Tabs: "Stands (3)" and "Areas (1)". One table at a time, not two stacked.
- Stands: name, type (icon + word), area (link that filters), Active badge or an "Inactive" neutral badge (replace the "In use / Yes" column with status; show nothing alarming for the normal case). Filter chips by area above the table.
- Areas: name, stands count (link to Stands filtered by area), property status. Expandable row later; filtering is enough for now.
- EmptyState for each tab pointing to the app: "Stands are added in the app."

**Harvests**

- PageHeader: "Harvests", description "Harvests that members shared with the club.", header action Export CSV (enabled only when rows exist; otherwise hidden, not disabled).
- Filter bar card: season preset Select ("2026-27 season", "Custom"), custom dates reveal two fields, Refresh as a tertiary icon button.
- Tiles: Total harvests, By species (top 3), Most active stand. Skeleton while loading.
- Table: date, member, species, sex, stand or area. Mobile stacks.
- Empty: EmptyState "No shared harvests this season" with a body line on how members share them from the app.

**Map packs**

- PageHeader: "Map packs", description "Download the property in full detail before you go. Maps work with no cell service."
- "Build a map pack" card: Segmented control with two preview thumbnails (Topo / Aerial), a stats line (area covered, ~46 tiles, ~1.4 MB) as caption tiles, a primary "Build map pack" button. If there is no property line: Banner (info) "Draw your property line in the app first", disable build with the reason shown, never silently.
- "Your map packs" list: card rows with name, basemap badge, size, built date, status pill (Building / Ready / Failed), actions. EmptyState when none.

**Billing**

- PageHeader: "Billing", description "Your club's plan, payment and invoices."
- Plan card (the hero): plan name ("Club"), status pill, big price line stat-style ("$100 / year" or "$10 / month"), renewal line ("Renews on Feb 10, 2027" / "Ends on ..." / "Free trial ends Dec 10, 2026 (14 days left)" with a progress bar for trial), the grace-period line as a quiet Banner ("Features stay on until Feb 24 while you renew"), and the primary "Manage subscription" (Stripe portal). If Stripe isn't set up, show the button disabled with the reason as a Banner. Do not hide it.
- Not subscribed: two plan cards side by side (Monthly $10, Yearly $100 with a "Save $20" badge: $100 vs $120), both stating the 14-day free trial and what the club gets; primary "Start 14-day free trial" on the yearly card, secondary on the monthly one. The no-club version shows the plans with "Create your club to start your free trial".
- Past due: danger Banner at the top of the page and a warning dot on the nav item.
- Keep the line "The radio, chat and Ask for a Hand keep working whatever the billing status." as a caption in a Card footer, not loose text.

**Not found, session expired, checkout return:** all use the shell, EmptyState, one clear action.

**Mobile app (Expo)**

- Tab bar: add Lucide icons above the labels: Map, MessageSquare (Chat), CheckCircle (Check In), Users (Party/Club). Selected = accent. Keep 48px+ targets and the safe-area handling.
- Theme: introduce a ThemeProvider and useTheme() so screens stop importing static `colors`; ship dark and light with the same tokens and Auto/Dark/Light in Profile or settings. Map overlays and map labels keep their own halo rules. Light mode on the map screen = light controls over the map with the same 3:1 control borders.
- Replace icons.tsx with Lucide. Move every screen's Button, TextField, Sheet and Choice to the same variants and sizes as the web (primary / secondary / tertiary / danger; md 48, lg 56; the 62 to 66px primary stays only for Check Out and Ask for a Hand).
- Screens to restyle with the new system: Map (controls and bottom sheet), Chat, Check In, Party/Club (and QR), onboarding steps, sign-in and Join club, Clubhouse board (keep it huge; apply the new type tokens), Legal. Same EmptyState, Badge and Banner components. This is its own phase (P5); do not hold the web phases for it.

### 8. Phased PRs and acceptance criteria

Order: P1 tokens and primitives, then P2 shell, then P3 pages, then P4 polish, then P5 app. One PR per bullet, small and reviewable. Deploy dev after each phase; the UI Director reviews every deploy and sends findings.

**P1 Tokens and primitives**

- PR 1a: packages/design: new color tokens (dark and light), semantic tokens, type scale, spacing, radii, elevation, motion; SPEC.md updated; the contrast test for both themes (every pair in section 4.1, thresholds 4.5 text and 3 non-text); CSS-variable output with data-theme and prefers-color-scheme; theme bootstrap file (no inline script).
- PR 1b: the primitives in section 6 plus the dev-only /app/#/\_kit page, the Lucide dependency, and the CSP spike result for Radix (or the fallback choice).

Acceptance: contrast tests pass in both themes; /app/#/\_kit shows every component and state in dark and light with screenshots at 1280 and 390; no console CSP violations; axe: 0 serious or critical issues on the kit page; keyboard walkthrough noted in the PR; initial JS gzip size reported before and after (justify any growth over 40KB).

**P2 Shell**

- PR 2: sidebar, tablet rail, mobile top bar and bottom tabs, account menu with theme toggle and Sign out, PageHeader on all existing pages, real not-found inside the shell, max-width 1120 content.

Acceptance: before and after screenshots of My club at 1280 and 390, in dark and light; no horizontal scroll at 390; every nav target >= 48px; aria-current on the current item; Sign out only in the account menu; "Signed in as" footer gone; axe 0 serious or critical; Lighthouse accessibility >= 95 on the shell with a signed-in session.

**P3 Pages (ship in this order; reviewed after each)**

- PR 3a: My club dashboard (stat tiles, setup checklist, subscription card) and Billing (plan card, plans, banners).
- PR 3b: Roster (with the Invite dialog) and Stands and areas (tabs, filters).
- PR 3c: Harvests and Map packs.
- PR 3d: Sign-in screens (split layout, code step).

Acceptance for each: before and after screenshots at 1280 and 390 in dark and light for every state it has (loading skeleton, empty, populated, error, no-club); all copy from this brief or better; every empty state uses EmptyState; every loading state uses Skeleton; axe 0 serious or critical; Lighthouse accessibility >= 95 on each page; existing tests updated and new tests for: theme switching, stacked table at 390, dialog focus trap, toast role, Billing states (trial, active, past due, no sub).

**P4 Polish**

- PR 4: motion and reduced-motion pass, skeleton timing, hover/pressed states, focus audit, keyboard walkthrough of every page, topo texture, favicon and theme-color per theme, 404 and error pages, copy pass, high-contrast (forced-colors) check.

Acceptance: a full-app screenshot set at 1280 and 390 in both themes attached to the PR; Lighthouse accessibility >= 95 and best-practices >= 95 everywhere; axe 0 serious or critical; no layout shift above 0.1 on page load; Windows forced-colors mode screenshot of one page.

**P5 Mobile app (can run in parallel with P3 after P1a lands)**

- PR 5a: ThemeProvider, useTheme, Lucide icons, tab-bar icons.
- PR 5b: shared Button, Field, Badge, Banner, EmptyState; restyle Map controls and sheet, Chat, Check In, Party/Club.
- PR 5c: onboarding, sign-in, join, Clubhouse board, legal; light mode complete.

Acceptance: screenshots of every screen at 390x844 and a large Android width in dark and light (Expo screenshots or device captures; attach to the PR); the contrast test covers the app tokens; tab bar has icons and word labels; tap targets >= 48; screen reader labels preserved; existing app tests green. The app has not been seen running, so it is reviewed from the screenshots; send them with each PR.

**Global rules**

- Do not loosen the CSP. Do not add tracking. Do not add dependencies beyond Lucide and, only if the spike allows, specific Radix packages. Report any other addition first.
- No placeholder data in production screens. Seed data is for dev only.
- Keep prices and trial copy single-sourced from CLUB_PRICING and the shared constants. Prices: $10 a month, $100 a year, 14-day free trial.
- Do not ship the redesign half-done: a deploy must never mix old pill nav and new pages. P2 and the pages ship so that the app is coherent after each deploy.
- Nothing in these documents or PRs includes passwords, tokens or keys.

**Still open from earlier reports (folded into the redesign)**

- Real HTTP 404 for non-app paths (PR #63).
- Draft label on Privacy and Terms: stays until the owner approves them; must be gone before production.
- Billing grace-period line and the "Start your 14-day free trial" copy.
