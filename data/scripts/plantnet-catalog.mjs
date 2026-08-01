#!/usr/bin/env node
/**
 * PlantNet taxonomy bridge for the species catalog.
 *
 * Commands (run from repo root):
 *   node data/scripts/plantnet-catalog.mjs --key <KEY> --fetch
 *   node data/scripts/plantnet-catalog.mjs --verify        (uses cached list)
 *   node data/scripts/plantnet-catalog.mjs --candidates    (uses cached list)
 *
 * The "useful" project (cultivated & ornamental plants) is the houseplant
 * referential. The species list is fetched once into data/.cache/ so later
 * steps are offline and quota-friendly.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT, "data");
const SPECIES_DIR = path.join(DATA_DIR, "species");
const CACHE_DIR = path.join(DATA_DIR, ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "plantnet-useful.json");

const API = "https://my-api.plantnet.org/v2";
const PROJECT = "useful";
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 250;

/** Families that are overwhelmingly indoor/houseplant candidates. */
const HOUSEHOLD_FAMILIES = new Set([
  "Araceae", "Marantaceae", "Bromeliaceae", "Apocynaceae", "Moraceae",
  "Crassulaceae", "Asparagaceae", "Arecaceae", "Polypodiaceae", "Pteridaceae",
  "Dennstaedtiaceae", "Commelinaceae", "Urticaceae", "Vitaceae", "Acanthaceae",
  "Araliaceae", "Begoniaceae", "Gesneriaceae", "Melastomataceae", "Oxalidaceae",
  "Amaranthaceae", "Solanaceae", "Lamiaceae", "Asteraceae", "Orchidaceae",
  "Theaceae", "Myrtaceae", "Pandanaceae", "Passifloraceae", "Musaceae",
  "Strelitziaceae", "Cyperaceae", "Amaryllidaceae", "Aizoaceae",
  "Euphorbiaceae", "Bignoniaceae", "Ericaceae", "Saxifragaceae",
  "Selaginellaceae", "Fabaceae", "Piperaceae", "Malvaceae", "Rutaceae",
  "Rubiaceae", "Oleaceae", "Nephrolepidaceae", "Davalliaceae",
  "Plantaginaceae", "Pittosporaceae", "Ruscaceae", "Zingiberaceae",
  "Cannaceae", "Heliconiaceae", "Costaceae", "Nepenthaceae",
]);

function norm(name) {
  return (name ?? "")
    .toLowerCase()
    .replace(/×/g, " ")
    .replace(/\bx\b/g, " ")
    .replace(/\./g, "")
    .replace(/'[^']*'/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function apiKey() {
  const idx = process.argv.indexOf("--key");
  return (idx >= 0 ? process.argv[idx + 1] : process.env.PLANTNET_API_KEY) ?? "";
}

async function fetchAll(key) {
  let page = 1;
  const all = [];
  while (true) {
    const url = `${API}/projects/${PROJECT}/species?api-key=${encodeURIComponent(key)}&page=${page}&pageSize=${PAGE_SIZE}`;
    let res;
    for (let attempt = 1; attempt <= 3; attempt++) {
      res = await fetch(url);
      if (res.ok) break;
      console.error(`  page ${page}: HTTP ${res.status} (attempt ${attempt})`);
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
    if (!res || !res.ok) throw new Error(`fetch failed at page ${page}: HTTP ${res.status}`);
    const batch = await res.json();
    all.push(...batch);
    console.error(`  page ${page}: +${batch.length} (total ${all.length})`);
    if (batch.length < PAGE_SIZE) break;
    page++;
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  }
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(all));
  console.log(`cached ${all.length} species -> ${CACHE_FILE}`);
  return all;
}

async function loadCache() {
  return JSON.parse(await readFile(CACHE_FILE, "utf8"));
}

async function loadCatalog() {
  const files = (await readdir(SPECIES_DIR)).filter((f) => f.endsWith(".json"));
  const out = [];
  for (const f of files) {
    const data = JSON.parse(await readFile(path.join(SPECIES_DIR, f), "utf8"));
    out.push({ file: f, slug: data.slug, scientificName: data.scientificName });
  }
  return out;
}

async function verify() {
  const cache = await loadCache();
  const byNorm = new Map(cache.map((s) => [norm(s.scientificNameWithoutAuthor), s]));
  const catalog = await loadCatalog();
  let ok = 0, synonym = 0, missing = 0;
  for (const item of catalog) {
    const n = norm(item.scientificName);
    const hit = byNorm.get(n);
    if (hit) {
      ok++;
    } else {
      const genus = n.split(" ")[0];
      const anyGenus = cache.find((s) => norm(s.genus) === genus);
      if (anyGenus) {
        synonym++;
        console.log(`  synonym/alt: "${item.scientificName}" not exact; genus has "${anyGenus.scientificNameWithoutAuthor}"`);
      } else {
        missing++;
        console.log(`  not in useful referential: ${item.scientificName}`);
      }
    }
  }
  console.log(`\nverify: ${ok} exact, ${synonym} genus-level, ${missing} missing (of ${catalog.length})`);
}

async function candidates() {
  const cache = await loadCache();
  const catalog = await loadCatalog();
  const have = new Set(catalog.map((c) => norm(c.scientificName)));
  const pick = cache
    .filter((s) => HOUSEHOLD_FAMILIES.has(s.family))
    .filter((s) => !have.has(norm(s.scientificNameWithoutAuthor)))
    .filter((s) => (s.commonNames ?? []).length > 0)
    .sort((a, b) => (b.commonNames ?? []).length - (a.commonNames ?? []).length);
  const grouped = {};
  for (const s of pick) {
    (grouped[s.family] ??= []).push(s);
  }
  const byCount = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);
  console.log(`${pick.length} candidate species across ${byCount.length} families\n`);
  for (const [family, rows] of byCount) {
    console.log(`## ${family} (${rows.length})`);
    for (const r of rows.slice(0, 12)) {
      console.log(`  ${r.scientificNameWithoutAuthor} | ${(r.commonNames ?? []).join(", ")}`);
    }
    if (rows.length > 12) console.log(`  … and ${rows.length - 12} more`);
  }
}

const cmd = process.argv.includes("--fetch")
  ? "fetch"
  : process.argv.includes("--verify")
    ? "verify"
    : process.argv.includes("--candidates")
      ? "candidates"
      : null;

try {
  if (cmd === "fetch") {
    const key = apiKey();
    if (!key) throw new Error("missing PlantNet API key (--key <KEY> or PLANTNET_API_KEY)");
    await fetchAll(key);
  } else if (cmd === "verify") {
    await verify();
  } else if (cmd === "candidates") {
    await candidates();
  } else {
    console.log("usage: node data/scripts/plantnet-catalog.mjs {--fetch|--verify|--candidates} [--key <KEY>]");
  }
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exit(1);
}
