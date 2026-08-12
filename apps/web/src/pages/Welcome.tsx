import { useState } from "react";
import { useAuth } from "../lib/auth";

function friendlyAuthError(err: unknown): string {
  const code = err instanceof Error && "code" in err ? String((err as { code: unknown }).code) : "";
  if (code === "auth/email-already-in-use") return "That email already has an account — try signing in instead.";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password") return "That email and password don't match.";
  if (code === "auth/user-not-found") return "No account found for that email.";
  if (code === "auth/weak-password") return "Choose a password with at least 6 characters.";
  if (code === "auth/invalid-email") return "That doesn't look like a valid email address.";
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

/**
 * The mandatory registration/sign-in gate. Rendered full-screen, with no nav
 * chrome, whenever there's no signed-in account — Silvae ties every plant to
 * a real account so care history and photos are never lost.
 */
export default function Welcome() {
  const { signUp, signIn, signInGoogle } = useAuth();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") await signUp(email, password, name);
      else await signIn(email, password);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function withGoogle() {
    setError(null);
    setGoogleBusy(true);
    try {
      await signInGoogle();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <span className="brand-mark" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 4.5C12.5 4.5 6 8.3 6 14c0 2.9 2.2 5 5.2 5C17 19 20 12.5 20 4.5Z" />
            <path d="M4 20c2.5-4.8 6.2-7.9 11-10" />
          </svg>
        </span>
        <strong>Silvae</strong>
        <small>Grow happy, free forever</small>
      </div>

      <section className="card auth-card">
        <span className="eyebrow">{mode === "signup" ? "Create your account" : "Welcome back"}</span>
        <h1>{mode === "signup" ? "Let's grow something lovely" : "Good to see you again"}</h1>
        <p className="muted">
          {mode === "signup"
            ? "An account keeps your plants, photos, and care history safe and synced across devices."
            : "Sign in to pick up right where you left off."}
        </p>

        <form onSubmit={(e) => void submit(e)}>
          {mode === "signup" && (
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn sun" disabled={busy} type="submit">
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <button className="btn secondary" onClick={() => void withGoogle()} disabled={googleBusy}>
          {googleBusy ? "Please wait…" : "Continue with Google"}
        </button>

        <p className="muted auth-switch">
          {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
          <button type="button" className="text-link" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }}>
            {mode === "signup" ? "Sign in" : "Create an account"}
          </button>
        </p>
      </section>
    </div>
  );
}
