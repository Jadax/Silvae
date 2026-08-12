# Silvae Android

Kotlin + Jetpack Compose, MVVM + Clean Architecture (layers under `org.silvae`:
`data`, `domain`, `di`, `ml`, `ui`, `notifications`).

## Open in Android Studio

1. Open this folder (`apps/android`) as a project.
2. Android Studio generates the Gradle wrapper jar on first sync.
3. minSdk 26 · JDK 17 · AGP 8.7 · Kotlin 2.1 · Compose BOM.

Room is the local source of truth; Firestore is the sync mirror (blueprint A3).

Mandatory account (email/password or Google, no guest mode) → Garden (plant
CRUD + care scheduling) → Discover (400-species catalog) → Species Guide →
Plant Doctor (photo ID via the shared `/api/identify` proxy + symptom
checklist) → growth journal (photos/notes/comments) → weather-aware care via
`/api/weather` → daily watering-reminder notifications. In-app account
deletion under You → Delete account and data.

**Not implemented**: on-device TFLite species/disease ML (no trained models
exist in this repo — Plant Doctor uses the same server-side identify proxy the
web app uses instead; see `ml/MlPlaceholder.kt`), photo uploads to R2 (journal
photos stay device-local), and plant sharing/FCM.

See `RELEASE.md` for signing/build instructions and `PLAY_STORE.md` for the
Play Console listing content, data-safety form answers, and a privacy-policy
draft.
