# @silvae/db

Source of truth for the Firestore schema, security rules and indexes.

- `firestore.rules` — security rules (see blueprint §13.1; guarded by ownership + roles).
- `firestore.indexes.json` — required composite indexes (blueprint §7.2).

Wire-up (root): `firebase.json` points at these files so `firebase deploy --only firestore` uses them.
