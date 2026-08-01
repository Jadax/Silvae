# Silvae release setup

The repository contains a release workflow for a signed Android App Bundle and
Google Play publishing. It deliberately fails early when required secrets are
absent, rather than producing a misleading unsigned "release".

## One-time Google Play setup

1. Create a Google Play Developer account and create the Silvae app. The first
   package name is permanent. This project currently uses `org.silvae`; change
   `applicationId`, workflow package name, and Firebase Android app together if
   you want a different final identifier before the first upload.
2. Enrol in Play App Signing and create an upload key. Keep the app-signing key
   with Google; only use the upload key in GitHub Actions.
3. In Play Console, create the **internal testing** track before the first
   automated upload. Use internal testing until real-device checks are complete.
4. Create a Google Cloud service account with Play Developer API access and add
   that service account to Play Console with release permissions for Silvae.
5. Add the following GitHub Actions secrets to `Jadax/Silvae`:

   | Secret | Value |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | Base64 of the upload `.jks`/`.keystore` file |
   | `ANDROID_KEY_ALIAS` | Upload key alias |
   | `ANDROID_KEY_PASSWORD` | Upload key password |
   | `ANDROID_STORE_PASSWORD` | Keystore password |
   | `PLAY_SERVICE_ACCOUNT_JSON` | Entire service-account JSON document |

6. Create the protected GitHub environment `play-production` and restrict who
   can approve it. This is the final safety gate before a tag can publish.

## Firebase and backend setup

1. Create a Firebase project; enable Anonymous, Email/Password, and Google
   authentication, Firestore, and Cloud Messaging.
2. Register both the web PWA and the Android app with the final Android package
   name. Store Android `google-services.json` as a GitHub secret if/when the
   native client starts configuring Firebase.
3. Set the values in `.env.example` in Vercel, never in Git. Add R2 credentials
   before enabling cloud image uploads.
4. Deploy Firestore rules and indexes, then seed species data using the scripts
   in the root package.

## Releasing

- Every normal commit runs checks.
- A `v0.2.0` tag builds a signed AAB, uploads it to the internal Play track, and
  creates a GitHub release. Use the manual workflow only to promote a tested
  bundle to a different track.
- Play policy declarations, privacy policy URL, store listing copy/screenshots,
  Data safety, content rating, and test-device validation must be completed in
  Play Console by the account owner.
