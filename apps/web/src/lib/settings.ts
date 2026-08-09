import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSettings, saveSettings, type Settings } from "./db";
import type { Place } from "./location";

export const DEFAULT_SETTINGS: Settings = {
  pets: { cat: false, dog: false },
  location: undefined,
  onboarded: false,
};

export function useSettings() {
  return useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: async () => (await getSettings()) ?? DEFAULT_SETTINGS,
    staleTime: 60_000,
  });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const current = (await getSettings()) ?? DEFAULT_SETTINGS;
      const next: Settings = { ...DEFAULT_SETTINGS, ...current, ...patch };
      await saveSettings(next);
      return next;
    },
    onSuccess: (next) => queryClient.setQueryData(["settings"], next),
  });
}

export function usePlace(): Place | undefined {
  const { data } = useSettings();
  return data?.location ? { lat: data.location.lat, lon: data.location.lon, label: data.location.label } : undefined;
}
