import { SpeciesSchema, type Species } from "@silvae/core";

/**
 * Offline species catalog. Single source of truth is `data/species/*.json`
 * (schema-validated by `pnpm data:validate`); this glob bundles those files
 * into the app so the offline catalog can never drift from the seeds.
 * Production additionally reads the public Firestore collection `species/{slug}` (C-7).
 */
const RAW_SPECIES: Record<string, unknown> = import.meta.glob(
  "../../../../data/species/*.json",
  { eager: true, import: "default" },
);

export const SPECIES: Species[] = Object.values(RAW_SPECIES)
  .map((raw) => SpeciesSchema.parse(raw))
  .sort((a, b) => a.slug.localeCompare(b.slug));

export function speciesBySlug(slug: string): Species | undefined {
  return SPECIES.find((s) => s.slug === slug);
}
