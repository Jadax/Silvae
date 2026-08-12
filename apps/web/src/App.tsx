import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";

const Home = lazy(() => import("./pages/Home"));
const Discover = lazy(() => import("./pages/Discover"));
const PlantDetail = lazy(() => import("./pages/PlantDetail"));
const SpeciesGuide = lazy(() => import("./pages/SpeciesGuide"));
const AddPlant = lazy(() => import("./pages/AddPlant"));
const Account = lazy(() => import("./pages/Account"));
const Doctor = lazy(() => import("./pages/Doctor"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Welcome = lazy(() => import("./pages/Welcome"));
import { useAuth } from "./lib/auth";

const THEME_KEY = "silvae-theme";

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
};

const navItems: NavItem[] = [
  { to: "/", label: "My garden", end: true, icon: <LeafIcon /> },
  { to: "/discover", label: "Discover", icon: <SearchIcon /> },
  { to: "/doctor", label: "Plant doctor", icon: <DoctorIcon /> },
  { to: "/account", label: "You", icon: <PersonIcon /> },
];

function Navigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav className={mobile ? "bottom-nav" : "desktop-nav"} aria-label="Primary">
      {navItems.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end}>
          <span className="nav-icon" aria-hidden>{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const { status } = useAuth();

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }, [dark]);

  if (status === "loading") {
    return (
      <div className="auth-loading">
        <p>Loading…</p>
      </div>
    );
  }

  if (status === "unconfigured") {
    return (
      <div className="auth-page">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden><LeafIcon /></span>
          <strong>Silvae</strong>
          <small>Grow happy, free forever</small>
        </div>
        <section className="card auth-card">
          <span className="eyebrow">Setup needed</span>
          <h1>Accounts aren't configured yet</h1>
          <p className="muted">
            Silvae needs a Firebase project to create accounts. Set <code>VITE_FIREBASE_CONFIG</code> at
            build time (see <code>.env.example</code>) and reload.
          </p>
        </section>
      </div>
    );
  }

  if (status === "signed-out") {
    return (
      <Suspense fallback={<div className="auth-loading"><p>Loading…</p></div>}>
        <Welcome />
      </Suspense>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Silvae home">
          <span className="brand-mark" aria-hidden><LeafIcon /></span>
          <span>
            <strong>Silvae</strong>
            <small>Grow happy</small>
          </span>
        </Link>
        <Navigation />
        <button
          className="theme-toggle"
          onClick={() => setDark((value) => !value)}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>
      <main>
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/plants/:id" element={<PlantDetail />} />
            <Route path="/species/:slug" element={<SpeciesGuide />} />
            <Route path="/add" element={<AddPlant />} />
            <Route path="/account" element={<Account />} />
            <Route path="/doctor" element={<Doctor />} />
            <Route path="/onboard" element={<Onboarding />} />
          </Routes>
        </Suspense>
      </main>
      <Navigation mobile />
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>;
}

function LeafIcon() {
  return <Icon><path d="M20 4.5C12.5 4.5 6 8.3 6 14c0 2.9 2.2 5 5.2 5C17 19 20 12.5 20 4.5Z" /><path d="M4 20c2.5-4.8 6.2-7.9 11-10" /></Icon>;
}

function SearchIcon() {
  return <Icon><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></Icon>;
}

function DoctorIcon() {
  return <Icon><path d="M12 21s7-3.8 7-10V5l-7-2-7 2v6c0 6.2 7 10 7 10Z" /><path d="M9 12h6M12 9v6" /></Icon>;
}

function PersonIcon() {
  return <Icon><circle cx="12" cy="8" r="3.5" /><path d="M5 21c.5-4 3-6 7-6s6.5 2 7 6" /></Icon>;
}

function SunIcon() {
  return <Icon><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>;
}

function MoonIcon() {
  return <Icon><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" /></Icon>;
}
