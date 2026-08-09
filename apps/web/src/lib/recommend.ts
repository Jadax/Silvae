import {
  regionFit,
  recommendForRegion,
  climateBand,
  bandLabel,
  type PlaceRef,
  type RegionFit,
  type RegionFitInput,
} from "@silvae/core";
import { SPECIES } from "./seed";
import type { Place } from "./location";
import { seasonForMonth } from "./weather";

export type { RegionFit };

export { climateBand, bandLabel };

export function placeRef(place: Place | undefined): PlaceRef | undefined {
  return place ? { lat: place.lat, lon: place.lon, label: place.label } : undefined;
}

/** Fit of one species to the saved place, this season. */
export function fitForPlace(
  species: (typeof SPECIES)[number],
  place: Place | undefined,
  locationType: "indoor" | "outdoor" = "indoor",
): RegionFit {
  const input: RegionFitInput = {
    species,
    season: seasonForMonth(new Date().getMonth()),
    locationType,
  };
  const ref = placeRef(place);
  if (ref) input.place = ref;
  return regionFit(input);
}

/** Top N species for the saved place, best fit first. */
export function recommendationsForPlace(
  place: Place | undefined,
  opts: { locationType?: "indoor" | "outdoor"; petSafe?: boolean; limit?: number } = {},
) {
  return recommendForRegion(SPECIES, placeRef(place), {
    season: seasonForMonth(new Date().getMonth()),
    locationType: opts.locationType ?? "indoor",
    petSafe: opts.petSafe,
    limit: opts.limit ?? 8,
  });
}
