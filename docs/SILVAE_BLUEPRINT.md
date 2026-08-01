# SILVAE — Free‑Forever Plant Care Platform · Production Blueprint

**Version:** 1.0 · **Status:** Approved for build · **License:** MIT (app code), Apache‑2.0/CC‑BY‑4.0 (models & data as noted)

> **The Silvae Promise:** Every feature below ships with $0 recurring cost, no credit card, no paid tier, no trial that expires. Anything that cannot run for free is either replaced by a free equivalent or removed. Donations are welcome but never gate a feature.

---

## 0. Non‑Negotiable Constraints (recap)

1. **$0 forever, no card.** No service may require a billing card to create, run, or scale past its quota.
2. **Zero paid APIs.** If a capability costs money, substitute a free API, an open‑source on‑device model, or drop it.
3. **Production grade.** TypeScript everywhere on the web/backend; Kotlin + Jetpack Compose MVVM on Android; Clean Architecture; tests in CI.
4. **Local‑first AI.** Chat / plant doctor runs on‑device (no LLM API). Semantic caching avoids re‑processing.
5. **Self‑contained handoff.** Another engineer or LLM must be able to continue from this document alone.

---

## 1. Competitive Research Summary

Research performed Aug 2026 across: **Planta, Plantin, Plant Parent, LeafSnap, PictureThis, Blossom, Greg, Gardenia, Flora Incognita, PlantNet, iNaturalist, Growli** plus GitHub open‑source plant projects (`PlantNet-300K`, `PlantVillage-Dataset`, `GreenHealer`, `PlantAi`, `Green-Sense`, `offline-plantid`, `llmedge`, `Gemma-on-Android`, `Sentence-Embeddings-Android`).

### 1.1 Feature matrix

| App | Standout features | UI/UX signals | Monetisation | Free‑tier lesson for Silvae |
|---|---|---|---|---|
| **Planta** | 9‑step personalized onboarding; 30+‑parameter adaptive water schedule w/ local weather; light meter; Dr. Planta AI diagnosis; plant journal w/ monthly photo progress; Care Share (family/sitters); seasonal updates; "graveyard" empathy; snooze/skip | Fresh green, nature‑inspired; icons + imagery over text; status % complete cards; gentle plant photos; empathy copy | Subscription (~$35/yr); free tier ≈ watering reminders only | Personalization beats breadth; make onboarding short with progress bar + skip; notifications must name the plant & action |
| **PictureThis** | 400K‑species ID, ~98% acc; disease auto‑diagnose + treatment; toxic‑plant warning; weed ID; care tips/reminders; light meter; collection + wishlist; 24/7 expert chat | Polished, fast, beginner‑friendly; single confident answer; high‑quality reference photos | Aggressive $30–40/yr freemium; trial‑auto‑charge complaints; ID + care + reminders paywalled | Don't hide confidence; show ranked candidates; NEVER dark‑pattern trials — trust is our brand |
| **PlantNet** | Free citizen‑science ID (Cirad/INRA/INRIA/IRD); ranked results with confidence; regional floras; offline embedded model; disease ID (EPPO codes) via API; PlantNet‑300K open dataset + open weights | Functional/utilitarian; ranked list (honest uncertainty) | Research‑funded; completely free, ad‑free | Open weights + citizen‑science data are our ML backbone; honesty about uncertainty builds credibility |
| **Greg** | PlantVision ID (measures pot, window distance); ml‑precise watering; water‑now swipe; community #Communities hashtags; Q&A <24h w/ Plant Card context; progress tracking | Friendly/playful; naming plants (emotional bond); social feed of "Moments" | $29.99/yr Super Greg (precision watering, light gauge, seasonal) | Attach rich context (plant card) to community Q&A; hashtag communities are cheap to build |
| **Plantin** | ID + care + reminders; duplicate of PictureThis playbook | Same as PictureThis | Freemium subscription, trial dark patterns | (see PictureThis row) |
| **LeafSnap** | Leaf‑shape‑only identification; UI for field use | Simple, functional | Freemium | Leaf anatomy is a useful fallback signal for our TFLite ID |
| **Blossom** | Plant ID + diagnosis; care reminders | Bright, photo‑centric | Freemium | Diagnosis UX: photo in → treatment steps out |
| **Gardenia** | Garden planner; design + plant placement; encyclopedia | Design‑first, board/planner mental model | Freemium | Placement/spacing advice is a differentiated, data‑driven module |
| **Flora Incognita** | Research app; offline ID of wild flora; strong Europe coverage; no care advice | Minimal, scientific | Free (research) | Offline model viability proven at scale |
| **iNaturalist** | Community‑confirmed observations; broader than plants; AI suggestion + human confirmation | Explorer/observation ledger | Free (non‑profit) | Community confirmation loop improves ID trust |
| **Growli** | Conversational symptom diagnosis (dialogue, not lookup); daily weather briefings; frost alerts | Chat‑first | Free core + paid Plus | Symptom dialogue is what "plant doctor" should be — we do it on‑device |

### 1.2 Top 15 features → free implementation notes

| # | Feature | Free implementation |
|---|---|---|
| 1 | **Photo plant identification** | Primary: Plant.id API (free ~100 IDs/day) via server proxy + cache. Fallback: on‑device TFLite MobileNetV3‑Small (PlantNet‑300K, 1,081 species, ~10 MB). Secondary API: PlantNet `/v2/identify` (free tier). |
| 2 | **Disease / pest diagnosis** | On‑device TFLite PlantVillage MobileNetV3 38‑class classifier + symptom rule engine (disease→symptom mapping table). Cloud: Plant.id `health_auto` modifier (only spends credits when unhealthy). |
| 3 | **Species‑specific care engine** | Curated care dataset (open sources: PlantNet taxon data, Wikipedia/Wikidata, A-Z databases seeded from open data); numeric params (lux, °C, RH%, pH, NPK) in Firestore `species/` docs. |
| 4 | **Dynamic weather‑adaptive schedule** | Open‑Meteo (10 K calls/day, no key) → cached per location; schedule engine re‑computes intervals (evapotranspiration model). |
| 5 | **Push notifications** | Primary: local WorkManager on device (free, reliable, offline). Cloud: Firebase Cloud Messaging (unlimited, free) for cross‑device/share events. |
| 6 | **Dated progress history + timeline** | Care events, photos, health checks as timestamped Firestore docs + Room cache; photo gallery on Cloudflare R2 (10 GB free, 10 GB egress free). |
| 7 | **Growth stats ("2 new leaves this month")** | Leaf‑count deltas stored per care event; monthly rollups aggregated client‑side + cached counters (no server cost). |
| 8 | **Home placement advisor** | Window direction + optional phone lux reading + Open‑Meteo sun/cloud → suitability score per species (Section 11). |
| 9 | **On‑device AI care chat / Plant Doctor** | Gemma 3 1B INT4 (~620 MB) via MediaPipe `tasks-genai` on Android; Web via Transformers.js small model. No API keys. |
| 10 | **Prompt/semantic caching for AI** | all‑MiniLM‑L6‑v2 quantized TFLite embeddings (384‑dim) + Room store; cosine ≥ 0.92 → cached answer; KV‑cache warmup at launch. |
| 11 | **Community Q&A + #Communities** | Firestore (Spark: 50 K reads, 20 K writes/day) with pragmatic indexing; hashtags as string fields; FCM for replies. |
| 12 | **Care sharing (family / sitters)** | Firestore multi‑writer rules + share tokens; FCM sync; read‑only vs read‑write roles. |
| 13 | **Toxic‑plant warnings** | Static curated toxicity flags in `species/` docs (open data); pet/child safety card. |
| 14 | **Multi‑platform web + Android (+iOS‑ready)** | React + Vite PWA on Vercel; native Android (Kotlin/Compose) distributed via GitHub Releases + F‑Droid; web components shared via TanStack Query + zod. |
| 15 | **Undo / snooze / empathy UX** | Local undo journal + toast; snooze shifts nextWaterAt; "moved to rest" not "dead" copy. |

### 1.3 Top 5 UI/UX patterns → free implementation

