import { describe, expect, it } from "vitest";
import type { Env, Species } from "@silvae/core";
import { DAY, feedingPlan, fertilizerMix, lastDone, rescheduleWater, waterStatusLabel } from "./care";
import type { CareEventRow, PlantRow } from "./db";

const species: Species = {
  slug: "monstera-deliciosa",
  commonNames: ["Swiss cheese plant"],
  scientificName: "Monstera deliciosa",
  family: "Araceae",
  toxicity: { pets: true },
  ideal: {
    luxMin: 1500, luxIdeal: 2500, luxMax: 20000, tempMinC: 18, tempMaxC: 30,
    humidityMin: 50, humidityMax: 80, phMin: 5.5, phMax: 7,
    npk: { n: 3, p: 1, k: 2 },
    waterIntervalDays: 7, waterAmountMl: 500, fertIntervalDays: 14, mistIntervalDays: 7,
    repotIntervalMonths: 18, rotateIntervalDays: 30,
  },
  tolerance: { drought: "LOW", shade: "MED", cold: "LOW" },
  growth: { rate: "SLOW", maxHeightCm: 300 },
} as Species;

const env: Env = { tempC: 22, rh: 55, uvIndex: 2, season: "spring", daylightH: 12 };

const plant: PlantRow = {
  id: "p1", ownerUid: "u", name: "Momo", speciesSlug: species.slug,
  potType: "plastic", soilType: "standard", potSizeCm: 20, sharedWith: [],
  plantedAt: "2026-01-01T12:00:00.000Z",
};

const ev = (type: CareEventRow["type"], at: string, id = at): CareEventRow => ({ id, plantId: "p1", type, at });

describe("care schedule", () => {
  it("counts from the latest watering even when a backdated one is logged after it", () => {
    const events = [ev("water", "2026-03-10T12:00:00.000Z"), ev("water", "2026-03-01T12:00:00.000Z"), ev("prune", "2026-03-12T12:00:00.000Z")];
    expect(lastDone(events, "water")?.toISOString()).toBe("2026-03-10T12:00:00.000Z");
    const next = new Date(rescheduleWater(plant, species, env, events).nextWaterAt!);
    expect(next.toISOString().slice(0, 10)).toBe("2026-03-17");
  });

  it("falls back to when the plant was added if it has never been watered", () => {
    const next = new Date(rescheduleWater(plant, species, env, []).nextWaterAt!);
    expect(next.toISOString().slice(0, 10)).toBe("2026-01-08");
  });

  it("labels overdue plants as late rather than in the past", () => {
    const label = waterStatusLabel(new Date(Date.now() - 2 * DAY));
    expect(label.tone).toBe("due");
    expect(label.label).toMatch(/2 days late/);
    expect(waterStatusLabel(new Date(Date.now() + 3 * DAY), "Refresh water").label).toMatch(/^Refresh water in/);
  });
});

describe("feeding", () => {
  it("is due in the growing season when never fed, and not in winter", () => {
    expect(feedingPlan(plant, species, [], "spring")?.due).toBe(true);
    expect(feedingPlan(plant, species, [], "winter")?.due).toBe(false);
  });

  it("isn't due again until the interval has passed", () => {
    const fedYesterday = [ev("fertilize", new Date(Date.now() - DAY).toISOString())];
    expect(feedingPlan(plant, species, fedYesterday, "summer")?.due).toBe(false);
  });

  it("skips fertiliser plans for plants growing in water", () => {
    expect(feedingPlan({ ...plant, potType: "glass" }, species, [], "summer")).toBeUndefined();
  });

  it("works out how much of the person's own fertiliser to mix", () => {
    const plan = feedingPlan(plant, species, [], "summer", { name: "Seagro", dosePerLiter: 2, unit: "ml" })!;
    // Monstera's NPK profile is a light feeder, so half strength into one watering for a 20 cm pot.
    expect(plan.mix).toMatch(/^Mix [\d.]+ ml of Seagro into \d+ ml of water \(half the label strength\)\.$/);
    const full = fertilizerMix({ name: "X", dosePerLiter: 4, unit: "g" }, { ...plan.advice, strength: "hungry", doseMl: 1000 });
    expect(full).toBe("Mix 4 g of X into 1000 ml of water.");
  });
});
