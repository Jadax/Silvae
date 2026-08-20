import { useAuth } from "../lib/auth";
import SettingsPanel from "../components/SettingsPanel";

export default function Account() {
  const { user, signOutUser } = useAuth();

  return (
    <>
      <h1>Account</h1>
      <div className="card" style={{ maxWidth: 440 }}>
        <p>
          <strong>{user?.displayName ?? user?.email}</strong>
        </p>
        <p className="muted">Signed in. Data syncs with Firestore when online.</p>
        <button className="btn secondary" onClick={() => void signOutUser()}>
          Sign out
        </button>
      </div>
      <SettingsPanel />
    </>
  );
}
