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

// Free LLM for the conversational concierge (Groq, OpenAI-compatible). The LLM
// handles chat/planning and calls the search_stays tool to ground answers in
// live Stay22 prices. Leave GROQ_API_KEY blank to disable (frontend falls back
// to template replies).
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_BASE_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const LLM_ENABLED = Boolean(GROQ_API_KEY);

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
    // Seed backdated points in BOTH modes. Stay22 is snapshot-only and sits on
    // a ~10-min cache, so live mode would otherwise start with 0-1 points and
    // the chart would render "waiting for price history" indefinitely.
    hist = seedBackdatedHistory(price);
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

async function getAccommodations(address, { type, min, max, lat, lng } = {}) {
  knownDestinations.add(address);
  const hasCenter = Number.isFinite(lat) && Number.isFinite(lng);
  const key = [address, type ?? "", min ?? "", max ?? "", hasCenter ? `${lat},${lng}` : ""].join("|");
  const cached = stay22Cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < STAY22_CACHE_MS) {
    return cached.data;
  }
  const { checkin, checkout } = nextWeekendDates();
  let data = USE_REAL_STAY22
    ? await searchAccommodations({ address, lat, lng, checkin, checkout, min, max, type })
    : mockSearchAccommodations({ address, type });
  // Live Stay22 has no inventory for some catalog cities (e.g. Prince Edward
  // County). Rather than render a priceless row, fall back to mock pricing so
  // every destination always shows a number + chart.
  if (USE_REAL_STAY22 && !(data.results ?? []).length) {
    data = mockSearchAccommodations({ address, type });
  }
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
  const rating =
    typeof p.rating === "object" && p.rating ? p.rating.value ?? null : p.rating ?? null;
  const capacity =
    typeof p.capacity === "object" && p.capacity ? p.capacity.guests ?? null : p.capacity ?? null;
  return {
    name: p.name ?? null,
    type: p.type ?? null,
    rating,
    capacity,
    freeCancellation: p.policies?.freeCancellation ?? null,
    instantBook: p.policies?.instantBook ?? null,
    image: p.media?.thumbnail ?? null,
    images: p.media?.thumbnail ? [p.media.thumbnail] : [],
  };
}

// ---------------------------------------------------------------------------
// Book-now affiliate links
// ---------------------------------------------------------------------------
// Link for the exact supplier offer we quoted as cheapest, so the price on
// the dashboard matches what the user sees after clicking Book now. Falls back
// to the property-level aggregator page only if no per-supplier link exists.
function cheapestSupplierLink(property) {
  const priced = Object.values(property?.suppliers ?? {})
    .filter((s) => typeof s?.price?.total === "number" && (s.link || s.deeplink || s.url))
    .sort((a, b) => a.price.total - b.price.total);
  const best = priced[0];
  return best ? best.link || best.deeplink || best.url : null;
}

