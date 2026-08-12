# Play Store submission content

Drafted from what the app actually does as of this build — update this file
if you add features (R2 photo uploads, sharing/FCM, on-device ML) that change
what data is collected or where it goes.

## What data Silvae actually collects (for your own reference)

| Data | Collected? | Where it's stored | Why |
|---|---|---|---|
| Email address | Yes (account holders) | Firebase Auth | Sign-in, account recovery |
| Display name | Optional | Firebase Auth | Personalization |
| Plant names, species, care notes, care history | Yes | Local (Room) + Firestore, tied to your account | Core app function |
| Journal photos & notes | Yes | Local device storage only (not currently uploaded) | Growth journal |
| Precise/approximate location | Optional, opt-in only | Local (Room) only — never sent to Firestore | Weather-based care recommendations |
| Photos submitted to Plant Doctor's photo ID | Only when you use that feature | Sent to Plant.id/PlantNet via our server proxy; the image itself is not retained after the request, only the identification result is cached (90 days, keyed by an image fingerprint, not linked to your account) | Species/health identification |

No financial info, contacts, SMS, call logs, or browsing history are collected.
The "health" / "disease" data mentioned above is about the **plant's**
condition, not the user's — don't answer Play Console's Health data-safety
questions as if it collects user health data.

Third parties data passes through: Firebase/Google Cloud (account + plant
data), Vercel (hosts our API proxy), Plant.id and PlantNet (photo ID only),
Open-Meteo and BigDataCloud (weather/location lookups, no account, no key).
None of it is sold or used for advertising.

Users can delete their account and all associated data in-app: **You → Delete
account and data**.

## Data safety form (Play Console → App content → Data safety)

- **Does your app collect or share any of the required user data types?** Yes.
- **Is all user data encrypted in transit?** Yes.
- **Do you provide a way for users to request that their data is deleted?** Yes — in-app account deletion.
- **Data types to declare:**
  - *Personal info → Email address*: Collected, required for account creation, not shared, used for App functionality & Account management.
  - *Personal info → Name*: Collected, optional, not shared, used for App functionality.
  - *Location → Approximate/Precise location*: Collected, optional, not shared with third parties for their own purposes (sent only to weather/geocoding APIs to fulfill the request), used for App functionality.
  - *Photos*: Collected (journal photos, stays on-device; photo-ID photos sent to identification providers), not shared for advertising, used for App functionality.
  - *App activity → App interactions*: Collected (plant care records), not shared, used for App functionality.

## Content rating (IARC questionnaire)

This is a plant-care utility app: no violence, sexual content, gambling,
user-generated public content, or controlled substances. Expect a rating of
**Everyone** (PEGI 3 / ESRB Everyone equivalent). Answer "No" to every
mature-content question; answer "Yes" to "Users can create/share content"
only if you're counting the private plant journal (it isn't shared publicly
between users, so most jurisdictions still treat this as no UGC exposure —
answer per the questionnaire's exact wording when you fill it in).

## Store listing assets

Ready-to-upload files live in `apps/android/store-assets/` (see its README for
what's covered and what's still missing):

- **App name / short description / full description** — `store-assets/text/`
- **App icon (512×512 PNG)** — `store-assets/icon/app_icon_512.png`, composited
  from the real in-app adaptive-icon vectors, so it always matches what's on
  the device
- **Feature graphic (1024×500 PNG)** — `store-assets/feature-graphic/`
- **Category:** Lifestyle
- **Phone screenshots (6, 1080×2340)** — `store-assets/screenshots/01_garden.png`
  through `06_account.png`, real captures from the signed-in app
- **7"/10" tablet screenshots** — not provided; declare "phone only" in Play
  Console and skip these fields

## Privacy policy (live)

Hosted and public — enter this exact URL in Play Console → App content →
Privacy policy:

**https://astraiva.app/privacy/silvae.html**

Source lives in the Astraiva Website repo at `privacy/silvae.html` (and its
landing-page companion at `apps/silvae.html`). If app data practices change
(e.g. journal photos start uploading to cloud storage, sharing/FCM is added,
on-device ML ships), update that page and re-push — Play Console re-crawls the
URL, no re-submission of the URL itself needed.
