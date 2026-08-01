# Silvae Android

Kotlin + Jetpack Compose, MVVM + Clean Architecture (layers under `org.silvae`:
`data`, `domain`, `di`, `ml`, `ui`, `notifications`).

## Open in Android Studio

1. Open this folder (`apps/android`) as a project.
2. Android Studio generates the Gradle wrapper jar on first sync.
3. minSdk 26 · JDK 17 · AGP 8.7 · Kotlin 2.1 · Compose BOM.

Room is the local source of truth; Firestore is the sync mirror (blueprint A3).
Model files are downloaded at first launch from the `ml/models.json` manifest.
