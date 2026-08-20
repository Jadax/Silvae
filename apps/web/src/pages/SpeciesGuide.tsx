import { Link, useNavigate, useParams } from "react-router-dom";
import { feedingAdvice } from "@silvae/core";
import { speciesBySlug } from "../lib/seed";
import { seasonForMonth } from "../lib/weather";

function level(level: string): string {
  return ({ HIGH: "High", MED: "Medium", LOW: "Low" })[level] ?? level;
}

function growthRate(rate: string): string {
  return rate.charAt(0).toUpperCase() + rate.slice(1).toLowerCase();
}

export default function SpeciesGuide() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const species = speciesBySlug(slug);

  if (!species) {
    return (
      <div className="setup-page">
        <h1>Species not found</h1>
        <p className="muted">
          We don't have a care guide for "{slug}" yet.{" "}
          <Link to="/discover">Browse the 400-species catalog.</Link>
        </p>
      </div>
    );
  }

  const facts = [
    { icon: "\uD83D\uDCA7", label: "Watering", value: `${species.ideal.waterAmountMl} ml every ${species.ideal.waterIntervalDays} days` },
    { icon: "\u2600\uFE0F", label: "Ideal light", value: `${species.ideal.luxMin}\u2013${species.ideal.luxMax} lux` },
    { icon: "\uD83C\uDF21\uFE0F", label: "Temperature", value: `${species.ideal.tempMinC}\u2013${species.ideal.tempMaxC}{'\u00B0'}C` },
    { icon: "\uD83D\uDCA6", label: "Humidity", value: `${species.ideal.humidityMin}\u2013${species.ideal.humidityMax}%` },
  ];

  const feed = feedingAdvice({ species, season: seasonForMonth(new Date().getMonth()), potSizeCm: 20 });

  return (
    <div className="plant-page">
      <button className="back-link" onClick={() => navigate("/discover")}>{"\u2190"} Discover</button>
      <header className="plant-hero">
        <div className="plant-avatar" aria-hidden>{'\uD83C\uDF31'}</div>
        <div className="plant-title">
          <span className="eyebrow">Care guide</span>
          <h1>{species.commonNames[0]}</h1>
          <p>
            <em>{species.scientificName}</em> \u00B7 {species.family}
          </p>
          <p>
            <span className={`pet-flag ${species.toxicity.pets ? "toxic" : "safe"}`}>
              {species.toxicity.pets ? "\u26A0 Likely toxic to pets" : "\uD83D\uDC3E Pet friendly"}
            </span>
          </p>
          {species.toxicity.note && <p className="muted">{species.toxicity.note}</p>}
          {species.toxicity.pets && (
            <p className="muted">Keep it out of reach of curious mouths. If you think your pet had a nibble, call your vet.</p>
          )}
        </div>
        <Link to={`/add?species=${encodeURIComponent(species.slug)}`} className="btn">
          Add to my garden
        </Link>
      </header>

      <section className="care-overview" aria-label="Care essentials">
        {facts.map((fact) => (
          <div key={fact.label} className="care-fact">
            <span aria-hidden>{fact.icon}</span>
            <div>
              <small>{fact.label}</small>
              <strong>{fact.value}</strong>
            </div>
          </div>
        ))}
      </section>

      <details className="care-details">
        <summary>Care schedule details</summary>
        <ul className="modifier-list">
          <li>Water {species.ideal.waterAmountMl} ml every {species.ideal.waterIntervalDays} days as a baseline</li>
          <li>Mist {species.ideal.mistIntervalDays === 0 ? "rarely" : `every ${species.ideal.mistIntervalDays} days`}</li>
          <li>Repot about every {species.ideal.repotIntervalMonths} months</li>
          <li>Rotate every {species.ideal.rotateIntervalDays} days</li>
          <li>Soil pH {species.ideal.phMin}\u2013{species.ideal.phMax}</li>
        </ul>
      </details>

      <details className="care-details">
        <summary>Feeding plan</summary>
        <ul className="modifier-list">
          <li>Fertilise every {species.ideal.fertIntervalDays} days (NPK {species.ideal.npk.n}\u2013{species.ideal.npk.p}\u2013{species.ideal.npk.k})</li>
          <li>Use about {feed.gramsPerLiter} g/L of a balanced feed, roughly {feed.doseMl} ml for a standard 20 cm pot</li>
          <li>{feed.guidance}</li>
        </ul>
      </details>

      <details className="care-details">
        <summary>Hardiness</summary>
        <ul className="modifier-list">
          <li>Drought tolerance: {level(species.tolerance.drought)}</li>
          <li>Shade tolerance: {level(species.tolerance.shade)}</li>
          <li>Cold tolerance: {level(species.tolerance.cold)}</li>
          <li>Growth rate: {growthRate(species.growth.rate)} \u00B7 max {species.growth.maxHeightCm} cm</li>
        </ul>
      </details>

      <p className="muted" style={{ marginTop: "1rem" }}>
        This covers a typical healthy plant. Your home is different, so watch yours and adjust. Not a substitute for professional advice.
      </p>
    </div>
  );
}