| # | Pattern | Implementation |
|---|---|---|
| 1 | **Short, progressive onboarding with progress bar + skip** (Planta's failure: 9 steps, no progress, radio vs checkbox confusion) | 3 steps max, each a single decision; segmented progress; "Skip" honored everywhere; set home conditions later. |
| 2 | **Action‑specific notifications** ("Water Monstera — 250 ml", not "Your plant needs you") (Planta/Greg feedback) | Notification text templated with plant name, action, and ml. |
| 3 | **Honest uncertainty (ranked candidates with scores)** (PlantNet) vs. over‑confident single answer (PictureThis) | ID screen shows top‑3 with % and "choose yours" + manual search. |
| 4 | **Emotional bond & empathy** (naming plants, graveyard, undo) (Greg/Planta) | Name‑your‑plant, photos, monthly progress prompt, "resting" state, confetti on milestones. |
| 5 | **Visual density: charts, bullets, images over prose** (Planta's "who reads text in 2025") | Care cards as icon + short line + numeric value; placement as visual diagram; timeline as photo strip + sparkline. |

---

## 2. Final Feature List (grouped by module)

### 2.1 Onboarding & Account
- O‑1 3‑step onboarding (skill level, home conditions, first plant) with progress + skip.
- O‑2 Email/Google/Apple sign‑in via Firebase Auth (Spark, unlimited).
- O‑3 Anonymous preview mode → upgrade to account without losing data.
- O‑4 Default room/profile templates ("bright living room", "shady bedroom").

### 2.2 Plant Collection
- C‑1 Add plant: photo → ID (Plant.id → TFLite → PlantNet → manual search).
- C‑2 Species care card (numeric params: lux, °C, RH%, pH, NPK, toxicity).
- C‑3 Rooms with direction, window type, lux reading, grow lights.
- C‑4 Placement advisor (suitability score per room/spot).
- C‑5 Plant naming, avatar photo, pot/soil/size metadata.
- C‑6 Wishlist + "plant market?" → excluded (avoid marketplace complexity; keep a plain wishlist).
- C‑7 Public Discover library: browse every species care card **without an account** (guest read‑only; auth only for adding to My Plants) — from gplant.

### 2.3 Care & Schedule
- S‑1 Dynamic per‑plant schedule (water/fertilise/mist/repot/prune/rotate/clean) w/ weather + season + environment modifiers.
- S‑2 Local push via WorkManager + FCM for shared care.
- S‑3 Snooze/skip/early-water with undo.
- S‑4 Care history log (timestamped; offline queue).
- S‑5 Care Share: invite family/sitter (roles), live task completion sync.
- S‑6 Household shared plants: multiple users own/act on the same plant with role assignments (owner/caregiver/viewer) — from alastairrmcneill/plant-care (upgrades S‑5).
- S‑7 Expanded care event types: water, mist, fertilize, biostimulate, repot, prune, rotate, clean — each with its own interval & log — from mdeluise/plant-it + alastairrmcneill.
- S‑8 "Time since last action" reminders: notify "not watered in 4 days" instead of fixed dates, so the user stays the decision‑maker — from mdeluise/plant-it (log‑first model).
- S‑9 Care calendar view: month grid of per‑plant tasks (water/feed/mist/…) with overdue highlighting — from CMPT362‑PlantCare.
- S‑10 Quantitative irrigation recommendation: location + next‑day weather (temp, precip, pressure) → evapotranspiration → "≈ 180 ml today (ET − rainfall)" with crop‑age factor — from yingxin‑jia (MinneHack). Feeds §10.2.

### 2.4 Plant Doctor & AI
- D‑1 Photo diagnosis: PlantVillage TFLite + Plant.id health_auto + symptom rule engine.
- D‑2 Symptom dialogue ("which leaves are affected? soil moist? light?") — on‑device.
- D‑3 On‑device chat assistant (Gemma 3 1B / Llama 3.2 1B) grounded in the plant's own care card + RAG.
- D‑4 Semantic answer cache (embeddings ≥ 0.92 cosine) → instant, zero‑compute repeats.

### 2.5 Progress & History
- P‑1 Timeline feed per plant (events + photos + health checks).
- P‑2 Growth gallery (photo‑a‑month prompts, before/after slider).
- P‑3 Stats: water frequency trend, new leaves/month, health streaks.
- P‑4 Export own data (JSON) — privacy.
- P‑5 Sortable dashboard: sort My Plants by **next watering date** or **care level**, filter by room — from layekmia + taanzzz.

### 2.6 Community (Phase 3)
- M‑1 #Communities hashtag channels (cheap, string‑based).
- M‑2 Q&A with attached Plant Card context; answers by community.
- M‑3 Feed of "Moments" (photos); report/moderation toolkit.

### 2.7 System & Trust
- T‑1 Donate button (links only; no feature gating).
- T‑2 Privacy: all AI on‑device; photo storage on user‑scoped R2; data export + delete.
- T‑3 Accessibility (WCAG AA, dark mode, reduced motion, dynamic type).
- T‑4 Offline‑first: full local DB, sync on connect.
- T‑5 Image compression: downscale + WebP/AVIF re‑encode before upload (≤150 KB/photo) — from pgrzel.

### 2.8 Gamification & Engagement (free, cosmetic‑only)
- G‑1 XP + health streaks from completed care events (logged on‑device, no server cost).
- G‑2 Virtual currency earned purely by care consistency (never purchasable).
- G‑3 Cosmetic item shop: pot styles, themes, stickers, virtual greenhouse upgrades — no real‑money purchases, no pay‑to‑win (repurposed "Market" idea from CODINATA).
- G‑4 Random & special events with choices that affect the virtual plant's wellbeing — from Spyderdreams (e.g., "sudden heatwave → shade or water more?").
- G‑5 All gamification state local‑first; optional cross‑device sync — keeps Firestore writes ≤ budget (§17.1).

---

## 3. Design System & UI/UX

### 3.1 Brand & tone
Calm, inclusive, eco‑conscious. Copy is gender‑neutral, plain‑language, never shaming ("let's check your Monstera", not "you overwatered again"). Death = "moved to rest". Donations = "support Silvae".

### 3.2 Color tokens

| Token | Light | Dark | Usage | AA on bg |
|---|---|---|---|---|
| `bg` | `#F6F4EC` warm ivory | `#121A15` deep forest | app background | — |
| `surface` | `#FFFFFF` | `#1C2720` | cards | — |
| `primary` (fern) | `#3E7C56` | `#6FBF94` | CTAs, active states | 4.7:1 on white / 4.9:1 on dark |
| `secondary` (sage) | `#6E8F72` | `#9CBB9F` | secondary buttons | ≥4.5:1 |
| `ink` | `#24302A` | `#E9F0EB` | body text | 12+:1 |
| `ink-muted` | `#5B6A61` | `#B7C6BC` | secondary text | ≥4.5:1 |
| `accent-terra` | `#C97C5D` | `#E0A184` | highlights, badges | ≥3:1 (large/non‑text ok) |
| `accent-sun` | `#D9A13B` | `#E8C469` | milestones, stars | ≥3:1 |
| `success` | `#2E7D57` | `#6FBF94` | done states | ≥4.5:1 |
| `danger` | `#B4442F` | `#E58A74` | destructive | ≥4.5:1 |

Accessibility contract: body text always ≥4.5:1; decorative gradient/photo overlays carry dark scrim ≥0.35 opacity; never color‑only signals (icons + labels accompany color).

### 3.3 Typography (Google Fonts, free)
- **Display / headings:** *Fraunces* (organic serif, 520–700 weight) — brand identity.
- **UI / body:** *Inter* (400/500/600/700).
- Scale: 12/14/16/20/24/32/48 px; line‑height 1.5 body, 1.2 headings; letter‑spacing −0.01em headings.

### 3.4 Layout & components
- 4‑pt grid; card radius 16 px; inner padding 16 px; 48 dp min touch target; bottom nav ≤5 items: **Today · Plants · Scan · Community · Profile**.
- Components (design‑system folder, Storybook for web): `Button` (primary/secondary/ghost/destructive), `Card`, `StatChip`, `CareTraitBar` (lux/°C/RH bar showing "your home" marker), `TimelineItem`, `PhotoStrip`, `SuitabilityGauge`, `LeafProgress`, `Toast` (with Undo), `ConfettiBurst`, `PlacementMap`.

### 3.5 Micro‑interactions (CSS/Compose, no libs)
- **Leaf‑scan animation:** camera shutter → pulsing ring → SVG leaf grows/snaps into place → result card slides up (600 ms ease‑out).
- **Task complete:** soft check + confetti when a plant hits a milestone (7/30/90 days alive; 10 new leaves).
- **Idle life:** plant avatar gently sways (2 s loop, `prefers-reduced-motion` disables).
- **Haptics** (Android): completion = light tick; diagnosis warning = double tap.

### 3.6 User flows (text specs)
1. **Onboarding** → welcome → (skip allowed) → skill level (3 chips) → home profile (select from templates or custom: window directions, grow lights) → first plant teaser → Home.
2. **Add plant** → Scan (camera/upload) → scanning animation → top‑3 species cards (confidence %) → pick or search → care summary → optional lux/room config → named & saved → confetti.
3. **Daily care** → Today list (plant card: task, ml, due) → tap → do‑it screen (big action, undo) → timeline updates → next due computed.
4. **Plant Doctor** → symptom picker (photo, affected parts, soil, light) → on‑device diagnosis → treatment steps → offer chat follow‑up (local AI).
5. **Timeline** → filter chips (All/Water/Photos/Health) → photo month grid → tap photo → before/after slider.
6. **Placement** → choose room → drag plant between spots → each spot shows suitability % & best‑to‑worst ranking → save.

### 3.7 Accessibility & inclusion checklist
- WCAG 2.1 AA (contrast above, focus ring 2 px offset, aria labels, semantic HTML, Compose `testTags` + a11y).
- Dark mode from system; manual override in settings.
- Dynamic type (web: rem; Android: `FontScaleMatcher`).
- `prefers-reduced-motion` honored.
- Copy style guide in `docs/CONTENT.md` (gender‑neutral, no ableist metaphors, plain language, localized placeholders).

---

## 4. Handoff & Continuity Guide

> Read this first. It condenses every decision a successor (human or LLM) needs.

### 4.1 Architectural decisions (and why)
| # | Decision | Rationale |
|---|---|---|
| A1 | **Firebase Auth + Firestore on Spark** (no card) | Unlimited email/Google/Apple/anonymous auth; Firestore 1 GiB / 50 K reads / 20 K writes per day. Read costs cut by local‑first caching. |
| A2 | **NO Cloud Functions / Cloud Storage on Spark** — since Feb 2026 both require Blaze (a card). Instead: **Vercel serverless** for all backend logic and **Cloudflare R2** for photo blobs. | Honors the no‑card promise. Vercel Hobby + R2 free tier are card‑free. *(This corrects the original brief's assumption that Cloud Functions/Storage run free on Spark.)* |
| A3 | **Local‑first (offline‑first) everywhere.** Room (Android) / IndexedDB + Dexie (web) is source of truth; Firestore is the sync layer. | Cuts Firestore reads/writes by ~80%, gives instant UI, works offline. |
| A4 | **Push: local WorkManager primary, FCM only for share/community.** | No server cron needed for timezone‑correct reminders; avoids FCM scheduling complexity. |
| A5 | **AI fully on‑device.** No LLM API. Gemma 3 1B (Android, MediaPipe), Web‑LLM/Transformers.js (web, optional download). Semantic cache with all‑MiniLM‑L6‑v2 embeddings. | $0 inference, privacy, works offline. |
| A6 | **ID pipeline: Plant.id proxy (cached) → PlantNet → TFLite → manual.** | Plant.id ~100/day free; cache makes it stretch; TFLite covers offline + bursts. |
| A7 | **Web is a PWA** (installable, offline) and the reference implementation; native Android shares domain models via generated OpenAPI client. | One business‑logic core, two shells. |
| A8 | **Monorepo (npm workspaces) `apps/*` + `packages/*`.** | Shared DTOs, validation, care engine reused by web + Vercel functions; Android keeps its own Kotlin copies generated from JSON schema. |
| A9 | **CI: GitHub Actions only (public repo).** Lint → typecheck → unit → build web → build APK (signed debug for F‑Droid/releases). | 2000 free minutes/mo on public repos. |
| A10 | **Monetisation = none.** Donate button links only. No analytics SDKs that monetise data. | Brand trust; also reduces egress. |

### 4.2 Repository layout (monorepo)

```
silvae/
├─ apps/
│  ├─ web/                  # React + Vite + TanStack Query + Dexie (PWA)
│  └─ android/              # Kotlin + Jetpack Compose (MVVM, Clean Architecture)
│     ├─ app/src/main/java/org/silvae/
│     │  ├─ data/           # Room, Firestore repo, R2 upload, repositories
│     │  ├─ domain/         # use cases, entities, care engine
│     │  ├─ di/             # Hilt modules
│     │  ├─ ml/             # TFLite interpreters, Gemma engine, embeddings cache
│     │  ├─ ui/             # Compose screens + theme
│     │  └─ notifications/  # WorkManager + FCM
│     └─ app/src/main/assets/models/   # *.tflite (+ checksums)
├─ packages/
│  ├─ core/                 # shared TS: DTOs (zod), care engine, weather math, placement
│  ├─ api/                  # OpenAPI spec + generated client (web)
│  └─ db/                   # Firestore schema + rules + indexes (source of truth)
├─ server/
│  └─ functions/            # Vercel serverless (TS): plant-id proxy, weather proxy, share/notify
├─ data/
│  ├─ species/              # seeded care dataset (JSON, per-species)
│  └─ disease/              # symptom→disease mapping tables
├─ ml/                      # training/eval notebooks + conversion scripts (Colab, free)
├─ docs/                    # this blueprint, CONTENT.md (copy), SECURITY.md
├─ .github/workflows/       # CI
└─ firebase.json            # Firestore rules + indexes
```

### 4.3 Environment variables (all free, none cost money)
| Var | Owner | Purpose |
|---|---|---|
| `PLANT_ID_API_KEY` | Vercel server env | Plant.id v3 identifications (free key from web.plant.id) |
| `PLANTNET_API_KEY` | Vercel server env | PlantNet fallback (free key from my.plantnet.org) |
| `FIREBASE_SERVICE_ACCOUNT` (JSON) | Vercel server env | FCM HTTP v1 + admin SDK for share/notify |
| `VITE_FIREBASE_CONFIG` | web build env | Firebase web app config (public, safe) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Vercel server env | Photo blob storage (free) |
| `OPEN_METEO_BASE` | default const | `https://api.open-meteo.com` (no key) |
| `HF_TOKEN` (optional) | Android BuildConfig (dev only) | Model download from gated HF repos (Gemma licence) |

**Never** commit `.env*`, service accounts, or keys. All are free‑tier but still secrets.

### 4.4 Conventions
- **TS:** strict mode; zod for every DTO; no `any`; `npm run typecheck` gates PRs.
- **Kotlin:** Clean Architecture layers (data→domain→ui); coroutines + Flow; Hilt DI; no business logic in Compose.
- **Commits:** Conventional Commits; PR title = feature; squash merge.
- **Branching:** `main` protected; feature branches; PR requires green CI.
- **Firestore:** every rule change ships with emulator tests in CI.
- **Data:** species keys = lower‑snake scientific name (`monstera-deliciosa`); enums in constants, never raw strings in logic.
- **Model updates:** models live in `ml/`; a `models.json` manifest pins URL + sha256 + version; Android downloads on first launch (not in APK, to keep APK < 150 MB).

### 4.5 Environment/tooling (free)
Node 20 LTS, pnpm, Vite, Android Studio (free), Kotlin 2.x, Gradle wrapper, Firebase CLI + emulator, Vercel CLI, GitHub CLI, TensorFlow Lite, MediaPipe `tasks-genai`, Python 3.11 (Colab) for ML.

---

## 5. System Architecture

### 5.1 Text diagram

```
┌────────────────────────────── SILVAE CLIENT (web PWA / Android) ──────────────────────────────┐
│  UI (Compose / React)                                                                          │
│    ▲                                                                                           │
│  ViewModels / State (MVVM) ── Domain Use Cases                                                 │
│    ▲                                   │                                                       │
│  Repositories (local‑first) ──────────┼───────────────────────────┐                            │
│    │ Room/Dexie (source of truth)    Care Engine (schedule,       │ Placement Advisor         │
│    │ Firestore sync layer            placement, progress)         │ (window, lux, weather)    │
│    │ R2 upload (photos)                                            │                            │
│  ── On‑device ML ───────────────────────────────  ────────────────────────────                 │
│   Species TFLite (1081 sp)   PlantVillage TFLite (38)   Gemma 3 1B (chat)                     │
│   all‑MiniLM L6v2 (embeddings → semantic cache)   CameraX / WebCamera                          │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
        │ HTTPS (REST)                    │ Firestore SDK                 │ FCM
        ▼                                ▼                               ▼
┌────────────── VERCEL (Hobby, card‑free) ─────────────┐        ┌─────────────────────────┐
│  /api/identify        → Plant.id v3 proxy + cache    │        │ Firebase Auth (Spark)  │
│  /api/weather         → Open‑Meteo proxy + cache     │        │ Firestore (Spark)      │
│  /api/share           → FCM notify caretakers        │        │ 1 GiB · 50K R · 20K W  │
│  /api/r2-upload       → presigned R2 PUT             │        │ FCM (unlimited, free)  │
│  Cron (≤1/day)        → weekly digest + prune cache  │        │ Hosting (static, free) │
└──────────────────────────────────────────────────────┘        └─────────────────────────┘
        │ S3‑compatible
        ▼
┌────────────────────────────── CLOUDFLARE R2 (free) ──────────────────────────────┐
│ public read bucket (r2.dev) for user photos · 10 GB storage · 10 GB egress free │
└──────────────────────────────────────────────────────────────────────────────────┘
        │ HTTPS (no key)
        ▼
   Open‑Meteo (10 K/day) · Plant.id (~100/day) · PlantNet (free tier) · HuggingFace (models)
```

### 5.2 Data flows
1. **Identify plant:** App captures photo → (a) embed local image, run species TFLite → top‑3; (b) if online & cache miss, POST `/api/identify` (Vercel) which checks Firestore `idCache` (md5 of downscaled image) → on miss calls Plant.id v3 `identify` (modifiers `health_auto`, details) → stores result in `idCache` → returns. UI merges server + local candidates.
2. **Water plant:** App writes `care_events` to Room → computes next schedule locally → pushes task to WorkManager → syncs compact event to Firestore (batch). FCM alert only if a caretaker is involved.
3. **Placement:** Room query + Open‑Meteo (cached 3 h) sun position → score per spot → UI gauge.
4. **Doctor:** symptom rules (local) → if photo, PlantVillage TFLite → optional Plant.id `health_auto` (spends credit only when unhealthy) → treatment steps → chat (Gemma) with RAG over species card → semantic cache lookup first.
5. **Care share:** inviter creates share token → invitee opens → Firestore permissions grant write to `plants/*` → task completions write events + FCM notify.

### 5.3 Offline strategy
- All user data mirrored in Room/Dexie; UI renders from local store; Firestore sync via a queue (pull‑based, exponential backoff, resume on connectivity).
- Photo uploads: enqueue; retry on connect; thumbnails generated on device (no server compute).
- ML: species/disease classifiers bundled; chat model downloaded once (Wi‑Fi only toggle) and cached; semantic cache local.
- Degradation ladder: online+server → online+local model → offline+local model → manual search → offline manual care card.

### 5.4 Prompt caching layer (local AI) — detail
- **Embedding index:** all‑MiniLM‑L6‑v2 quantized TFLite (384‑dim). Every user question → embedding stored with answer in Room `ai_cache(plantId, q_emb BLOB, answer, created_at, hits)`.
- **Retrieval:** cosine similarity; threshold 0.92 exact‑semantic reuse → instant answer, zero inference. Below 0.92 → run Gemma.
- **Context assembly (token efficiency):** RAG over species care card + disease docs, chunked ≤ 96 tokens; retrieve top‑3 chunks by embedding cosine; system prompt pre‑filled **once** and KV‑cache warmed at app launch (first‑message latency 15 s → <1 s on Snapdragon 8 class).
- **Budgeting:** max output tokens 256; answer templates for common intents; cache hit rate target ≥ 40%.
- **Privacy:** nothing leaves the device.

### 5.5 All‑free services integration summary
| Need | Service | Role |
|---|---|---|
| Auth | Firebase Auth Spark | identity, anonymous→upgrade |
| DB | Firestore Spark | sync, community, share, idCache, weatherCache |
| Backend | Vercel Hobby | proxies, presigned URLs, share/notify, cron |
| Blobs | Cloudflare R2 | plant photos |
| Push | FCM + WorkManager | local first, cloud second |
| Weather | Open‑Meteo | forecast + sun + soil |
| ID | Plant.id (proxy+cache) | primary cloud ID |
| ID fallback | PlantNet API + TFLite | cloud fallback + offline |
| Chat AI | Gemma 3 1B (MediaPipe) / Transformers.js | on‑device doctor chat |
| Embeddings | all‑MiniLM‑L6‑v2 TFLite | semantic cache + RAG |
| CI/CD | GitHub Actions, Vercel | build, test, deploy |
| Hosting | Vercel (web) + GitHub Releases/F‑Droid (APK) | distribution |
| Analytics | Privacy‑first: Firebase Analytics (optional off) or none | keep it minimal |

---

## 6. Complete Free Tech Stack

> Every row: free tier, exact limit, and the mitigation that keeps us under it forever.

| Layer | Choice | Free tier | Mitigation to stay free forever |
|---|---|---|---|
| Identity | **Firebase Auth (Spark)** | Unlimited email/password, Google, Apple, GitHub, anonymous. No card. | No per‑user cost ever. |
| Database | **Firestore (Spark)** | 1 GiB stored · 50 K reads/day · 20 K writes/day · 20 K deletes/day · 10 GiB egress/mo | Local‑first cuts reads ~80%; compact docs; batch writes; daily rollups instead of event scans; TTL/prune caches; see §17 math. |
| Backend | **Vercel Hobby (serverless TS)** | Card‑free hobby tier; functions + cron (≤1/day on Hobby) + 100 GB bandwidth/mo | All hot endpoints behind caching (Plant.id/weather results cached in Firestore); functions only hit on cache miss; weekly digest cron is 1/day. |
| Object storage | **Cloudflare R2** | 10 GB storage · 10 GB egress/mo · 1 M Class‑A · 10 M Class‑B ops | Photos are downscaled/compressed on‑device (~150–400 KB); public bucket via r2.dev; presigned uploads; egress is free anyway. |
| Push | **FCM** + **WorkManager** | FCM unlimited & free | Primary reminders are local (zero server calls); FCM only for share/community/feed. |
| Weather | **Open‑Meteo** | 10 K calls/day · 5 K/hr · 600/min · no key · CC‑BY‑4.0 (non‑commercial) | Per‑location cache 3 h in Firestore (`weatherCache`); placement + schedule reuse same payload; ~1 call/user/day worst case → 10 K users/day is the hard ceiling, cache makes it ~1 call per 100 users/day. |
| Plant ID (cloud) | **Plant.id v3 API** | Free key, ~100 IDs/day; `health_auto` costs extra credit only when unhealthy | Server proxy stores every result in `idCache` keyed by image fingerprint; identical/duplicate photos cost 0; TFLite handles most common species offline; PlantNet is secondary; manual search covers long tail. Combined budget ≈ 100 fresh cloud IDs/day shared by all users. |
| Plant ID (fallback) | **PlantNet API** | Free key (my.plantnet.org); quota ≈ 500 req/day | Same proxy+cache pattern; used only when Plant.id is exhausted. |
| ID offline | **TFLite MobileNetV3‑Small (PlantNet‑300K)** | OpenRAIL weights, ~10 MB, 1,081 species | Bundled asset / model manifest download; no per‑call cost; primary path for common houseplants. |
| Disease offline | **TFLite MobileNetV3‑Large (PlantVillage 38‑class, int8)** | Apache‑2.0, ~4–6 MB | On‑device; note: trained on crop leaves — combine with symptom rule engine for houseplants. |
| Chat AI | **Gemma 3 1B INT4 (MediaPipe `tasks-genai`)** Android; **Transformers.js/Web‑LLM** web | Open weights (gated licence, free); ~620 MB download | Wi‑Fi‑only opt‑in download; KV‑cache warmup; semantic cache ≥40% hits; 256‑token answers. |
| Embeddings | **all‑MiniLM‑L6‑v2 TFLite (int8)** | Apache‑2.0, ~23 MB / ~6 MB int8, 384‑dim | On‑device; enables RAG + semantic cache. |
| Training/ML tooling | **Google Colab free + TensorFlow/PyTorch** | Free GPU hours, resets | Retrain/convert models yearly; free. |
| Web hosting | **Vercel (web app) + Firebase Hosting optional** | Hobby: 100 GB bandwidth/mo · Firebase Hosting: 10 GB storage + 10 GB transfer | PWA static assets + code‑split; aggressive `Cache-Control`; brotli. |
| APK distribution | **GitHub Releases + F‑Droid** | Free | No Play‑Store fee; Play optional later ($25 one‑time, not a subscription — a user decision, not a service cost). |
| CI/CD | **GitHub Actions** | 2,000 min/mo (public repo) | PR‑gated lint/type/test ~4 min/run; Android build only on tags. |
| Analytics | **Firebase Analytics (Spark, free)** (opt‑in) | Unlimited free | Minimal events; anonymous by default; no ad SDKs. |
| Maps (optional, placement) | **Open‑StreetMap tiles / Leaflet** | Free | Avoid Google Maps paid API; use OSM + `navigator.geolocation` for lat/lng. |
| Vector search (optional) | **Firestore `vector` field** (Spark‑eligible) or local cosine | Free | On‑device embeddings; server vector search only if needed later. |

> **Rule of thumb:** the only shared, exhaustible pools are Plant.id (~100/day) and Open‑Meteo (10 K/day). Everything else scales with our own storage/read discipline. §17 shows the arithmetic.

---

## 7. Database Schema (Firestore)

### 7.1 Collections & documents

```text
users/{uid}
  { email?, name?, photoUrl?, createdAt, settings:{ darkMode, notifyWatering, notifyShare, locale },
    home:{ lat, lng, timezone, homeType }, profile:{ skillLevel } }

species/{slug}                                  // canonical care card (seeded, read‑only)
  { commonNames: string[], scientificName, family, toxicity:{ pets:boolean, note? },
    ideal:{ luxMin, luxIdeal, luxMax, tempMinC, tempMaxC, humidityMin, humidityMax,
            phMin, phMax, npk:{n,p,k}, waterIntervalDays, waterAmountMl,
            fertIntervalDays, mistIntervalDays, repotIntervalMonths },
    tolerance:{ drought, shade, cold }, growth:{ rate, maxHeightCm },
    diseaseNotes:[{ symptom, likelyCause, treatment }], sources:[url], version }

rooms/{roomId}
  { uid, name, windowDirection: "N"|"NE"|...|"NW", windowType: "curtains"|"sheer"|"none",
    obstacleMeters, hasGrowLight, luxMeasured?, avgTempC?, avgHumidity?, createdAt }

plants/{plantId}
  { uid, roomId?, speciesSlug, name, avatarUrl?, potType, potSizeCm, soilType,
    distanceToWindowM, luxEstimate?, growLightHours?, placementScore?,
    schedule:{ lastWateredAt, waterIntervalDays, nextWaterAt, lastFertAt, nextFertAt,
               lastMistAt, nextMistAt, lastRepotAt, nextRepotAt },
    stats:{ leafCount, lastLeafCountAt, streakDays, healthySince },
    createdAt, updatedAt }

care_events/{eventId}                          // compact, offline‑synced
  { uid, plantId, type: "WATER"|"FERT"|"MIST"|"REPOT"|"PRUNE"|"ROTATE"|"CLEAN"|"CHECK"|"NOTE",
    at (server Timestamp), amountMl?, leafCountDelta?, notes?, weather:{ tempC, rh, uvIndex }? }

photos/{photoId}
  { uid, plantId, url (R2), thumbUrl, at, note?, isProgressPhoto:boolean }

health_checks/{checkId}
  { uid, plantId, at, isHealthy, isHealthyProbability, disease?, diseaseClass?,
    confidence, treatment?, imageUrl?, method: "TFLITE"|"PLANTID"|"RULES"|"MANUAL" }

summary_stats/{plantId_month}                  // rollups to avoid event scans
  { plantId, month: "2026-07", waterCount, fertCount, photos, newLeaves, avgIntervalDays,
    healthIssues, updatedAt }

id_cache/{md5ImageFp}                          // Plant.id / PlantNet responses
  { fingerprint, species, top:[{slug,score}], health?, source, createdAt, ttl, hits }

weather_cache/{key}
  { key: "lat_lng", payload, fetchedAt, expiresAt }

share_links/{token}
  { plantIds:[], role:"READ"|"WRITE", invitedUid?, expiresAt, createdBy }
```

### 7.2 Required composite indexes (Firestore)
```text
care_events:  (plantId ASC, at DESC)          // timeline
photos:       (plantId ASC, at DESC)          // gallery
health_checks:(plantId ASC, at DESC)          // health timeline
care_events:  (uid ASC, at DESC)              // global "recent activity" for feed
plants:       (uid ASC, updatedAt DESC)       // collection ordering
summary_stats:(plantId ASC, month ASC)        // stats queries
id_cache:     (createdAt ASC)                 // pruning TTL sweep
```
Deploy via `firebase.json` → `firestore.indexes` (code‑reviewed, emulator‑tested).

### 7.3 JSON examples
```json
// plants/monstera-ab12
{
  "uid": "user_123",
  "roomId": "rooms/living",
  "speciesSlug": "monstera-deliciosa",
  "name": "Monty",
  "avatarUrl": "https://pub-xxxx.r2.dev/users/user_123/plants/monty/avatar.webp",
  "potType": "terracotta", "potSizeCm": 24, "soilType": "aroid-mix",
  "distanceToWindowM": 1.2, "luxEstimate": 1500,
  "schedule": {
    "lastWateredAt": "2026-07-30T08:12:00Z", "waterIntervalDays": 7.5,
    "nextWaterAt": "2026-08-06T20:00:00Z"
  },
  "stats": { "leafCount": 14, "streakDays": 92 }
}

// care_events/evt_water_001
{ "uid": "user_123", "plantId": "plants/monstera-ab12",
  "type": "WATER", "at": "2026-07-30T08:12:00Z", "amountMl": 500,
  "weather": { "tempC": 26, "rh": 62, "uvIndex": 3 } }
```

### 7.4 Anti‑read‑cost design
- Timeline UI reads from **local Room/Dexie**; Firestore `care_events` is the durable sync copy.
- "2 new leaves this month" comes from `summary_stats/{plantId_month}` (1 read), not an event scan.
- `id_cache` / `weather_cache` have `ttl`/`expiresAt`; a Vercel cron (or client opportunistic prune) deletes expired rows (counts against 20 K deletes/day, negligible).

---

## 8. API & Integration Details

### 8.1 Internal endpoints (Vercel serverless, TS, zod‑validated)
| Endpoint | Method | Behaviour |
|---|---|---|
| `/api/identify` | POST | Body: `{ imageDataUrl?, imageFp?, speciesHints? }`. 1) Downscale to 512px on server. 2) Lookup `id_cache` by fingerprint → hit returns cached. 3) Miss → call Plant.id v3 `identify` (`modifiers:["health_auto"]`, `plant_details:[common_names, wiki_description, taxonomy]`). 4) On quota/network failure → fall back to PlantNet `/v2/identify`. 5) Persist `id_cache`, merge local‑TFLite candidates, return. |
| `/api/weather` | GET | Params `lat,lng`. Cache in `weather_cache` (TTL 3 h) keyed `lat_lng` rounded to 2 decimals. Payload: `daily` (temp, precip, sunshine, uv) + `hourly` (temp, rh, cloud_cover) + `daily_sunshine`. Uses Open‑Meteo. |
| `/api/r2-upload` | POST | Body `{ path, contentType }` → returns presigned PUT URL (5 min) + public GET URL. Uploads happen device→R2 directly (no egress through Vercel). |
| `/api/share` | POST | Body `{ plantId, inviteeEmail|shareToken }`. Validates owner → creates `share_links`, adds invitee write permission → FCM notify invitee. |
| `/api/notify` | POST | Body `{ tokens, notification }`. FCM HTTP v1 multicast for share/community/feed (not watering). |
| `/api/feedback` | POST | Anonymous feedback/contact (Firestore `feedback` collection). |
| `/api/cron/weekly` | CRON (≤1/day) | Weekly care digest to opted‑in users (FCM), prune expired `id_cache`/`weather_cache`, generate weekly `summary_stats` for stale months. |

