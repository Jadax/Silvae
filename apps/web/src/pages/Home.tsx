import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { recentCareEvents, listPlants, logCareEvent, savePlant } from "../lib/repo";
import { speciesBySlug } from "../lib/seed";
import { applyStillMoist, applyWater, envForPlant, waterStatusLabel } from "../lib/care";
import { usePlace, useSettings } from "../lib/settings";
import { useWeather } from "../hooks/useWeather";
import { seasonForMonth } from "../lib/weather";
import type { CareEventRow, PlantRow } from "../lib/db";

function waterStatus(plant: PlantRow) {
  return waterStatusLabel(plant.nextWaterAt);
}

export function PlantCard({ plant }: { plant: PlantRow }) {
  const species = speciesBySlug(plant.speciesSlug);
  const status = waterStatus(plant);
  const { data: settings } = useSettings();
  const hasPets = Boolean(settings?.pets.cat || settings?.pets.dog);
  const risky = hasPets && species?.toxicity.pets;
  return (
    <Link className="plant-card" to={`/plants/${plant.id}`}>
      <div className="plant-visual">
        {plant.avatarPhotoUrl ? <img src={plant.avatarPhotoUrl} alt="" /> : <span aria-hidden>{'\uD83C\uDF3F'}</span>}
        <i />
      </div>
      <div className="plant-card-body">
        <div>
          <h2>{plant.name}</h2>
          <p>{species?.commonNames[0] ?? plant.speciesSlug}</p>
        </div>
        <span className={`care-pill ${status.tone}`}><i />{status.label}</span>
      </div>
      {risky && <span className="pet-badge" title="Toxic to pets">{'\u26A0'} pets</span>}
    </Link>
  );
}

const DAY = 86400000;

