import { useEffect, useState } from "react";

// Person A owns this file and everything in /frontend.
// Consumes GET /api/opportunity from the backend - see docs/PRD.md section 12.
// Do not call Stay22, FreeSolo, or Chexy directly from here.

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

// Backend prices sit on Stay22's ~10-min cache, so polling more often than
// this just re-reads the backend's cache (safe, but pointless to go faster).
const POLL_MS = 60 * 1000;

// Shown only when the backend is unreachable, so the board never looks empty.
const DEMO_ROUTES = [
  { category: "food_delivery", destination: "Banff, AB", livePrice: 214, progress: 0.71 },
  { category: "subscriptions", destination: "Montreal, QC", livePrice: 96, progress: 0.34 },
  { category: "shopping", destination: "Tofino, BC", livePrice: 338, progress: 0.18 },
];

function labelize(category) {
  return category.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}

function Flap({ value }) {
  return <span className="flap">{value}</span>;
}

function StatusPill({ progress }) {
  const boarding = progress >= 0.5;
  return (
    <span className={`status ${boarding ? "status--boarding" : "status--waiting"}`}>
      {boarding ? "boarding" : "waiting"}
    </span>
  );
}

export default function App() {
  const [routes, setRoutes] = useState(DEMO_ROUTES);
  const [live, setLive] = useState(false);
  const [coachMessage, setCoachMessage] = useState(
    "Cut $150 from food delivery this month and Banff is already 71% funded, two more weeks gets you there."
  );
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const r = await fetch(
          `${BACKEND_URL}/api/opportunity?category=food_delivery&amount=150`
        );
        const data = await r.json();
        if (cancelled) return;
        if (Array.isArray(data.routes) && data.routes.length > 0) {
          setRoutes(data.routes);
          setLive(true);
        }
        if (data.coachMessage) setCoachMessage(data.coachMessage);
        setLastUpdated(new Date());
      } catch {
        // backend not running yet - keep demo rows, don't break the UI
      }
    }

    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="brand">
            yon<span>der</span>
          </div>
          <div className="tagline">where your spending is actually going</div>
        </div>
      </header>

      <div className="board-labels">
        <span>Category</span>
        <span>Destination</span>
        <span>Live price</span>
        <span>Status</span>
      </div>

      {routes.map((r) => (
        <div className="route-row" key={r.category}>
          <div className="route-category">{labelize(r.category)}</div>
          <div className="route-destination">{r.destination.toUpperCase()}</div>
          <Flap value={r.livePrice != null ? `$${r.livePrice}` : "—"} />
          <StatusPill progress={r.progress} />
        </div>
      ))}

      <div className="coach-card">
        <div className="coach-label">Coach</div>
        <div className="coach-message">{coachMessage}</div>
      </div>

      <div className="meta">
        <span>
          {live ? "Live from backend" : "Demo data (backend offline)"} · prices on a
          10-minute cache
        </span>
        <span>Last updated {lastUpdated.toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
