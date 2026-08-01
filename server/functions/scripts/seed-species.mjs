#!/usr/bin/env node
/**
 * Bulk-import `data/species/*.json` into Firestore at `species/{slug}`.
 *
 * Usage (from repo root):
 *   pnpm data:seed                                          # validate + dry-run
 *   pnpm data:seed -- --write                               # real write to Firestore
 *   pnpm data:seed -- --write --project <id> --credentials <path>
 *
 * Credentials resolution (write mode only):
 *   --credentials <path> | GOOGLE_APPLICATION_CREDENTIALS | ./firebase-service-account.json
 * Project id:  --project <id> | FIREBASE_PROJECT_ID | credentials.project_id
 *
 * Always validates every file against SpeciesSchema first and exits non-zero on
 * any schema/slug mismatch (mirrors `pnpm data:validate`).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SpeciesSchema } from "@silvae/core";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SPECIES_DIR = fileURLToPath(new URL("../../../data/species", import.meta.url));

const args = process.argv.slice(2);
const wantWrite = args.includes("--write");
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const inline = args[i + 1];
  return inline && !inline.startsWith("--") ? inline : undefined;
};
const inlineFlag = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const projectId = inlineFlag("project") ?? flag("project") ?? process.env.FIREBASE_PROJECT_ID;
const credentialsPath =
  inlineFlag("credentials") ?? flag("credentials") ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;

function loadSpecies() {
  const files = readdirSync(SPECIES_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) throw new Error(`no species files found in ${SPECIES_DIR}`);
  const species = [];
  for (const f of files) {
    const slug = f.replace(/\.json$/, "");
    const data = JSON.parse(readFileSync(`${SPECIES_DIR}/${f}`, "utf8"));
    const parsed = SpeciesSchema.safeParse(data);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
        .join(", ");
      throw new Error(`invalid species ${f}: ${detail}`);
    }
    if (parsed.data.slug !== slug) {
      throw new Error(`invalid species ${f}: slug "${parsed.data.slug}" != filename "${slug}"`);
    }
    species.push(parsed.data);
  }
  return species;
}

async function writeAll(species) {
  const { cert, initializeApp, getApp, getApps } = await import("firebase-admin/app");
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");

  let creds;
  if (credentialsPath && existsSync(credentialsPath)) {
    creds = JSON.parse(readFileSync(credentialsPath, "utf8"));
  } else {
    const fallback = `${ROOT}firebase-service-account.json`;
    if (existsSync(fallback)) creds = JSON.parse(readFileSync(fallback, "utf8"));
  }
  if (!creds) {
    throw new Error(
      "no credentials found. Pass --credentials <path>, set GOOGLE_APPLICATION_CREDENTIALS, " +
        "or drop firebase-service-account.json in the repo root.",
    );
  }
  const pid = projectId ?? creds.project_id;
  if (!pid) throw new Error("project id unknown. Pass --project <id> or set FIREBASE_PROJECT_ID.");

  const app =
    getApps().length === 0
      ? initializeApp({ credential: cert(creds), projectId: pid })
      : getApp();
  const db = getFirestore(app);

  const stamp = FieldValue.serverTimestamp();
  const batchSize = 250;
  const errors = [];
  let written = 0;

  for (let i = 0; i < species.length; i += batchSize) {
    const slice = species.slice(i, i + batchSize);
    await Promise.all(
      slice.map(async (s) => {
        try {
          await db.collection("species").doc(s.slug).set(
            { ...s, _createdAt: stamp, _updatedAt: stamp },
            { merge: false },
          );
          written += 1;
          process.stdout.write(`  ✓ species/${s.slug}\n`);
        } catch (err) {
          errors.push(`species/${s.slug}: ${err.message}`);
          process.stdout.write(`  ✗ species/${s.slug}: ${err.message}\n`);
        }
      }),
    );
  }

  if (errors.length > 0) {
    throw new Error(`wrote ${written} of ${species.length}; ${errors.length} failed`);
  }
  return written;
}

try {
  const species = loadSpecies();
  console.log(`loaded ${species.length} species from data/species/*.json`);

  if (wantWrite) {
    const n = await writeAll(species);
    console.log(`seeded ${n} species into Firestore (species/{slug}).`);
  } else {
    console.log("dry-run: all species valid; nothing written.");
    console.log("run `pnpm data:seed -- --write` to import into Firestore.");
  }
  process.exit(0);
} catch (err) {
  console.error(`seed failed: ${err.message}`);
  process.exit(1);
}