export default function Home() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: plants = [], isLoading: plantsLoading } = useQuery({ queryKey: ["plants"], queryFn: listPlants });
  const { data: events = [] } = useQuery({ queryKey: ["events", "all"], queryFn: () => recentCareEvents(400) });
  const { data: weather } = useWeather();
  const place = usePlace();
  const { data: settings } = useSettings();

  useEffect(() => {
    if (!plantsLoading && settings && settings.onboarded === false && plants.length === 0) {
      navigate("/onboard", { replace: true });
    }
  }, [plantsLoading, settings, plants.length, navigate]);

  const lastWaterByPlant = new Map<string, CareEventRow>();
  for (const event of events) {
    if (event.type === "water" && !lastWaterByPlant.has(event.plantId)) lastWaterByPlant.set(event.plantId, event);
  }

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["plants"] });
    void queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  const [justWatered, setJustWatered] = useState<string | null>(null);

  const waterNow = useMutation({
    mutationFn: async (plant: PlantRow) => {
      const species = speciesBySlug(plant.speciesSlug);
      const env = weather ? envForPlant(weather, plant.locationType) : undefined;
      const at = new Date();
      await logCareEvent({ id: crypto.randomUUID(), plantId: plant.id, type: "water", at: at.toISOString() });
      await savePlant(applyWater(plant, species, env, at));
    },
    onSuccess: (_data, plant) => {
      setJustWatered(plant.id);
      refresh();
      window.setTimeout(() => setJustWatered((cur) => (cur === plant.id ? null : cur)), 1600);
    },
  });

  const stillMoist = useMutation({
    mutationFn: async (plant: PlantRow) => {
      const species = speciesBySlug(plant.speciesSlug);
      const env = weather ? envForPlant(weather, plant.locationType) : undefined;
      const lastWater = lastWaterByPlant.get(plant.id);
      await savePlant(applyStillMoist(plant, species, env, lastWater ? new Date(lastWater.at) : new Date()));
    },
    onSuccess: refresh,
  });

  const sorted = [...plants].sort((a, b) => (a.nextWaterAt ?? "9999").localeCompare(b.nextWaterAt ?? "9999"));
  const due = sorted.filter((plant) => (waterStatus(plant).days ?? 1) <= 0);
  const tomorrow = sorted.filter((plant) => waterStatus(plant).days === 1);
  const overdueCount = due.length;
  const season = seasonForMonth(new Date().getMonth());
  const seasonIcon = { spring: "\uD83C\uDF38", summer: "\u2600\uFE0F", autumn: "\uD83C\uDF42", winter: "\u2744\uFE0F" }[season];
  const outdoorPlants = plants.filter((plant) => plant.locationType === "outdoor");
  const frostOut = weather && weather.tempC < 3 ? outdoorPlants : [];
  const heatOut = weather && weather.tempC > 35 ? outdoorPlants : [];
  const warnings = frostOut.length + heatOut.length;

  return (
    <div className="home-page">
      <section className="welcome-panel">
        <div>
          <span className="eyebrow">Your garden</span>
          <h1>{plants.length ? "Good to see you!" : "Let's get growing"}</h1>
          <p>{plants.length ? (overdueCount ? `${overdueCount} plant${overdueCount === 1 ? " needs" : "s need"} water today.` : "Everything looks happy today.") : "Plant care is mostly remembering to water. We'll do the remembering."}</p>
          <Link className="btn sun" to="/add">Add your first plant <span aria-hidden>{'\u2192'}</span></Link>
        </div>
        <div className="sunny-art" aria-hidden>
          <span className="sun-orb" />
          <span className="leaf leaf-one">{'\uD83C\uDF3F'}</span>
          <span className="leaf leaf-two">{'\u2618\uFE0F'}</span>
          <span className="pot" />
        </div>
      </section>

      {plants.length > 0 && (
        <section className="weather-strip" aria-label="Weather">
          {place && weather ? (
            <>
              <Link className="weather-chip" to="/account" title="Change location">{'\uD83D\uDCCD'} {place.label}</Link>
              <span className="weather-chip">{seasonIcon} {season}</span>
              <span className="weather-chip">{'\uD83C\uDF21\uFE0F'} {Math.round(weather.tempC)}{'\u00B0'}C</span>
              <span className="weather-chip">{'\uD83D\uDCA7'} {Math.round(weather.rh)}% humidity</span>
              {warnings > 0 && <Link className="weather-chip warn" to="/account">{'\u26C5'} {warnings} outdoor warning{warnings === 1 ? "" : "s"}</Link>}
            </>
          ) : (
            <Link className="weather-chip warn" to="/account">{'\uD83D\uDCCD'} Set your location for weather data</Link>
          )}
        </section>
      )}

      {due.length > 0 && (
        <section className="today-section" aria-label="Today">
          <div className="section-heading">
            <div><span className="eyebrow">Today</span><h2>Water me first {'\uD83D\uDCA7'}</h2></div>
          </div>
          <div className="today-list">
            {due.map((plant) => {
              const species = speciesBySlug(plant.speciesSlug);
              const lastWater = lastWaterByPlant.get(plant.id);
              const daysSince = lastWater ? Math.floor((Date.now() - new Date(lastWater.at).getTime()) / DAY) : 0;
              return (
                <div className="today-card" key={plant.id}>
                  <div className="today-plant">
                    <Link className="today-avatar" to={`/plants/${plant.id}`}>{plant.avatarPhotoUrl ? <img src={plant.avatarPhotoUrl} alt="" /> : <span aria-hidden>{'\uD83C\uDF3F'}</span>}</Link>
                    <div>
                      <strong><Link className="text-link" to={`/plants/${plant.id}`}>{plant.name}</Link></strong>
                      <small>{species?.commonNames[0] ?? plant.speciesSlug}{lastWater ? ` \u00B7 last watered ${daysSince} day${daysSince === 1 ? "" : "s"} ago` : ""}</small>
                    </div>
                  </div>
                  <div className="today-actions">
                    <button className={`btn ${justWatered === plant.id ? "popped" : ""}`} disabled={waterNow.isPending} onClick={() => void waterNow.mutate(plant)}>{justWatered === plant.id ? "\u2713 Done!" : "\uD83D\uDCA7 Watered"}</button>
                    <button className="btn secondary" disabled={stillMoist.isPending} onClick={() => void stillMoist.mutate(plant)}>Still moist</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tomorrow.length > 0 && (
        <section className="section-heading">
          <div><span className="eyebrow">Coming up</span><h2>Tomorrow</h2></div>
        </section>
      )}
      {tomorrow.length > 0 && (
        <div className="tomorrow-row">
          {tomorrow.map((plant) => <Link key={plant.id} className="tomorrow-chip" to={`/plants/${plant.id}`}>{plant.avatarPhotoUrl ? <img src={plant.avatarPhotoUrl} alt="" /> : <span aria-hidden>{'\uD83C\uDF3F'}</span>} {plant.name}</Link>)}
        </div>
      )}

      <section className="section-heading">
        <div>
          <span className="eyebrow">My garden</span>
          <h2>{plants.length ? `${plants.length} happy plant${plants.length === 1 ? "" : "s"}` : "Your plants will live here"}</h2>
        </div>
        {plants.length > 0 && <Link className="btn" to="/add"><span aria-hidden>{'\uFF0B'}</span> Add plant</Link>}
      </section>

      {sorted.length === 0 ? (
        <div className="empty-garden">
          <div className="empty-illustration" aria-hidden>{'\uD83C\uDF3F'}</div>
          <h2>Ready when you are</h2>
          <p>Name your plant, pick its type, and we'll handle the rest.</p>
          <Link className="btn" to="/add">Add a plant</Link>
          <Link className="text-link" to="/discover">Or browse the plant library</Link>
        </div>
      ) : (
        <div className="plant-grid">{sorted.map((plant) => <PlantCard key={plant.id} plant={plant} />)}</div>
      )}

      <section className="helper-grid" aria-label="Quick actions">
        <Link to="/doctor" className="helper-card peach"><span className="helper-icon">{'\u271A'}</span><div><strong>Plant looking sad?</strong><small>Let the Plant Doctor help</small></div><span>{'\u2192'}</span></Link>
        <Link to="/discover" className="helper-card sage"><span className="helper-icon">{'\u2281'}</span><div><strong>Meet a new plant</strong><small>Explore 400 care guides</small></div><span>{'\u2192'}</span></Link>
      </section>
    </div>
  );
}