Request schemas live in `packages/api/openapi.yaml`; a typed client is generated for web; Android uses its own small HTTP layer (Ktor) mirroring the same contracts (documented in OpenAPI).

### 8.2 External integrations
- **Plant.id v3** — `POST https://plant.id/api/v3/identification` (access‑token model). Request: `{ images:[url], modifiers:["health_auto"], plant_details:[...], disease_details:[...] }`. Credits: 1/ID; +1 if `health_auto` returns a diagnosis. **Rate handling:** queue per 5‑min window (in‑memory + Firestore lease), never exceed 100/day; on 429 → PlantNet fallback, then TFLite + mark degraded.
- **PlantNet** — `POST https://my-api.plantnet.org/v2/identify/{project}?api-key=...` (1–5 images). Used as secondary. Same cache.
- **Open‑Meteo** — `GET /v1/forecast?latitude=&longitude=&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration,uv_index_max&hourly=temperature_2m,relative_humidity_2m,cloud_cover&timezone=auto`. No key. Client‑side cache 3 h.
- **Firebase Admin (Vercel)** — FCM HTTP v1 (service‑account OAuth token, cached 50 min), Firestore admin writes (id_cache, share_links, feedback, summary).
- **R2** — S3‑compatible presigned PUT (`s3:PutObject`, 5‑min expiry, content‑type lock, size ≤ 5 MB, path scoped `users/{uid}/...`); public GET via r2.dev bucket domain.

