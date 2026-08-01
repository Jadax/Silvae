import { useQuery } from "@tanstack/react-query";
import type { Weather } from "@silvae/core";
import { fetchWeather } from "../lib/weather";

export function useWeather(lat?: number, lon?: number) {
  return useQuery<Weather>({
    queryKey: ["weather", lat ?? "default", lon ?? "default"],
    queryFn: () => fetchWeather(lat, lon),
  });
}
