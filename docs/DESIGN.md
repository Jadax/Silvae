# Silvae — product & design brief

Lead designer note (Aug 2026): this brief turns competitor research into a concrete,
science-honest product direction. It deliberately **steals the good parts and fixes the
documented failures** of the category leaders, within Silvae's hard constraints: $0 forever,
local-first, WCAG AA.

## 1. What the category does well (stolen)

| App | Steal | Why it wins |
|---|---|---|
| **Planta** | Onboarding asks about the environment (window, light, pot, distance to window); per-plant photo journal; snooze/skip on tasks; weather-aware watering; "your garden" today screen | Feels tailored; progress photos create attachment; forgiving when life happens |
| **Planta** | Light meter (camera → lux) + space-based organisation (rooms/balcony) | Turns "vague light" into a number you can act on |
| **Greg** | Environment-aware onboarding, streaks, friendly community voice | Engagement; beginners feel held |
| **Garden Helpr** | **Checked vs Watered learning loop**; silent seasonal auto-adaptation; indoor + outdoor zones; weather-integrated outdoor (skip before rain, frost/heat alerts); no shame language | The genuinely smarter model — adapts to *your* home |
| **PictureThis / Botanicaly** | Pet toxicity shown on every species page, ASPCA-grounded, with caveats + "contact a vet" | Cat/dog owners (like our primary user) make it a filter |

## 2. What the category gets wrong (fixed here)

1. **Static schedules kill plants.** Planta's #1 documented complaint (r/houseplants, Planet
   Houseplant, App Store reviews): users water on fixed dates regardless of season → winter
   overwatering kills plants. **Silvae's answer: the app never commands — it suggests and
   learns.** Watering is a loop: we suggest a date, you tell us "watered" or "still moist",
   and the cadence adapts to your actual drying pattern, silently shifting with season/temp.
2. **Paywalls gate the useful parts.** Every leader hides the light meter, journal, or
   diagnosis behind $30–60/yr. **Silvae: free forever.** Not a free tier — the product.
3. **Weather without location is fake.** Planta auto-detects but users can't change it and it
   ignores outdoor beds. **Silvae: location is a real setting** (auto-detect or manual city),
   surfaces season/temp/humidity, and outdoor plants get real outdoor logic (frost, heat, rain).
4. **Gamified guilt.** Streaks/overdue lists create shame. **Silvae: gentle, calm, no shame.**
   ("Momo could use some water today." Not "OVERDUE 3 DAYS!!")
5. **Misting cargo-cult.** Several apps push misting for every tropical (fungal risk). **Silvae:
   species-specific mist intervals only where the data supports it.**

## 3. Design pillars

1. **Guide, not command.** Every schedule is a suggestion with transparent reasons ("warm room
   + terracotta pot → sooner"). Users stay the decision-maker. (Already: named modifiers.)
2. **Learn from you.** The Checked-vs-Watered loop teaches the app your plants' real rhythm in
   your home and season. Offline, free, privacy-safe.
3. **Context-aware precision.** Real location → weather → season. Indoor plants get moderated
   indoor conditions; outdoor plants get live weather, frost and heat warnings, and rain-aware
   watering. Every number is traceable to the species card (science-backed: 400-species catalog
   with lux/°C/RH%/pH/NPK).
4. **Pet safety first-class.** A "pets at home" setting; every plant surface shows a clear
   🐾 Pet friendly / ⚠ Toxic to pets badge; a pet-safe filter in Discover; toxicity notes
   cite caution and advise calling a vet (not medical certainty).
5. **A dated photo journal.** Every plant gets a timeline of dated photos (camera on Android,
   upload on web) — the "growth diary" that makes care feel rewarding. Compare before/after.
6. **Simple, cute, fun.** Plain verbs, warm copy, 44–48px targets, one obvious next action.
   Four destinations stay.

## 4. North-star flow

1. Onboard: set location (auto-detect) → "do you have pets?" (cat, dog) → add a plant.
2. Add plant: name → type (photo ID or search) → **where does it live?** (indoor/outdoor,
   room/spot) → we generate a science-backed plan.
3. Every day: Home shows *Today* — a short, gentle list ("Momo: water today · Basil: happy").
4. You tap **Watered** or **Still moist**; the schedule learns and shifts with the seasons.
5. Once a month the journal asks for a photo → the before/after slider shows progress.

## 5. Roadmap (this build wave)

1. **Location + season settings** — geolocation or manual city; season/temp/humidity surface on
   Home and plant pages; real Env for outdoor, moderated for indoor.
2. **Photo journal** — dated photos per plant (camera capture on Android via
   `capture="environment"`, upload on web), timeline, before/after.
3. **Today list + learning loop** — Home today cards with Watered / Still-moist quick actions;
   interval adapts (snooze extends, water reset shortens/keeps).
4. **Pet safety** — pets setting, badges everywhere, pet-safe Discover filter.
5. **Indoor/outdoor + outdoor alerts** — frost/heat/rain guidance for outdoor plants.
6. **Personality copy pass** — warm, plain-language, no shame.

## 6. Honest science rules

- Lux/°C/RH/ph/NPK ranges come from the curated 400-species catalog (referential-verified).
- Weather from Open-Meteo (temp/RH/precip/UV/daylight), season from hemisphere + month.
- Outdoor thresholds are conservative (frost < 3°C warn, heat > 35°C warn, rain > 5 mm ⇒ skip).
- Toxicity: shown as "likely toxic to pets" with a caution and vet referral — never absolute.
- Everything labeled as guidance, not a substitute for a professional/vet.
