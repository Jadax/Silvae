# Play Store submission assets

Ready to upload as-is in Play Console → Store presence → Main store listing.

| Asset | File | Status |
|---|---|---|
| App name | `text/app_name.txt` | Ready |
| Short description | `text/short_description.txt` | Ready (76/80 chars) |
| Full description | `text/full_description.txt` | Ready |
| App icon (512×512) | `icon/app_icon_512.png` | Ready — composited from the app's real adaptive-icon vectors (`app/src/main/res/drawable/ic_launcher_{background,foreground}.xml`), opaque RGB, no alpha |
| Feature graphic (1024×500) | `feature-graphic/feature_graphic_1024x500.png` | Ready |
| Phone screenshots (2–8) | `screenshots/01_garden.png` … `06_account.png` | Ready — 6 real screens (1080×2340) captured on an emulator |
| 7" / 10" tablet screenshots | — | Not provided; the app isn't tablet-optimized, so in Play Console → Store presence declare phone-only and skip these fields |

If the app's branding or copy changes, regenerate the icon/feature graphic from
`apps/android/app/src/main/res/drawable/ic_launcher_*.xml` rather than hand-editing
the PNGs, so they stay in sync with the actual in-app icon.

## How the screenshots were captured

Taken on the `silvae_test` AVD (resized to 1080×2340/420dpi for quality) with a
temporary, always-reverted change to `MainActivity.kt`'s `SilvaeRoot()` that
skipped straight to the signed-in shell — no real account was created or signed
into for this. Local Room data only; nothing was written to Firestore since
there was no real Firebase user. Screens captured:

1. `01_garden.png` — Garden with two plants (a fresh add-plant flow was walked
   through live to generate real, non-fake data)
2. `02_add_plant_pot_size.png` — Add Plant's pot type/soil/pot-size step
3. `03_plant_detail.png` — Plant Detail with the computed care plan and history
4. `04_discover.png` — Discover's species library with pet-safety flags
5. `05_plant_doctor.png` — Plant Doctor's photo-ID + symptom checklist
6. `06_account.png` — Account/You settings (location, pets)

To recapture after a UI change, repeat the same process (see `RELEASE.md` for
emulator setup) rather than editing these PNGs by hand.
