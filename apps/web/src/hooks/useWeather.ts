import { useQuery } from "@tanstack/react-query";
import type { Weather } from "@silvae/core";
import { fetchWeather } from "../lib/weather";
import { usePlace } from "../lib/settings";

/** Weather for the saved location (falls back to a neutral default offline). */
export function useWeather() {
  const place = usePlace();
  return useQuery<Weather>({
    queryKey: ["weather", place?.label ?? "default"],
    queryFn: () => fetchWeather(place?.lat, place?.lon),
    staleTime: 30 * 60 * 1000,
  });
}
