# Silvae project status

Updated: 20 August 2026

## Current position

Silvae has a working web MVP and a functional Android client foundation. The shared TypeScript care engine, schemas, weather calculations, doctor rules, API contract, Firestore rules, 400-species catalog, CI, local-first web sync, Room-backed Android storage, authentication, care journal, and production build paths are in place.

## What works now

- Web PWA shell, offline service worker, local Dexie storage, and optional Firebase authentication.
- First-run onboarding (`/onboard`): location, pets, and add-your-first-plant, with a Home redirect until completed.
- Add, list, view, and delete plants; calculate watering dates and amounts; log care events.
- Plant photos: journal photos and notes, before/after comparison, a timeline thumbnail gallery with a keyboard-friendly lightbox, and "use as avatar" from any photo.
- Browse and search 400 species, each with a public care guide (`/species/:slug`) reachable from Discover and identification results.
- Rule-based symptom diagnosis and server-backed photo identification flow (photos or screenshots: automatic chrome/border stripping plus a draw-to-crop tool before the Plant.id proxy call).
- Local-to-Firestore sync with a pending-write queue: offline creates/updates/deletes are queued and flushed on reconnect, and conflicting edits resolve by newest write.
- Server functions for identification, weather, and share invitations.
- Shared care-engine and identification unit tests.
- A shared warm visual system and easy four-destination navigation for web and Android.

## Highest-priority work remaining

### P0: make production reproducible

- Connect the Firebase/Vercel projects and set the protected production API base.
- Add Firestore emulator rule tests; the current rules exist but have no automated test suite.
- Complete backend routes from the blueprint: R2 upload, notifications, cron/weekly work, and production smoke tests.

### P1: finish the web MVP

- Route-level code splitting with lazy-loaded pages and split vendor chunks (entry ~8 kB; the former 1.2 MB bundle is now per-page chunks + cached vendor chunks).
- Add Playwright journeys for onboarding, plant creation, care logging, diagnosis, and offline recovery.
- Run a WCAG AA and Lighthouse pass, then test installation on iOS and Android browsers.
- Verify Firestore sync across two signed-in devices, including offline create/update/delete recovery.

### P2: finish Android production hardening

- Complete cloud sync conflict handling and production smoke tests.
- Add on-device model delivery and Compose UI/device tests.
- Add Compose UI tests and smoke-test the APK on physical devices.

### Later phases

- Placement advisor, sharing, progress stats, semantic chat, and community features remain P3/P4 work.
- Model conversion/evaluation and the model manifest are not yet implemented under `ml/`.
- Production deployment, monitoring, privacy export/delete, translations, and store distribution remain outstanding.

## UI/UX direction

The product should feel like a sunny windowsill: warm, calm, and forgiving.

| Role | Light | Dark | Use |
|---|---:|---:|---|
| Leaf green | `#2D7650` | `#72C895` | Primary actions, active navigation, success |
| Deep forest | `#205C3D` | `#92D9AB` | Strong text and emphasis |
| Warm cream | `#FFFAF0` | `#121B16` | App background |
| Soft sage | `#DCEBDD` | `#274936` | Selected states and calm panels |
| Sunflower | `#F2B84B` | `#F1BD58` | Cheerful calls-to-action and today states |
| Peach | `#FFE2C5` | `#4C3326` | Gentle warnings and helper cards |

Interaction rules:

- Keep four primary destinations: My garden, Discover, Plant doctor, and You.
- Use a bottom navigation bar on phones and a top navigation bar on wider screens.
- Make the next useful action visually obvious; advanced detail stays secondary.
- Use plain verbs, friendly empty states, 44–48 px minimum touch targets, and never rely on colour alone.
- Keep web and Android visually related through tokens and navigation, while following each platform's interaction conventions.
