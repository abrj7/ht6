import express from "express";
import cors from "cors";
import "dotenv/config";
import { searchAccommodations } from "./stay22Client.js";
import {
  mockSearchAccommodations,
  CATEGORY_DESTINATIONS,
  CATALOG_DESTINATIONS,
  DESTINATION_COORDS,
  MAP_CITIES,
  CITY_CENTERS,
  resolveCity,
} from "./mockStay22.js";
import ragRouter from "./routes/rag.js";
import voiceRouter from "./routes/voice.js";
import nowcastRouter from "./routes/nowcast.js";
import matchRouter from "./routes/match.js";
import { authMiddleware, ensureUserProfile } from "./auth.js";
import { insertTransaction, getDb } from "./mongoClient.js";

const app = express();
app.use(cors());
app.use(express.json());

// Feature routers - each owned by its workstream (see file headers).
app.use("/api/ask", ragRouter);
app.use("/api/voice", voiceRouter);
app.use("/api/nowcast", nowcastRouter);
app.use("/api/match", matchRouter);
app.use("/api/spend", authMiddleware(), ensureUserProfile);

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";
const CHEXY_SERVICE_URL = process.env.CHEXY_SERVICE_URL || "http://localhost:5002";
const USE_REAL_STAY22 = Boolean(process.env.STAY22_API_KEY);

// User origin for the green/carbon layer (demo assumption: Toronto).
const ORIGIN = { lat: 43.6532, lng: -79.3832 };

// ---------------------------------------------------------------------------
// Dates: price every stay as next Friday -> Sunday (2 nights).
// ---------------------------------------------------------------------------
function nextWeekendDates() {
  const now = new Date();
  let daysUntilFriday = (5 - now.getDay() + 7) % 7;
  if (daysUntilFriday === 0) daysUntilFriday = 7; // today is Friday -> next week
  const checkin = new Date(now);
  checkin.setDate(now.getDate() + daysUntilFriday);
  const checkout = new Date(checkin);
  checkout.setDate(checkin.getDate() + 2);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { checkin: fmt(checkin), checkout: fmt(checkout) };
}

// ---------------------------------------------------------------------------
// Price history engine. Stay22 is snapshot-only, so we build our own time
// series: every fresh pricing of a destination appends a point. In mock mode
// the first pricing seeds ~8 backdated points so sparklines render on demo day.
// ---------------------------------------------------------------------------
const PRICE_HISTORY_CAP = 50;
const SEED_POINTS = 8;
const priceHistory = new Map(); // destination -> [{ t, price }] oldest -> newest
const knownDestinations = new Set(); // everything we've ever priced (for the repricer)

function seedBackdatedHistory(currentPrice) {
  // Small random walk backwards from the current price, 10-min intervals.
  const points = [];
  let price = currentPrice;
  for (let i = 1; i <= SEED_POINTS; i++) {
    price = Math.max(20, Math.round(price + (Math.random() - 0.5) * 14));
    points.unshift({
      t: new Date(Date.now() - i * 10 * 60 * 1000).toISOString(),
      price,
    });
  }
  return points;
}

function recordPrice(destination, price) {
  if (typeof price !== "number") return;
  let hist = priceHistory.get(destination);
  if (!hist) {
    hist = USE_REAL_STAY22 ? [] : seedBackdatedHistory(price);
    priceHistory.set(destination, hist);
  }
  // Near-simultaneous fetches (different cache keys) update the same point
  // instead of appending, so the series stays one-point-per-tick.
  const last = hist[hist.length - 1];
  if (last && Date.now() - Date.parse(last.t) < 60 * 1000) {
    last.price = price;
    return;
  }
  hist.push({ t: new Date().toISOString(), price });
  if (hist.length > PRICE_HISTORY_CAP) hist.splice(0, hist.length - PRICE_HISTORY_CAP);
}

function getPriceHistory(destination) {
  return priceHistory.get(destination) ?? [];
}

// current price minus previous snapshot; negative = price dropped.
function getPriceDelta(destination) {
  const hist = getPriceHistory(destination);
  if (hist.length < 2) return null;
  return hist[hist.length - 1].price - hist[hist.length - 2].price;
}

// ---------------------------------------------------------------------------
// Stay22 fetching. Their price cache is ~10 min - never hit them faster.
// ---------------------------------------------------------------------------
const STAY22_CACHE_MS = 10 * 60 * 1000;
const stay22Cache = new Map(); // cacheKey -> { data, fetchedAt }

