package org.silvae.data

/**
 * Local-first data layer (blueprint A3).
 * Room is the source of truth; Firestore is the sync mirror.
 * - Room entities + DAOs for plants, care events, rooms.
 * - Firestore repositories push compact batches + rollups (17.1).
 * - R2 uploader for photo blobs (presigned URLs).
 */
object DataPlaceholder
