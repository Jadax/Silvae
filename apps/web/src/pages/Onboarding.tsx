import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSaveSettings, useSettings } from "../lib/settings";
import LocationPicker from "../components/LocationPicker";

const STEPS = ["Where do you live?", "Pets at home?", "Let's grow"] as const;

export default function Onboarding() {
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const [step, setStep] = useState(0);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  const pets = settings?.pets ?? { cat: false, dog: false };

  async function finish() {
    const current = settings ?? {};
    await save.mutateAsync({ ...current, onboarded: true });
  }

  return (
    <div className="onboard-page">
      <ol className="onboard-steps" aria-label={`Step ${step + 1} of 3`}>
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? "active" : index < step ? "done" : ""}>
            <span>{index < step ? "✓" : index + 1}</span>{label}
          </li>
        ))}
      </ol>

      <section className="card onboard-card">
        {step === 0 && (
          <>
            <span className="eyebrow">Welcome to Silvae</span>
            <h2>Where do your plants live?</h2>
            <p className="muted">Your location powers season-aware advice, real weather, and outdoor warnings. Nothing leaves this device.</p>
            <LocationPicker onLocationSet={(p) => setLocationMessage(`You're in ${p.label}.`)} />
          </>
        )}

        {step === 1 && (
          <>
            <span className="eyebrow">Almost there</span>
            <h2>Do pets live here?</h2>
            <p className="muted">We'll flag risky plants for your cat or dog and add a pet-safe filter to Discover.</p>
            <div className="checks">
              <label className="check">
                <input type="checkbox" checked={pets.cat} onChange={(event) => void save.mutateAsync({ pets: { ...pets, cat: event.target.checked } })} /> 🐱 Cat
              </label>
              <label className="check">
                <input type="checkbox" checked={pets.dog} onChange={(event) => void save.mutateAsync({ pets: { ...pets, dog: event.target.checked } })} /> 🐶 Dog
              </label>
            </div>
            <p className="muted">No pets? Just skip — you can change all this later in Settings.</p>
          </>
        )}

        {step === 2 && (
          <>
            <span className="eyebrow">You're all set</span>
            <h2>Ready to grow something lovely?</h2>
            <p className="muted">Add your first plant and we'll build its care plan together.</p>
            <div className="onboard-ctas">
              <button className="btn sun" onClick={() => void finish().then(() => navigate("/add"))}>Add my first plant <span aria-hidden>→</span></button>
              <button className="btn secondary" onClick={() => void finish().then(() => navigate("/discover"))}>Browse the plant library</button>
              <button className="text-link" onClick={() => void finish().then(() => navigate("/"))}>I'll just look around for now</button>
            </div>
          </>
        )}

        {locationMessage && <p className="form-error" role="status">{locationMessage}</p>}
        <div className="onboard-actions">
          {step > 0 && <button className="btn secondary" type="button" onClick={() => setStep((current) => current - 1)}>Back</button>}
          {step < 2 && <button className="btn" type="button" onClick={() => setStep((current) => current + 1)}>Continue <span aria-hidden>→</span></button>}
        </div>
      </section>
    </div>
  );
}
