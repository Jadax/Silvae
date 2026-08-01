# ml/

Model training, evaluation and conversion (Google Colab free tier — §9.3).

Planned artifacts (pinned in a `models.json` manifest with URL + sha256; Android
downloads on first launch so the APK stays < 150 MB — §4.4):

- `species/` — TFLite MobileNetV3-Small fine-tuned on PlantNet-300K (1,081 species, ~10 MB).
- `disease/` — TFLite MobileNetV3-Large, PlantVillage 38-class int8 (~4–6 MB).
- `embed/` — all-MiniLM-L6-v2 int8 (384-dim, ~6 MB) for semantic cache + RAG.
- `chat/` — Gemma 3 1B INT4 (MediaPipe tasks-genai, ~620 MB, gated licence).

Reproducible pipeline: Colab notebook → export → convert → checksum → `models.json` →
staged rollout. Yearly refresh (17.3). Large binaries are never committed.
