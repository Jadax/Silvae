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
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "./firebase";
import { ensureUserDoc, pruneExpiredCaches, setUid, subscribeToCloud } from "./repo";

type AuthStatus = "unconfigured" | "loading" | "anonymous" | "signed-in";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signInAnon: () => Promise<void>;
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
    const unsub = onAuthStateChanged(a, async (u) => {
      setUser(u);
      if (u) {
        setUid(u.uid);
        if (u.isAnonymous) setStatus("anonymous");
        else setStatus("signed-in");
        subscribeToCloud(u.uid);
        if (!u.isAnonymous) void ensureUserDoc();
        void pruneExpiredCaches();
      } else {
        setUid(undefined);
        setStatus("loading");
        await signInAnonymously(a).catch(() => {
          setStatus("signed-in");
        });
      }
    });
    return unsub;
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
        await signInWithPopup(auth, new GoogleAuthProvider());
      },
      signInAnon: async () => {
        if (!auth) return;
        await signInAnonymously(auth);
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