### 8.3 Rate‑limit & queue handling
- Shared pools are only touched from Vercel (single point of accounting) — never from clients.
- In‑memory token bucket + Firestore counter doc per pool (`limits/plantid`: `{usedToday, day}`) with optimistic compare‑and‑set; on exhaustion mark degraded mode (TFLite only) and surface a subtle banner.
- WorkManager/IndexedDB queues client uploads & syncs with backoff (2 s → 5 min) and connectivity gate.

---

## 9. Machine Learning Pipeline

### 9.1 Layers (primary → fallback)

```
 USER PHOTO
   │
   ├─[A] On‑device Species Classifier (TFLite, PlantNet‑300K MobileNetV3‑Small, 1081 sp, ~10 MB)
   │      → top‑3 candidates + scores (always available, offline, free)
   │
   ├─[B] Cloud Identify (Vercel proxy, cached) — Plant.id v3 (100/day) → PlantNet (500/day)
   │      → top‑5 candidates + health_auto diagnosis + wiki/taxonomy
   │      → only on cache miss (image fingerprint md5)
   │
   └─[C] Manual search + community confirmation (long tail)
         → user picks; we record feedback to improve ranking locally

 HEALTH/PHOTO
   ├─[A2] PlantVillage TFLite (38 classes, int8) — disease screening (crop leaves best)
   ├─[B2] Plant.id health_auto (credits only when unhealthy)
   └─[C2] Symptom rule engine (local) — weighted evidence table (§10.3)

 CHAT/DOCTOR
   ├─[A3] Semantic cache (all‑MiniLM‑L6‑v2) — cosine ≥ 0.92 → cached answer
   ├─[B3] RAG over species card + disease docs (top‑3 chunks)
   └─[C3] Gemma 3 1B INT4 (MediaPipe) streaming answer (max 256 tok)
```

