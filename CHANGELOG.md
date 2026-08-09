# Changelog

## 0.3.0 — 2026-08-09

Social, synced, and location-aware: the first release built on offline-first cloud
sync with anonymous Google sign-in.

- First-run onboarding flow and login prompts.
- Journal photos with captions and comments, a before/after slider, a gallery
  lightbox, and using a photo as the plant avatar.
- Offline-first cloud sync: queued writes, newest-wins conflict resolution, and
  multi-device consistency via Firebase.
- Location-aware care: regional fit engine powers placement recommendations and
  species care guides at `/species/:slug`.
- Route-level code splitting for a faster first paint.
- Bumped web, server, and Android app versions (0.3.0, versionCode 3).

## 0.2.0 — 2026-08-01

First release candidate for Silvae’s web MVP and Android shell.

- Warm, accessible plant-care visual system across web and Android.
- Thumb-friendly web navigation and a guided three-step plant setup flow.
- Local-first plant photos, editable profiles, care actions, and diary timeline.
- Upgraded web/server dependencies and added automated dependency update checks.
- Restored Gradle wrapper files and added a signed Android App Bundle / Google
  Play internal-track release workflow.

## 0.1.0

Initial prototype: shared care engine, 400-species offline catalog, web PWA,
serverless identification/weather wiring, and Android Compose scaffold.
