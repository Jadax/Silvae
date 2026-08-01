import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { SpeciesSchema, SymptomsSchema } from "@silvae/core";

const DATA_DIR = fileURLToPath(new URL("../../../data", import.meta.url));

const DiseaseRuleSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  weight: z.number().int().positive(),
  symptoms: SymptomsSchema.strict(),
  likelyCause: z.string().min(1),
  treatment: z.array(z.string().min(1)).min(1),
});

const issues = [];
const checked = { species: 0, rules: 0 };

function report(file, detail) {
  issues.push(`${file}: ${detail}`);
}

function checkSpeciesFile(file, slug) {
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    report(file, "unreadable");
    return;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    report(file, `invalid JSON: ${err.message}`);
    return;
  }
  const parsed = SpeciesSchema.safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      report(file, `${issue.path.join(".") || "root"}: ${issue.message}`);
    }
    return;
  }
  const s = parsed.data;
  checked.species += 1;

  if (s.slug !== slug) report(file, `slug "${s.slug}" does not match filename "${slug}"`);
  if (s.ideal.luxMin > s.ideal.luxIdeal || s.ideal.luxIdeal > s.ideal.luxMax)
    report(file, "lux ordering violated (luxMin <= luxIdeal <= luxMax)");
  if (s.ideal.tempMinC >= s.ideal.tempMaxC) report(file, "tempMinC must be < tempMaxC");
  if (s.ideal.humidityMin > s.ideal.humidityMax) report(file, "humidityMin must be <= humidityMax");
  if (s.ideal.phMin >= s.ideal.phMax) report(file, "phMin must be < phMax");
}

function checkDiseaseFile(file) {
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    report(file, "unreadable");
    return;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    report(file, `invalid JSON: ${err.message}`);
    return;
  }
  if (!Array.isArray(data.rules)) {
    report(file, "missing rules[] array");
    return;
  }
  const seen = new Set();
  for (const rule of data.rules) {
    const parsed = DiseaseRuleSchema.safeParse(rule);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        report(file, `rule ${rule?.id ?? "?"}.${issue.path.join(".") || "root"}: ${issue.message}`);
      }
      continue;
    }
    checked.rules += 1;
    if (seen.has(rule.id)) report(file, `duplicate rule id "${rule.id}"`);
    seen.add(rule.id);
  }
}

const speciesFiles = readdirSync(`${DATA_DIR}/species`).filter((f) => f.endsWith(".json"));
for (const f of speciesFiles) {
  checkSpeciesFile(`${DATA_DIR}/species/${f}`, f.replace(/\.json$/, ""));
}
checkDiseaseFile(`${DATA_DIR}/disease/symptoms.json`);

if (speciesFiles.length === 0) issues.push("no species files found in data/species");

if (issues.length > 0) {
  console.error(`data validation failed (${issues.length} issue(s)):`);
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}

console.log(
  `data validation OK: ${checked.species} species, ${checked.rules} disease rules, ` +
    `${speciesFiles.length} species files checked.`,
);
