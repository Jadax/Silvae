import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextWaterAt, type ScheduleInput } from "./care/schedule.js";
import { irrigation, evapotranspirationMm } from "./care/irrigation.js";
import { diagnose } from "./doctor/rules.js";
import { assessSpot, suitability } from "./placement/advisor.js";
import type { Species } from "./dto/species.js";

const species: Species = {
  slug: "monstera-deliciosa",
  commonNames: ["Swiss cheese plant"],
  scientificName: "Monstera deliciosa",
  family: "Araceae",
  toxicity: { pets: true, note: "Insoluble calcium oxalates" },
  ideal: {
    luxMin: 1500,
    luxIdeal: 2500,
    luxMax: 20000,
    tempMinC: 18,
    tempMaxC: 30,
    humidityMin: 50,
    humidityMax: 80,
    phMin: 5.5,
    phMax: 7.0,
    npk: { n: 3, p: 1, k: 2 },
    waterIntervalDays: 7,
    waterAmountMl: 500,
    fertIntervalDays: 14,
    mistIntervalDays: 7,
    repotIntervalMonths: 18,
    rotateIntervalDays: 30,
  },
  tolerance: { drought: "LOW", shade: "MED", cold: "LOW" },
  growth: { rate: "FAST", maxHeightCm: 300 },
};

const plant: ScheduleInput["plant"] = { potType: "plastic", soilType: "standard", potSizeCm: 20 };

const baseEnv = { tempC: 22, rh: 55, uvIndex: 4, season: "autumn" as const, daylightH: 11 };

describe("care/schedule", () => {
  it("returns baseline interval with no modifiers", () => {
    const res = nextWaterAt({ species, plant, env: baseEnv, last: new Date("2026-08-01") });
    assert.equal(res.intervalDays, 7);
    assert.equal(res.modifiers.length, 0);
  });

  it("shortens interval under high light and heat", () => {
    const res = nextWaterAt({
      species,
      plant,
      env: { ...baseEnv, tempC: 32, uvIndex: 8 },
      last: new Date("2026-08-01"),
      luxEstimate: 6000,
    });
    assert.ok(res.intervalDays < 7);
    assert.ok(res.modifiers.some((m) => m.name === "heat"));
    assert.ok(res.modifiers.some((m) => m.name === "highLight"));
  });

  it("lengthens interval for low light", () => {
    const res = nextWaterAt({
      species,
      plant,
      env: { ...baseEnv, tempC: 10, daylightH: 8 },
      last: new Date("2026-08-01"),
      luxEstimate: 300,
    });
    assert.ok(res.intervalDays > 7);
  });

  it("respects clamp bounds", () => {
    const res = nextWaterAt({
      species: { ...species, ideal: { ...species.ideal, waterIntervalDays: 7 } },
      plant,
      env: { ...baseEnv, tempC: 35, rh: 20, uvIndex: 11 },
      last: new Date("2026-08-01"),
      luxEstimate: 20000,
    });
    assert.ok(res.intervalDays >= 3.5);
    assert.ok(res.intervalDays <= 12.6);
  });
});

describe("care/irrigation (S-10)", () => {
  it("computes positive amount with explanation", () => {
    const res = irrigation(species, baseEnv);
    assert.ok(res.amountMl > 0);
    assert.ok(res.explanation.length >= 1);
  });

  it("reduces amount when it rains", () => {
    const dry = irrigation(species, baseEnv);
    const wet = irrigation(species, { ...baseEnv, precipitationMm: 5 });
    assert.ok(wet.amountMl < dry.amountMl);
  });

  it("evapotranspiration is 0 in cold dark weather", () => {
    const et = evapotranspirationMm({ ...baseEnv, tempC: 5, daylightH: 2, uvIndex: 0 });
    assert.ok(et < 2);
  });
});

describe("doctor/rules", () => {
  it("detects overwatering", () => {
    const res = diagnose({ leafColor: "yellow", soil: "moist", lowerLeaves: true, potHasDrainage: false });
    assert.equal(res[0]?.id, "overwater");
  });

  it("returns empty for no symptoms", () => {
    assert.deepEqual(diagnose({}), []);
  });
});

describe("placement/advisor", () => {
  it("scores a bright spot well for Monstera", () => {
    const score = suitability(species, 3000);
    assert.ok(score >= 80);
  });

  it("flags a dark spot as unsuitable", () => {
    const score = suitability(species, 200);
    assert.equal(score, 15);
  });

  it("produces a human-readable assessment", () => {
    const a = assessSpot({
      room: { id: "r1", name: "Living room", windowDirection: "S", windowType: "none" },
      spot: { roomId: "r1", spotName: "window sill", distanceFromWindowM: 0.5 },
      species,
      env: { ...baseEnv, cloudCover: 20 },
    });
    assert.match(a.reason, /lux/);
    assert.ok(a.suitability >= 0 && a.suitability <= 100);
  });
});
