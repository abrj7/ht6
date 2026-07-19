import { useEffect, useState } from "react";
import TickerTape from "./TickerTape.jsx";
import TickerCard from "./TickerCard.jsx";

// Yonder Exchange: Stay22 inventory rendered as a securities exchange.
// Destinations are tickers, the 4 suppliers are market makers quoting the
// same room, the user's cut spending is buying power, BUY = affiliate link.
//
// Polls GET /api/market every 60s while mounted (App only mounts the visible
// view). Falls back to DEMO_MARKET whenever the endpoint is down or the
// payload is unusable, and normalizes partial payloads so the grid never
// renders broken.

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
const POLL_MS = 60 * 1000;

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

const DEMO_MARKET = {
  asOf: new Date().toISOString(),
  mode: "mock",
  buyingPower: 387.42,
  tickers: [
    demoTicker({
      symbol: "BANF",
      destination: "Banff, AB",
      last: 214.0,
      changeAbs: -12.5,
      quotes: [214.0, 245.0, 222.5, 231.0],
      property: { name: "Spruce Ridge Lodge", type: "cabin", rating: 9.2 },
      arb: true,
      affordable: true,
    }),
    demoTicker({
      symbol: "MTRL",
      destination: "Montreal, QC",
      last: 96.0,
      changeAbs: 4.25,
      quotes: [101.0, 118.0, 96.0, 99.5],
      property: { name: "H\u00F4tel Le Vieux-Port", type: "hotel", rating: 8.6 },
      arb: true,
      affordable: true,
    }),
    demoTicker({
      symbol: "TFNO",
      destination: "Tofino, BC",
      last: 338.0,
      changeAbs: -9.0,
      quotes: [338.0, 344.0, 352.0, 341.5],
      property: { name: "Driftwood Surf Cabins", type: "cabin", rating: 9.6 },
    }),
    demoTicker({
      symbol: "QBEC",
      destination: "Qu\u00E9bec City, QC",
      last: 142.75,
      changeAbs: -21.0,
      quotes: [149.0, 142.75, 168.0, 155.25],
      property: { name: "Auberge du Vieux Quartier", type: "hotel", rating: 8.9 },
      arb: true,
      affordable: true,
    }),
    demoTicker({
      symbol: "HLFX",
      destination: "Halifax, NS",
      last: 128.5,
      changeAbs: 6.0,
      quotes: [131.0, 128.5, 136.0, 133.5],
      property: { name: "Harbourfront Inn", type: "hotel", rating: 8.2 },
    }),
    demoTicker({
      symbol: "VANC",
      destination: "Vancouver, BC",
      last: 289.0,
      changeAbs: -3.25,
      quotes: [305.0, 289.0, 297.5, 312.0],
      property: { name: "Coal Harbour Suites", type: "hotel", rating: 9.0 },
    }),
  ],
  movers: { up: "HLFX", down: "QBEC" },
  tape: [
    "\u25BC BANF 214.00 -12.50 (-5.5%)",
    "\u25B2 MTRL 96.00 +4.25 (+4.6%)",
    "\u25BC TFNO 338.00 -9.00 (-2.6%)",
    "\u25BC QBEC 142.75 -21.00 (-12.8%)",
    "\u25B2 HLFX 128.50 +6.00 (+4.9%)",
    "\u25BC VANC 289.00 -3.25 (-1.1%)",
    "ARB ALERT: QBEC quoted 142.75\u2013168.00 across makers (17.7% spread)",
    "BUYING POWER 387.42 \u00B7 funded by cut spending",
  ],
};

// Merge a (possibly partial) backend payload over the demo dataset so
// missing fields never crash the grid.
function normalizeMarket(data) {
  if (!data || !Array.isArray(data.tickers) || data.tickers.length === 0) {
    return DEMO_MARKET;
  }
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
  if (tickers.length === 0) return DEMO_MARKET;
  return {
    asOf: data.asOf || new Date().toISOString(),
    mode: data.mode === "live" ? "live" : "mock",
    buyingPower,
    tickers,
    movers: data.movers || { up: null, down: null },
    tape: Array.isArray(data.tape) ? data.tape : [],
  };
}

export default function ExchangeView() {
  const [market, setMarket] = useState(DEMO_MARKET);
  const [live, setLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [expandedSymbol, setExpandedSymbol] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const r = await fetch(`${BACKEND_URL}/api/market`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (cancelled) return;
        const normalized = normalizeMarket(data);
        setMarket(normalized);
        setLive(normalized !== DEMO_MARKET);
        setLastUpdated(new Date());
      } catch {
        // backend not up yet - keep the demo market so the terminal never blanks
      }
    }

    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const { buyingPower, tickers, movers, tape } = market;
  const affordableCount = tickers.filter((t) => t.affordable).length;
  const feedLabel = !live ? "DEMO" : market.mode === "live" ? "LIVE FEED" : "MOCK FEED";

  return (
    <div className="exchange">
      <TickerTape tape={tape} />

      <div className="power-strip">
        <div>
          <div className="micro-label">Buying power</div>
          <div className="power-amount">
            ${buyingPower.toFixed(2)}
            <span className="power-note">funded by your cut spending</span>
          </div>
        </div>
        <div className="power-right">
          <span
            className={`feed-badge${live && market.mode === "live" ? " feed-badge--live" : ""}`}
          >
            {feedLabel}
          </span>
          <div className="power-reach">
            {affordableCount} of {tickers.length} tickers within reach
          </div>
        </div>
      </div>

      <div className="market-grid">
        {tickers.map((t) => (
          <TickerCard
            key={t.symbol}
            ticker={t}
            moverDir={
              movers && movers.up === t.symbol
                ? "up"
                : movers && movers.down === t.symbol
                ? "down"
                : null
            }
            buyingPower={buyingPower}
            expanded={expandedSymbol === t.symbol}
            onToggle={() =>
              setExpandedSymbol((cur) => (cur === t.symbol ? null : t.symbol))
            }
          />
        ))}
      </div>

      <div className="meta">
        <span>
          {live ? "Live from backend" : "Demo data (backend offline)"} · quotes on a
          10-minute cache · for travelers, down is up
        </span>
        <span>Last updated {lastUpdated.toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
