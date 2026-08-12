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

## Store listing draft

**App name:** Silvae

**Short description** (≤80 chars):
> Free plant care: watering schedules, a plant doctor, and a growth journal.

**Full description:**
> Silvae helps you keep houseplants (and outdoor ones) alive and thriving —
> free, forever, no ads, no subscription.
>
> 🌱 **Personal care plans** — every plant gets a watering schedule that
> adapts to your pot, soil, and the real weather at your location.
>
> 🔍 **400-species library** — browse detailed care guides, filter for
> pet-safe plants, and see what fits your climate.
>
> 🩺 **Plant Doctor** — identify a plant from a photo, or answer a quick
> symptom checklist to get a likely cause and treatment steps.
>
> 📸 **Growth journal** — log photos and notes over time, compare before and
> after, and watch your plants grow.
>
> 🔔 **Gentle reminders** — a nudge when something's thirsty, nothing more.
>
> Your data is yours: everything works offline-first and syncs across your
> devices once you sign in. No ads, no data sold, ever.

**Category:** Lifestyle (or House & Home, if available in your console)

**Screenshots needed** (Play Console requires at minimum 2, up to 8, per form
factor): Garden home, Add Plant flow, Plant Detail with care actions,
Discover list, Plant Doctor, growth journal. None have been captured yet —
this needs a device/emulator run.

## Privacy policy (live)

Hosted and public — enter this exact URL in Play Console → App content →
Privacy policy:

**https://astraiva.app/privacy/silvae.html**

Source lives in the Astraiva Website repo at `privacy/silvae.html` (and its
landing-page companion at `apps/silvae.html`). If app data practices change
(e.g. journal photos start uploading to cloud storage, sharing/FCM is added,
on-device ML ships), update that page and re-push — Play Console re-crawls the
URL, no re-submission of the URL itself needed.