async function getAccommodations(address, { type, min, max } = {}) {
  knownDestinations.add(address);
  const key = [address, type ?? "", min ?? "", max ?? ""].join("|");
  const cached = stay22Cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < STAY22_CACHE_MS) {
    return cached.data;
  }
  const { checkin, checkout } = nextWeekendDates();
  const data = USE_REAL_STAY22
    ? await searchAccommodations({ address, checkin, checkout, min, max, type })
    : mockSearchAccommodations({ address, type });
  stay22Cache.set(key, { data, fetchedAt: Date.now() });
  // Only untyped searches feed the per-destination series so the history
  // isn't polluted by "hostels only" vs "villas only" price swings.
  if (!type) {
    const best = cheapestOfResults(data.results ?? []);
    recordPrice(address, best);
  }
  return data;
}

// Background repricer: refresh every known destination each cache window so
// the time series keeps moving even when nobody is hitting the API.
setInterval(async () => {
  for (const destination of knownDestinations) {
    try {
      await getAccommodations(destination);
    } catch {
      // upstream flake - next tick will retry
    }
  }
}, STAY22_CACHE_MS + 5 * 1000);

// ---------------------------------------------------------------------------
// Pricing helpers
// ---------------------------------------------------------------------------
function cheapestTotal(property) {
  const totals = Object.values(property.suppliers ?? {})
    .map((s) => s?.price?.total)
    .filter((t) => typeof t === "number");
  return totals.length ? Math.min(...totals) : null;
}

function cheapestOfResults(results) {
  const totals = results.map(cheapestTotal).filter((t) => t !== null);
  return totals.length ? Math.min(...totals) : null;
}

// Best-value = cheapest property that actually has a price.
function bestValueProperty(results) {
  const priced = results
    .map((p) => ({ p, total: cheapestTotal(p) }))
    .filter((x) => x.total !== null)
    .sort((a, b) => a.total - b.total);
  return priced.length ? priced[0].p : null;
}

function propertySummary(p) {
  if (!p) return null;
  return {
    name: p.name ?? null,
    type: p.type ?? null,
    rating: p.rating ?? null,
    capacity: p.capacity ?? null,
    freeCancellation: p.policies?.freeCancellation ?? null,
    instantBook: p.policies?.instantBook ?? null,
  };
}

// ---------------------------------------------------------------------------
// Book-now affiliate links
// ---------------------------------------------------------------------------
function buildBookUrl(property, destination, checkin, checkout) {
  // Real API responses may carry a deeplink; prefer it when present.
  const deeplink =
    property?.deeplink ||
    property?.bookingUrl ||
    property?.url ||
    Object.values(property?.suppliers ?? {})
      .map((s) => s?.deeplink || s?.url)
      .find(Boolean);
  if (deeplink) return deeplink;
  return `https://www.stay22.com/allez/roundtrip?aid=yonder&address=${encodeURIComponent(
    destination
  )}&checkin=${checkin}&checkout=${checkout}`;
}

// ---------------------------------------------------------------------------
// Green/Deloitte layer: haversine distance from Toronto + rough carbon
// estimate. Resource-efficiency framing, not exact science.
// ---------------------------------------------------------------------------
function haversineKm(a, b) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// <400km = drivable (~0.12 kg/km); >=400km assume flight (~0.15 kg/km + 50kg overhead).
function estimateCarbonKg(distanceKm) {
  const kg = distanceKm < 400 ? distanceKm * 0.12 : distanceKm * 0.15 + 50;
  return Math.round(kg * 10) / 10;
}

