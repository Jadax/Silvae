# Releasing Silvae for Android

## Signing key

A release **upload keystore** was generated for you at
`apps/android/app/silvae-upload.keystore` (PKCS12, alias `silvae-upload`), with
its store/key passwords in `apps/android/keystore.properties`. Both files are
gitignored — they only exist on this machine right now.

**Back these up somewhere durable before you rely on them** (a password
manager or encrypted archive, not just this disk). If you lose the keystore
and haven't enrolled in Play App Signing, you can never publish an update to
this `applicationId` (`org.silvae`) again under the same listing.

Recommended: enroll in **Play App Signing** the first time you create the app
in Play Console (it's the default now). Google then holds the signing key that
actually ships to users, and this local keystore becomes just an "upload key"
— replaceable via Play Console support if it's ever lost, much lower stakes.

`apps/android/app/build.gradle.kts` reads signing values from (in order):
`-P` Gradle properties, then `apps/android/keystore.properties`. Neither is
required for debug builds; release builds are simply unsigned if both are
absent.

## Building a release

```bash
cd apps/android
./gradlew bundleRelease   # apps/android/app/build/outputs/bundle/release/app-release.aab — upload this to Play Console
./gradlew assembleRelease # .apk, for manual/sideload testing only — Play Store wants the .aab
```

Both are R8-minified (`isMinifyEnabled = true`); `app/proguard-rules.pro`
carries the kotlinx.serialization keep rules the app's JSON models need to
survive minification (Room/Hilt/Firebase ship their own consumer rules
automatically).

## Before you submit

- [ ] Bump `versionCode` / `versionName` in `app/build.gradle.kts` for every submission.
- [ ] Verify `google-services.json` (Firebase Android app config) is present — see main session notes; it's gitignored, re-fetch from Firebase Console → Project Settings → your Android app if this is a fresh checkout.
- [ ] Confirm `BuildConfig.API_BASE` in `app/build.gradle.kts` points at your live Vercel deployment.
- [ ] Read `PLAY_STORE.md` in this folder for the listing content, data-safety form answers, and privacy policy draft.
- [ ] Install the release build on a real device and click through sign-up, add-a-plant, Discover, Doctor, and account deletion before submitting — none of this has been run on a device yet (see main session).
