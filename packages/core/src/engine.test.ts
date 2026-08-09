import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextWaterAt, type ScheduleInput } from "./care/schedule.js";
import { irrigation, evapotranspirationMm } from "./care/irrigation.js";
import { feedingAdvice, nextFertilizeAt, potVolumeL, feedingStrength } from "./care/feeding.js";
import { regionFit, climateBand, recommendForRegion } from "./care/region.js";
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

  it("lengthens interval for outdoor plants in winter (dormancy)", () => {
    const indoor = nextWaterAt({
      species,
      plant: { ...plant, locationType: "indoor" },
      env: { ...baseEnv, season: "winter", tempC: 16 },
      last: new Date("2026-08-01"),
    });
    const outdoor = nextWaterAt({
      species,
      plant: { ...plant, locationType: "outdoor" },
      env: { ...baseEnv, season: "winter", tempC: 4 },
      last: new Date("2026-08-01"),
    });
    assert.ok(outdoor.intervalDays > indoor.intervalDays);
    assert.ok(outdoor.modifiers.some((m) => m.name === "outdoorDormant"));
  });

  it("treats missing locationType as indoor", () => {
    const res = nextWaterAt({
      species,
      plant: { ...plant, locationType: undefined },
      env: { ...baseEnv, season: "winter", tempC: 4 },
      last: new Date("2026-08-01"),
    });
    assert.ok(!res.modifiers.some((m) => m.name === "outdoorDormant"));
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

describe("care/feeding", () => {
  it("plans feed from species interval and NPK", () => {
    const a = feedingAdvice({ species, season: "summer" });
    assert.equal(a.intervalDays, 14);
    assert.equal(a.growingSeason, true);
    assert.deepEqual(a.npk, { n: 3, p: 1, k: 2 });
    assert.match(a.guidance, /14 days/);
  });

  it("classifies strength from the NPK profile", () => {
    assert.equal(feedingStrength({ n: 10, p: 10, k: 10 }), "hungry");
    assert.equal(feedingStrength(species.ideal.npk), "gentle");
    const std = feedingAdvice({ species: { ...species, ideal: { ...species.ideal, npk: { n: 5, p: 5, k: 5 } } } });
    assert.equal(std.strength, "standard");
    assert.ok(std.gramsPerLiter > 0.7);
  });

  it("scales dose with pot size", () => {
    const small = feedingAdvice({ species, potSizeCm: 12 });
    const large = feedingAdvice({ species, potSizeCm: 40 });
    assert.ok(potVolumeL(40) > potVolumeL(12));
    assert.ok(large.doseMl > small.doseMl);
    assert.ok(large.doseMl <= 1200);
  });

  it("tells us to skip feeding in the resting season", () => {
    const a = feedingAdvice({ species, season: "winter" });
    assert.equal(a.growingSeason, false);
    assert.match(a.guidance, /Skip|half-strength/i);
  });

  it("computes next fertilise date from the last feed", () => {
    const last = new Date("2026-08-01");
    const next = nextFertilizeAt(species, last, "summer");
    assert.equal(next.getTime(), last.getTime() + 14 * 24 * 60 * 60 * 1000);
  });
});

describe("care/region", () => {
  it("maps latitude to a climate band", () => {
    assert.equal(climateBand(0), "tropical");
    assert.equal(climateBand(30), "subtropical");
    assert.equal(climateBand(45), "temperate");
    assert.equal(climateBand(60), "cool");
    assert.equal(climateBand(undefined), null);
  });

  it("scores a tropical plant well outdoors in a tropical summer", () => {
    const fit = regionFit({ species, place: { lat: 1, lon: 20 }, season: "summer", locationType: "outdoor" });
    assert.ok(fit.fitScore >= 70, `score was ${fit.fitScore}`);
    assert.ok(fit.reasons.length >= 2);
  });

  it("penalises a cold-sensitive plant outdoors in a cool winter", () => {
    const fit = regionFit({ species, place: { lat: 55, lon: -3 }, season: "winter", locationType: "outdoor" });
    assert.ok(fit.fitScore < 55, `score was ${fit.fitScore}`);
    assert.ok(fit.reasons.some((r) => r.includes("Cold-tolerant") || r.includes("below")));
  });

  it("indoor placement is forgiving", () => {
    const outdoor = regionFit({ species, place: { lat: 55, lon: -3 }, season: "winter", locationType: "outdoor" });
    const indoor = regionFit({ species, place: { lat: 55, lon: -3 }, season: "winter", locationType: "indoor" });
    assert.ok(indoor.fitScore > outdoor.fitScore);
  });

  it("ranks the best-fit species first and respects pet filter", () => {
    const safe = { ...species, slug: "safe", toxicity: { pets: false } };
    const toxic = { ...species, slug: "toxic", toxicity: { pets: true } };
    const ranked = recommendForRegion([safe, toxic], { lat: 55, lon: -3 }, { season: "winter", locationType: "outdoor", petSafe: true });
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0]!.species.slug, "safe");
  });
});

describe("doctor/rules", () => {
  it("detects overwatering", () => {
    const res = diagnose({ leafColor: "yellow", soil: "moist", lowerLeaves: true, potHasDrainage: false });
    assert.equal(res[0]?.id, "overwater");
  });

  it("detects overwatering from waterlogged soil with drooping leaves", () => {
    const res = diagnose({ leafColor: "yellow", soil: "soaked", droop: true });
    assert.equal(res[0]?.id, "overwater");
  });

  it("returns empty for no symptoms", () => {
    assert.deepEqual(diagnose({}), []);
  });

  it("flags brown leaf spots as a possible fungal issue", () => {
    const res = diagnose({ leafBurn: "brown-spots" });
    assert.ok(res.some((d) => d.id === "leaf-spot"));
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
