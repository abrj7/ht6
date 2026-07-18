import express from "express";
import cors from "cors";
import "dotenv/config";
import { searchAccommodations } from "./stay22Client.js";
import { mockSearchAccommodations, CATEGORY_DESTINATIONS } from "./mockStay22.js";

const app = express();
app.use(cors());
app.use(express.json());

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";
const CHEXY_SERVICE_URL = process.env.CHEXY_SERVICE_URL || "http://localhost:5002";
const USE_REAL_STAY22 = Boolean(process.env.STAY22_API_KEY);

// Stay22's price cache is ~10 min on their end - never hit them faster than that.
const STAY22_CACHE_MS = 10 * 60 * 1000;
const stay22Cache = new Map(); // address -> { data, fetchedAt }

async function getAccommodations(address) {
  const cached = stay22Cache.get(address);
  if (cached && Date.now() - cached.fetchedAt < STAY22_CACHE_MS) {
    return cached.data;
  }
  const data = USE_REAL_STAY22
    ? await searchAccommodations({ address })
    : mockSearchAccommodations({ address });
  stay22Cache.set(address, { data, fetchedAt: Date.now() });
  return data;
}

function cheapestTotal(property) {
  const totals = Object.values(property.suppliers ?? {})
    .map((s) => s?.price?.total)
    .filter((t) => typeof t === "number");
  return totals.length ? Math.min(...totals) : null;
}

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

// GET /api/opportunity?category=food_delivery&amount=150
// Contract (docs/PRD.md section 12):
// -> { properties: [...], goalProgress: number, lastUpdated: ISO, coachMessage, routes }
app.get("/api/opportunity", async (req, res) => {
  const { category, amount } = req.query;
  if (!category || !amount) {
    return res.status(400).json({ error: "category and amount required" });
  }
  const recoverable = Number(amount);
  if (!Number.isFinite(recoverable) || recoverable <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  try {
    const destination = CATEGORY_DESTINATIONS[category] ?? "Banff, AB";
    const [stay22, spendSummary] = await Promise.all([
      getAccommodations(destination),
      getSpendSummary(),
    ]);

    const properties = (stay22.results ?? []).map((p) => ({
      ...p,
      cheapestTotal: cheapestTotal(p),
      destination,
    }));

    const target = properties
      .map((p) => p.cheapestTotal)
      .filter((t) => t !== null)
      .sort((a, b) => a - b)[0];
    const goalProgress = target ? Math.min(1, recoverable / target) : 0;

    const coachMessage =
      (await getCoachMessage(spendSummary, target ?? recoverable)) ??
      `Redirect $${recoverable}/mo from ${category.replaceAll("_", " ")} and ${destination} is ${Math.round(goalProgress * 100)}% funded.`;

    // Bonus board data: one route row per category from the chexy spend summary,
    // so the frontend can render the whole departure board from one call.
    const routes = [];
    if (spendSummary?.categories) {
      for (const c of spendSummary.categories) {
        const dest = CATEGORY_DESTINATIONS[c.name] ?? "Banff, AB";
        const acc = await getAccommodations(dest);
        const best = (acc.results ?? [])
          .map((p) => cheapestTotal(p))
          .filter((t) => t !== null)
          .sort((a, b) => a - b)[0];
        routes.push({
          category: c.name,
          destination: dest,
          monthlyTotal: c.monthlyTotal,
          livePrice: best ?? null,
          progress: best ? Math.min(1, c.monthlyTotal / best) : 0,
        });
      }
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
