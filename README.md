# Silvae 🌱

Free‑forever plant care platform: web PWA (reference implementation) + native Android. A free account is required to keep your plants and care history safe — AI runs on‑device, no credit card, no paid tiers, ever.

## Stack (all free tier, see §6 of the blueprint)

- Firebase Auth + Firestore (Spark) · Vercel Hobby serverless · Cloudflare R2 photos
- React + Vite + TanStack Query + Dexie (web PWA) · Kotlin + Jetpack Compose (Android)
- TFLite on‑device species/disease models · Gemma 3 1B chat (opt‑in download)
- Open‑Meteo (weather) · Plant.id → PlantNet → TFLite identification pipeline

## Layout

```
apps/web          React + Vite + TanStack Query + Dexie (PWA)
apps/android      Kotlin + Jetpack Compose (MVVM, Clean Architecture)
packages/core     shared TS: DTOs (zod), care engine, weather math, placement
packages/api      OpenAPI spec + generated client
packages/db       Firestore schema + rules + indexes (source of truth)
server/functions  Vercel serverless (TS): plant-id proxy, weather proxy, share/notify
data/species      seeded care dataset (JSON, per-species)
data/disease      symptom → disease mapping tables
ml/               training/eval notebooks + model conversion (Colab, free)
docs/             this blueprint, CONTENT.md, SECURITY.md
```

## Quickstart

```bash
pnpm install
cp .env.example apps/web/.env.local   # fill in VITE_FIREBASE_CONFIG — required, accounts are mandatory
pnpm dev          # apps/web at http://localhost:5173
```

## Android

Open `apps/android` in Android Studio (minSdk 26).

## Docs

- **Architecture, constraints, quotas, roadmap:** [`docs/SILVAE_BLUEPRINT.md`](docs/SILVAE_BLUEPRINT.md)

## License

MIT (app). Models/data per their own licenses. Donations welcome; nothing is gated.
