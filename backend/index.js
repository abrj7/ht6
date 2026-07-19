import express from "express";
import cors from "cors";
import "dotenv/config";
import { searchAccommodations } from "./stay22Client.js";
import {
  mockSearchAccommodations,
  CATEGORY_DESTINATIONS,
  DESTINATION_COORDS,
} from "./mockStay22.js";

const app = express();
app.use(cors());
app.use(express.json());

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

app.get("/health", (req, res) => {
  res.json({ status: "ok", stay22Mode: USE_REAL_STAY22 ? "live" : "mock" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(
    `backend running on :${PORT} (stay22: ${USE_REAL_STAY22 ? "LIVE" : "mock - set STAY22_API_KEY for real prices"})`
  )
);