### 9.2 Model inventory (all free/open)

| Model | Source | Size | Task | License |
|---|---|---|---|---|
| `plantnet300k_mobilenetv3_small` | cpoisson/plantnet300k‑mobilenetv3‑small (HF) → convert to TFLite (int8 PTQ) | ~10 MB | species (1,081) | OpenRAIL |
| `aiy_plants_v1` (iNaturalist) | Kaggle `google/aiy/vision-classifier-plants-v1` | ~14 MB | species (~1,000+), alternative | Apache‑2.0 |
| `plantvillage_mobilenetv3_large_int8` | Train from PlantVillage (54 K imgs, 38 cls) in Colab; or use GreenHealer pipeline | ~4–6 MB | disease screening | Apache‑2.0 / MIT |
| `all-MiniLM-L6-v2-quant.tflite` | Nihal2000/all‑MiniLM‑L6‑v2‑quant.tflite (HF) | ~6 MB | 384‑dim embeddings | Apache‑2.0 |
| `gemma-3-1b-it-int4.task` | HF `litert-community/Gemma3-1B-IT` (gated; free licence) | ~620 MB | chat/doctor | Gemma licence (free, no cost) |
| fallback: `llama-3.2-1b-instruct` GGUF (Q4_K_M) | HF + llama.cpp via `llmedge` | ~0.8 GB | chat | Llama 3.2 community licence |

### 9.3 Training / conversion (free, reproducible)
- **Species:** fine‑tune MobileNetV3‑Small on PlantNet‑300K (306 K images) in Colab; export `TFLite` int8 PTQ (representative set = 100 test images); target Top‑5 ≥ 90% on held‑out split; commit to `ml/` with `models.json` (sha256).
- **Disease:** fine‑tune MobileNetV3‑Large on PlantVillage 38‑class; int8 quantize; ~92% target.
- **Chat:** no training needed (base Gemma 3 1B); optionally LoRA fine‑tune on curated plant‑care Q&A in Colab (free T4) → merge → convert via MediaPipe `.task` (following `Gemma-on-Android` pipeline).
- **Versioning:** models pinned in `models.json`; Android downloads lazily (Wi‑Fi default); web uses Transformers.js quantized ONNX (browser WebGPU).

### 9.4 Inference wiring (Android)
- `SpeciesInterpreter` (TFLite Interpreter, NNAPI/GPU delegate fallback → CPU), input 224×224 RGB, ImageNet normalization, output softmax over 1,081 → map via `labels.txt`.
- `DiseaseInterpreter` same pattern (38 labels).
- `EmbeddingEngine` (TFLite) tokenize via bundled tokenizer; 384‑dim out.
- `GemmaEngine` (MediaPipe `tasks-genai`, scope to ViewModel, `close()` in `onCleared()`, `setPreferredBackend(GPU)`, streaming `ProgressListener`).
- All heavy work on `Dispatchers.Default`/single‑threaded native dispatcher; mock mode for emulators (`USE_MOCK_INFERENCE`).

### 9.5 Evaluation & quality gates
- CI: golden‑image tests (known species → expected top‑5), embedding cosine sanity, model size/checksum checks.
- Staging: 1,000‑image eval on Colab before bumping `models.json`.
- Feedback loop: identification "helpful/correct" votes update per‑species priors (local + anonymized counters in Firestore).

---

## 10. Species‑Specific Care Engine

### 10.1 Data model (`species/{slug}`)
Numeric, granular, never generic. Example (Monstera deliciosa):

```json
{
  "slug": "monstera-deliciosa",
  "commonNames": ["Swiss cheese plant"],
  "scientificName": "Monstera deliciosa",
  "family": "Araceae",
  "toxicity": { "pets": true, "note": "Insoluble calcium oxalates" },
  "ideal": {
    "luxMin": 1500, "luxIdeal": 2500, "luxMax": 20000,
    "tempMinC": 18, "tempMaxC": 30, "humidityMin": 50, "humidityMax": 80,
    "phMin": 5.5, "phMax": 7.0,
    "npk": { "n": 3, "p": 1, "k": 2 },
    "waterIntervalDays": 7, "waterAmountMl": 500,
    "fertIntervalDays": 14, "mistIntervalDays": 7,
    "repotIntervalMonths": 18, "rotateIntervalDays": 30
  },
  "tolerance": { "drought": "LOW", "shade": "MED", "cold": "LOW" },
  "growth": { "rate": "FAST", "maxHeightCm": 300 }
}
```
Seed source: open PlantNet taxon + curated expert tables in `data/species/*.json` (bulk import via script; schema‑validated). Target 400 common houseplants at launch, expanding from community contributions + PlantNet dataset. Pipeline (Aug 2026): `pnpm data:validate` parses `data/species/*.json` + `data/disease/symptoms.json` against `packages/core` zod schemas and fails CI on drift; `apps/web/src/lib/seed.ts` glob‑imports the same files, so the offline catalog can never diverge from the seeds (400 curated species at launch); `pnpm data:seed -- --write` bulk‑imports `species/{slug}` into Firestore.

### 10.2 Dynamic schedule algorithm (pseudo‑code)
```ts
// packages/core/src/care/schedule.ts
type Env = { tempC; rh; uvIndex; season: "winter"|"spring"|"summer"|"autumn"; daylightH }
function nextWaterAt(plant, weather, last: Date): Date {
  let d = plant.species.ideal.waterIntervalDays            // baseline
  const m = [];                                            // named modifiers (debuggable)
  // light/lux
  const lux = plant.luxEstimate ?? luxFor(plant.room) ?? 1000;
  if (lux > 5000)         { d *= 0.75; m.push("highLight:-25%"); }
  else if (lux < 500)     { d *= 1.35; m.push("lowLight:+35%"); }
  // pot & soil (evaporation)
  if (plant.potType === "terracotta") d *= 0.85;           // porous
  if (soilDrains(plant.soilType))     d *= 0.9;
  if (plant.potSizeCm > 25)           d *= 1.15;           // big pot holds water
  // weather (Open‑Meteo, cached)
  const t = weather.tempC, rh = weather.rh, uv = weather.uvIndex;
  if (t >= 30) { d *= 0.75; m.push("heat:-25%"); }
  else if (t >= 25) { d *= 0.9; m.push("warm:-10%"); }
  else if (t < 12) { d *= 1.2; m.push("cold:+20%"); }
  if (rh < 40) d *= 0.85; else if (rh > 70) d *= 1.15;
  if (uv >= 7) d *= 0.9;                                    // strong sun dries faster
  // season & growth
  if (plant.species.growth.rate === "FAST" && isGrowingSeason(plant)) d *= 0.9;
  d = clamp(d, plant.species.ideal.waterIntervalDays * 0.5, plant.species.ideal.waterIntervalDays * 1.8);
  return addDays(last, d);
}
```
- Every modifier is recorded in the UI ("High light −25% · warm −10% → water every 5.2 days") so users trust the number.
- Snooze pushes `nextWaterAt` by the snoozed delta and records the actual date; schedule recomputes from the *real* last action, never from an ignored notification.
- Early‑water ("water now") records action; algorithm learns (updates local `avgIntervalDays` prior, synced to `summary_stats`).

