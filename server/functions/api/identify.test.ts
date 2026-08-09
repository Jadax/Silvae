import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePlantId, normalizePlantNet } from "./identify.js";

test("normalizePlantId maps Plant.id suggestions into IdentifyResponse", () => {
  const out = normalizePlantId({
    result: {
      is_plant: { probability: 0.99 },
      classification: {
        suggestions: [
          { name: "Monstera deliciosa", probability: 0.91 },
          { name: "Monstera adansonii", probability: 0.04 },
          { name: "" },
        ],
      },
      disease: { suggestions: [{ name: "Bacterial spot", probability: 0.2 }] },
    },
  });
  assert.deepEqual(out.species, [
    { scientificName: "Monstera deliciosa", confidence: 0.91 },
    { scientificName: "Monstera adansonii", confidence: 0.04 },
  ]);
  assert.equal(out.isPlant?.probability, 0.99);
  assert.equal(out.disease?.name, "Bacterial spot");
});

test("normalizePlantId tolerates empty payloads", () => {
  assert.deepEqual(normalizePlantId({}).species, []);
});

test("normalizePlantNet maps results into species suggestions", () => {
  const out = normalizePlantNet({
    results: [
      { score: 0.87, species: { scientificNameWithoutAuthor: "Monstera deliciosa" } },
      { score: 0.06, species: { scientificNameWithoutAuthor: "Philodendron gloriosum" } },
      { score: 0.01, species: {} },
    ],
  });
  assert.deepEqual(out.species, [
    { scientificName: "Monstera deliciosa", confidence: 0.87 },
    { scientificName: "Philodendron gloriosum", confidence: 0.06 },
  ]);
});

test("normalizePlantNet drops entries without a scientific name", () => {
  const out = normalizePlantNet({ results: [{ score: 0.9, species: {} }] });
  assert.deepEqual(out.species, []);
});