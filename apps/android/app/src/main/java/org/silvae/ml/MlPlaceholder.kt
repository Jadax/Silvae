package org.silvae.ml

/**
 * On-device ML (A5, 9.4):
 * - TFLite MobileNetV3 Small (PlantNet-300K) species ID.
 * - TFLite MobileNetV3 Large (PlantVillage 38-class int8) disease.
 * - Gemma 3 1B INT4 via MediaPipe tasks-genai (opt-in Wi-Fi download).
 * - all-MiniLM-L6-v2 embeddings for semantic cache + RAG.
 */
object MlPlaceholder
