import { describe, expect, it } from "vitest";
import { matchCatalog, normalizeName, sha256Hex } from "./identify";

const CATALOG = [
  {
    slug: "monstera-deliciosa",
    scientificName: "Monstera deliciosa",
    commonNames: ["Swiss cheese plant"],
  },
  {
    slug: "fragaria-x-ananassa",
    scientificName: "Fragaria × ananassa",
    commonNames: ["Garden strawberry"],
  },
  { slug: "spathiphyllum-wallisii", scientificName: "Spathiphyllum wallisii", commonNames: [] },
];

describe("normalizeName", () => {
  it("lower-cases and trims", () => {
    expect(normalizeName("  MONSTERA DELICIOSA ")).toBe("monstera deliciosa");
  });
  it("treats × and x as the same hybrid mark", () => {
    expect(normalizeName("Fragaria × ananassa")).toBe("fragaria x ananassa");
    expect(normalizeName("Fragaria x ananassa")).toBe("fragaria x ananassa");
  });
  it("strips apostrophes and collapses whitespace", () => {
    expect(normalizeName("Monstera d'amazonie   deliciosa")).toBe(
      "monstera damazonie deliciosa",
    );
  });
});

describe("matchCatalog", () => {
  it("maps exact matches onto catalog care guides", () => {
    const out = matchCatalog(
      [{ scientificName: "Monstera deliciosa", confidence: 0.93 }],
      CATALOG,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      scientificName: "Monstera deliciosa",
      confidence: 0.93,
      slug: "monstera-deliciosa",
      commonNames: ["Swiss cheese plant"],
      inCatalog: true,
    });
    expect(out[0].genusName).toBeUndefined();
  });

  it("matches across hybrid-mark spelling differences", () => {
    const out = matchCatalog([{ scientificName: "Fragaria x ananassa" }], CATALOG);
    expect(out[0]).toMatchObject({ slug: "fragaria-x-ananassa", inCatalog: true });
  });

  it("keeps unmatched suggestions with a genus hint", () => {
    const out = matchCatalog([{ scientificName: "Selenicereus undatus", confidence: 0.5 }], CATALOG);
    expect(out[0]).toMatchObject({
      scientificName: "Selenicereus undatus",
      confidence: 0.5,
      inCatalog: false,
      genusName: "selenicereus",
    });
    expect(out[0].slug).toBeUndefined();
  });

  it("drops suggestions without a scientific name", () => {
    const out = matchCatalog(
      [{ confidence: 0.1 }, { scientificName: "Spathiphyllum wallisii" }],
      CATALOG,
    );
    expect(out).toHaveLength(1);
    expect(out[0].slug).toBe("spathiphyllum-wallisii");
  });
});

describe("sha256Hex", () => {
  it("returns a 64-char lowercase hex digest (RFC 6234 test vector)", async () => {
    const bytes = new TextEncoder().encode("abc");
    expect(await sha256Hex(bytes)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
