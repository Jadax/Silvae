import { SPECIES } from "./seed";
import { identifyPlant, type IdentifyResponse, type IdentifySpecies } from "./api";
import type { Symptoms } from "@silvae/core";

export const MAX_ID_IMAGE_BYTES = 150 * 1024;
export const MAX_ID_IMAGE_DIM = 1024;
const B64_CHUNK = 0x8000;

export interface MatchedSpecies {
  scientificName: string;
  confidence?: number;
  /** present only when the suggestion matches the offline catalog */
  slug?: string;
  commonNames: string[];
  inCatalog: boolean;
  /** genus hint for suggestions the catalog doesn't cover */
  genusName?: string;
}

/**
 * Normalize a scientific name for fuzzy matching: lower-case, treat ×/x as
 * the same hybrid mark, drop apostrophes, collapse whitespace.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[×x]/g, "x")
    .replace(/['`\u2019]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Drop trailing cultivar and nomenclatural-rank bits that identification
 * services append ("Epipremnum aureum 'Neon'", "Ficus lyrata cv. Bambino").
 */
function baseName(name: string): string {
  return name
    .replace(/\s+['\u2019][^'\u2019]*['\u2019]\s*$/i, "")
    .replace(/\s+cv\.?\s+.+$/i, "")
    .replace(/\s+(var\.?|subsp\.?|ssp\.?|f\.|subf\.?)\s+.*$/i, "")
    .trim();
}

/**
 * Common synonyms and superseded names that photo ID services return for
 * plants the catalog lists under a newer or different name. Keys are
 * normalized; values are the catalog's own scientific names.
 */
export const SPECIES_ALIASES: Record<string, string> = {
  "aloe barbadensis": "Aloe vera",
  "scindapsus aureus": "Epipremnum aureum",
  "pothos aureus": "Epipremnum aureum",
  "rhaphidophora aurea": "Epipremnum aureum",
  "sansevieria trifasciata": "Dracaena trifasciata",
  "sansevieria laurentii": "Dracaena trifasciata",
  "sansevieria zeylanica": "Dracaena trifasciata",
  "sansevieria cylindrica": "Dracaena angolensis",
  "nephthytis podophyllum": "Syngonium podophyllum",
  "monstera friedrichsthalii": "Monstera adansonii",
  "philodendron oxycardium": "Philodendron hederaceum",
  "philodendron scandens": "Philodendron hederaceum",
  "philodendron micans": "Philodendron hederaceum 'Micans'",
  "chlorophytum elatum": "Chlorophytum comosum",
  "ficus pandurata": "Ficus lyrata",
  "dracaena deremensis": "Dracaena fragrans",
  "dracaena compacta": "Dracaena fragrans",
  "crassula argentea": "Crassula ovata",
  "alocasia x amazonica": "Alocasia A- amazonica",
  "alocasia amazonica": "Alocasia A- amazonica",
  "tillandsia cyanea": "Wallisia cyanea",
  "hedera canariensis": "Hedera helix",
  "peperomia obtusifolia variegata": "Peperomia obtusifolia",
};

/** 2019 reclassification: the "calatheas" are now Goeppertia. */
function swappedGoeppertia(base: string): string | undefined {
  if (base.startsWith("calathea ")) return `goeppertia ${base.slice("calathea ".length)}`;
  if (base.startsWith("goeppertia ")) return `calathea ${base.slice("goeppertia ".length)}`;
  return undefined;
}

function findHit(
  catalog: { slug: string; scientificName: string; commonNames: string[] }[],
  full: string,
  base: string,
) {
  return (
    catalog.find((c) => normalizeName(c.scientificName) === full) ??
    catalog.find((c) => normalizeName(c.scientificName) === base) ??
    (() => {
      const target = SPECIES_ALIASES[base] ?? SPECIES_ALIASES[full];
      return target
        ? catalog.find((c) => normalizeName(c.scientificName) === normalizeName(target))
        : undefined;
    })() ??
    (() => {
      const swapped = swappedGoeppertia(base);
      return swapped
        ? catalog.find((c) => normalizeName(c.scientificName) === swapped)
        : undefined;
    })()
  );
}

/**
 * Map Plant.id suggestions onto the offline catalog (`SPECIES`, bundled from
 * `data/species/*.json`). Exact scientific-name matches get care-guide links;
 * cultivar suffixes, superseded names (Sansevieria, Scindapsus aureus), and
 * the Calathea/Goeppertia rename are all resolved; anything else is kept with
 * a genus hint so the UI can offer a manual search.
 */
export function matchCatalog(
  suggestions: IdentifySpecies[],
  catalog: { slug: string; scientificName: string; commonNames: string[] }[] = SPECIES,
): MatchedSpecies[] {
  return suggestions
    .filter((s) => typeof s?.scientificName === "string" && s.scientificName.length > 0)
    .map((s) => {
      const name = s.scientificName as string;
      const full = normalizeName(name);
      const base = normalizeName(baseName(name));
      const hit = findHit(catalog, full, base);
      const genusName = full.split(" ")[0];
      return {
        scientificName: name,
        confidence: s.confidence,
        slug: hit?.slug,
        commonNames: hit?.commonNames ?? [],
        inCatalog: Boolean(hit),
        genusName: hit ? undefined : genusName,
      };
    });
}

/**
 * Translate a Plant.id health result into checklist flags the on-device
 * symptom engine understands, so a flagged photo can drive real treatment
 * recommendations instead of stopping at "something may be wrong". Photos
 * only set suggestions; the person confirms before a diagnosis is trusted.
 */
const DISEASE_SYMPTOMS: ReadonlyArray<readonly [RegExp, Symptoms]> = [
  [/aphid/i, { insects: true, stickyResidue: true, curledLeaves: true }],
  [/mealybug/i, { whiteFluff: true, stickyResidue: true }],
  [/spider mite/i, { webbing: true, stippling: true }],
  [/mite/i, { stippling: true }],
  [/scale insect/i, { insects: true }],
  [/whitefly/i, { insects: true, stickyResidue: true }],
  [/thrips?/i, { stippling: true, leafBurn: "brown-spots" }],
  [/fungus gnat|gnat/i, { insects: true }],
  [/leaf miner/i, { curledLeaves: true }],
  [/root rot|overwater/i, { leafColor: "yellow", soil: "moist" }],
  [/underwater|dehydrat|drought/i, { leafCrisp: "dry-brown", droop: true, soil: "dry" }],
  [/sunburn|scorch|leaf burn/i, { leafBurn: "brown-spots", spotsOnExposed: true, directSun: true }],
  [/leaf spot|spotting|fungal|fungus/i, { leafBurn: "brown-spots" }],
  [/yellow/i, { leafColor: "yellow" }],
  [/chlorosis|deficien|pale/i, { leafColor: "pale" }],
  [/drooping|wilting|wilt/i, { droop: true }],
];

export interface PestInfo {
  pest: string;
  icon: string;
  severity: "easy" | "moderate" | "stubborn";
  treatments: string[];
}

/**
 * Pest cheat sheet, keyed by the terms photo ID services report. Shown
 * prominently when a photo flags a pest so the plan is unmistakable.
 */
export const PESTS: ReadonlyArray<readonly [RegExp, PestInfo]> = [
  [/aphid/i, {
    pest: "Aphids",
    icon: "🦠",
    severity: "easy",
    treatments: [
      "Rinse the plant under a gentle spray to knock them off",
      "Spray with insecticidal soap or a neem solution every few days",
      "Repeat until no new colonies appear; check leaf undersides and new growth",
    ],
  }],
  [/mealybug/i, {
    pest: "Mealybugs",
    icon: "🤍",
    severity: "moderate",
    treatments: [
      "Wipe each fluffy spot with a cotton swab dipped in rubbing alcohol",
      "Check leaf joints and undersides — they love the crevices",
      "Re-treat weekly; inspect nearby plants, they spread quietly",
    ],
  }],
  [/spider mite/i, {
    pest: "Spider mites",
    icon: "🕷️",
    severity: "moderate",
    treatments: [
      "Isolate the plant and raise humidity — mites hate it",
      "Wash the leaves and spray with insecticidal soap or neem",
      "Repeat twice a week for two weeks; the webbing marks where they hide",
    ],
  }],
  [/scale insect|scale/i, {
    pest: "Scale insects",
    icon: "🛡️",
    severity: "moderate",
    treatments: [
      "Scrape off the hard bumps with a fingernail or old toothbrush",
      "Wipe with rubbing alcohol, then apply horticultural oil",
      "Check stems and leaf veins weekly for two or three weeks",
    ],
  }],
  [/whitefly/i, {
    pest: "Whiteflies",
    icon: "🦋",
    severity: "moderate",
    treatments: [
      "Vacuum adults off in the morning, then use yellow sticky traps",
      "Spray with insecticidal soap, focusing on leaf undersides",
      "Quarantine — whiteflies spread fast to the whole shelf",
    ],
  }],
  [/thrips?/i, {
    pest: "Thrips",
    icon: "🗡️",
    severity: "stubborn",
    treatments: [
      "Isolate the plant and prune the worst damaged leaves",
      "Wash it down, then treat with insecticidal soap or neem repeatedly",
      "Thrips are persistent — plan on weekly treatment for several weeks",
    ],
  }],
  [/fungus gnat|gnat/i, {
    pest: "Fungus gnats",
    icon: "🪰",
    severity: "easy",
    treatments: [
      "Let the top few cm of soil dry out between waterings",
      "Put up yellow sticky traps to catch the adults",
      "Bottom-water, and if they persist do a diluted hydrogen peroxide drench",
    ],
  }],
  [/leaf miner/i, {
    pest: "Leaf miners",
    icon: "🪱",
    severity: "easy",
    treatments: [
      "Remove and bin the leaves with visible tunnels",
      "Keep the plant tidy; healthy leaves are less attractive",
      "Check new leaves for fresh wiggly trails",
    ],
  }],
  [/broad mite|russet mite|eriophyid/i, {
    pest: "Broad or russet mites",
    icon: "🔬",
    severity: "stubborn",
    treatments: [
      "Treat like spider mites — wash, raise humidity, isolate",
      "Apply a miticide or sulfur according to the label",
      "These are tiny; treat generously and expect a long campaign",
    ],
  }],
];

/** Look up a pest plan when a photo ID names one. */
export function pestFromDisease(res: IdentifyResponse): PestInfo | undefined {
  const disease = res.disease?.name ?? "";
  if (!disease) return undefined;
  return PESTS.find(([pattern]) => pattern.test(disease))?.[1];
}

export function photoSymptoms(res: IdentifyResponse): Symptoms {
  const merged: Symptoms = {};
  const disease = res.disease?.name ?? "";
  if (disease) {
    for (const [pattern, flags] of DISEASE_SYMPTOMS) {
      if (pattern.test(disease)) Object.assign(merged, flags);
    }
  }
  return merged;
}

/** Decode an image file/Blob into an HTMLImageElement for canvas scaling. */
export function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_decode_failed"));
    };
    img.src = url;
  });
}

