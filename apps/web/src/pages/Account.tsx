import { useState } from "react";
import { UnsyncedChangesError, useAuth } from "../lib/auth";
import SettingsPanel from "../components/SettingsPanel";

export default function Account() {
  const { user, signOutUser, deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function signOutSafely() {
    setBusy(true);
    setMessage(null);
    try {
      await signOutUser();
    } catch (err) {
      if (
        err instanceof UnsyncedChangesError &&
        window.confirm(
          `${err.message} (you may be offline). Signing out now removes them from this device. Sign out anyway?`,
        )
      ) {
        await signOutUser({ force: true });
      } else if (!(err instanceof UnsyncedChangesError)) {
        setMessage("Couldn't sign out. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteEverything() {
    const ok = window.confirm(
      "Delete your account and everything in it? Your plants, care history, journal photos and preferences are removed from every device. This can't be undone.",
    );
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteAccount();
    } catch (err) {
      setMessage(
        err instanceof Error && err.message === "requires-recent-login"
          ? "Your plant data is deleted. For your security, sign out, sign back in, then tap Delete account again to remove the account itself."
          : "Couldn't delete everything. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Account</h1>
      <div className="card" style={{ maxWidth: 440 }}>
        <p>
          <strong>{user?.displayName ?? user?.email}</strong>
        </p>
        <p className="muted">
          Your plants, care history, journal photos and preferences sync to every device you sign in on.
          Your location stays on this device.
        </p>
        <button className="btn secondary" disabled={busy} onClick={() => void signOutSafely()}>
          {busy ? "Working..." : "Sign out"}
        </button>
        {message && <p className="form-error" role="alert">{message}</p>}
      </div>
      <SettingsPanel />
      <div className="card" style={{ maxWidth: 440 }}>
        <h2>Delete account and data</h2>
        <p className="muted">Removes your account and everything you've added, on every device.</p>
        <button className="delete-link" disabled={busy} onClick={() => void deleteEverything()}>
          Delete my account
        </button>
      </div>
    </>
  );
}