function greenInfo(destination) {
  const coords = DESTINATION_COORDS[destination];
  if (!coords) return null;
  const distanceKm = Math.round(haversineKm(ORIGIN, coords));
  const carbonKgCO2e = estimateCarbonKg(distanceKm);

  // Greener alternative: the closest OTHER catalog destination with lower carbon.
  let alt = null;
  for (const [name, c] of Object.entries(DESTINATION_COORDS)) {
    if (name === destination) continue;
    const altCarbon = estimateCarbonKg(Math.round(haversineKm(ORIGIN, c)));
    if (altCarbon >= carbonKgCO2e) continue;
    const distFromDest = haversineKm(coords, c);
    if (!alt || distFromDest < alt.distFromDest) {
      alt = {
        destination: name,
        carbonKgCO2e: altCarbon,
        savingsKg: Math.round((carbonKgCO2e - altCarbon) * 10) / 10,
        distFromDest,
      };
    }
  }
  return {
    distanceKm,
    carbonKgCO2e,
    greenerAlternative: alt
      ? {
          destination: alt.destination,
          carbonKgCO2e: alt.carbonKgCO2e,
          savingsKg: alt.savingsKg,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Sibling services (graceful when down)
// ---------------------------------------------------------------------------
async function getSpendSummary() {
  try {
    const res = await fetch(`${CHEXY_SERVICE_URL}/spend-summary?userId=demo`);
    if (!res.ok) throw new Error(`chexy-integration ${res.status}`);
    return await res.json();
  } catch {
    return null; // chexy-integration not running - callers fall back gracefully
  }
}

async function getCoachMessage(spendSummary, goalAmount, tone = "encouraging") {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spendSummary: spendSummary ?? {}, goalAmount, tone }),
    });
    if (!res.ok) throw new Error(`ai-service ${res.status}`);
    const data = await res.json();
    return data.message;
  } catch {
    return null; // ai-service not running - caller uses a fallback line
  }
}

// ---------------------------------------------------------------------------
// Route rows for the departure board: one per spend category.
// ---------------------------------------------------------------------------
async function buildRoute({ category, monthlyTotal, recoverableSpend }) {
  const destination = CATEGORY_DESTINATIONS[category] ?? "Banff, AB";
  const { checkin, checkout } = nextWeekendDates();
  const spendBase = recoverableSpend ?? monthlyTotal;

  let results = [];
  try {
    const acc = await getAccommodations(destination);
    results = acc.results ?? [];
  } catch {
    // Stay22 down for this destination - row still renders with nulls
  }

  const best = bestValueProperty(results);
  const livePrice = best ? cheapestTotal(best) : null;
  // Keep the sparkline's newest point in sync with the price we're showing.
  recordPrice(destination, livePrice);

  return {
    category,
    destination,
    monthlyTotal,
    recoverableSpend: spendBase,
    livePrice,
    progress: livePrice ? Math.min(1, spendBase / livePrice) : 0,
    bookUrl: buildBookUrl(best, destination, checkin, checkout),
    priceDelta: getPriceDelta(destination),
    priceHistory: getPriceHistory(destination),
    property: propertySummary(best),
    green: greenInfo(destination),
  };
}

