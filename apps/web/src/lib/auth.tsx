import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "./firebase";
import {
  deleteAllCloudData,
  ensureUserDoc,
  flushPendingWrites,
  pendingWriteCount,
  pruneExpiredCaches,
  setUid,
  subscribeToCloud,
  wipeLocalData,
} from "./repo";

const OWNER_KEY = "silvae-device-owner";

/** Thrown by signOutUser when edits made offline still haven't reached the cloud. */
export class UnsyncedChangesError extends Error {
  constructor(public readonly count: number) {
    super(`${count} change${count === 1 ? "" : "s"} haven't synced yet`);
  }
}

/**
 * Local data belongs to whoever last signed in here. If a different account
 * signs in (say the previous session simply expired), start clean so one
 * person's plants never get uploaded into someone else's account.
 */
async function claimDevice(uid: string): Promise<void> {
  let owner: string | null = null;
  try {
    owner = localStorage.getItem(OWNER_KEY);
  } catch {
    return;
  }
  if (owner && owner !== uid) await wipeLocalData();
  try {
    localStorage.setItem(OWNER_KEY, uid);
  } catch {
    // storage blocked; nothing more we can do
  }
}

/**
 * Registration/sign-in gate. Rendered full-screen whenever there's no
 * signed-in account.
 */
type AuthStatus = "unconfigured" | "loading" | "signed-out" | "signed-in";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  /** Deletes all of the account's data and then the account. Rejects with "requires-recent-login" when Firebase asks for a fresh sign-in. */
  deleteAccount: () => Promise<void>;
  /** Rejects with UnsyncedChangesError unless `force` when offline edits are still queued. */
  signOutUser: (opts?: { force?: boolean }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    isFirebaseConfigured ? "loading" : "unconfigured",
  );
  const [user, setUser] = useState<User | null>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    const a = auth;
    if (!a) return;
    const onOnline = () => void flushPendingWrites();
    window.addEventListener("online", onOnline);
    void getRedirectResult(a);

    // Cloud snapshots land in Dexie; refresh the screens (not the weather) shortly after.
    let refreshTimer: number | undefined;
    const refreshData = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "weather" });
      }, 250);
    };

    let stopSync: (() => void) | undefined;
    let generation = 0;
    const unsub = onAuthStateChanged(a, (u) => {
      if (u?.isAnonymous) {
        // Leftover session from before mandatory registration: anonymous
        // accounts never satisfy the sign-up gate.
        void signOut(a);
        return;
      }
      const mine = ++generation;
      stopSync?.();
      stopSync = undefined;
      setUser(u);
      if (!u) {
        setUid(undefined);
        setStatus("signed-out");
        return;
      }
      void (async () => {
        await claimDevice(u.uid);
        if (mine !== generation) return;
        setUid(u.uid);
        setStatus("signed-in");
        stopSync = subscribeToCloud(u.uid, refreshData);
        void ensureUserDoc();
        void pruneExpiredCaches();
      })();
    });
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearTimeout(refreshTimer);
      stopSync?.();
      unsub();
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signUp: async (email, password, name) => {
        if (!auth) return;
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) await updateProfile(cred.user, { displayName: name });
      },
      signIn: async (email, password) => {
        if (!auth) return;
        await signInWithEmailAndPassword(auth, email, password);
      },
      signInGoogle: async () => {
        if (!auth) return;
        await signInWithRedirect(auth, new GoogleAuthProvider());
      },
      deleteAccount: async () => {
        const current = auth?.currentUser;
        if (!auth || !current) return;
        await deleteAllCloudData();
        try {
          await deleteUser(current);
        } catch (err) {
          if ((err as { code?: string }).code === "auth/requires-recent-login") throw new Error("requires-recent-login");
          throw err;
        }
        try {
          localStorage.removeItem(OWNER_KEY);
        } catch {
          // ignore
        }
        queryClient.clear();
      },
      signOutUser: async (opts) => {
        if (!auth) return;
        await flushPendingWrites();
        const unsynced = await pendingWriteCount();
        if (unsynced > 0 && !opts?.force) throw new UnsyncedChangesError(unsynced);
        await signOut(auth);
        await wipeLocalData();
        try {
          localStorage.removeItem(OWNER_KEY);
        } catch {
          // ignore
        }
        queryClient.clear();
      },
    }),
    [status, user, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
