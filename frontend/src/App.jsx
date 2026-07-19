import { useEffect, useState } from "react";
import RouteRow from "./components/RouteRow.jsx";
import ExchangeView from "./components/ExchangeView.jsx";

// Person A owns this file and everything in /frontend.
// Consumes GET /api/opportunity from the backend - see docs/PRD.md section 12.
// Do not call Stay22, FreeSolo, or Chexy directly from here.

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

// Backend prices sit on Stay22's ~10-min cache, so polling more often than
// this just re-reads the backend's cache (safe, but pointless to go faster).
const POLL_MS = 60 * 1000;

function demoHistory(base, drift) {
  // ~8 plausible points, oldest -> newest, ending near base.
  const now = Date.now();
  return [7, 6, 5, 4, 3, 2, 1, 0].map((daysAgo, i) => ({
    t: new Date(now - daysAgo * 86400000).toISOString(),
    price: Math.round(base - drift * (i / 7) + Math.sin(i * 1.7) * base * 0.02),
  }));
}

// Shown only when the backend is unreachable, so the board never looks empty.
const DEMO_ROUTES = [
  {
    category: "food_delivery",
    destination: "Banff, AB",
    monthlyTotal: 210,
    recoverableSpend: 150,
    livePrice: 214,
    progress: 0.71,
    priceDelta: -12,
    priceHistory: demoHistory(226, 12),
    bookUrl: "https://www.stay22.com",
    property: {
      name: "Spruce Ridge Lodge",
      type: "cabin",
      rating: 9.2,
      capacity: 4,
      freeCancellation: true,
      instantBook: true,
    },
    green: {
      distanceKm: 3420,
      carbonKgCO2e: 540,
      greenerAlternative: { destination: "Blue Mountain, ON", carbonKgCO2e: 45, savingsKg: 495 },
    },
  },
  {
    category: "subscriptions",
    destination: "Montreal, QC",
    monthlyTotal: 64,
    recoverableSpend: 33,
    livePrice: 96,
    progress: 0.34,
    priceDelta: 4,
    priceHistory: demoHistory(92, -4),
    bookUrl: "https://www.stay22.com",
    property: {
      name: "H\u00F4tel Le Vieux-Port",
      type: "hotel",
      rating: 8.6,
      capacity: 2,
      freeCancellation: true,
      instantBook: false,
    },
    green: {
      distanceKm: 540,
      carbonKgCO2e: 130,
      greenerAlternative: null,
    },
  },
  {
    category: "shopping",
    destination: "Tofino, BC",
    monthlyTotal: 180,
    recoverableSpend: 61,
    livePrice: 338,
    progress: 0.18,
    priceDelta: -9,
    priceHistory: demoHistory(347, 9),
    bookUrl: "https://www.stay22.com",
    property: {
      name: "Driftwood Surf Cabins",
      type: "cabin",
      rating: 9.6,
      capacity: 3,
      freeCancellation: false,
      instantBook: true,
    },
    green: {
      distanceKm: 4370,
      carbonKgCO2e: 690,
      greenerAlternative: { destination: "Sauble Beach, ON", carbonKgCO2e: 60, savingsKg: 630 },
    },
  },
];

export default function App() {
  const [view, setView] = useState("departures"); // "departures" | "exchange"
  const [routes, setRoutes] = useState(DEMO_ROUTES);
  const [live, setLive] = useState(false);
  const [feedMode, setFeedMode] = useState(null); // "live" | "mock" | null (backend down)
  const [coachMessage, setCoachMessage] = useState(
    "Cut $150 from food delivery this month and Banff is already 71% funded, two more weeks gets you there."
  );
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Only poll /api/opportunity while the departures board is visible; the
  // exchange view owns its own /api/market polling inside ExchangeView.
  useEffect(() => {
    if (view !== "departures") return;
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
        setFeedMode(data.meta && data.meta.stay22Mode ? data.meta.stay22Mode : null);
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
  }, [view]);

  const totalRecoverable = routes.reduce(
    (sum, r) => sum + (Number.isFinite(r.recoverableSpend) ? r.recoverableSpend : 0),
    0
  );

  const feedLabel = !live ? "DEMO" : feedMode === "live" ? "LIVE FEED" : "MOCK FEED";
  const feedIsLive = live && feedMode === "live";

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="brand">
            yon<span>der</span>
          </div>
          <div className="tagline">where your spending is actually going</div>
        </div>

        <div className="header-right">
          <div className="view-tabs" role="tablist" aria-label="Board view">
            <button
              type="button"
              role="tab"
              aria-selected={view === "departures"}
              className={`view-tab${view === "departures" ? " view-tab--active" : ""}`}
              onClick={() => setView("departures")}
            >
              Departures
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "exchange"}
              className={`view-tab${view === "exchange" ? " view-tab--active" : ""}`}
              onClick={() => setView("exchange")}
            >
              Exchange
            </button>
          </div>

          {view === "departures" && (
            <div className="header-stats">
              {totalRecoverable > 0 && (
                <div className="header-recoverable">
                  <span className="header-recoverable__amount">${Math.round(totalRecoverable)}</span>
                  /mo recoverable
                </div>
              )}
              <span className={`feed-badge${feedIsLive ? " feed-badge--live" : ""}`}>
                {feedLabel}
              </span>
            </div>
          )}
        </div>
      </header>

      {view === "exchange" ? (
        <ExchangeView />
      ) : (
        <>
          <div className="board-labels">
            <span>Category</span>
            <span>Destination</span>
            <span>Trend</span>
            <span>Live price</span>
            <span>Status</span>
          </div>

          {routes.map((r) => (
            <RouteRow
              key={r.category}
              route={r}
              expanded={expandedCategory === r.category}
              onToggle={() =>
                setExpandedCategory((cur) => (cur === r.category ? null : r.category))
              }
            />
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
        </>
      )}
    </div>
  );
}