// GET /api/opportunity?category=food_delivery&amount=150&type=cabin
// Contract (docs/PRD.md section 12) - LOCKED, frontend builds against this shape.
app.get("/api/opportunity", async (req, res) => {
  const { category, amount, type } = req.query;
  if (!category || !amount) {
    return res.status(400).json({ error: "category and amount required" });
  }
  const recoverable = Number(amount);
  if (!Number.isFinite(recoverable) || recoverable <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  try {
    const destination = CATEGORY_DESTINATIONS[category] ?? "Banff, AB";
    const { checkin, checkout } = nextWeekendDates();
    // Budget band around the recoverable amount so results are actually reachable.
    const budget = {
      min: Math.max(20, Math.round(recoverable * 0.25)),
      max: Math.round(recoverable * 2.5),
    };

    const [stay22, spendSummary] = await Promise.all([
      getAccommodations(destination, { type, ...budget }),
      getSpendSummary(),
    ]);

    const properties = (stay22.results ?? []).map((p) => ({
      ...p,
      cheapestTotal: cheapestTotal(p),
      destination,
      bookUrl: buildBookUrl(p, destination, checkin, checkout),
    }));

    const target = properties
      .map((p) => p.cheapestTotal)
      .filter((t) => t !== null)
      .sort((a, b) => a - b)[0];
    const goalProgress = target ? Math.min(1, recoverable / target) : 0;

    const coachMessage =
      (await getCoachMessage(spendSummary, target ?? recoverable)) ??
      `Redirect $${recoverable}/mo from ${category.replaceAll("_", " ")} and ${destination} is ${Math.round(goalProgress * 100)}% funded.`;

    // One route row per category. If chexy is down, still serve a row for the
    // requested category so the board isn't empty.
    const categoryRows = spendSummary?.categories?.length
      ? spendSummary.categories.map((c) => ({
          category: c.name,
          monthlyTotal: c.monthlyTotal,
          recoverableSpend: c.recoverableSpend ?? null,
        }))
      : [{ category, monthlyTotal: recoverable, recoverableSpend: null }];

    const routes = [];
    for (const row of categoryRows) {
      routes.push(await buildRoute(row));
    }

    res.json({
      properties,
      goalProgress,
      lastUpdated: new Date().toISOString(),
      coachMessage,
      routes,
      meta: { stay22Mode: USE_REAL_STAY22 ? "live" : "mock" },
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "upstream failure", detail: String(err.message ?? err) });
  }
});

app.post("/api/spend", async (req, res) => {
  const { category, amount, merchant, date, userId } = req.body ?? {};
  if (!category || typeof category !== "string") {
    return res.status(400).json({ error: "category required" });
  }
  const spendAmount = Number(amount);
  if (!Number.isFinite(spendAmount) || spendAmount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  const transactionDate = (() => {
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime())
      ? new Date().toISOString().slice(0, 10)
      : parsed.toISOString().slice(0, 10);
  })();

  const payload = {
    userId: userId || "demo",
    category: category.trim(),
    amount: Math.round(spendAmount * 100) / 100,
    merchant: merchant ? String(merchant).trim() : "Manual entry",
    date: transactionDate,
  };

  try {
    // If a MongoDB URI is configured, persist transactions locally in Mongo.
    if (process.env.MONGODB_URI) {
      try {
        const r = await insertTransaction(payload);
        return res.status(201).json({ status: "ok", insertedId: r.insertedId });
      } catch (e) {
        console.error("mongo insert failed", e);
        // fall through to attempt chexy write as a fallback
      }
    }

    const chexyRes = await fetch(`${CHEXY_SERVICE_URL}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!chexyRes.ok) {
      const detail = await chexyRes.text().catch(() => "");
      throw new Error(`chexy-integration ${chexyRes.status} ${detail}`);
    }
    const data = await chexyRes.json();
    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "chexy write failed", detail: String(err.message ?? err) });
  }
});

// GET /api/spend - return stored transactions (Mongo) or fallback to Chexy summary
app.get("/api/spend", async (req, res) => {
  const userId = req.query.userId || "demo";
  try {
    if (process.env.MONGODB_URI) {
      const db = await getDb();
      if (!db) throw new Error("mongo not available");
      const docs = await db
        .collection("transactions")
        .find({ userId })
        .sort({ date: -1 })
        .limit(200)
        .toArray();
      return res.json({ mode: "mongo", userId, transactions: docs });
    }

    // Fallback: ask Chexy for the categorized spend summary
    const r = await fetch(`${CHEXY_SERVICE_URL}/spend-summary?userId=${encodeURIComponent(userId)}`);
    if (!r.ok) throw new Error(`chexy ${r.status}`);
    const data = await r.json();
    return res.json({ mode: "chexy", userId, summary: data });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "spend fetch failed", detail: String(err.message ?? err) });
  }
});

// ---------------------------------------------------------------------------
// The exchange: /api/market. Destinations are tickers, suppliers are market
// makers quoting the same property, chexy recoverable spend is buying power.
// ---------------------------------------------------------------------------
const TICKER_SYMBOLS = {
  "Banff, AB": "YBNF",
  "Montreal, QC": "YMTL",
  "Tofino, BC": "YTOF",
  "Prince Edward County, ON": "YPEC",
  "Blue Mountain, ON": "YBLU",
  "Niagara-on-the-Lake, ON": "YNTL",
};

const SUPPLIER_LABELS = {
  booking: "Booking.com",
  vrbo: "Vrbo",
  expedia: "Expedia",
  hotelscom: "Hotels.com",
};

function tickerSymbol(destination) {
  if (TICKER_SYMBOLS[destination]) return TICKER_SYMBOLS[destination];
  // Fallback for destinations added later: Y + first 3 consonants of the city.
  const city = destination.split(",")[0].toUpperCase().replace(/[^A-Z]/g, "");
  const consonants = city.replace(/[AEIOU]/g, "");
  return "Y" + (consonants || city).slice(0, 3);
}

function supplierLabel(key) {
  return SUPPLIER_LABELS[key] ?? key;
}

const round1 = (n) => Math.round(n * 10) / 10;

// Order book for one property: best quote per supplier, cheapest first.
function orderBook(property) {
  return Object.entries(property?.suppliers ?? {})
    .map(([supplier, s]) => ({ supplier, price: s?.price?.total }))
    .filter((q) => typeof q.price === "number")
    .sort((a, b) => a.price - b.price);
}

function spreadFromBook(book) {
  if (book.length < 2) return null;
  const best = book[0];
  const worst = book[book.length - 1];
  const spreadAbs = worst.price - best.price;
  return {
    bestSupplier: best.supplier,
    bestPrice: best.price,
    worstSupplier: worst.supplier,
    worstPrice: worst.price,
    spreadAbs,
    spreadPct: round1((spreadAbs / best.price) * 100),
  };
}

async function buildTicker(destination, buyingPower, { checkin, checkout }) {
  let results = [];
  try {
    const acc = await getAccommodations(destination);
    results = acc.results ?? [];
  } catch {
    // upstream flake - ticker still renders from history below
  }

  const best = bestValueProperty(results);
  const last = best ? cheapestTotal(best) : null;

  const history = getPriceHistory(destination);
  const prev = history.length >= 2 ? history[history.length - 2].price : null;
  const changeAbs = last !== null && prev !== null ? last - prev : null;
  const changePct =
    changeAbs !== null && prev ? round1((changeAbs / prev) * 100) : null;
  const prices = history.map((p) => p.price);
  const dayRange = prices.length
    ? { low: Math.min(...prices), high: Math.max(...prices) }
    : { low: null, high: null };

  const book = best ? orderBook(best) : [];
  const spread = spreadFromBook(book);

  return {
    symbol: tickerSymbol(destination),
    destination,
    last,
    changeAbs,
    changePct,
    history,
    dayRange,
    book,
    spread,
    arb: Boolean(spread && spread.spreadPct >= 15),
    affordable: last !== null && buyingPower >= last,
    property: best
      ? { name: best.name ?? null, type: best.type ?? null, rating: best.rating ?? null }
      : null,
    buyUrl: buildBookUrl(best, destination, checkin, checkout),
  };
}

function pickMovers(tickers) {
  const moved = tickers.filter((t) => typeof t.changePct === "number");
  const up = moved.filter((t) => t.changePct > 0).sort((a, b) => b.changePct - a.changePct)[0];
  const down = moved.filter((t) => t.changePct < 0).sort((a, b) => a.changePct - b.changePct)[0];
  return { up: up?.symbol ?? null, down: down?.symbol ?? null };
}

// Ticker-tape lines built from real quote data (no canned strings).
function buildTape(tickers, buyingPower) {
  const lines = [];
  for (const t of tickers) {
    if (t.arb && t.spread) {
      lines.push(`ARB ALERT: ${t.symbol} ${t.spread.spreadPct}% spread across suppliers`);
    }
  }
  for (const t of tickers) {
    if (typeof t.changePct !== "number" || t.changePct === 0) continue;
    const arrow = t.changePct > 0 ? "\u25b2" : "\u25bc";
    if (t.spread && t.spread.spreadAbs > 0 && t.property?.name) {
      lines.push(
        `${t.symbol} ${arrow}${Math.abs(t.changePct)}% - ${supplierLabel(t.spread.bestSupplier)} undercutting ${supplierLabel(t.spread.worstSupplier)} by $${t.spread.spreadAbs} on ${t.property.name}`
      );
    } else {
      lines.push(`${t.symbol} ${arrow}${Math.abs(t.changePct)}% at $${t.last}`);
    }
  }
  for (const t of tickers) {
    if (t.last === null) continue;
    if (t.dayRange.low !== null && t.last <= t.dayRange.low) {
      lines.push(`${t.symbol} testing session low $${t.last}`);
    } else if (t.dayRange.high !== null && t.last >= t.dayRange.high) {
      lines.push(`${t.symbol} printing session high $${t.last}`);
    }
  }
  const affordables = tickers.filter((t) => t.affordable);
  if (buyingPower > 0 && affordables.length) {
    const cheapest = affordables.sort((a, b) => a.last - b.last)[0];
    lines.push(
      `BUYING POWER $${buyingPower} covers ${cheapest.symbol} at $${cheapest.last} - ${affordables.length} ticker${affordables.length > 1 ? "s" : ""} in range`
    );
  }
  return lines.slice(0, 8);
}

// GET /api/market - the exchange feed. Contract in docs/PRD.md section 12.
app.get("/api/market", async (req, res) => {
  try {
    const dates = nextWeekendDates();
    const spendSummary = await getSpendSummary();
    const buyingPower = spendSummary?.summary?.totalRecoverable ?? 0;

    const tickers = [];
    // Sequential on purpose: getAccommodations caches per destination, and in
    // mock mode the first pricing seeds history, so one pass fills the board.
    for (const destination of CATALOG_DESTINATIONS) {
      tickers.push(await buildTicker(destination, buyingPower, dates));
    }

    res.json({
      asOf: new Date().toISOString(),
      mode: USE_REAL_STAY22 ? "live" : "mock",
      buyingPower,
      tickers,
      movers: pickMovers(tickers),
      tape: buildTape(tickers, buyingPower),
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "upstream failure", detail: String(err.message ?? err) });
  }
});

// ---------------------------------------------------------------------------
// The map layer: /api/map. One pin per property with the cheapest supplier
// quote, spread/arb data, and unfiltered bounds so the UI can build controls.
// Contract in docs/PRD.md section 12.
// ---------------------------------------------------------------------------
function mapProperty(p, city, checkin, checkout) {
  const book = orderBook(p);
  if (!book.length) return null; // no priced supplier - nothing to pin
  const spread = spreadFromBook(book);
  const spreadPct = spread ? spread.spreadPct : 0;
  return {
    id: p.id ?? null,
    name: p.name ?? null,
    type: p.type ?? null,
    lat: p.location?.lat ?? p.location?.latitude ?? null,
    lng: p.location?.lng ?? p.location?.longitude ?? null,
    price: book[0].price, // cheapest nightly total across suppliers
    rating: p.rating ?? null,
    capacity: p.capacity ?? null,
    supplier: book[0].supplier,
    spreadPct,
    arb: spreadPct >= 15,
    freeCancellation: p.policies?.freeCancellation ?? null,
    instantBook: p.policies?.instantBook ?? null,
    bookUrl: buildBookUrl(p, city, checkin, checkout),
  };
}

// GET /api/map?city=Toronto&type=hostel&min=50&max=150&minRating=8
app.get("/api/map", async (req, res) => {
  const city = resolveCity(req.query.city ?? "Toronto");
  if (!city) {
    return res.status(404).json({
      error: `unknown city: ${req.query.city}`,
      availableCities: MAP_CITIES,
    });
  }

  const { type } = req.query;
  const num = (v) => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);
  const min = num(req.query.min);
  const max = num(req.query.max);
  const minRating = num(req.query.minRating);

  try {
    const { checkin, checkout } = nextWeekendDates();

    // Unfiltered pass always runs: it feeds the shared cache/price history
    // and gives the UNFILTERED bounds the UI needs to build filter controls.
    const unfiltered = await getAccommodations(city);
    let results = unfiltered.results ?? [];

    // Live mode pushes the filters upstream (Stay22 supports min/max/type);
    // mock mode just filters the catalog locally below.
    if (USE_REAL_STAY22 && (type || min !== null || max !== null)) {
      const narrowed = await getAccommodations(city, { type, min, max });
      results = narrowed.results ?? [];
    }

    const allPins = (unfiltered.results ?? [])
      .map((p) => mapProperty(p, city, checkin, checkout))
      .filter(Boolean);

    let pins = results.map((p) => mapProperty(p, city, checkin, checkout)).filter(Boolean);
    // Local filtering applies in both modes: it's a no-op where the upstream
    // already narrowed, and it enforces minRating (no Stay22 param used).
    if (type) pins = pins.filter((p) => p.type === type);
    if (min !== null) pins = pins.filter((p) => p.price >= min);
    if (max !== null) pins = pins.filter((p) => p.price <= max);
    if (minRating !== null) pins = pins.filter((p) => p.rating !== null && p.rating >= minRating);

    const prices = pins.map((p) => p.price);
    const allPrices = allPins.map((p) => p.price);

    res.json({
      city,
      center: CITY_CENTERS[city] ?? null,
      asOf: new Date().toISOString(),
      mode: USE_REAL_STAY22 ? "live" : "mock",
      properties: pins,
      stats: {
        count: pins.length,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        avgPrice: prices.length
          ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
          : null,
        arbCount: pins.filter((p) => p.arb).length,
      },
      filters: {
        types: [...new Set(allPins.map((p) => p.type).filter(Boolean))],
        priceRange: {
          min: allPrices.length ? Math.min(...allPrices) : null,
          max: allPrices.length ? Math.max(...allPrices) : null,
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "upstream failure", detail: String(err.message ?? err) });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", stay22Mode: USE_REAL_STAY22 ? "live" : "mock" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(
    `backend running on :${PORT} (stay22: ${USE_REAL_STAY22 ? "LIVE" : "mock - set STAY22_API_KEY for real prices"})`
  )
);