async function encodeWebP(
  img: HTMLImageElement,
  maxDim: number,
  quality: number,
): Promise<Blob | null> {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

/**
 * Downscale a phone photo (camera shot or screenshot) to a Plant.id-friendly
 * WebP ≤150KB. Shrinks quality first, then dimension, to stay under budget.
 */
export async function fileToPayload(
  file: File | Blob,
  opts?: { maxDim?: number; maxBytes?: number },
): Promise<{ base64: string; bytes: Uint8Array } | null> {
  const maxDim = opts?.maxDim ?? MAX_ID_IMAGE_DIM;
  const maxBytes = opts?.maxBytes ?? MAX_ID_IMAGE_BYTES;

  const img = await loadImage(file);
  let quality = 0.82;
  let blob = await encodeWebP(img, maxDim, quality);
  while (blob && blob.size > maxBytes && quality > 0.4) {
    quality -= 0.12;
    blob = await encodeWebP(img, maxDim, quality);
  }
  if (blob && blob.size > maxBytes) {
    blob = await encodeWebP(img, Math.max(256, Math.floor(maxDim / 2)), 0.7);
  }
  if (!blob) return null;

  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length === 0 || bytes.length > maxBytes * 2) return null;

  let bin = "";
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + B64_CHUNK));
  }
  return { base64: `data:image/webp;base64,${btoa(bin)}`, bytes };
}

/** sha256 hex digest of the image bytes — the server-side cache key (D-4). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Shared photo-ID pipeline used by both the Add Plant flow and the Plant
 * Doctor: downscale, fingerprint, call the identify API, then map the
 * suggestions onto the offline catalog. Throws on any step's failure —
 * callers own their own busy/error state around this call.
 */
export async function identifyFromFile(
  source: File | Blob,
): Promise<{ result: IdentifyResponse; matches: MatchedSpecies[] }> {
  const payload = await fileToPayload(source);
  if (!payload) throw new Error("encode_failed");
  const fingerprint = await sha256Hex(payload.bytes);
  const result = await identifyPlant({ imageFingerprint: fingerprint, base64: payload.base64 });
  return { result, matches: matchCatalog(result.species ?? []) };
}
