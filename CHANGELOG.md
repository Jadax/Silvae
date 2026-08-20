# Changelog

## 0.4.1 — 2026-08-20

- Fixed a gap in the mandatory-registration gate shipped in 0.4.0: browsers/
  devices that had used Silvae before that release (silent anonymous sign-in)
  kept a lingering anonymous Firebase session, which `onAuthStateChanged`
  treated as "signed in," letting them skip the new sign-up/sign-in screen
  entirely and land straight in onboarding. Anonymous sessions are now
  detected and signed out on load, correctly falling through to the
  mandatory sign-up gate.
- Removed the stale hardcoded Android API hostname. Release builds now require
  the live Vercel API base through `SILVAE_API_BASE`, preventing broken mobile
  deployments when a Vercel project domain changes.
- Updated Vercel, Android release, and project-status documentation to match
  the current 0.4.x architecture.

## 0.4.0 — 2026-08-12

Mandatory accounts, a real native Android app, and a round of security hardening.

- Built out the Android app from an empty UI shell into a working app:
  mandatory account gate, Garden (plant CRUD + the real ported watering-
  schedule engine), the full 400-species Discover catalog + Species Guide,
  Plant Doctor (photo ID via the shared server proxy + the ported symptom
  checklist), weather-aware care with a location settings screen, a photo/
  note growth journal, daily watering-reminder notifications, in-app account
  deletion (Play Store requirement), a real adaptive launcher icon, and a
  signed, R8-minified release build. See `apps/android/RELEASE.md` and
  `apps/android/PLAY_STORE.md`.
- Fixed a real, blocking bug found by actually running the Android app on an
  emulator for the first time: the sign-up/sign-in screen's content was
  taller than the viewport and had no scroll modifier, so the "Create
  account" / "Sign in" button, Google sign-in, and the mode-toggle link were
  completely unreachable — nobody could have registered. Also proactively
  fixed the same missing-scroll pattern in Add Plant and Species Guide.
- Fixed a second on-device-only bug in the same area, caught by user report:
  once the keyboard was up, scrolling stalled partway and still couldn't
  reach the submit button — `imePadding()` alone wasn't enough without
  `android:windowSoftInputMode="adjustResize"` declared on `MainActivity`.
  Both are now set together; scrolling with the keyboard open works
  correctly across sign-up, sign-in, Add Plant, Species Guide, Account, and
  the plant journal's note/comment composers.
- Fixed a serious, previously invisible bug found by testing the signed-in
  screens directly (via a temporary local auth bypass, reverted before this
  was considered done — no account was created or used): `LocationApi`,
  `WeatherApi`, and `IdentifyApi` all made blocking OkHttp calls without
  switching to `Dispatchers.IO`, which throws `NetworkOnMainThreadException`
  on real Android (never triggered by JVM unit tests). The exception was
  getting silently swallowed by `runCatching`, so city search always
  returned zero results, every care schedule silently fell back to
  indoor-default weather instead of real conditions, and photo
  identification always failed — with no visible crash or error to explain
  why. All three now correctly run their network calls on `Dispatchers.IO`.
- Fixed care-action buttons (water/mist/fertilize/prune/rotate/clean) on
  Plant Detail wrapping character-by-character ("fe/rti/li/ze") because six
  buttons didn't fit one row — now a horizontally scrolling row.
- Added first-run onboarding (location + metric/imperial units) shown once
  right after sign-up, before the user ever sees an empty garden — previously
  the app jumped straight to "add a plant" with no context-setting step.
- Added a metric/imperial units preference, applied to watering amounts,
  temperatures, and sizes on the Species Guide (e.g. "3.4 fl oz every 3 days",
  "61–81°F").
- Add Plant now asks when the plant was last watered and fertilized, and uses
  that as the real baseline for the watering/fertilizing schedule and care
  history — previously every new plant was seeded as if it had just been
  watered "now," regardless of reality.
- Add Plant's species-identification step now surfaces the same photo health
  check Plant Doctor shows (healthy / possible issue / disease name), not
  just the species match.
- Fixed a serious bug caught by this exact onboarding test: a brand-new
  account (no settings row in Room yet, the normal state before onboarding)
  got stuck on an infinite loading spinner and never reached onboarding or
  the app at all. The gate conflated "Room hasn't emitted yet" with "Room
  emitted: no row exists" — both looked like `null`. Fixed with an explicit
  `hasLoadedSettings` signal instead of inferring load state from nullability.

- Accounts are now required before using the app: a new full-screen sign-up /
  sign-in gate (`Welcome`) replaces silent anonymous sign-in as the very first
  screen. Anonymous/guest mode has been removed.
- De-duplicated the location-picker UI (used-my-location / search-a-city /
  manual coordinates) that was copy-pasted between onboarding and account
  settings into one shared `LocationPicker` component.
- Fixed a dead `/setup` link on the Discover page (now points at `/account`).
- Security: closed three Firestore rules gaps that had drifted from the
  documented model (`docs/SILVAE_BLUEPRINT.md` §13.1) — `care_events` reads
  were open to any signed-in user instead of the owner, `summary_stats` was
  client-writable (tamper/quota-cheat risk), and `share_links` allowed
  arbitrary update by any signed-in user instead of just create/delete.
- Security: `/api/share-invite` had no authentication at all — any request
  could impersonate `inviterUid`, forge invites for any plant, and push
  notifications to arbitrary registered emails. Now requires and verifies a
  Firebase ID token, and checks the caller actually owns the plant.
- Security: `/api/identify` had no authentication, so an anonymous script
  could drain the shared Plant.id/PlantNet daily quota. Now requires a signed-
  in account, matching the app's own mandatory-registration requirement.

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