### 10.3 Disease → symptom mapping (rule engine)
```ts
// packages/core/src/doctor/rules.ts
const RULES = [
  { id: "overwater", weight: 4, symptoms: { leafColor:"yellow", soil:"moist", lowerLeaves:true, potHasDrainage:false },
    likelyCause: "Overwatering / root rot risk", treatment: ["Let soil dry", "Check roots", "Repot in drainage"] },
  { id: "underwater", weight: 4, symptoms: { leafCrisp:"dry-brown", soil:"dry", droop:true } },
  { id: "low-light", weight: 3, symptoms: { leafColor:"pale", stretched:true, light:"low" } },
  { id: "sunburn", weight: 3, symptoms: { leafBurn:"brown-spots", directSun:true, spotsOnExposed:true } },
  { id: "low-humidity", weight: 2, symptoms: { leafCrisp:"brown-tips", envHumidity:"low" } },
  { id: "spider-mite", weight: 3, symptoms: { webbing:true, stippling:true } },
  { id: "mealybug", weight: 3, symptoms: { whiteFluff:true, stickyResidue:true } },
  { id: "aphid", weight: 3, symptoms: { curledLeaves:true, stickyResidue:true, insects:true } },
];
function diagnose(answers): Diagnosis[] {
  return RULES.map(r => ({ r, score: sum(weights where answers match) }))
    .filter(x => x.score >= 2).sort((a,b)=>b.score-a.score).slice(0,3);
}
```
Photo signal (PlantVillage or Plant.id health) acts as a strong prior that re‑weights these rules; results always show confidence + "see a specialist if it worsens".

**Shipped (Phase 1):** D‑2 symptom dialogue live at `apps/web/src/pages/Doctor.tsx` (`/doctor`) — 8 rules driven from `data/disease/symptoms.json`, checklist bound to `SymptomsSchema`, results show confidence + treatment steps. `pnpm data:validate` enforces every rule's symptoms parse against `SymptomsSchema.strict()` (caught a real bug: sunburn used `light:"direct"` which the schema never allowed → added `directSun:boolean`).

---

## 11. Placement Advisor

### 11.1 Inputs
- Room: window direction (N/NE/E/SE/S/SW/W/NW), window type (curtain/sheer/none), obstacle distance (building/tree), grow light (lux @ distance if known), measured lux (phone sensor or manual).
- Species: `luxMin/luxIdeal/luxMax`.
- Environment: latitude, hemisphere, season, cloudiness (Open‑Meteo cached), daylight hours.

### 11.2 Algorithm
```ts
// packages/core/src/placement/advisor.ts
function estimateLux(room, spotDistM, env): number {
  const solarIndex = sunHeightFactor(lat, env.season, room.windowDirection); // 0..1
  const cloud = clamp(1 - env.cloudCover / 100, 0.25, 1);
  const windowLoss = room.windowType === "curtains" ? 0.5 : room.windowType === "sheer" ? 0.7 : 1;
  const obstacle = 1 / (1 + (room.obstacleMeters ?? 0) / 4);
  const falloff = 1 / (1 + spotDistM / 1.8);          // ~ halve every ~1.8 m
  const grow = (room.growLightLux ?? 0) / 1000;
  const base = solarIndex * cloud * windowLoss * obstacle * falloff;
  return round(base * 12000 + grow * 400);            // typical bright indoor range 200–12,000 lux
}
function suitability(species, lux): number {
  const { luxMin, luxIdeal, luxMax } = species.ideal;
  if (lux < luxMin * 0.5) return 15;                   // too dark
  if (lux < luxMin) return lerp(15, 50, lux, luxMin*0.5, luxMin);
  if (lux <= luxIdeal) return lerp(50, 95, lux, luxMin, luxIdeal);
  if (lux <= luxMax)   return lerp(95, 70, lux, luxIdeal, luxMax);
  return 40;                                           // too bright
}
```
- Output: ranked spots per room, each with est. lux, suitability % and one‑line reason ("~2,400 lux in summer sun — great for Monstera").
- If user takes a real lux reading, measured value overrides estimates.
- Seasonal note: "move 0.5 m closer to window in winter."

---

## 12. Plant Progress & History Module

### 12.1 Timeline data structure
- Source of truth: local Room tables `care_events`, `photos`, `health_checks` (Firestore mirrors). Timeline = single `ORDER BY at DESC` union query on the three tables (Room: `@Transaction` + `Flow`).
- Every event carries `at` (epoch ms), `type`, optional `leafCountDelta`, `photoUrl`, `weather` snapshot.
- Monthly rollup: `summary_stats` doc per `plantId_month`, updated transactionally when events are written (Water count, photos, newLeaves = Σ leafCountDelta, avgIntervalDays).

### 12.2 UI design
- **Timeline feed:** grouped by day; icon per type (💧🌱📷🩺✂️); expandable note; tap photo → full screen.
- **Growth gallery:** `photos` where `isProgressPhoto` → month grid; before/after slider (first vs latest).
- **Stats screen:** sparkline of water interval over time; "New leaves this month: 2" chip; "Healthy for 92 days" streak; health‑check history with confidence.
- **Prompt loop:** after 30 days, gentle notification "Monty is 1 month old — take a progress photo?" → confetti on 3‑month anniversary.

### 12.3 Aggregation query (read‑efficient)
```ts
// reads exactly ONE Firestore doc + local stats, never scans events
async function monthlyStats(db, plantId, month = "2026-07") {
  const doc = await db.doc(`summary_stats/${plantId}_${month}`).get();
  return doc.exists ? doc.data() : { waterCount: 0, photos: 0, newLeaves: 0 };
}
// "2 new leaves this month" = newLeaves field maintained at write time via increment()
```
- Client rollups from Room keep the number instant; Firestore rollup keeps it durable & shareable.

---

## 13. Security, Stability & Code Quality

### 13.1 Firestore security rules (key excerpts)
```text
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function isOwner(uid) { return request.auth != null && request.auth.uid == uid; }
    function isCaretaker(uid, plantId) {
      return isOwner(uid) ||
        (exists(/databases/$(db)/documents/plants/$(plantId)) &&
         get(/databases/$(db)/documents/plants/$(plantId)).data.uid in resource.data.shareUids);
    }
    match /users/{uid} { allow read, write: if isOwner(uid); }
    match /species/{slug} { allow read: if true; allow write: if false; }        // public, read‑only
    match /rooms/{roomId} { allow read, write: if resource.data.uid == request.auth.uid; }
    match /plants/{plantId} {
      allow create: if request.auth != null
                     && request.resource.data.uid == request.auth.uid
                     && request.resource.data.createdAt != null;
      allow read: if isCaretaker(request.auth.uid, plantId);
      allow update: if isCaretaker(request.auth.uid, plantId)
                     && request.resource.data.uid == resource.data.uid;          // owner immutable
      allow delete: if isOwner(request.auth.uid);
    }
    match /care_events/{e} {
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid
                     && isCaretaker(request.auth.uid, request.resource.data.plantId);
      allow read: if isCaretaker(request.auth.uid, request.resource.data.plantId);
    }
    match /summary_stats/{k} { allow read: if isCaretaker(request.auth.uid, resource.data.plantId);
                               allow write: if false; }                          // server‑maintained
    match /id_cache/{k} { allow read, write: if false; }                          // server‑only (admin)
    match /weather_cache/{k} { allow read: if request.auth != null; allow write: if false; }
    match /share_links/{token} {
      allow read: if request.auth != null;                                        // invitee
      allow create: if request.auth != null; allow delete: if isOwner(request.auth.uid);
    }
    match /feedback/{f} { allow create: if request.auth != null; allow read: if false; }
  }
}
```
- **No client writes to `summary_stats`, `id_cache`, `health_checks` rollups** — server/admin only, preventing quota‑cheat and tampering.
- **App Check** (Firebase, free) + anonymous auth strengthen client identity; R2 uploads scoped to `users/{uid}/…` via presigned path policy.

### 13.2 Offline sync & stability
- Sync queue with idempotency keys (`eventId`), conflict resolution: last‑writer‑wins per field with `updatedAt`, except schedule which recomputes from last action (always consistent).
- WorkManager constraints: connectivity + battery‑not‑low for photos; retry backoff; periodic (6 h) reconcile.
- Remote Config (Spark, free) toggles feature flags (e.g., "disable Plant.id" → degraded mode).

### 13.3 Testing strategy
| Layer | Tooling | What |
|---|---|---|
| Care engine / placement / rules | Vitest (TS), JUnit (Kotlin port) | property tests: schedule invariants, suitability monotonicity |
| Firestore rules | Firebase Emulator + `firebase-tools` | each rule scenario (owner/caretaker/anon) in CI |
| Repos (Room) | Robolectric/JUnit | DAO flows, sync queue, conflict tests |
| ML | golden image tests + Colab eval | species top‑5, disease labels, embedding cosine sanity |
| Web UI | Playwright E2E (free) | onboarding, add‑plant, timeline, placement flows |
| Android UI | Compose UI tests (Espresso) | happy path + a11y snapshot |
| API | Vitest + `fetch-mock` on Vercel functions | proxy caching, quota exhaustion fallback |

