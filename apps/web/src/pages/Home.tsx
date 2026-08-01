import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listPlants } from "../lib/repo";
import { speciesBySlug } from "../lib/seed";
import type { PlantRow } from "../lib/db";

function waterStatus(plant: PlantRow) {
  if (!plant.nextWaterAt) return { label: "Schedule pending", tone: "neutral", days: undefined };
  const days = Math.ceil((new Date(plant.nextWaterAt).getTime() - Date.now()) / 86400000);
  if (days <= 0) return { label: "Water today", tone: "due", days: 0 };
  if (days === 1) return { label: "Water tomorrow", tone: "soon", days };
  return { label: `Water in ${days} days`, tone: "happy", days };
}

export function PlantCard({ plant }: { plant: PlantRow }) {
  const species = speciesBySlug(plant.speciesSlug);
  const status = waterStatus(plant);
  return (
    <Link className="plant-card" to={`/plants/${plant.id}`}>
      <div className="plant-visual">
        {plant.avatarPhotoUrl ? <img src={plant.avatarPhotoUrl} alt="" /> : <span aria-hidden>🌿</span>}
        <i />
      </div>
      <div className="plant-card-body">
        <div>
          <h2>{plant.name}</h2>
          <p>{species?.commonNames[0] ?? plant.speciesSlug}</p>
        </div>
        <span className={`care-pill ${status.tone}`}><i />{status.label}</span>
      </div>
    </Link>
  );
}

export default function Home() {
  const { data: plants = [] } = useQuery({ queryKey: ["plants"], queryFn: listPlants });
  const sorted = [...plants].sort((a, b) => (a.nextWaterAt ?? "9999").localeCompare(b.nextWaterAt ?? "9999"));
  const due = sorted.filter((plant) => (waterStatus(plant).days ?? 1) <= 0).length;

  return (
    <div className="home-page">
      <section className="welcome-panel">
        <div>
          <span className="eyebrow">Your little patch of green</span>
          <h1>{plants.length ? "Good to see you!" : "Let’s grow something lovely."}</h1>
          <p>{plants.length ? (due ? `${due} plant${due === 1 ? " needs" : "s need"} a little love today.` : "Everything looks happy today. Nice work!") : "Silvae makes plant care simple, cheerful, and stress-free—one tiny step at a time."}</p>
          <Link className="btn sun" to="/add">Add your first plant <span aria-hidden>→</span></Link>
        </div>
        <div className="sunny-art" aria-hidden>
          <span className="sun-orb" />
          <span className="leaf leaf-one">🌿</span>
          <span className="leaf leaf-two">☘️</span>
          <span className="pot" />
        </div>
      </section>

      <section className="section-heading">
        <div>
          <span className="eyebrow">My garden</span>
          <h2>{plants.length ? `${plants.length} happy plant${plants.length === 1 ? "" : "s"}` : "Your plants will live here"}</h2>
        </div>
        {plants.length > 0 && <Link className="btn" to="/add"><span aria-hidden>＋</span> Add plant</Link>}
      </section>

      {sorted.length === 0 ? (
        <div className="empty-garden">
          <div className="empty-illustration" aria-hidden>🪴</div>
          <h2>Ready when you are</h2>
          <p>Give your plant a name, choose its type, and we’ll help with the rest.</p>
          <Link className="btn" to="/add">Add a plant</Link>
          <Link className="text-link" to="/discover">Or browse the plant library</Link>
        </div>
      ) : (
        <div className="plant-grid">{sorted.map((plant) => <PlantCard key={plant.id} plant={plant} />)}</div>
      )}

      <section className="helper-grid" aria-label="Quick actions">
        <Link to="/doctor" className="helper-card peach"><span className="helper-icon">✚</span><div><strong>Plant looking sad?</strong><small>Let the Plant Doctor help</small></div><span>→</span></Link>
        <Link to="/discover" className="helper-card sage"><span className="helper-icon">⌕</span><div><strong>Meet a new plant</strong><small>Explore 400 care guides</small></div><span>→</span></Link>
      </section>
    </div>
  );
}
