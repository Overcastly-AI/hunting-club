# Hunt Club Mesh

Off-grid hunting app: phones pair over BLE to Meshtastic LoRa radios.
Free for hunters (parties up to 3); clubs pay a subscription for the cloud/admin layer.
Source of truth: docs/SPEC.md. Read it before starting any milestone.

## Rules
- Offline-first: every field feature must work with no internet.
- Stay wire-compatible with stock Meshtastic firmware. No custom firmware.
- Members never see channels, keys, presets or regions outside Advanced settings.
- Use theme tokens only; no hard-coded colors. Font: Archivo.
- Min tap target 48px, min map text 13px, body 16px+.
- Never show legal shooting hours. Sunrise and sunset only.
- Ask for a Hand pings your party or club. Never style or word anything like a 911 call.
- Location is shared only while checked in.
- Stands are optional: every feature must work for hunters at a spot or on the move.
- Everything over the mesh is free forever; never paywall mesh or safety features.
- Free users have no account and never call our backend.
- Cloud: Supabase free plan + AWS pay-per-use only (Lambda, S3, CloudFront, EventBridge). No always-on compute.
- Clubs are rows with club_id + RLS in one shared database, never per-club infrastructure.
- Never log channel keys or message bodies.

## Workflow
- Work one milestone at a time; list what you will build and the test, then build.
- Write unit tests for protobuf encode/decode and message de-duplication.
- Ask before adding a dependency not listed in docs/SPEC.md.

## Git
- Commit messages must not credit Claude or any AI tool (no Co-Authored-By, session links or "Generated with" lines).
- Enforced by `.githooks/commit-msg`. Enable it once per clone: `git config core.hooksPath .githooks`
