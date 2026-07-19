import { useEffect, useState } from "react";

// Shared data layer for the dashboard shell. Owns both backend polls and the
// offline demo fallbacks so views stay presentational.
// Backend prices sit on Stay22's ~10-min cache, so polling faster than 60s
// just re-reads the backend's cache.

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
export const POLL_MS = 60 * 1000;

/* ---------------- demo fallback: /api/opportunity ---------------- */

function demoHistory(base, drift) {
  const now = Date.now();
  return [7, 6, 5, 4, 3, 2, 1, 0].map((daysAgo, i) => ({
    t: new Date(now - daysAgo * 86400000).toISOString(),
    price: Math.round(base - drift * (i / 7) + Math.sin(i * 1.7) * base * 0.02),
  }));
}

export const DEMO_ROUTES = [
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

const DEMO_COACH =
  "Cut $150 from food delivery this month and Banff is already 71% funded, two more weeks gets you there.";

/* ---------------- demo fallback: /api/market ---------------- */

const SUPPLIERS = ["Booking.com", "Vrbo", "Expedia", "Hotels.com"];

function demoTicker({
  symbol,
  destination,
  last,
  changeAbs,
  quotes,
  property,
  arb = false,
  affordable = false,
}) {
  const now = Date.now();
  const history = Array.from({ length: 12 }, (_, i) => {
    const frac = i / 11;
    const wobble = Math.sin(i * 1.9 + last) * last * 0.015;
    return {
      t: new Date(now - (11 - i) * 2 * 3600000).toISOString(),
      price: Math.round((last - changeAbs * (1 - frac) + wobble) * 100) / 100,
    };
  });
  const prices = history.map((p) => p.price);
  const book = SUPPLIERS.map((supplier, i) => ({ supplier, price: quotes[i] })).sort(
    (a, b) => a.price - b.price
  );
  const best = book[0];
  const worst = book[book.length - 1];
  const spreadAbs = Math.round((worst.price - best.price) * 100) / 100;
  return {
    symbol,
    destination,
    last,
    changeAbs,
    changePct: Math.round((changeAbs / (last - changeAbs)) * 1000) / 10,
    history,
    dayRange: { low: Math.min(...prices), high: Math.max(...prices) },
    book,
    spread: {
      bestSupplier: best.supplier,
      bestPrice: best.price,
      worstSupplier: worst.supplier,
      worstPrice: worst.price,
      spreadAbs,
      spreadPct: Math.round((spreadAbs / best.price) * 1000) / 10,
    },
    arb,
    affordable,
    property,
    buyUrl: "https://www.stay22.com",
  };
}

export const DEMO_MARKET = {
  asOf: new Date().toISOString(),
  mode: "mock",
  buyingPower: 387.42,
  tickers: [
    demoTicker({
      symbol: "YBNF",
      destination: "Banff, AB",
      last: 214.0,
      changeAbs: -12.5,
      quotes: [214.0, 245.0, 222.5, 231.0],
      property: { name: "Spruce Ridge Lodge", type: "cabin", rating: 9.2 },
      arb: true,
      affordable: true,
    }),
    demoTicker({
      symbol: "YMTL",
      destination: "Montreal, QC",
      last: 96.0,
      changeAbs: 4.25,
      quotes: [101.0, 118.0, 96.0, 99.5],
      property: { name: "H\u00F4tel Le Vieux-Port", type: "hotel", rating: 8.6 },
      arb: true,
      affordable: true,
    }),
    demoTicker({
      symbol: "YTOF",
      destination: "Tofino, BC",
      last: 338.0,
      changeAbs: -9.0,
      quotes: [338.0, 344.0, 352.0, 341.5],
      property: { name: "Driftwood Surf Cabins", type: "cabin", rating: 9.6 },
    }),
    demoTicker({
      symbol: "YPEC",
      destination: "Prince Edward County, ON",
      last: 142.75,
      changeAbs: -21.0,
      quotes: [149.0, 142.75, 168.0, 155.25],
      property: { name: "Auberge du Vieux Quartier", type: "hotel", rating: 8.9 },
      arb: true,
      affordable: true,
    }),
    demoTicker({
      symbol: "YBLU",
      destination: "Blue Mountain, ON",
      last: 128.5,
      changeAbs: 6.0,
      quotes: [131.0, 128.5, 136.0, 133.5],
      property: { name: "Harbourfront Inn", type: "hotel", rating: 8.2 },
    }),
    demoTicker({
      symbol: "YNTL",
      destination: "Niagara-on-the-Lake, ON",
      last: 289.0,
      changeAbs: -3.25,
      quotes: [305.0, 289.0, 297.5, 312.0],
      property: { name: "Coal Harbour Suites", type: "hotel", rating: 9.0 },
    }),
  ],
  movers: { up: "YBLU", down: "YPEC" },
  tape: [
    "\u25BC YBNF 214.00 -12.50 (-5.5%)",
    "\u25B2 YMTL 96.00 +4.25 (+4.6%)",
    "\u25BC YTOF 338.00 -9.00 (-2.6%)",
    "\u25BC YPEC 142.75 -21.00 (-12.8%)",
    "\u25B2 YBLU 128.50 +6.00 (+4.9%)",
    "\u25BC YNTL 289.00 -3.25 (-1.1%)",
    "ARB ALERT: YPEC quoted 142.75\u2013168.00 across makers (17.7% spread)",
    "BUYING POWER 387.42 \u00B7 funded by cut spending",
  ],
};

// Merge a (possibly partial) backend payload over sane defaults so missing
// fields never crash the grid.
export function normalizeMarket(data) {
  if (!data || !Array.isArray(data.tickers) || data.tickers.length === 0) return null;
  const buyingPower = Number.isFinite(data.buyingPower)
    ? data.buyingPower
    : DEMO_MARKET.buyingPower;
  const tickers = data.tickers
    .filter((t) => t && t.symbol)
    .map((t) => ({
      destination: "",
      history: [],
      book: [],
      arb: false,
      ...t,
      affordable:
        typeof t.affordable === "boolean"
          ? t.affordable
          : Number.isFinite(t.last) && t.last <= buyingPower,
    }));
  if (tickers.length === 0) return null;
  return {
    asOf: data.asOf || new Date().toISOString(),
    mode: data.mode === "live" ? "live" : "mock",
    buyingPower,
    tickers,
    movers: data.movers || { up: null, down: null },
    tape: Array.isArray(data.tape) ? data.tape : [],
  };
}

/* ---------------- polling hooks ---------------- */

// Poll GET /api/opportunity while `active`. Keeps the last payload when the
// view unmounts the poll, falls back to DEMO_ROUTES if the backend is down.
// routes === null means "first fetch still in flight" (render skeletons).
export function useOpportunity(active) {
  const [state, setState] = useState({
    routes: null,
    coachMessage: DEMO_COACH,
    goalProgress: null,
    live: false,
    feedMode: null,
    lastUpdated: null,
  });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function refresh() {
      try {
        const r = await fetch(
          `${BACKEND_URL}/api/opportunity?category=food_delivery&amount=150`
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (cancelled) return;
        if (!Array.isArray(data.routes) || data.routes.length === 0) throw new Error("empty");
        setState({
          routes: data.routes,
          coachMessage: data.coachMessage || DEMO_COACH,
          goalProgress: Number.isFinite(data.goalProgress) ? data.goalProgress : null,
          live: true,
          feedMode: data.meta && data.meta.stay22Mode ? data.meta.stay22Mode : null,
          lastUpdated: new Date(),
        });
      } catch {
        if (cancelled) return;
        // Backend down: fall back to demo rows, but never clobber live data.
        setState((s) =>
          s.live ? s : { ...s, routes: s.routes || DEMO_ROUTES, live: false, lastUpdated: new Date() }
        );
      }
    }

    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active]);

  return state;
}

// Poll GET /api/market while `active`. market === null means "first fetch
// still in flight"; on failure the demo market keeps the terminal alive.
export function useMarket(active) {
  const [state, setState] = useState({ market: null, live: false, lastUpdated: null });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function refresh() {
      try {
        const r = await fetch(`${BACKEND_URL}/api/market`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (cancelled) return;
        const normalized = normalizeMarket(data);
        if (!normalized) throw new Error("unusable payload");
        setState({ market: normalized, live: true, lastUpdated: new Date() });
      } catch {
        if (cancelled) return;
        setState((s) =>
          s.live ? s : { ...s, market: s.market || DEMO_MARKET, live: false, lastUpdated: new Date() }
        );
      }
    }

    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active]);

  return state;
}
