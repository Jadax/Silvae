import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "./firebase";
import { ensureUserDoc, flushPendingWrites, pruneExpiredCaches, setUid, subscribeToCloud } from "./repo";

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
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    isFirebaseConfigured ? "loading" : "unconfigured",
  );
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const a = auth;
    if (!a) return;
    const onOnline = () => void flushPendingWrites();
    window.addEventListener("online", onOnline);
    void getRedirectResult(a);
    const unsub = onAuthStateChanged(a, (u) => {
      if (u?.isAnonymous) {
        // Leftover session from before mandatory registration — anonymous
        // accounts never satisfy the sign-up gate, so drop it and treat as
        // signed-out instead of silently admitting a guest.
        void signOut(a);
        return;
      }
      setUser(u);
      if (u) {
        setUid(u.uid);
        setStatus("signed-in");
        subscribeToCloud(u.uid);
        void flushPendingWrites();
        void ensureUserDoc();
        void pruneExpiredCaches();
      } else {
        setUid(undefined);
        setStatus("signed-out");
      }
    });
    return () => {
      window.removeEventListener("online", onOnline);
      unsub();
    };
  }, []);

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
      signOutUser: async () => {
        if (!auth) return;
        await signOut(auth);
      },
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
