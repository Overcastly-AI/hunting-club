# Hunt Club Mesh

Off-grid hunting club app: phones pair over BLE to Meshtastic LoRa radios.
Source of truth: docs/SPEC.md. Read it before starting any milestone.

## Rules
- Offline-first: every field feature must work with no internet.
- Stay wire-compatible with stock Meshtastic firmware. No custom firmware.
- Members never see channels, keys, presets or regions outside Advanced settings.
- Use theme tokens only; no hard-coded colors. Font: Archivo.
- Min tap target 48px, min map text 13px, body 16px+.
- Never show legal shooting hours. Sunrise and sunset only.
- Ask for a Hand pings club members. Never style or word anything like a 911 call.
- Harvests are private by default. Location is shared only while checked in.
- Never log channel keys or message bodies.

## Workflow
- Work one milestone at a time; list what you will build and the test, then build.
- Write unit tests for protobuf encode/decode and message de-duplication.
- Ask before adding a dependency not listed in docs/SPEC.md.