### 13.4 CI/CD (GitHub Actions, public repo)
- `ci.yml`: pnpm install → lint → typecheck → unit tests → build web → upload artifact (≈4 min).
- `android.yml`: on tag `v*` → assemble release APK (unsigned) → attach to GitHub Release + prepare F‑Droid metadata PR.
- `rules.yml`: `firebase emulators:exec` rule tests.
- Deploy: Vercel auto‑deploys `main` (preview per PR); production promotion manual.
- Secrets: GitHub Actions secrets + Vercel env (PLANT_ID_API_KEY, FIREBASE_SERVICE_ACCOUNT, R2 creds).

---

## 14. Deployment Plan

### Phase D0 — Foundations (day 1)
1. `git init` monorepo; add `pnpm-workspace.yaml`, `.gitignore` (never commit `.env*`), README (§16).
2. GitHub repo `silvae/silvae` (public); protect `main`.
3. Firebase project: enable **Auth** (Email/Password, Google, Apple, Anonymous), **Firestore**, **Hosting**, **FCM** — all on **Spark, no card**. Install Firebase CLI + emulator.
4. Cloudflare account → create **R2 bucket** `silvae-photos`, enable public bucket (r2.dev), create scoped token; store creds in Vercel.
5. Vercel project linked to repo; set env vars.

### Phase D1 — Backend
6. Implement `server/functions`: `/api/identify`, `/api/weather`, `/api/r2-upload`, `/api/share`, `/api/notify`, `/api/cron/weekly`.
7. Get Plant.id free key (web.plant.id/api-access-request) and PlantNet key (my.plantnet.org); set in Vercel.
8. Deploy; smoke test each endpoint; verify cache behaviour + quota accounting.

### Phase D2 — Web app
9. Build `apps/web` (React + Vite + TanStack Query + Dexie): onboarding, collection, care, timeline, placement, doctor (web AI via Transformers.js optional).
10. Configure PWA (manifest + service worker + offline shell); Lighthouse ≥ 95.
11. Deploy to Vercel; enable HTTPS; test install‑ability + offline.

### Phase D3 — Android app
12. Create `apps/android` (Kotlin + Compose, minSdk 26): auth, Room, Firestore sync, R2 upload, TFLite models, MediaPipe chat, WorkManager notifications, FCM.
13. Register app in Firebase (android package `org.silvae.app`), add `google-services.json` (dev‑only, gitignored via CI seed).
14. Build signed release APK → GitHub Release; add to **F‑Droid** (metadata PR). Optional later: Play Console ($25 one‑time — user decision).
15. Install on 2–3 physical devices; validate offline mode, notifications, camera flows.

### Phase D4 — Data & models
16. Import `data/species` (400 species) via seed script; run schema validation.
17. Convert & pin models in `models.json` (MobileNetV3 species, PlantVillage, MiniLM, Gemma task).
18. Firestore indexes + rules deployed; emulator rule tests green.

### Phase D5 — Go‑live
19. Seed content (community welcome posts, care FAQ RAG docs).
20. Announce; monitor quotas via Firebase console + Vercel usage; set Open‑Meteo/Plant.id usage dashboards.
21. Post‑launch: 30‑day bugfix sprints; collect feedback; iterate.

---

## 15. Development Roadmap