function buildBookUrl(property, destination, checkin, checkout) {
  // Prefer the specific cheapest-supplier offer so the booking page shows the
  // same number the dashboard quoted; then any property deeplink; then roam.
  const deeplink =
    cheapestSupplierLink(property) ||
    property?.deeplink ||
    property?.bookingUrl ||
    property?.url;
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
async function getSpendSummary(userId = "demo") {
  try {
    const res = await fetch(
      `${CHEXY_SERVICE_URL}/spend-summary?userId=${encodeURIComponent(userId)}`
    );
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
async function buildRoute({ category, monthlyTotal, recoverableSpend, destination: override }) {
  // User-set destination (from Trip settings) wins over the demo default map.
  const destination = override || CATEGORY_DESTINATIONS[category] || "Banff, AB";
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
  const {
    category,
    amount,
    type,
    destination: destParam,
    destinations: destsParam,
    goals: goalsParam,
    userId: userIdParam,
  } = req.query;
  // Which profile's spend drives the board. "demo" = the showcase sandbox;
  // a logged-in user sends their Auth0 sub so they see only their own data.
  const userId = userIdParam || "demo";
  if (!category || !amount) {
    return res.status(400).json({ error: "category and amount required" });
  }
  const recoverable = Number(amount);
  if (!Number.isFinite(recoverable) || recoverable <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  // Per-category destination overrides from the frontend Trip settings.
  // `destinations` is a JSON map {category: "City, XX"}; `destination` is a
  // shorthand override for the requested category only.
  let destinationOverrides = {};
  try {
    if (destsParam) destinationOverrides = JSON.parse(destsParam) || {};
  } catch {
    return res.status(400).json({ error: "destinations must be valid JSON" });
  }
  if (destParam) destinationOverrides[category] = destParam;

  // User-defined goals (Trip settings). Each = { category, destination, amount }.
  // When present they drive the board directly, replacing the chexy-derived
  // category rows so the user sees only the buckets/destinations they created.
  let goals = null;
  try {
    if (goalsParam) goals = JSON.parse(goalsParam);
  } catch {
    return res.status(400).json({ error: "goals must be valid JSON" });
  }

  try {
    const destination =
      destinationOverrides[category] || CATEGORY_DESTINATIONS[category] || "Banff, AB";
    const { checkin, checkout } = nextWeekendDates();
    // Budget band around the recoverable amount so results are actually reachable.
    const budget = {
      min: Math.max(20, Math.round(recoverable * 0.25)),
      max: Math.round(recoverable * 2.5),
    };

    const [stay22, spendSummary] = await Promise.all([
      getAccommodations(destination, { type, ...budget }),
      getSpendSummary(userId),
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
    const bestProperty = properties.find((p) => p.cheapestTotal === target);

    // Flat facts shape the FreeSolo yonder-coach adapter was actually
    // trained on (see ai-service/dataset/train.jsonl) - not the raw chexy
    // categories[] blob, which is off-distribution for the model.
    const matchedCategory = spendSummary?.categories?.find((c) => c.name === category);
    const goalAmount = target ?? recoverable;
    const remaining = Math.max(0, goalAmount - recoverable);
    const estimatedMonths = recoverable > 0 ? Math.max(1, Math.round(goalAmount / recoverable)) : null;
    const coachFacts = {
      category: category.replaceAll("_", " "),
      monthlyTotal: matchedCategory?.monthlyTotal ?? recoverable,
      recoverableMonthly: matchedCategory?.recoverableSpend ?? recoverable,
      remaining,
      estimatedMonths,
      destination,
      propertyName: bestProperty?.name,
    };

    const coachMessage =
      (await getCoachMessage(coachFacts, goalAmount)) ??
      `Redirect $${recoverable}/mo from ${category.replaceAll("_", " ")} and ${destination} is ${Math.round(goalProgress * 100)}% funded.`;

    // One route row per category. If chexy is down, still serve a row for the
    // requested category so the board isn't empty.
    const categoryRows =
      Array.isArray(goals) && goals.length
        ? goals.map((g) => {
            const amt = Number(g.amount);
            const monthlyGoal = Number.isFinite(amt) && amt > 0 ? amt : recoverable;
            // Match the goal to the user's actual logged spend for that category
            // so the progress bar tracks real spend and moves the moment they log
            // more (case-insensitive on the category name). Falls back to the
            // monthly goal target until any spend is logged.
            const summaryOk = Array.isArray(spendSummary?.categories);
            const match = summaryOk
              ? spendSummary.categories.find(
                  (c) => (c.name || "").toLowerCase() === (g.category || "").toLowerCase()
                )
              : null;
            const loggedRecoverable = Number.isFinite(match?.recoverableSpend)
              ? match.recoverableSpend
              : null;
            // Chexy up + spend logged -> real accumulated recoverable (grows as
            // you log). Chexy up + nothing logged yet -> 0 (bar fills from empty).
            // Chexy down -> show the monthly goal as a baseline.
            const recoverableSpend =
              loggedRecoverable != null ? loggedRecoverable : summaryOk ? 0 : monthlyGoal;
            return {
              category: g.category || "Savings",
              monthlyTotal: match?.monthlyTotal ?? monthlyGoal,
              recoverableSpend,
              destination: g.destination || null,
            };
          })
        : spendSummary?.categories?.length
        ? spendSummary.categories.map((c) => ({
            category: c.name,
            monthlyTotal: c.monthlyTotal,
            recoverableSpend: c.recoverableSpend ?? null,
            destination: destinationOverrides[c.name] || null,
          }))
        : [{ category, monthlyTotal: recoverable, recoverableSpend: null, destination }];

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

  // A verified Auth0 user (sub from the JWT) always wins over any body value,
  // so a logged-in user's spend is tied to their profile and can't be spoofed.
  // Unauthenticated (demo mode) falls back to the body userId or "demo".
  const resolvedUserId = req.auth?.payload?.sub || userId || "demo";
  const payload = {
    userId: resolvedUserId,
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

  // Live Stay22 nests coordinates under location.coordinates; mock uses
  // location.lat/lng. Support both, or there are no pins to place.
  const coords = p.location?.coordinates ?? p.location ?? {};
  const lat = coords.lat ?? coords.latitude ?? null;
  const lng = coords.lng ?? coords.longitude ?? null;

  // rating/capacity come back as objects from live Stay22 - flatten so the map
  // popup and rating filter get plain numbers.
  const rating =
    typeof p.rating === "object" && p.rating ? p.rating.value ?? null : p.rating ?? null;
  const capacity =
    typeof p.capacity === "object" && p.capacity ? p.capacity.guests ?? null : p.capacity ?? null;

  // book prices are the whole-stay total (2 nights); show per-night so the
  // "price / night" filter and pill labels are correct.
  const nights = Math.max(1, Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86400000));
  const nightly = Math.round(book[0].price / nights);

  return {
    id: p.id ?? null,
    name: p.name ?? null,
    type: p.type ?? null,
    lat,
    lng,
    // Stay22 search returns a single thumbnail per property (no gallery via
    // this endpoint). image = that thumbnail; images = a 1-item array the UI
    // renders as a (single-slide) carousel, ready for more if a details API
    // is added later.
    image: p.media?.thumbnail ?? null,
    images: p.media?.thumbnail ? [p.media.thumbnail] : [],
    price: nightly,
    totalStay: book[0].price,
    rating,
    capacity,
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
  const cityInput = String(req.query.city ?? "Toronto, ON").trim();
  // Known catalog city -> use its downtown centre coords (tight, downtown
  // results). Unknown text -> in live mode, pass it straight to Stay22 as an
  // address so ANY city/area the API covers works. Mock mode can only serve
  // the catalog, so it still 404s on unknown.
  const known = resolveCity(cityInput);
  if (!known && !USE_REAL_STAY22) {
    return res.status(404).json({ error: `unknown city: ${cityInput}`, availableCities: MAP_CITIES });
  }
  const label = known || cityInput;
  const knownCenter = known ? CITY_CENTERS[known] : null;

  const { type } = req.query;
  const num = (v) => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);
  const min = num(req.query.min);
  const max = num(req.query.max);
  const minRating = num(req.query.minRating);

  try {
    const { checkin, checkout } = nextWeekendDates();

    // One fetch, centred downtown for known cities. All filtering is local on
    // per-night price (Stay22's min/max are whole-stay totals, so pushing the
    // per-night filter upstream would be wrong).
    const data = await getAccommodations(label, {
      lat: knownCenter?.lat,
      lng: knownCenter?.lng,
    });

    const allPins = (data.results ?? [])
      .map((p) => mapProperty(p, label, checkin, checkout))
      .filter(Boolean);

    let pins = [...allPins];
    if (type) pins = pins.filter((p) => p.type === type);
    if (min !== null) pins = pins.filter((p) => p.price >= min);
    if (max !== null) pins = pins.filter((p) => p.price <= max);
    if (minRating !== null) pins = pins.filter((p) => p.rating !== null && p.rating >= minRating);

    const prices = pins.map((p) => p.price);
    const allPrices = allPins.map((p) => p.price);

    // Centre: downtown coords for known cities, else the mean of returned pins.
    const pinCoords = allPins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const center =
      knownCenter ??
      (pinCoords.length
        ? {
            lat: pinCoords.reduce((s, p) => s + p.lat, 0) / pinCoords.length,
            lng: pinCoords.reduce((s, p) => s + p.lng, 0) / pinCoords.length,
          }
        : null);

    res.json({
      city: label,
      center,
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

// ---------------------------------------------------------------------------
// Conversational concierge (Groq LLM + Stay22 tool-calling)
// ---------------------------------------------------------------------------

// Run a Stay22 search for the LLM tool. Returns card-shaped stays (nightly
// price so the UI's "/nt" label is correct) + a compact summary for the model.
async function searchStaysForLLM({ city, maxPrice }) {
  const address = resolveCity(city) || city;
  const { checkin, checkout } = nextWeekendDates();
  const nights = 2; // nextWeekendDates is Fri->Sun
  let data;
  try {
    data = await getAccommodations(address, maxPrice ? { max: Math.round(maxPrice * nights) } : {});
  } catch {
    data = { results: [] };
  }
  const stays = (data.results ?? [])
    .map((p) => {
      const total = cheapestTotal(p);
      const nightly = typeof total === "number" ? Math.round(total / nights) : null;
      // Live Stay22 returns rating/capacity as objects; flatten to primitives
      // so the UI (and JSON) never receives an object where a number is shown.
      const rating =
        typeof p.rating === "object" && p.rating ? p.rating.value ?? null : p.rating ?? null;
      const capacity =
        typeof p.capacity === "object" && p.capacity ? p.capacity.guests ?? null : p.capacity ?? null;
      return {
        id: p.id ?? p.name,
        name: p.name ?? "Stay",
        type: p.type ?? "hotel",
        city: address,
        destination: address,
        rating,
        capacity,
        price: nightly, // per night
        totalStay: total, // 2-night total
        freeCancellation: p.policies?.freeCancellation ?? null,
        amenities: Array.isArray(p.amenities) ? p.amenities : [],
        bookUrl: buildBookUrl(p, address, checkin, checkout),
      };
    })
    .filter((s) => Number.isFinite(s.price))
    .sort((a, b) => a.price - b.price)
    .slice(0, 6);

  const summary = stays.length
    ? stays
        .map(
          (s, i) =>
            `${i + 1}. ${s.name} (${s.type}) — $${s.price}/night, $${s.totalStay} for ${nights} nights${
              s.rating ? `, rating ${s.rating}` : ""
            }`
        )
        .join("\n")
    : `No live Stay22 inventory found for ${address}.`;

  return { stays, summary, city: address, nights };
}

const CHAT_SYSTEM_PROMPT = `You are Yonder's travel concierge. You help users plan trips — itineraries, timing, budgets, getting around — and find places to stay.
Rules:
- Be conversational, concise, and genuinely helpful. Answer planning questions directly with specifics.
- When the user wants hotels/stays or prices, call the search_stays tool. NEVER invent hotel names or prices — only cite what the tool returns.
- Prices from the tool are in CAD; "price" is per night, "totalStay" is the 2-night weekend total.
- After a search, summarize the best few options in prose (the UI shows cards separately).
- If you don't have a destination yet for a search, ask for one. Keep answers under ~120 words unless building an itinerary.`;

const SEARCH_TOOL = {
  type: "function",
  function: {
    name: "search_stays",
    description:
      "Search live Stay22 accommodation inventory for a city and return real stays with nightly prices. Use whenever the user wants hotels, stays, or price info.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "Destination city, e.g. 'Lisbon, Portugal' or 'Banff'." },
        maxPrice: { type: "number", description: "Optional max price per night in CAD." },
      },
      required: ["city"],
    },
  },
};

async function callGroqOnce(messages, withTools) {
  const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.6,
      ...(withTools ? { tools: [SEARCH_TOOL], tool_choice: "auto" } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`groq ${res.status} ${body}`);
    err.toolUseFailed = res.status === 400 && body.includes("tool_use_failed");
    throw err;
  }
  return res.json();
}

// Llama on Groq occasionally emits a malformed tool call (400 tool_use_failed).
// Retry once without tools so the user still gets a text answer instead of an
// error.
async function callGroq(messages, { withTools } = {}) {
  try {
    return await callGroqOnce(messages, withTools);
  } catch (err) {
    if (err.toolUseFailed && withTools) {
      return await callGroqOnce(messages, false);
    }
    throw err;
  }
}

// POST /api/chat { messages:[{role,content}] } -> { answer, results, mode }
app.post("/api/chat", async (req, res) => {
  if (!LLM_ENABLED) {
    // No key: tell the frontend to use its local template fallback.
    return res.status(501).json({ error: "LLM not configured", mode: "fallback" });
  }
  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const history = incoming
    .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content }));

  const messages = [{ role: "system", content: CHAT_SYSTEM_PROMPT }, ...history];
  let collectedStays = [];

  try {
    // Up to 3 rounds so the model can call the tool then answer.
    for (let round = 0; round < 3; round++) {
      const data = await callGroq(messages, { withTools: true });
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error("empty groq response");

      if (msg.tool_calls?.length) {
        messages.push(msg);
        for (const call of msg.tool_calls) {
          let args = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            /* bad args - search with empty */
          }
          const { stays, summary } = await searchStaysForLLM(args);
          collectedStays = stays.length ? stays : collectedStays;
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: summary,
          });
        }
        continue; // let the model use the tool output
      }

      return res.json({
        answer: msg.content || "Here's what I found.",
        results: collectedStays,
        mode: "groq",
      });
    }
    // Tool loop exhausted: force one final answer with tools disabled so the
    // model must write prose instead of calling the tool again.
    const finalData = await callGroq(messages, { withTools: false });
    const finalMsg = finalData.choices?.[0]?.message;
    return res.json({
      answer: finalMsg?.content || "Here are some options based on your request.",
      results: collectedStays,
      mode: "groq",
    });
  } catch (err) {
    console.error("chat error", err);
    // If we already fetched stays before the model hiccuped, still show them.
    if (collectedStays.length) {
      return res.json({
        answer: `Here are some stays in ${collectedStays[0].city}.`,
        results: collectedStays,
        mode: "groq",
      });
    }
    return res.status(502).json({ error: "chat failed", detail: String(err.message ?? err) });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    stay22Mode: USE_REAL_STAY22 ? "live" : "mock",
    llm: LLM_ENABLED ? "groq" : "off",
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(
    `backend running on :${PORT} (stay22: ${USE_REAL_STAY22 ? "LIVE" : "mock - set STAY22_API_KEY for real prices"})`
  )
);
