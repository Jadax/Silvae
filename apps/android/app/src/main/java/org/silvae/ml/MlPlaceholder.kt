package org.silvae.ml

/**
 * On-device ML (A5, 9.4) — species/disease TFLite models, Gemma chat, and
 * embeddings — is NOT implemented. No trained models exist anywhere in this
 * repo (`ml/` has only a README, no `.tflite` files). Plant Doctor's photo ID
 * (org.silvae.ui.doctor) calls the same server-side `/api/identify` proxy the
 * web app uses instead. Training real on-device models is a separate ML
 * project (dataset + training pipeline) that would replace this package.
 */
object MlPlaceholder
