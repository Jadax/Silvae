import { useState } from "react";
import { useAuth } from "../lib/auth";

export default function Account() {
  const { status, user, signUp, signIn, signInGoogle, signInAnon, signOutUser } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") await signUp(email, password, name);
      else await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (status === "unconfigured") {
    return (
      <>
        <h1>Account</h1>
        <p className="muted">
          Offline mode — everything is stored on this device. Set{" "}
          <code>VITE_FIREBASE_CONFIG</code> at build time to enable sync + accounts.
        </p>
      </>
    );
  }

  if (status === "loading") return <p className="muted">Loading…</p>;

  if (user) {
    return (
      <>
        <h1>Account</h1>
        <div className="card" style={{ maxWidth: 440 }}>
          <p>
            <strong>{user.isAnonymous ? "Anonymous preview" : user.displayName ?? user.email}</strong>
          </p>
          <p className="muted">
            {user.isAnonymous
              ? "Your data stays on this device. Sign up to sync it across devices."
              : "Signed in and syncing with Firestore."}
          </p>
          {user.isAnonymous ? (
            <>
              <p className="muted">Already have an account?</p>
              <button className="btn secondary" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
                {mode === "signup" ? "Switch to sign in" : "Switch to sign up"}
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => void signOutUser()}>
              Sign out
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <h1>{mode === "signup" ? "Create account" : "Sign in"}</h1>
      <form onSubmit={(e) => void submit(e)}>
        {mode === "signup" && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        {error && (
          <p className="muted" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        <button className="btn" disabled={busy}>
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button className="btn secondary" onClick={() => void signInGoogle()}>
          Continue with Google
        </button>
        <button className="btn secondary" onClick={() => void signInAnon()}>
          Anonymous preview
        </button>
      </div>
      <p className="muted">
        <button className="btn secondary" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </p>
    </>
  );
}
