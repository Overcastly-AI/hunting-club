# Public site and funnel brief (UI Director, 2026-11-26)

Source: the UI Director's email of 2026-11-26, copied as-is apart from names. Decisions made since,
which take precedence over the brief:

- **Pricing (owner):** $10/month or $100/year per club; yearly is the default, shown as "$100/year (2 months free)" with "or $10/month". 14-day free trial on both. CTA "Start your 14-day free trial"; line "Then $100/year or $10/month. Cancel anytime before day 14 and you won't be charged." Member limit, card up front, refunds and retention are still TBD. Stripe stays off in dev until the owner sets it up.
- **Coordinator:** Option A (react-dom/server prerender), no new dependencies in Phase 1. No analytics script in Phase 1 (zero-cost CloudFront logs only). Invite preview endpoint deferred. Web refresh token persists in localStorage (30 days), so section 8's "tokens in memory only" no longer applies.
- **Beta wording:** no store badges until listings exist.

---

======================================================================
0. THE SHORT VERSION (read this if nothing else)
======================================================================

1. Today "/" on the dev domain IS the club admin sign-in, and CloudFront serves index.html with a 200 for every path without a file extension. There is no public page, no sitemap, and every wrong URL is a "soft 404". Search engines and store reviewers have nothing to read.
2. MUST: put a static, prerendered marketing site at real paths (/, /clubs, /pricing, /download, /privacy, /terms, /contact, /join) and move the admin to /app/. Build it as a separate workspace package (site/), deployed to the same bucket and CloudFront distribution, sharing @huntclub/design tokens.
3. The app stores need this too: App Store Connect and Play Console both require a live privacy policy URL, a support URL and a marketing URL. Phase 1 unblocks store submission.
4. Two funnels. Hunter: see site, get the free app (and a radio). Club admin: see /clubs, sign in with an emailed code, create club, invite members, pay with Stripe. Plus a third surface that matters more than it looks: the invite page (/join), which is how most members will first meet the product.
5. Truthful copy only. Free = parties up to 3, no account, works with no cell service. Club price, member limit and trial are NOT decided (the repo has a placeholder plan "club_standard", limit 50, no price). Pricing page ships with "$TBD" placeholders that block launch.
6. Privacy: the invite link carries the radio channel key in the URL fragment (https://<host>/join#cs=...). Nothing on /join may send, log or track the full URL. No third-party scripts on /join.
7. Analytics: cookieless (Plausible suggested, about $9 to $19 a month, needs the owner's OK to spend). No analytics SDK in the free app (free users never call our backend).
8. Size: Phase 1 about 8 to 12 working days of your time; Phase 2 about 6 to 8; Phase 3 ongoing.

======================================================================
1. WHAT EXISTS TODAY (facts from the repo)
======================================================================

Product (docs/SPEC.md)
- Off-grid hunting app. Phone pairs over Bluetooth LE with a stock Meshtastic LoRa radio (with GPS). Live map, texts, check-in with no cell service. iOS and Android with equal features.
- Free: pair a radio and see mesh status; live map with free USGS topo and aerial (downloaded on the phone); wind, sunrise and sunset, scent cone; hunting party by QR code, MAX 3 PEOPLE (map, chat, quick replies, direct messages); check in "At a spot" and "On the move"; Ask for a Hand to your party; overdue alert to your party; log a harvest (private by default, optional share). No account. No backend calls.
- Club (paid): club property line, shared stands and areas (named zones like "North 40"); roster, roles (admin, member, guest), invites, guest passes (guests expire and do not count toward the member limit); reset club key; whole-club chat; check in "At a stand" and "In an area" with open/occupied stands; Ask for a Hand and overdue alerts to the whole club and the board; clubhouse board (wall tablet, replaces the paper sign-in sheet); high-resolution offline map pack for the property (PMTiles on S3 + CloudFront); harvest reports and season summaries with CSV export. Safety warnings near occupied stands: "Later".
- Rules that shape marketing copy: everything over the mesh is free forever; safety is never behind a paywall (lapsed club: mesh, chat, Ask for a Hand and overdue alerts keep working, shared setup and admin tools freeze); location shared only while checked in; stands are optional; no legal shooting hours (sunrise and sunset only); nothing may look like a 911 call; terms say "For emergencies, call 911 from your phone if you have service."
- Hunters are often 50 to 75, in gloves, in the cold, at dawn and dusk. The marketing site must work for them: big type, big buttons, plain words.

Billing (code)
- Plans: ONE placeholder plan, id club_standard, name "Club (placeholder)", memberLimit 50 (packages/club-data/src/plans.ts, marked an OPEN DECISION). No price anywhere in the repo. Dev Stripe prices map in infra/config/dev.ts is empty ({}), so dev Checkout answers 503.
- Stripe Checkout, subscription mode, yearly price recommended in docs/research/stripe-and-auth.md; "per season" renewal date (billing_cycle_anchor_config) and mid-season proration are owner decisions. Web admin Billing page already says "Continue to payment: <plan name>" and shows status and paid-through date.
- SPEC open decisions: flat price vs tiers by member count; per season vs per year; member limits; whether parties inside a club are capped; days club data is kept after lapse ([N]); open vs closed source (Meshtastic protobufs are GPL-3.0).

Web (web/, Vite 8 + React 19, TS)
- Hash-routed admin at "/": Sign in (email + 6-digit code), My club (create club), Roster, Stands and areas, Harvests, Map packs, Billing. Real paths with no sign-in: /join, /checkout/done, /checkout/cancel, /privacy, /terms. Anything else renders "Page not found" with HTTP 200.
- Invite link format: https://<host>/join#cs=<channel set>&party=<id> (or &club=<id>&invite=<token>). The data is in the URL fragment so it never reaches CloudFront. The /join page decodes it, shows "Open in the app" (huntclub://join... fallback) and a QR for a computer.
- Page head: web/site-head.ts writes title, description, theme-color and favicon.svg from @huntclub/shared and @huntclub/design. Archivo woff2 is bundled and preloaded.
- Privacy and Terms exist as DRAFTS (LEGAL_DRAFT_NOTICE "Draft, pending owner review").

Hosting (infra/)
- WebStack: private S3 bucket + CloudFront (OAC, HTTP/2+3, price class 100, TLS 1.2+), managed SECURITY_HEADERS policy (no CSP), a CloudFront Function that rewrites every extensionless path to /index.html. Only assets/* gets the 365-day immutable cache; every other file is no-cache. robots.txt: dev "Disallow: /", prod "Allow: /" (EnvConfig.searchIndexing). Only a dev environment exists; WEB_DOMAINS has no production domain. /.well-known files (apple-app-site-association, assetlinks.json) publish only once Apple Team ID and Android SHA-256 fingerprints are set (both unset).

Mobile
- Expo app, bundle id com.overcastly.huntclub, scheme huntclub://. EAS project id unset, ascAppId is a placeholder (SET_ASC_APP_ID), iOS goes to TestFlight via GitHub workflow, Android builds a preview APK. NO store listing exists yet. Free version is feature-complete in code; not field-tested on real radios yet.

Assets
- Logo mark exists in code (@huntclub/design logoMarkSvg: three radios linked in a mesh, the top one in accent). No photography, no real screenshots, no OG images.

======================================================================
2. COMPARABLE PRODUCTS: PATTERNS TO LEARN FROM (checked 2026-11-26; not copying)
======================================================================

- onX Hunt: hero is a benefit headline plus a promo banner; big social proof (4.9 stars, 239,700 ratings; a named conservationist quote); features shown as large map screenshots, each with one plain sentence ("No service? No problem."); clear free vs paid membership tiers. Lesson: show the map early, put real numbers next to ratings, one sentence per feature.
- HuntStand: "Start mapping for FREE" is the lead; Pro is $29.99/year and Ultimate $99.99/year; store badges everywhere. Lesson: free first, paid clearly labelled.
- Spartan Forge: pricing from $79.99/year or $12.99/month with a 7-day trial; heavy feature list. Lesson: annual price shown first with the monthly equivalent.
- Hunting club and lease apps (Ember, Trail Pro Intel Clubs, HuntClub, DropTine, LeaseBOSS): they sell to the ADMIN and say "members join free". They open with the pain ("Three guys, same stand, 5 a.m."; "Chasing seven men for dues"), then a 3-step setup (create the club, invite by text link, retire the spreadsheet), a mock of the shared board, and price up front (Ember: club plans of 5, 15 or 30 members from $199.99 a year; Trail Pro Intel: free for crews of 3 or fewer, then $99 a year per club or $9.99 a month). Lesson for us: lead /clubs with the paper sign-in sheet pain, show the board and the map, state the member limit and price plainly.
- Our edge, which none of them can say: it works with zero cell service, and the whole mesh layer is free forever. Say it without naming competitors.
- Meshtastic trademark: do not use "Meshtastic" or its logo in our name or primary branding, do not imply endorsement, and add the attribution line. Use plain text "works with Meshtastic radios" in a compatibility line, plus the community "M-Powered" logo if the owner wants a badge (no grant needed). Footer line: "Meshtastic is a registered trademark of Meshtastic LLC. Hunt Club Mesh is not affiliated with or endorsed by the Meshtastic project." Link to meshtastic.org.

======================================================================
3. SITE ARCHITECTURE AND URL PLAN
======================================================================

MUST: ship a static, prerendered marketing site. Recommendation: a SEPARATE workspace package, site/ (@huntclub/site), built to plain HTML files and deployed into the same S3 bucket and CloudFront distribution as the admin.

Why separate, not prerender inside web/:
- SEO and speed: crawlers and social scrapers (Facebook, iMessage, Slack, X) read the HTML only. They do not run React. Every page must contain its real content, title, meta, canonical and OG tags in the file. Static HTML at an edge cache gives the fastest LCP; the home page needs zero or near-zero JavaScript.
- The admin bundle (React, Cognito client, mesh codec, zod) must never load for a hunter reading the home page. A marketing typo or image change must never risk billing or sign-in.
- Different change rates and owners of risk: marketing changes weekly, billing rarely.
- Same domain keeps one cookie-free origin, one TLS cert, same-origin links to /app and /join, no CORS, and Stripe return paths stay the same.

How to build it (decision for you, tell me what you pick):
  Option A (my default, no new runtime dependency): Vite + react-dom/server. One route registry (site/src/routes.ts) lists every page with path, title, description, canonical, OG image, schema; a build script renders each page with renderToStaticMarkup into site/dist/<path>/index.html. Pages ship no hydration; FAQ uses <details>; mobile menu uses a disclosure button. Reuses @huntclub/design tokens, @huntclub/shared copy, existing QrCode component.
  Option B: Astro (static output, image optimization, sitemap integration). Better ergonomics, but a new dependency, and CLAUDE.md says ask before adding one. If you prefer B, put it in your plan and I will ask the owner.
  Either way: the route registry is the ONE source for nav, footer, sitemap.xml, canonical URLs, OG tags, prerender list and the CloudFront allowlist (DRY rule).

New dependencies likely needed (ask the owner, do not add silently): an image tool such as sharp (AVIF/WebP/resize) as a build-only devDependency; Lighthouse CI and an accessibility checker (axe) as devDependencies for CI; Astro only if you pick B. @resvg/resvg-js is already approved for build-time use and can render OG images from SVG templates.

URL plan (all lowercase, no trailing slash, one canonical each)
  / Home. Index. Priority 1.0.
  /features All features, free vs club, with screenshots. Index.
  /clubs For club admins: the paper sign-in sheet replacement. Index. Priority 0.9.
  /pricing Free vs Club, price (TBD), FAQ on billing. Index. 0.9.
  /download Get the app: store badges, QR on desktop, radio note. Index. 0.8.
  /get Smart link for QR codes and shares: detects iOS/Android and redirects to the right store (or /download). noindex. Never linked in nav.
  /faq Plain answers. Index.
  /about Who we are, why we built it (TBD copy from the owner). Index.
  /contact Support and press email (TBD address), no form in Phase 1. Index.
  /radios "What radio do I need?" guide (Phase 2). Index. Likely the best search entry point for hunters.
  /privacy, /terms Keep these exact paths (already in LEGAL_PATHS; the stores will link them). Move into site/ as static pages; keep copy in @huntclub/shared/legal. Index.
  /join Invite landing page (party and club). noindex. See section 5.
  /app/ Signed-in club admin (today's web/ app). noindex. Keep the hash routes for now (/app/#/roster); real sub-paths are Phase 3.
  /checkout/done, /checkout/cancel Stripe return pages. Keep paths (set in CHECKOUT_RETURN_PATHS and Stripe config), serve the admin bundle, noindex.
  /404.html Branded not-found page; served with a real 404 status.
  /sitemap.xml, /robots.txt, /og/<page>.jpg, /.well-known/*

Hosting changes (infra/src/web-pages.ts and web-stack.ts)
- Replace the "every extensionless path gets /index.html" function with an explicit mapping: "/" and marketing paths -> /<path>/index.html; /app and /app/* extensionless -> /app/index.html; /checkout/* -> /app/index.html; /join -> /join/index.html; everything else falls through to S3.
- Replace the soft 404: add a CloudFront custom error response (403 and 404 from S3 -> /404.html with status 404). Today a wrong URL returns 200, which search engines treat as a soft 404 and which hides broken links.
- Redirects (CloudFront Function, 301): /index.html -> /; trailing slash -> no slash; www -> apex (production only); /login and /sign-in -> /app/. Old admin bookmarks: a 6-line inline script on "/" that sends visitors with a "#/..." hash to /app/ plus the hash, so existing bookmarks and the "Back to sign in" link keep working. Update NotFound's "Back to sign in" to point to /app/.
- Vite base for web/ becomes "/app/". Merge both builds into one deployment (site at root, admin under app/). Cognito (no hosted UI), club API, Stripe return URLs and CORS are origin-based, so they should be unaffected: please verify and say so in your plan.
- Caching: keep HTML no-cache with the /* invalidation on deploy. Fingerprinted files in assets/* and app/assets/* and img/* get the 365-day immutable header (today only assets/* does; every image outside that prefix would be uncached. Put processed images under a hashed img/ path). OG images keep stable URLs (/og/*.jpg), 1-day cache.
- Headers: replace managed SECURITY_HEADERS with a custom policy that keeps HSTS, nosniff, frame-ancestors none, and adds a CSP (default-src 'self'; script-src 'self' plus the analytics host; connect-src 'self' plus cognito-idp.us-east-1.amazonaws.com, the club API URL and the analytics host; img-src 'self' data:; font-src 'self'), a Permissions-Policy (camera=(self) for the QR scan page only, geolocation=(self) for the admin map's "Use my location", microphone=()), and Referrer-Policy strict-origin-when-cross-origin; /join gets Referrer-Policy no-referrer.
- Dev stays closed: robots "Disallow: /" AND an X-Robots-Tag "noindex, nofollow" response header (robots.txt alone does not stop indexing of linked URLs). On production add <meta name="robots" content="noindex"> to /app, /join, /checkout/*, /get.
- Smoke test (infra/src/smoke.ts): extend to check / and /pricing return 200 with a <title> and one <h1>, /does-not-exist returns 404, /sitemap.xml and /robots.txt exist, /app/ returns the admin, /join returns 200.
- Rollback: deploy marketing to dev first; keep the previous admin-at-"/" build tag; Phase 1 is one CDK change set, so rolling back is a redeploy of the previous commit.

Production environment (needs the owner): there is no production domain, hosted zone, certificate or env config yet. Plan for apex as canonical with www redirecting to it. The site code should read its public origin from one place (WEB_DOMAINS in @huntclub/shared/app plus a build env) so canonical, sitemap and OG URLs are never hard-coded. Universal links (Apple Team ID, Android fingerprints) must be published on the PRODUCTION domain, and the invite QR codes and store listings will print that domain permanently, so choose it before the first store submission.

======================================================================
4. THE FUNNELS
======================================================================

A. HUNTER: get the free app (no account, no backend)
 Step 1 Arrive: search, social share, a friend's party invite, QR on a flyer. Page: /, /features, /download.
         Primary CTA: "Get the free app". Event: cta_click {id: hero_download}.
 Step 2 Choose store. Page: /download. Mobile visitor sees ONE big button for their OS first ("Download on the App Store" or "Get it on Google Play"), the other below. Desktop visitor sees both badges AND a QR code (reuse @huntclub/shared/qr and the QrCode component) with the line "Scan with your phone camera" pointing at /get?utm_source=site&utm_medium=qr. Event: store_click {store: ios|android, page}.
 Step 3 Install (measured in App Store Connect and Play Console, not by us). To attribute, add campaign parameters to the store links: Apple "?pt=<provider>&ct=<campaign>&mt=8" and Play "&referrer=utm_source%3Dsite%26utm_medium%3Dweb". Do NOT put an analytics SDK in the free app (SPEC: free users never call our backend). Activation is measured in the store consoles.
 Step 4 Get a radio (this is the real drop-off risk: the app is only useful with a Meshtastic radio with GPS). Page: /download section "What you need" and later /radios. CTA: "See compatible radios". Event: radio_guide_click, outbound_click {to}. Whether we sell kits, and at what price, is TBD (SPEC: "Radio kit and solar repeater [YOUR PRICE]"). Until decided, say "sold separately" and link to a neutral compatibility list.
 Step 5 Pair and hunt: onboarding in the app. No web event.
 Pre-launch (no store listing yet): /download shows "Join the iPhone beta (TestFlight)" and "Get the Android beta" with TBD links; no fake store badges. Official badges only when the listing is live, following Apple and Google badge rules.
 Success metric: unique store_click per 100 visitors, by OS; installs per week from the store consoles; QR scans (/get hits).

B. CLUB ADMIN: start a paid club
 Step 1 Arrive on /clubs (from search, a member who says "our club should use this", a shared link). Headline about replacing the paper sign-in sheet. Primary CTA: "Start your club". Event: club_start_click {page}.
 Step 2 /app/?intent=club (UTM kept). Same passwordless form (works for new and returning emails). Heading for intent=club: "Start your club"; subhead: "Enter your email. We send a 6-digit code. No password." Show a 3-line "What happens next": 1 Create your club. 2 Invite members with a link or QR. 3 Pay when you are ready to use it. Events: signin_view {intent}, code_requested, signup_completed {new_account: true|false}.
 Step 3 Create club (the existing "Create club" form on My club). Event: club_created. Add a first-run checklist on My club: Create club, Add stands, Invite members, Pay.
 Step 4 Invite members: invite link plus QR (exists). Event: invite_created {kind: club}.
 Step 5 Pay: Billing page "Continue to payment" -> Stripe Checkout -> /checkout/done. Events: checkout_started {plan}, checkout_returned {outcome}. The source of truth for paid is the Stripe webhook (subscription active), NOT the return page.
 Step 6 Activation (server side, no third party): first member joined (invite redeemed), first stand added, first check-in. Count from the DynamoDB table with a small script or weekly report.
 Product decision for the owner, with my advice: do unpaid clubs get to set up and invite before paying? Today the spec order is "sign in and pay". I recommend letting an admin create the club, draw stands and see the product FIRST and asking for payment when they invite members or download the map pack (higher conversion, nobody pays for something they have not seen). That needs backend rules for an unpaid club (I could not tell from the code). Please check what an unpaid club can do today and tell me. A free trial is TBD (Stripe supports trial_period_days; cannot be combined with a fixed renewal anchor).
 Success metric: visit /clubs -> start click -> signup_completed -> club_created -> invite_created -> subscription active. Track step-to-step rates, not just the end.

C. INVITE LANDING (/join): where most members first meet the product
 Today /join is a plain page with one button. Make it a branded explainer. It serves two audiences: a CLUB member (admin sent a link or QR) and a PARTY member (a hunter invited a friend, i.e. free-app growth).
 Layout: logo; small label "You're invited"; H1 "Join your hunting club" (club) or "Hunt with your party" (party); two sentences: what it is, and that it works with no cell service; one numbered list: 1 Install the app (only if not installed). 2 Open this invite. 3 The app sets up your radio. Primary CTA by device: "Open in Hunt Club Mesh" (universal link / huntclub:// fallback). Secondary: store badge "Get the free app". On desktop: the QR (exists) with "Scan this with your phone camera".
 Club name on the page: the link does not carry the club name. Option: a tiny public, rate-limited endpoint that takes the invite token and returns only the club name and admin display name, so the page can say "Dale invited you to Creek Bottom Hunt Club". Please check whether this is safe under the permission model (token must stay secret; response must reveal nothing else; no response for expired or used tokens beyond a generic message). If unsure, ship generic copy first.
 Install-then-open problem: App Store and Play do not carry a URL fragment through install. Do not add a third-party deferred-deep-link SDK (privacy, SPEC). v1: after install the user opens the same link again or scans the admin's QR from inside the app (scanner exists); add a visible "Already installed? Paste your invite link" in the app. Say this in the page's step list.
 Universal links: /.well-known files publish only when Apple Team ID and Android fingerprints are set. Until then the page relies on the huntclub:// button.
 Privacy rules for this page (MUST): the URL fragment holds the radio channel key. Never send, log or track location.href or the hash. No analytics script that records full URLs; if analytics runs here, send only join_view {kind} with the page URL stripped to "/join". Referrer-Policy no-referrer. noindex. No third-party scripts, fonts or images. Keep the JS tiny: decide club vs party from the fragment with a small parser (export one from @huntclub/mesh rather than shipping the protobuf codec to this page; validate fully in the app).
 Events: join_view {kind}, join_open_app_click, join_store_click {store}.
 Error state (exists): "This invite link is not complete. Ask for a new QR code." Keep, add the contact link.

======================================================================
5. PAGE SPECS
======================================================================

GLOBAL SHELL (every page)
- Header (64px): logo mark + "Hunt Club Mesh" wordmark; nav: Features, For clubs, Pricing, FAQ; right: "Sign in" (text link to /app/) and primary button "Get the free app". At 390px: logo, button "Get the app" (48px high), and a "Menu" button with the word label (no icon-only controls); the menu is a full-width disclosure with 56px rows.
- Skip link first. One H1 per page. Footer: Product (Features, Pricing, Download, FAQ), Clubs (For clubs, Start a club, Sign in), Company (About, Contact), Legal (Privacy, Terms), Meshtastic attribution, "Not an emergency service. For emergencies, call 911 from your phone if you have service." (the only place 911 appears, same wording as SAFETY_NOTE), copyright line with the legal entity (TBD).

HOME (/)
 Title (<=60): "Hunt Club Mesh: hunting app that works with no cell service"
 Meta description (<=160): "Share a live map, text and check in with your hunting party or club using a small radio. No cell service needed. Free for parties of up to 3."
 Section order:
 1 Hero. H1: "Hunt together, even with no cell service." Subhead: "Hunt Club Mesh links your phone to a small radio so your party or club can see each other on one map, send texts and check in. Free for parties of up to 3." CTAs: primary "Get the free app" (-> /download); text link "Run a hunting club? See club plans" (-> /clubs). Microcopy: "iPhone and Android. No account needed. Works with Meshtastic radios (sold separately)." Image: the illustrated dawn scene (@huntclub/design dawnScene, docs/BACKGROUND_LOOP.md) replaces the photo: an inline SVG behind the hero text, decorative (aria-hidden, no alt), slow CSS animation that stops for prefers-reduced-motion and has a 48px "Pause background" button. It is not a video, so the "No autoplay video" rule below still holds. The headline stays the LCP element. Home page only.
 2 Trust strip (one line, 3 items): "Works with no cell service" / "Your location is shared only while you're checked in" / "No account for hunters".
 3 How it works (3 steps, numbered, each with a small screenshot): 1 "Pair your radio. Scan once, no settings." 2 "Start a party or join with a QR code." 3 "Hunt. See the map, check in, send a text."
 4 What you get (6 cards, 2 columns desktop, 1 mobile, each a plain sentence): Live map that works offline; Check in your way ("At a stand, at a spot or on the move"); Ask for a Hand ("Pings your party or club when you need help"); Overdue alert ("If you are not back after sunset plus a grace time, your party gets an alert"); Chat with quick replies; Private harvest log ("Private unless you share it"). Include wind, sunrise and sunset, scent cone as one line of card 1. Each card links to /features#anchor.
 5 Free and club split (two cards). Free: "For you and your party of up to 3. $0. No account." CTA "Get the free app". Club: "For hunting clubs and leases. Shared stands, roster, clubhouse board, club map pack." CTA "See club plans".
 6 For clubs teaser (light section, see section 6): H2 "Retire the paper sign-in sheet." Screenshot of the board and the roster. CTA "See how clubs use it" (-> /clubs).
 7 Built for the field: large text, big buttons, slide to check in, word labels on every control, works in gloves. (Only claim red-light night mode if the app ships it; SPEC lists it, I could not confirm it in code.)
 8 Social proof: placeholders only. [TBD quote from the field-test club: name, role, club, photo, written permission]. [TBD counts after field test]. Do not invent quotes, ratings or user numbers. Store star ratings only after real ones exist.
 9 Safety and privacy in plain words: "Free hunters have no account. Maps come straight from public USGS servers. We do not keep location history. Safety features are never behind a paywall."
 10 FAQ preview (4 questions) + "All questions" link.
 11 Final CTA band (light variant): "Ready for your next sit?" Buttons: "Get the free app", "Start a club".
 12 Footer.
 Mobile at 390px: single column, 20px side padding (350px content). H1 40/44, subhead 18/28. Hero order: text, CTA (full width, 62px tall), secondary link (48px tap), with the dawn scene behind them (its sun and brightest light below the text). Screenshots in how-it-works stack under each step text at full width. Cards 1 column with 16px gap. No carousels. Section spacing 64px. Header shrinks to 56px. Optional (Nice): a sticky bottom bar "Get the free app" that appears after the hero scrolls away, 56px tall, hides when the footer is visible.

PRICING (/pricing)
 Title: "Pricing: free app, one plan for clubs | Hunt Club Mesh" (53)
 Meta: "The app is free for hunters and parties of up to 3. Clubs pay one subscription for shared stands, roster, clubhouse board and map packs."
 Section order:
 1 H1 "Free for hunters. One plan for your club." Subhead "Everything that works over the radio is free, always. Clubs pay for the shared setup and admin tools."
 2 Two cards side by side (stacked at 390, Free first):
    FREE: "$0". "For you and your party of up to 3." List: live map with free USGS topo and aerial; wind, sunrise and sunset, scent cone; party map, chat and quick replies; check in at a spot or on the move; Ask for a Hand and overdue alerts to your party; private harvest log. "No account." CTA "Get the free app".
    CLUB: "$TBD / year" [TBD: price, per season or per year, trial]. "For hunting clubs and leases. Up to [TBD, placeholder is 50] members." (guests do not count toward the limit). List: everything in Free; whole-club map and chat; club property line, stands and areas; roster, roles, invites and guest passes; check in at a stand or in an area; clubhouse board; high-resolution offline map pack; harvest reports with CSV export; Ask for a Hand and overdue alerts to the whole club. CTA "Start your club" (-> /app/?intent=club). Fine print: "Members join free. You pay once for the club. Pay by card through Stripe."
 3 Comparison table (from the SPEC Free vs Club table; real rows only). Desktop: three columns (Feature / Free / Club). 390px: each row becomes a block with the feature name and two lines "Free: Yes" "Club: Yes" (use words, not icons alone; "Later" for safety warnings).
 4 "Safety is never behind a paywall": "If a club's subscription ends, the radio, chat, Ask for a Hand and overdue alerts keep working. Only the shared setup and admin tools pause. Your club data is kept for [TBD] days so you can renew without starting over."
 5 "What you need": a Meshtastic-compatible radio with GPS for each hunter (sold separately; price TBD, are we selling kits TBD); optional solar repeater on high ground to cover the property; a phone. Link to /radios (Phase 2).
 6 Billing FAQ (details/summary): Who pays? How is it billed? Can I cancel? What happens if we stop paying? Do members need accounts? (Club members sign in once with an email code.) Taxes? [TBD: Stripe Tax yes/no]. Refunds? [TBD]. Do guests count toward the limit? (No, they expire.) Is the radio included? (No.)
 7 Final CTA.
 Display rules: price in the same size as plan name; show per-year price AND per-month equivalent if yearly; never show a price that is not in Stripe. LAUNCH BLOCKER: /pricing must not ship with "$TBD". Until the price is decided, ship Phase 1 with the Club card reading "Club pricing: coming soon" and a "Tell me when it opens" mailto (TBD) instead of a Checkout CTA, and tell the owner.
 Competitor price anchors for the owner's decision (public, 2026-11-26): Ember club plans from $199.99/year (5/15/30 members); Trail Pro Intel $99/year or $9.99/month per club, free for crews of 3 or fewer; HuntStand Pro $29.99/year; Spartan Forge $79.99/year.
 Mobile 390: cards stacked, price 40px, CTA full width 62px, comparison as blocks, FAQ full width with 56px summary rows.

CLUBS (/clubs) (Must, brief)
 Title: "Hunting club app: stands, roster, board | Hunt Club Mesh" (56). Meta: "Run your hunting club or lease from one app: who is in which stand, who is overdue, the roster and a clubhouse board. Works with no cell service." H1: "Retire the paper sign-in sheet." Sub: "See who is in which stand, who is overdue and where the club hunts, even with no cell service." Sections: pain list (who is in the north stand? who is not back yet? where is the club hunting? what is the property line?); 3-step setup (Create the club, Invite by link or QR, Hunt: members see the shared map); board mock; roster and roles screenshot; stands and areas screenshot; harvest report screenshot; map pack ("high-resolution offline map of your property"); pricing teaser card; FAQ; CTA "Start your club". Reuse screenshots from the dev seed club (npm seed:dev), no real emails.

DOWNLOAD (/download) (Must): H1 "Get Hunt Club Mesh". Store badges by device, QR on desktop, "What you need" (radio, phone), "Hunting with a party? Ask the host for the party QR code", beta links until the listing is live. Keep it indexed: it is where store-intent searches land.

FEATURES (/features) (Should): one section per feature group with a screenshot, plain-language benefit, "Free" or "Club" badge in words. Anchors: #map, #check-in, #safety, #chat, #harvests, #club-board, #map-packs.

FAQ (/faq) (Should): "Do I need cell service?" (No) "Do I need a radio?" (Yes, a Meshtastic-compatible radio with GPS) "Which radio?" "How far does it reach?" (do NOT give distances until the field test; say it depends on terrain and antenna) "Is it free?" "How many people in a free party?" (3) "What can a club do?" "Do members pay?" "What data do you collect?" "Is it an emergency service?" (No. Use the exact SAFETY_NOTE: "For emergencies, call 911 from your phone if you have service.") "Which phones?" "Is there a shooting-hours feature?" (No; we show sunrise and sunset only; check your state's rules). Each answer 2 to 4 short sentences. FAQPage schema.

ABOUT (/about) and CONTACT (/contact): TBD copy and email from the owner. Do not invent a team, a story or a legal address.

======================================================================
6. DESIGN SYSTEM DIRECTION (extend the tokens, do not fork them)
======================================================================

Add marketing tokens to packages/design (the single source), not to site/ CSS. Keep tests that no component hard-codes a color. Keep Archivo; keep mixed case; keep no emoji, no gradients, no pill chips; orange only for the main action (and focus, active nav).

Color (existing tokens stay)
- Dark section (default): surface #121416, raised #23272B, border #2A2E33, text #FFFFFF, muted #B8BDC2 (9.76:1 on surface, 7.95:1 on raised), accent #FF7A1F with DARK label #121416 (7.08:1). White on #FF7A1F is 2.61:1: never.
- Light section variant (sunlight readability, "warm paper"): new tokens bgLight #F4F1EA, textOnLight #121416 (16.37:1), mutedOnLight #4A5158 (7.14:1), linkOnLight #A8420A (5.40:1), controlBorder #7A828A reused (3.46:1 on light, 4.74:1 on surface, so it works on both). Orange on light: NEVER as text (2.31:1). As a button fill #FF7A1F with label #121416 (7.08:1) plus a 1px #121416 outline so the button edge meets 3:1. Focus ring on light sections: 3px #121416 with 2px offset (orange fails 3:1 on light); on dark: existing 3px accent.
- Add contrast tests for every new pair using the existing contrastRatio helper (4.5:1 text, 3:1 non-text).
- Use light sections sparingly: the "For clubs" teaser, FAQ and final CTA. Hero and feature sections stay dark to match the app.

Type (marketing scale; sizes fluid with clamp, 390px values first)
- Display / hero H1: 40/44 at 390, 56/60 at 1200+; weight 800, width 82% (the sheetTitle style).
- H2: 28/34 at 390, 36/42 at 1200+; 800, width 82%.
- H3: 20/26 to 22/28; 700.
- Lead paragraph: 18/28 to 20/30; 500.
- Body: 18/28 on marketing (never below 17; app minimum is 16); 600-700 for emphasis. Max line length 68ch (about 720px).
- Small / captions: 14/20 minimum (13 only for map labels in screenshots).
- No letter-spaced all caps. Numerals in steps use 800 weight.

Spacing and layout
- Section vertical spacing: 64px at 390, 96px at 768 to 1199, 128px at 1200+. Inside a section: heading to content 32 / 40 / 48; card gap 16 / 24 / 32.
- Max content width 1200px, text columns 720px, side padding 20px at 390 (350px content), 32px at 768+. Breakpoints 600, 960, 1280.
- Grid: 1 column to 599; 2 columns 600 to 959; 12-col at 960+ (cards 3 across).
- Cards: surface-raised #23272B, 1px #2A2E33 border, 20px radius (sheetTop token), 24px padding (32 at 960+). On light sections: white #FFFFFF card with a 1px #7A828A border (3.46:1). No shadows. No pills; badges are rounded 12px rectangles with a word label.
- Buttons: primary 62px tall, 12px radius (existing), 48px minimum for secondary; full width at 390; label weight 700; hover/active darken by 8% (check contrast stays >= 4.5).
- Images: 16:10 and 4:5 crops; 20px radius; always width and height attributes (CLS).
- Motion: none required; if used, respect prefers-reduced-motion. No autoplay video.

Imagery (real, not stock-looking; budget this before building)
- Photography: no hero photo (the illustrated dawn scene is the hero); 2 to 3 supporting (radio in a hand on a pack strap, solar repeater on a post, clubhouse board on a wall, ground blind or stand). Need the owner's photos or a commissioned shoot; model releases for faces. TBD source.
- Screenshots: real, not mockups: Map (Design D), check-in sheet, chat, party QR; web: roster, stands and areas, harvest report, billing; the board on a tablet. Use the dev seed club for web shots. Device frames minimal; add one-line captions.
- Diagrams: phone <-> radio <-> radio <-> phone as simple SVG (no emoji).
- Formats: AVIF with WebP and JPEG fallback via <picture>; srcset 390/780/1200/1600; hero max 150KB at 390w; screenshots WebP; SVG for logo and diagrams; OG 1200x630 JPEG under 300KB.

======================================================================
7. SEO AND SHARING
======================================================================

MUST
- Unique <title> (<=60 chars) and meta description (70 to 160 chars) per page, written from the route registry; test that none repeat and none exceed the limits. Titles above are the starting set.
- One H1 per page; headings in order; canonical URL on every page (https, apex, no trailing slash, no query).
- Open Graph and Twitter: og:title, og:description, og:url, og:type=website, og:site_name, og:image (1200x630, absolute https URL, alt text), twitter:card=summary_large_image. Per-page OG images generated at build time (title on dark surface with the logo mark; use @resvg/resvg-js, already approved). /join uses ONE generic OG image: "You're invited to hunt with Hunt Club Mesh" (social scrapers never see the fragment, so no per-club previews, and none should).
- sitemap.xml with only indexable routes and lastmod from the build; Sitemap: line in robots.txt.
- robots.txt: dev "Disallow: /" (keep; add X-Robots-Tag noindex header). Production: "Allow: /", "Disallow: /app/", "Disallow: /join", "Disallow: /checkout/", "Disallow: /get", plus the Sitemap line. Do not rely on robots for privacy of /join; use noindex and no-referrer.
- Real 404s (section 3), 301 for moved URLs, no redirect chains.
- Favicon.svg exists; add apple-touch-icon 180px, a 512px PNG for manifest, and a web app manifest only if the site is installable (not needed).

SHOULD: structured data (JSON-LD)
- Organization (name, url, logo, contactPoint TBD) and WebSite on /.
- SoftwareApplication on / and /download: name, operatingSystem "iOS, Android", applicationCategory "SportsApplication", offers {price "0", priceCurrency "USD"}. Add downloadUrl only when store links are live. NO aggregateRating or review markup until real ratings exist (fake markup risks a manual action).
- FAQPage on /faq and /pricing (Google limits FAQ rich results mostly to government and health sites now, so expect no snippet; it is still cheap and helps machine readers).
- BreadcrumbList on inner pages. Club plan Offer on /pricing only when the price is final.
- Validate with the Rich Results Test in CI-adjacent checks (manual at first).

Target queries (map one page each; do not stuff): "hunting app no cell service" and "hunting app with radio" (/), "hunting club app", "hunting lease management app", "paper sign-in sheet hunting club" (/clubs), "Meshtastic for hunters" and "what radio for hunting app" (/radios, Phase 2), "hunting party tracker app" (/features).

Core Web Vitals and budgets (mobile, field data p75 once live; lab first)
- LCP < 2.5s (aim < 1.8s lab on throttled 4G), CLS < 0.1 (aim 0), INP < 200ms (a mostly static site should be < 100ms).
- Budgets per page: JS <= 30KB gzip (Phase 1 target: 0KB except analytics, about 1KB), CSS <= 25KB gzip inlined or one render-blocking file, total transfer for the home page <= 600KB, fonts: the existing Archivo Latin woff2 preloaded with font-display swap and a size-adjusted fallback to avoid layout shift.
- Hero: the dawn scene is inline SVG in the HTML (no image request; its CSS is a hashed file linked from the home page only), so the headline is the LCP element; all images lazy with width/height. No carousels, no sliders, no chat widgets, no cookie banner, no third-party fonts.
- CI: Lighthouse CI on /, /pricing, /clubs, /download (mobile): Performance >= 90, Accessibility 100, Best practices >= 95, SEO 100; fail the build below that. Cache rule: HTML no-cache plus invalidation; immutable assets.

======================================================================
8. ANALYTICS AND MEASUREMENT
======================================================================

Principles: cookieless, no personal data, no cross-site tracking, no ad pixels. The free app has no analytics SDK. Privacy copy must match what we do.

Recommended (needs the owner's approval because it costs money; STATUS says ask before spending): Plausible Cloud. Starter is about $9 per month (up to 10k pageviews, custom events). Funnels need Business at about $19 per month (30-day free trial gives Business features; check current pricing before buying). Cookieless, so no consent banner is needed under most rules (GDPR, CCPA) for the analytics itself.
Zero-cost fallback if the owner says no: CloudFront standard logs to S3 and Athena queries (page and referrer counts only, no custom events), plus server-side club metrics from DynamoDB. No always-on compute either way.
Do NOT add Google Analytics, Meta pixel or ad tags in any phase without a new owner decision; those would need a consent banner, Do Not Sell/Share handling and a Privacy page rewrite.

Event names (snake_case, small property sets, no PII, no URLs with fragments, no email, no club or invite IDs)
Marketing site
- cta_click {id, page} e.g. hero_download, hero_clubs, pricing_club, footer_download
- store_click {store: ios|android|testflight|apk, page}
- download_qr_shown {page} (desktop only)
- get_redirect {os} (/get hits: QR scans)
- outbound_click {to} (radio guide, Meshtastic)
- faq_expand {question_id}
- contact_click {kind}
Join page: join_view {kind: club|party}, join_open_app_click, join_store_click {store} (never the URL)
Admin (/app): signin_view {intent}, code_requested, signup_completed {new_account}, club_created, invite_created {kind}, checkout_started {plan}, checkout_returned {outcome}
Server-confirmed (from Stripe webhook and the table, no third party): subscription_activated, invite_redeemed, first_stand_created, first_checkin_by_member. Report weekly in the coordinator's status email.

Funnel definitions
- Hunter: pageview(/ or /features) -> store_click -> (store console installs).
- Club: pageview(/clubs) -> club_start_click -> signup_completed -> club_created -> invite_created -> checkout_started -> subscription_activated.
- Invite: join_view -> join_open_app_click | join_store_click.
Set baselines in the first four weeks of real traffic before targets; starting hypotheses (assumptions, not facts): 10% of /download visitors click a store badge; 20% of /clubs visitors click "Start your club"; 50% of signups create a club.

UTM handling
- Standard utm_source, utm_medium, utm_campaign, utm_content, utm_term on inbound links; the analytics tool reads them from the landing URL. Keep them on every internal CTA to /app and /download for the session by appending them to those links at click time in a tiny script (sessionStorage, no cookie). Strip UTMs from canonical URLs (canonical is always the clean path). Never on /join.
- Conventions: utm_medium = qr | email | social | referral | print | club_invite; utm_source = site | flyer | facebook | clubhouse (never names or emails in UTMs). QR codes printed on flyers or the clubhouse board use /get?utm_source=flyer&utm_medium=print&utm_campaign=<season>.
- Store attribution: Apple campaign tokens (ct) and Play referrer on every store link.

Consent and privacy notes
- Add a "This website" section to the Privacy page: what the analytics counts, no cookies, no ads, no selling data, and a contact for questions. The current Privacy draft talks only about the app; keep the free-hunter promise ("the app never contacts our servers") true and separate from website analytics.
- Honor Global Privacy Control and Do Not Track (Plausible respects DNT by config; make sure custom events do too).
- No cookies set by the marketing site in Phase 1. The admin's sign-in storage is tokens in memory only (existing).
- Remove "Draft, pending owner review" from Privacy and Terms only after the owner approves them (a lawyer pass is advisable before launch; I am not giving legal advice).
- Apple App Store privacy "nutrition label" and Play Data safety form must match the app (no tracking) and the Privacy page URL.

======================================================================
9. ACCESSIBILITY AND CONTENT
======================================================================

WCAG 2.2 AA is the floor (SPEC: 4.5:1 text, 48px targets, 200% text resize).
MUST
- Contrast: use only token pairs with tests (section 6). Never convey meaning by color alone.
- Landmarks: header, nav (aria-label), main (id for the skip link), footer; one H1; logical heading levels; visible focus on every interactive element (3px, 2px offset; dark ring on light sections); focus order equals DOM order; no focus traps; menu opens and closes by keyboard (Esc closes).
- Targets: 48px minimum, primary buttons 62px; 8px+ between targets (gloves).
- Text: 200% zoom and 400% reflow at 320px without horizontal scroll; no text in images (except logo and screenshots, which have alt text).
- Images: informative alt text describing what matters ("Club map showing the property line, six stands and two hunters checked in"); decorative images alt=""; screenshots get one-sentence captions; store badges alt "Download on the App Store" and "Get it on Google Play"; QR code has text alt "QR code that opens the download page" and a visible link beside it.
- Forms (none in Phase 1 except sign-in): labels always visible, errors in text with role=alert, never placeholder-only.
- Motion: respect prefers-reduced-motion; no autoplay; if a video is added later: captions, transcript, no autoplay.
- Language: <html lang="en">; link text makes sense alone ("See club plans", not "Click here"); the "Menu" control has a word label.
- Test: axe in CI on every route plus a manual pass with VoiceOver and TalkBack on /, /pricing, /download, /join.
CONTENT RULES (plain copy for hunters)
- Second person, short sentences (aim for about 8th-grade reading level), active verbs, mixed case, no jargon. Say "radio" and "party", not "LoRa mesh node" or "channel preset". Say "Meshtastic" only in compatibility lines and the FAQ.
- Words to prefer: "party", "club", "check in", "stand", "Ask for a Hand", "overdue alert", "clubhouse board", "map pack".
- Never: legal shooting hours; anything implying a 911 or emergency-services call (Ask for a Hand "pings your party or club"); range numbers or miles before the field test; guarantees of safety; "military-grade" or tactical hype; claims about competitors; any feature that is not in the app today (mark Later items "Later" or leave them out); invented testimonials, ratings, user counts or press logos.
- Verify before claiming: red-light night mode, wind forecast availability offline, exact radio models, store availability, iOS/Android parity per feature.
- Tone: calm, practical, a little dry. This is about getting everyone home, not about gear bragging.

======================================================================
10. PHASED BUILD ORDER (sizes are rough, in your working days)
======================================================================

PHASE 0: decisions only the owner can make (blocks launch, not building). List at the end. Start building with placeholders.

PHASE 1: MINIMUM LAUNCH (about 8 to 12 days) MUST
 1.1 site/ package, route registry, shared shell (header, footer, skip link), dark and light tokens in @huntclub/design with contrast tests. (2 days)
 1.2 Routing and hosting: /app/ base, CloudFront function rewrite, real 404 page and status, redirects, noindex rules, robots (dev and prod), sitemap, smoke test updates, deploy both builds into one bucket. Verify Cognito, Stripe returns and club API CORS still work. (2 to 3 days)
 1.3 Pages: / , /clubs, /pricing (with "coming soon" state if no price), /download (beta or store state), /contact, /privacy and /terms moved to site/ with the same paths, /404. Placeholders for photos and screenshots at the right sizes. (3 to 4 days)
 1.4 /join branded landing with the privacy rules above, generic OG image. (1 to 2 days)
 1.5 OG images and meta from the registry; JSON-LD for Organization, WebSite, SoftwareApplication. (1 day)
 1.6 Analytics wired to the event list (after the owner approves the vendor); UTM pass-through; /app sign-in "intent=club" screen and first-run checklist. (1 to 2 days)
 Exit criteria: every route has unique title, description, canonical, OG; Lighthouse mobile gates pass on dev; axe has zero violations; no placeholder prices visible; Privacy and Terms approved; the store listing can point at /privacy, /contact and /.

PHASE 2: FULL WEB EXPERIENCE (about 6 to 8 days) SHOULD
 - /features with real screenshots, /faq with FAQPage schema, /about, /radios guide (and radio affiliate or kit question), real hero photography and screenshots replace placeholders, store badges and links live, "Already installed? Paste your invite link" in the app.
 - Club invite preview endpoint (club name on /join) if safe.
 - Lighthouse CI and axe in GitHub Actions as required checks; CSP and custom headers policy; production environment config (domain, certificate, www redirect, universal links files).
 - Weekly funnel numbers in the coordinator's status email.

PHASE 3: GROWTH (ongoing, each item 1 to 3 days) NICE TO HAVE
 - Guides that match real searches ("How to replace the paper sign-in sheet at a hunting club", "Meshtastic for hunters: what you need", "Hunting with no cell service: how it works").
 - A field-test story from the first club (with permission), real quotes and numbers.
 - Real routes inside /app (/app/roster) replacing hash routes; a club admin onboarding email series (needs email sending, SES, owner approval).
 - Short demo video with captions (no autoplay), hosted as a static file, poster image.
 - "Invite your club" share kit (printable flyer PDF with a QR to /get), referral sourcing question at signup ("How did you hear about us?" with fixed options, no free text).
 - Sticky mobile download bar, light/dark section polish, localization is NOT planned.

======================================================================
11. QUESTIONS FOR YOUR REPLY (please answer in this thread)
======================================================================
1. Option A (react-dom/server prerender) or B (Astro)? List every new dependency you would add so I can ask the owner once.
2. Walk me through the CloudFront function and custom error response changes, and what could break for existing /join, /checkout/* and bookmarked admin URLs. Any change to Cognito callbacks, Stripe return URLs or API CORS from moving the admin to /app/?
3. What can an unpaid club do today (create, invite, add stands, map pack)? Can we offer "set up first, pay to invite or use the map pack"?
4. Is a public invite preview endpoint (club name only) safe under the permission model? If not, we ship generic /join copy.
5. How will you keep /join tiny (parse club vs party from the fragment without the protobuf codec) while keeping DRY?
6. How will analytics events be sent without exposing the full URL on /join, and what does the CSP look like?
7. Your phase estimates in working days and the order you would merge PRs (small PRs please).
8. Tests you will add (route registry, title/description lengths, contrast pairs, smoke checks, axe).
9. Which copy and facts above you could not verify in code (night mode, offline wind, anything else).
10. A list of everything you need from the owner, ranked by what blocks you first.

======================================================================
12. TBD LIST (only the owner can answer; I will relay)
======================================================================
- Production domain (and whether www redirects to apex), and whether the dev domain stays as staging.
- Brand: is "Hunt Club Mesh" final? Logo and mark approved? Trademark search? Legal entity name and address for the footer, copyright and Terms.
- Club pricing: flat vs tiers, per year vs per season (renewal date), member limit, trial or none, annual only or also monthly, taxes, refunds, days club data is kept after lapse ([N]).
- App store status: Apple Developer enrollment and Team ID, App Store Connect record (ascAppId), Play Console account and signing fingerprints, target launch date, TestFlight public link and Android beta link for the pre-launch Download page. Apple and Google rules on linking to web payments from the app (SPEC says check before launch): the app should not link to /pricing until that is verified.
- Radios: do we sell kits or recommend models? Prices? Affiliate links? Support promises.
- Open vs closed source (affects the "open source" claims, a GitHub link, and the GPL-3.0 question).
- Photography and screenshots: who supplies, releases, and usage rights; the field-test club and permission for a quote.
- Contact email addresses (support, press) and an About story.
- Analytics vendor and budget (about $9 to $19 a month for Plausible), or the zero-cost fallback.
- Privacy and Terms approval (still drafts), including a "This website" section.
- Whether to show "Meshtastic" compatibility badges (M-Powered logo) and the attribution wording.
