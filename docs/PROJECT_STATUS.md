# Silvae project status

Updated: 9 August 2026

## Current position

Silvae is between the foundation phase (P0) and the web MVP phase (P1). The shared TypeScript care engine, schemas, weather calculations, doctor rules, API contract, Firestore rules, 400-species catalog, and basic CI are in place. The web app is a usable local-first vertical slice with a finished onboarding flow, plant photo timeline, and offline-first cloud sync. Android is still a UI/architecture scaffold rather than a functional client.

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

### P0: make the foundation reproducible

- Create the initial Git commit and move the default branch to `main`.
- Add the missing Gradle wrapper scripts/JAR so Android and CI build from a clean checkout.
- Finish environment setup documentation and connect the Firebase/Vercel projects.
- Add Firestore emulator rule tests; the current rules exist but have no automated test suite.
- Complete backend routes from the blueprint: R2 upload, notifications, cron/weekly work, and production smoke tests.

### P1: finish the web MVP

- Route-level code splitting with lazy-loaded pages and split vendor chunks (entry ~8 kB; the former 1.2 MB bundle is now per-page chunks + cached vendor chunks).
- Add Playwright journeys for onboarding, plant creation, care logging, diagnosis, and offline recovery.
- Run a WCAG AA and Lighthouse pass, then test installation on iOS and Android browsers.
- Verify Firestore sync across two signed-in devices, including offline create/update/delete recovery.

### P2: make Android functional

- Replace placeholders with Room entities/repositories, ViewModels, and real feature screens.
- Implement plant collection, care history, species search, and the doctor flow before cloud sync.
- Add WorkManager reminders, Firebase auth/sync, image handling, and on-device model delivery.
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