| Phase | Milestones | Exit criteria |
|---|---|---|
| **P0 (wk 1–2)** | Repo, CI, Firebase, R2, Vercel; core TS package; species seed (100) | CI green; `/api/weather` + `/api/identify` cached & tested |
| **P1 (wk 3–6)** | Web: onboarding, add‑plant (Plant.id+TFLite merge), care schedule, timeline, local‑first sync, PWA | Web end‑to‑end; Playwright suite passes; offline works |
| **P2 (wk 7–10)** | Android: auth, Room+Firestore, TFLite ID + disease, WorkManager + FCM, Compose UI mirror | Android APK on GitHub Releases; device smoke tests |
| **P3 (wk 11–14)** | Placement advisor, progress gallery + stats, Care Share, RAG+Gemma chat + semantic cache | Feature flags live; LLM latency < 2 s warmed; cache hit ≥ 40% |
| **P4 (wk 15–18)** | Community (Q&A, #Communities, Moments), moderation, feedback; App Check; hardening | All §2 modules shipped; rule tests; privacy export/delete |
| **P5 (ongoing)** | Model refresh (Colab), species dataset growth via community, a11y audit, translation i18n | Quarterly model bump; ≥400 species; WCAG AA re‑audit |

---

## 16. Code Snippets

### 16.1 Firebase Auth (web)
```ts
import { getAuth, signInWithPopup, GoogleAuthProvider, signInAnonymously } from "firebase/auth";
const auth = getAuth();
export async function startAnon(): Promise<void> {
  await signInAnonymously(auth);                       // preview mode, upgrade later
}
export async function googleSignIn(): Promise<void> {
  await signInWithPopup(auth, new GoogleAuthProvider());
}
```

### 16.2 Plant ID cloud function (Vercel, TS)
```ts
// server/functions/identify.ts
import { admin, db, plantIdApi } from "./lib";
import crypto from "node:crypto";

export default async function identify(req, res) {
  const { imageFp } = req.body;                        // fingerprint computed client-side
  const cache = await db.doc(`id_cache/${imageFp}`).get();
  if (cache.exists) return res.json(cache.data());     // 0 credits spent
  try {
    const result = await plantIdApi.identify(req.body.imageDataUrl); // health_auto
    await db.doc(`id_cache/${imageFp}`).set({ ...result, createdAt: admin.firestore.FieldValue.serverTimestamp(), ttl: ttlFor(result) });
    res.json(result);
  } catch (e) {
    if (isQuotaExhausted(e)) { res.status(503).json({ degraded: true, reason: "plantid-quota" }); }
    else throw e;
  }
}
```

### 16.3 Plant ID screen hook (web)
```tsx
function useIdentify() {
  return useMutation({
    mutationFn: async (image: File) => {
      const fp = await fingerprint(image);             // downscale + md5
      const local = await runTfliteSpecies(image);     // on-device top-3
      const remote = fp && (await api.identify(fp)).ok
        ? await api.identify({ imageDataUrl: toDataUrl(image), imageFp: fp }) : null;
      return mergeCandidates(local, remote?.top ?? []);
    },
  });
}
// UI shows <CandidateCard rank name score onPick onSeeMore confidence />
```

### 16.4 TFLite inference (Android)
```kotlin
// ml/SpeciesInterpreter.kt
class SpeciesInterpreter(context: Context, labels: List<String>) {
  private val tflite = Interpreter(loadModel(context, "species_mobilenetv3.tflite"), Interpreter.Options().apply {
    setNumThreads(4); addDelegate(NnApiDelegate())       // GPU/NNAPI w/ CPU fallback
  })
  fun classify(bitmap: Bitmap): List<Prediction> {
    val input = preprocess(bitmap)                        // 224x224, /255, imagenet norm
    val out = Array(1) { FloatArray(labels.size) }
    tflite.run(input, out)
    return out[0].mapIndexed { i, s -> Prediction(labels[i], s) }
      .sortedByDescending { it.score }.take(3)
  }
  private fun preprocess(b: Bitmap): Array<Array<Array<FloatArray>>> { /* crop+scale */ }
}
```

### 16.5 History / "new leaves this month" query (Firestore + Room)
```kotlin
// data/repo/StatsRepository.kt
fun monthlyStatsFlow(plantId: String, month: String): Flow<MonthlyStats> =
  room.summaryDao().observe(plantId, month).combine(
    fs.subscribe(`summary_stats/${plantId}_$month`)
  ) { local, remote -> merge(local, remote) }
// SummaryDao.kt
@Query("SELECT SUM(leafCountDelta) AS newLeaves, COUNT(*) AS waterCount FROM care_events WHERE plantId=:p AND type='WATER' AND strftime('%Y-%m', at) = :m")
fun summaryFor(p: String, m: String): Flow<MonthlyStats>
```

### 16.6 Firestore rules (see §13.1) + index file
```json
// firebase.json → firestore.indexes (excerpt)
{ "indexes": [
  { "collectionGroup": "care_events", "queryScope": "COLLECTION",
    "fields": [ { "fieldPath": "plantId", "order": "ASCENDING" },
                { "fieldPath": "at", "order": "DESCENDING" } ] },
  { "collectionGroup": "photos", "queryScope": "COLLECTION",
    "fields": [ { "fieldPath": "plantId", "order": "ASCENDING" },
                { "fieldPath": "at", "order": "DESCENDING" } ] } ] }
```

### 16.7 README.md (root)
```markdown
# Silvae 🌱

Free‑forever plant care: species‑specific care, weather‑adaptive schedules,
photo identification, disease diagnosis, progress timeline, placement advisor —
$0 forever, no card, no ads, on‑device AI.

## Stack
- Web: React + Vite + TanStack Query + Dexie (PWA) → Vercel
- Android: Kotlin + Jetpack Compose (MVVM, Clean Architecture) → GitHub Releases / F‑Droid
- Backend: Vercel serverless (Plant.id/Open‑Meteo proxies, R2 uploads, share/notify)
- Data: Firebase Auth + Firestore (Spark) · photos on Cloudflare R2
- AI: on‑device TFLite (species + disease) · Gemma 3 1B chat · MiniLM semantic cache

## Quickstart
pnpm install && pnpm -w build   # web + shared
pnpm --filter web dev           # local web (emulator backend)
# Android: open apps/android in Android Studio (minSdk 26)

## Docs
- `docs/SILVAE_BLUEPRINT.md` — full architecture, schema, roadmap, handoff guide
- `docs/SECURITY.md` — rules, threat model, privacy

## License
MIT (app). Models/data per their own licenses. Donations welcome; nothing is gated.
```

---

## 17. Sustaining Free Forever

### 17.1 Quota arithmetic (worst‑case model: 10,000 MAU, ~25,000 plants)
Assumptions: avg 2.5 plants/user; avg user performs 1.5 care events/day; 20% of users take 1 photo/plant/month; identification requests: 12% of users/month fresh ID (rare).

| Pool | Budget | Projected usage | Headroom |
|---|---|---|---|
| Firestore writes | 20,000/day | Care events (local→sync compact) 10,000×1.5 = 15,000 + photos ~330 + rollups ~8,000 ≈ **23,300** → cut by batching to **≤ 14,000** (see below) | ~6 K/day |
| Firestore reads | 50,000/day | Mostly served from Room/Dexie; live reads only on cold start + share/community ≈ **6,000–10,000** | ~40 K |
| Firestore storage | 1 GiB | 25 K plants×~1.5 KB + 10 K users×~1 KB + events(7‑day rolling, TTL) ≈ **~70 MB** | ~930 MB |
| Firestore egress | 10 GiB/mo | Tiny (documents); photo egress is R2 | ~10 GiB |
| Cloudflare R2 | 10 GB storage · 10 GB egress | 25 K plants×2 photos×250 KB ≈ **12.5 GB** → compress to 150 KB (webp/avif) ≈ **7.5 GB**; egress ~users viewing own gallery (small) | ok; prune avatars |
| Open‑Meteo | 10 K calls/day | 1 call/device/3 h ≈ 10 K×(8/day) = 80 K → **cached per city** (coarse grid) → **≤ 3 K/day** | >3× |
| Plant.id | ~100 IDs/day | Fresh cloud IDs only on cache miss; TFLite + PlantNet cover most → **≤ 50/day** | 2× |
| PlantNet | ~500/day | Fallback only | rarely hit |
| Vercel Hobby | functions + bandwidth | Proxies hit only on cache miss (≈ thousands/mo); static assets CDN‑cached | far under |
| FCM | unlimited/free | share/community only | fine |
| GitHub Actions | 2,000 min/mo | ~15 runs/day×4 min + tag builds ≈ **~2,000** → tune (path filters, `concurrency`) | careful |

**Write‑reduction tactics (keep Firestore writes ≤ ~14 K/day):**
1. Care events sync in batches (15 min bucket) with one doc per bucket: `care_batches/{uid}_{bucket}` containing array of events (1 write per ~10 events).
2. Rollups via `increment()` on `summary_stats` at bucket flush (not per event).
3. Firestore is a **mirror**, not a log: prune `care_events` docs > 90 days (Vercel cron), keep rollups forever (compact).
4. id/weather caches get TTLs; cron deletes expired (counts toward 20 K deletes, negligible).

### 17.2 Cost ceiling guarantee
Every service either (a) has no quota (Auth, FCM, Analytics, GitHub public), or (b) is architecturally throttled by our own local‑first + cache design to <30% of quota (Firestore, R2, Open‑Meteo, Plant.id, Vercel). No service in the stack can generate a bill: Spark blocks at quota (never charges), Vercel Hobby blocks overage, R2 free tier is capped, and we never add a card.

### 17.3 Model & content freshness (free maintenance)
- Yearly Colab retrain/refresh of species + disease models; pinned via `models.json` (sha256) + staged rollout.
- Species dataset grows from community PRs (`data/species/*.json`) reviewed in CI (schema + expert gate).
- Disease/symptom tables extended with each identified community issue.
- Docs/RAG corpus updated each release; embeddings regenerated locally.

### 17.4 Community & governance (no cost)
- Public repo + CONTRIBUTING.md; Good‑First‑Issue labels; monthly community call notes in repo.
- F‑Droid listing (free) for Android distribution; PWA for iOS/web.
- **Donate:** optional Ko-fi/GitHub Sponsors link in Profile + README; explicitly "supports hosting of open data & model training — never gates features."
- If ever a quota truly binds (100 K+ MAU), the *first* response is more caching and coarser weather grid — not a paid tier. A paid plan would violate the Silvae Promise.

### 17.5 Trust & transparency
- Public status page (free: GitHub issues + README badge); quota meters surfaced in‑app honestly.
- Privacy policy: "AI runs on your device; photos stored under your account in free storage; you can export & delete everything."
- No ads, no data sale, no dark patterns — this is the durable moat competitors (PictureThis, Planta, Plantin) are losing.

---

## 18. Open‑Source GitHub Harvest

Sweep of 13 open‑source plant‑care repos (Aug 2026). Each repo was read for features, ideals, and services; winning ideas are folded into §2 with origin tags. Nothing harvested requires a paid service.

### 18.1 Repo → feature harvest table

| Repo | Stack | Standout features | Adopted into Silvae |
|---|---|---|---|
| mdeluise/plant-it | Android, self‑hostable | Log‑first philosophy (user decides, app reminds); event types watering/fertilizing/biostimulating; reminders = "time since last action" (notify if not watered every 4 days); per‑plant photo collection; F‑Droid + Obtanium + GitHub Releases distribution | S‑7, S‑8; F‑Droid distribution (§17.4 confirmed); log‑first reminder model (§18.3) |
| Spyderdreams/Virtual-Plant-Care-App | Python (game) | Gamification: water/prune/replant; random events (challenges & blessings); special events with choices; virtual currency; item shop (pesticide/medicine/fertilizer) | §2.8 G‑1…G‑5 (cosmetic‑only, no pay‑to‑win) |
| layekmia/Plant-care-Full-stack | React/Tailwind/Express/MongoDB | Dark/light toggle; sort by next watering date or care level; date‑fns human dates; toast notifications; responsive table dashboard | P‑5 sorting; theme toggle (§3); toast pattern (§3.5) |
| CODINATA/PlantCare | Flask + PyTorch ML | Leaf disease detection (built on manthan89‑py/Plant‑Disease‑Detection); login/signup/profile + "Market" screen | Confirms §9 PlantVillage disease layer; "Market" → cosmetic shop (§2.8) |
| sunrisemystery/gplant | PHP/JS/PostgreSQL | "Discover" species section available to unregistered users; per‑plant name + notes + last‑watered | C‑7 public Discover (guest read‑only) |
| yingxin-jia/PlantCare-Hackathon-MinneHack | Django | Evapotranspiration irrigation: location + next‑day weather (temp, precip, pressure) → mm of water needed; crop‑age water demand; future weather‑weighted fertilization | S‑10 quantitative irrigation (feeds §10.2) |
| alastairrmcneill/plant-care | Flutter + Firebase | Cross‑platform; share plants with household members; reminders to water/**mist/feed**; multi‑user same plant | S‑6 household sharing; S‑7 event types |
| TomazMazej/plant_care | Android + own API | Water notifications; save/search plants; separated API (docker‑compose) | Reinforces notifications/search; API separation matches §8 |
| CMPT362-PlantCare/PlantCare | Android | Personalized reminders; rich plant database; calendar of watering tasks; "affordable, simple, delightful" positioning | S‑9 care calendar view |
| pgrzel/Plant-Care-App | Android + Firebase | FirebaseAuth + RTDB + Storage; notifications computed to fire at the right time; MVP + interactors/listeners layers; image compression TODO | T‑5 image compression; schedule‑computed notification timing (§8.3); MVP layering matches §4.4 |
| itsmahmudul/plant-care-tracker | React/Vite/Tailwind/DaisyUI | DaisyUI + Framer Motion + tooltips; clean tracker UI | UI inspiration only (§3) |
| taanzzz/my-plantcare-project | React/Node/Express/MongoDB + Firebase Auth | Email/Google auth; protected routes; add/edit/delete with modals; no native alerts (Toastify + SweetAlert2); custom 404; loading spinners | Confirms §3/§13 UX; edit‑with‑prefill + confirm modals |
| prerna-666/Plant-Care | Static HTML | No README; plain HTML page | None (skipped) |

### 18.2 Newly adopted features (tagged in §2)
C‑7 · S‑6 · S‑7 · S‑8 · S‑9 · S‑10 · P‑5 · T‑5 · G‑1…G‑5 (§2.8).

### 18.3 Lessons / ideals worth keeping
- **Log‑first, not auto‑advice** (plant‑it): remind about time since last action; never silently override the user's judgment. Aligns with Silvae's transparency promise (§17.5).
- **Discoverability without login** (gplant): species content is public, care is private — grows organic SEO and virality.
- **Gamification stays purely cosmetic** (Spyderdreams/CODINATA): XP/currency/shop drive retention but buy nothing real; keeps the $0 promise airtight.
- **Quantified irrigation** (MinneHack): convert "water me" into "≈ 180 ml today (ET − rainfall)" — a concrete value no mainstream free app gives.
- **Household sharing** (alastairrmcneill): one plant, many caregivers — a top real‑world need (S‑5 upgraded to shared‑ownership S‑6).

### 18.4 Repos read (Aug 2026)
- github.com/mdeluise/plant-it · github.com/Spyderdreams/Virtual-Plant-Care-App · github.com/layekmia/Plant-care-Full-stack · github.com/CODINATA/PlantCare · github.com/sunrisemystery/gplant · github.com/yingxin-jia/PlantCare-Hackathon-MinneHack · github.com/alastairrmcneill/plant-care · github.com/TomazMazej/plant_care · github.com/CMPT362-PlantCare/PlantCare · github.com/pgrzel/Plant-Care-App · github.com/itsmahmudul/plant-care-tracker · github.com/taanzzz/my-plantcare-project · github.com/prerna-666/Plant-Care

---

## Appendix A — References
- Plant.id v3 API & free‑key flow: web.plant.id · PlantNet API docs & PlantNet‑300K (github.com/plantnet) · PlantVillage dataset (github.com/spMohanty/PlantVillage-Dataset) · MobileNetV3‑Small PlantNet‑300K (huggingface.co/cpoisson) · GreenHealer / PlantAi / Green‑Sense (GitHub) · all‑MiniLM‑L6‑v2 TFLite (huggingface.co/Nihal2000) · Sentence‑Embeddings‑Android (github.com/shubham0204) · MediaPipe LLM Inference & Gemma 3 1B (developers.google.com/edge) · llmedge (github.com/CCE-Li/llmedge) · Open‑Meteo pricing/terms · Firebase pricing & Firestore quotas · Supabase pricing (alternative DB) · Vercel Hobby · Cloudflare R2 free tier.

*End of blueprint. Next step: `pnpm install` and scaffold `apps/web` per §4 layout.*


