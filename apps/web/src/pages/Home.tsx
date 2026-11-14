import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { latestCare, listPlants, logCareEvent, savePlant } from "../lib/repo";
import { speciesBySlug } from "../lib/seed";
import { DAY, applyStillMoist, envForPlant, feedingPlan, rescheduleWater, waterStatusLabel, waterVerb } from "../lib/care";
import { usePlace, useSettings } from "../lib/settings";
import { useWeather } from "../hooks/useWeather";
import { currentSeason } from "../lib/weather";
import type { CareEventRow, PlantRow } from "../lib/db";

function waterStatus(plant: PlantRow) {
  return waterStatusLabel(plant.nextWaterAt, waterVerb(plant));
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
        {plant.avatarPhotoUrl ? <img src={plant.avatarPhotoUrl} alt="" /> : <span aria-hidden>{'🌿'}</span>}
        <i />
      </div>
      <div className="plant-card-body">
        <div>
          <h2>{plant.name}</h2>
          <p>{species?.commonNames[0] ?? plant.speciesSlug}</p>
        </div>
        <span className={`care-pill ${status.tone}`}><i />{status.label}</span>
      </div>
      {risky && <span className="pet-badge" title="Toxic to pets">{'⚠'} pets</span>}
    </Link>
  );
}

export default function Home() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: plants = [], isLoading: plantsLoading } = useQuery({ queryKey: ["plants"], queryFn: listPlants });
  const { data: latest } = useQuery({ queryKey: ["latest-care"], queryFn: latestCare });
  const { data: weather } = useWeather();
  const place = usePlace();
  const { data: settings } = useSettings();

  useEffect(() => {
    if (!plantsLoading && settings && settings.onboarded === false && plants.length === 0) {
      navigate("/onboard", { replace: true });
    }
  }, [plantsLoading, settings, plants.length, navigate]);

  const lastWater = (plantId: string): CareEventRow | undefined => latest?.water[plantId];
  const season = currentSeason(place?.lat);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["plants"] });
    void queryClient.invalidateQueries({ queryKey: ["events"] });
    void queryClient.invalidateQueries({ queryKey: ["latest-care"] });
  };

  const [justWatered, setJustWatered] = useState<string | null>(null);

  const waterNow = useMutation({
    mutationFn: async (plant: PlantRow) => {
      const species = speciesBySlug(plant.speciesSlug);
      const env = weather ? envForPlant(weather, plant.locationType, place?.lat) : undefined;
      const event: CareEventRow = { id: crypto.randomUUID(), plantId: plant.id, type: "water", at: new Date().toISOString() };
      await logCareEvent(event);
      await savePlant(rescheduleWater(plant, species, env, [event]));
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
      const env = weather ? envForPlant(weather, plant.locationType, place?.lat) : undefined;
      const last = lastWater(plant.id);
      await savePlant(applyStillMoist(plant, species, env, last ? new Date(last.at) : new Date()));
    },
    onSuccess: refresh,
  });

  const [justFed, setJustFed] = useState<string | null>(null);
  const fedNow = useMutation({
    mutationFn: (plant: PlantRow) =>
      logCareEvent({ id: crypto.randomUUID(), plantId: plant.id, type: "fertilize", at: new Date().toISOString() }),
    onSuccess: (_data, plant) => {
      setJustFed(plant.id);
      refresh();
      window.setTimeout(() => setJustFed((cur) => (cur === plant.id ? null : cur)), 1600);
    },
  });

  const sorted = [...plants].sort((a, b) => (a.nextWaterAt ?? "9999").localeCompare(b.nextWaterAt ?? "9999"));
  const due = sorted.filter((plant) => (waterStatus(plant).days ?? 1) <= 0);
  const tomorrow = sorted.filter((plant) => waterStatus(plant).days === 1);
  const overdueCount = due.length;
  const feedDue = sorted.filter((plant) => {
    const fed = latest?.fertilize[plant.id];
    return feedingPlan(plant, speciesBySlug(plant.speciesSlug), fed ? [fed] : [], season)?.due;
  });
  const seasonIcon = { spring: "🌸", summer: "☀️", autumn: "🍂", winter: "❄️" }[season];
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
          <p>{plants.length ? todaySummary(overdueCount, feedDue.length) : "Plant care is mostly remembering to water. We'll do the remembering."}</p>
          {plants.length === 0 && <Link className="btn sun" to="/add">Add your first plant <span aria-hidden>→</span></Link>}
        </div>
        <div className="sunny-art" aria-hidden>
          <span className="sun-orb" />
          <span className="leaf leaf-one">{'🌿'}</span>
          <span className="leaf leaf-two">{'☘️'}</span>
          <span className="pot" />
        </div>
      </section>

      {plants.length > 0 && (
        <section className="weather-strip" aria-label="Weather">
          {place && weather ? (
            <>
              <Link className="weather-chip" to="/account" title="Change location">{'📍'} {place.label}</Link>
              <span className="weather-chip">{seasonIcon} {season}</span>
              <span className="weather-chip">{'🌡️'} {Math.round(weather.tempC)}{'°'}C</span>
              <span className="weather-chip">{'💧'} {Math.round(weather.rh)}% humidity</span>
              {warnings > 0 && <Link className="weather-chip warn" to="/account">{'⛅'} {warnings} outdoor warning{warnings === 1 ? "" : "s"}</Link>}
            </>
          ) : (
            <Link className="weather-chip warn" to="/account">{'📍'} Set your location for weather data</Link>
          )}
        </section>
      )}

      {due.length > 0 && (
        <section className="today-section" aria-label="Today">
          <div className="section-heading">
            <div><span className="eyebrow">Today</span><h2>Water me first {'💧'}</h2></div>
          </div>
          <div className="today-list">
            {due.map((plant) => {
              const species = speciesBySlug(plant.speciesSlug);
              const last = lastWater(plant.id);
              const daysSince = last ? Math.floor((Date.now() - new Date(last.at).getTime()) / DAY) : 0;
              return (
                <div className="today-card" key={plant.id}>
                  <div className="today-plant">
                    <Link className="today-avatar" to={`/plants/${plant.id}`}>{plant.avatarPhotoUrl ? <img src={plant.avatarPhotoUrl} alt="" /> : <span aria-hidden>{'🌿'}</span>}</Link>
                    <div>
                      <strong><Link className="text-link" to={`/plants/${plant.id}`}>{plant.name}</Link></strong>
                      <small>{species?.commonNames[0] ?? plant.speciesSlug}{last ? ` · last ${plant.potType === "glass" ? "refreshed" : "watered"} ${daysSince === 0 ? "today" : `${daysSince} day${daysSince === 1 ? "" : "s"} ago`}` : ""}</small>
                    </div>
                  </div>
                  <div className="today-actions">
                    <button className={`btn ${justWatered === plant.id ? "popped" : ""}`} disabled={waterNow.isPending} onClick={() => void waterNow.mutate(plant)}>{justWatered === plant.id ? "✓ Done!" : plant.potType === "glass" ? "💧 Refreshed" : "💧 Watered"}</button>
                    {plant.potType !== "glass" && <button className="btn secondary" disabled={stillMoist.isPending} onClick={() => void stillMoist.mutate(plant)}>Still moist</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {feedDue.length > 0 && (
        <section className="today-section" aria-label="Feeding">
          <div className="section-heading">
            <div><span className="eyebrow">Growing season</span><h2>Feeding time 🌱</h2></div>
          </div>
          <p className="muted">Feed with a normal watering, not on bone-dry soil. Open a plant for the exact amount.</p>
          <div className="today-list">
            {feedDue.map((plant) => {
              const fed = latest?.fertilize[plant.id];
              return (
                <div className="today-card" key={plant.id}>
                  <div className="today-plant">
                    <Link className="today-avatar" to={`/plants/${plant.id}`}>{plant.avatarPhotoUrl ? <img src={plant.avatarPhotoUrl} alt="" /> : <span aria-hidden>🌿</span>}</Link>
                    <div>
                      <strong><Link className="text-link" to={`/plants/${plant.id}`}>{plant.name}</Link></strong>
                      <small>{fed ? `last fed ${new Date(fed.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "no feed logged yet"}</small>
                    </div>
                  </div>
                  <div className="today-actions">
                    <button className={`btn ${justFed === plant.id ? "popped" : ""}`} disabled={fedNow.isPending} onClick={() => void fedNow.mutate(plant)}>{justFed === plant.id ? "✓ Done!" : "🌱 Fed"}</button>
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
          {tomorrow.map((plant) => <Link key={plant.id} className="tomorrow-chip" to={`/plants/${plant.id}`}>{plant.avatarPhotoUrl ? <img src={plant.avatarPhotoUrl} alt="" /> : <span aria-hidden>{'🌿'}</span>} {plant.name}</Link>)}
        </div>
      )}

      <section className="section-heading">
        <div>
          <span className="eyebrow">My garden</span>
          <h2>{plants.length ? `${plants.length} happy plant${plants.length === 1 ? "" : "s"}` : "Your plants will live here"}</h2>
        </div>
        {plants.length > 0 && <Link className="btn" to="/add"><span aria-hidden>{'＋'}</span> Add plant</Link>}
      </section>

      {sorted.length === 0 ? (
        <div className="empty-garden">
          <div className="empty-illustration" aria-hidden>{'🌿'}</div>
          <h2>Ready when you are</h2>
          <p>Name your plant, pick its type, and we'll handle the rest.</p>
          <Link className="btn" to="/add">Add a plant</Link>
          <Link className="text-link" to="/discover">Or browse the plant library</Link>
        </div>
      ) : (
        <div className="plant-grid">{sorted.map((plant) => <PlantCard key={plant.id} plant={plant} />)}</div>
      )}

      <section className="helper-grid" aria-label="Quick actions">
        <Link to="/doctor" className="helper-card peach"><span className="helper-icon">{'✚'}</span><div><strong>Plant looking sad?</strong><small>Let the Plant Doctor help</small></div><span>{'→'}</span></Link>
        <Link to="/discover" className="helper-card sage"><span className="helper-icon">{'⊁'}</span><div><strong>Meet a new plant</strong><small>Explore 400 care guides</small></div><span>{'→'}</span></Link>
      </section>
    </div>
  );
}

function todaySummary(water: number, feed: number): string {
  if (!water && !feed) return "Everything looks happy today.";
  const parts: string[] = [];
  if (water) parts.push(`${water} plant${water === 1 ? " needs" : "s need"} water`);
  if (feed) parts.push(`${feed} ${feed === 1 ? "is" : "are"} ready for a feed`);
  return `${parts.join(", and ")} today.`;
}
