// Hotel-Tinder agent owns this file: swipe deck + persona proxy to ai-service.
// Mounted at /api/match.
import { Router } from "express";
import { searchAccommodations } from "../stay22Client.js";
import {
  mockSearchAccommodations,
  MAP_CITIES,
  resolveCity,
} from "../mockStay22.js";

const router = Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";
const USE_REAL_STAY22 = Boolean(process.env.STAY22_API_KEY);

// ---------------------------------------------------------------------------
// Pricing helpers (mirrors backend/index.js — owned here to avoid touching index)
// ---------------------------------------------------------------------------
function nextWeekendDates() {
  const now = new Date();
  let daysUntilFriday = (5 - now.getDay() + 7) % 7;
  if (daysUntilFriday === 0) daysUntilFriday = 7;
  const checkin = new Date(now);
  checkin.setDate(now.getDate() + daysUntilFriday);
  const checkout = new Date(checkin);
  checkout.setDate(checkin.getDate() + 2);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { checkin: fmt(checkin), checkout: fmt(checkout) };
}

function cheapestTotal(property) {
  const totals = Object.values(property.suppliers ?? {})
    .map((s) => s?.price?.total)
    .filter((t) => typeof t === "number");
  return totals.length ? Math.min(...totals) : null;
}

function bestSupplier(property) {
  const book = Object.entries(property.suppliers ?? {})
    .map(([supplier, s]) => ({ supplier, price: s?.price?.total }))
    .filter((q) => typeof q.price === "number")
    .sort((a, b) => a.price - b.price);
  return book[0]?.supplier ?? null;
}

function buildBookUrl(property, destination, checkin, checkout) {
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

async function getAccommodations(city, { type, min, max } = {}) {
  const { checkin, checkout } = nextWeekendDates();
  if (USE_REAL_STAY22) {
    return searchAccommodations({ address: city, checkin, checkout, min, max, type });
  }
  return mockSearchAccommodations({ address: city, type });
}

function parseVibes(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Local persona fallback when ai-service /persona is down or 404
// (ported from ai-service/personas.py — keep in sync conceptually)
// ---------------------------------------------------------------------------
function seedInt(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function seededRng(seed) {
  let s = seedInt(seed);
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const ARCHETYPES = [
  ["The Slow Burn", "patient, observant, saves the best views for sunrise"],
  ["The Spontaneous Flame", "books last-minute, lives for plot twists"],
  ["The Cozy Classic", "blankets, tea, and zero small talk before coffee"],
  ["The Luxury Minimalist", "understated taste, hates performative flexing"],
  ["The Social Butterfly", "knows the bartender by name, collects stories"],
  ["The Wild Adventurer", "hiking boots in the suitcase, always"],
  ["The Budget Romantic", "candlelit picnic beats a prix fixe every time"],
  ["The Party Catalyst", "DJ requests and late checkout negotiator"],
  ["The Nature Mystic", "forest baths, star maps, silence as a love language"],
  ["The Design Snob", "judges you by your luggage and your lighting"],
];

const LOVE_LANGUAGES = [
  "Quality Time",
  "Acts of Service",
  "Words of Affirmation",
  "Physical Touch",
  "Receiving Gifts",
];

const GREEN_FLAGS = [
  "Texts back before the lift closes",
  "Remembers your pillow preference",
  "Splits the minibar bill without drama",
  "Plans the itinerary but leaves room for detours",
  "Actually reads the house rules",
  "Brings snacks for the road trip",
  "Tips housekeeping without being asked",
  "Suggests sunrise instead of brunch",
  "Books refundable rates when you're flaky",
  "Celebrates your weird travel rituals",
];

const RED_FLAGS = [
  "Leaves wet towels on the bed",
  "Argues with front desk at 2am",
  "Ghosting after matching on vibes alone",
  "Treats staff like NPCs",
  "Only travels for the Instagram grid",
  "Never shares the aux cord",
  "Packs flip-flops for a glacier hike",
  "Talks through the movie on the plane",
];

const TYPE_VIBES = {
  hotel: ["luxury", "romantic", "social"],
  hostel: ["budget", "party", "social"],
  cabin: ["cozy", "nature", "romantic"],
  villa: ["luxury", "romantic", "adventure"],
  apartment: ["cozy", "budget", "social"],
  bnb: ["cozy", "romantic", "nature"],
  all_inclusive: ["party", "luxury", "social"],
};

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function sample(rng, arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(rng() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

function buildLocalPersona(facts) {
  const id = String(facts.id || facts.name || "unknown");
  const rng = seededRng(`persona:${id}`);
  const name = facts.name || "Mystery Stay";
  const ptype = (facts.type || "hotel").toLowerCase();
  const city = facts.destination || facts.location?.address || facts.city || "somewhere good";
  const rating = facts.rating ?? 8;
  const capacity = facts.capacity ?? 2;
  const price = facts.price ?? facts.cheapestTotal ?? 150;
  const instant = Boolean(facts.instantBook ?? facts.policies?.instantBook);
  const freeCancel = Boolean(facts.freeCancellation ?? facts.policies?.freeCancellation);

  const [archetype, archetypeBlurb] = pick(rng, ARCHETYPES);
  const loveLanguage = pick(rng, LOVE_LANGUAGES);
  const greenFlags = sample(rng, GREEN_FLAGS, 3);
  const redFlags = sample(rng, RED_FLAGS, 2);

  const stats = {
    spontaneity: Math.min(98, Math.max(5, 40 + (instant ? 10 : 0) + Math.floor(rng() * 40))),
    luxury: Math.min(98, Math.max(5, 30 + Math.floor(rating * 5) + (price > 250 ? 15 : 0) + Math.floor(rng() * 25))),
    social: Math.min(98, Math.max(5, 35 + capacity * 8 + Math.floor(rng() * 32))),
    adventure: Math.min(98, Math.max(5, 35 + Math.floor(rng() * 40))),
    budget: Math.min(98, Math.max(5, Math.max(10, 100 - Math.floor(price / 4) + Math.floor(rng() * 30)))),
    nature: Math.min(98, Math.max(5, 30 + Math.floor(rng() * 40))),
    romance: Math.min(98, Math.max(5, 35 + Math.floor(rating * 4) + Math.floor(rng() * 35))),
  };
  if (["cabin", "villa", "bnb"].includes(ptype)) stats.nature += 20;
  if (ptype === "hostel") {
    stats.social += 25;
    stats.budget += 20;
  }

  const vibeScores = {
    adventure: stats.adventure + stats.spontaneity * 0.3,
    luxury: stats.luxury,
    cozy: (100 - stats.social) * 0.4 + stats.romance * 0.3,
    party: stats.social * 0.7 + stats.spontaneity * 0.3,
    budget: stats.budget,
    nature: stats.nature,
    romantic: stats.romance,
    social: stats.social,
  };
  for (const v of TYPE_VIBES[ptype] || []) {
    vibeScores[v] = (vibeScores[v] || 50) + 15;
  }
  const vibes = Object.entries(vibeScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([v]) => v);

  const nickname = name.split(" ")[0];
  const policy = [freeCancel && "free cancellation", instant && "instant book"].filter(Boolean).join(" + ") || "old-school charm";
  const hook = `${city.split(",")[0]} weekends with ${policy}`;

  const bio = `${name} (${ptype}) in ${city.split(",")[0]}. ${Number(rating).toFixed(1)}-star energy, sleeps ${capacity}. I'm ${archetype.toLowerCase()} — swipe right if you want ${hook}.`;
  const openingLine = `Hey — I noticed you picked ${vibes[0]}. Same. Want to see my cancellation policy? (It's ${freeCancel ? "flexible" : "commitment-heavy"}.)`;

  return {
    id,
    displayName: nickname,
    fullName: name,
    archetype,
    archetypeBlurb,
    bio,
    greenFlags,
    redFlags,
    loveLanguage,
    stats,
    vibes,
    openingLine,
    propertyType: ptype,
    city,
    price: Math.round(price),
    rating,
  };
}

function localCompatibility(persona, userVibes) {
  if (!userVibes.length) return 62 + (seedInt(persona.id) % 20);

  const personaVibes = new Set(persona.vibes || []);
  const overlap = userVibes.filter((v) => personaVibes.has(v)).length;
  const overlapScore = Math.min(50, overlap * 18);

  const vibeStatMap = {
    adventure: "adventure",
    luxury: "luxury",
    cozy: "romance",
    party: "social",
    budget: "budget",
    nature: "nature",
    romantic: "romance",
    social: "social",
  };

  let statTotal = 0;
  for (const v of userVibes) {
    const key = vibeStatMap[v] || "romance";
    statTotal += persona.stats?.[key] ?? 50;
  }
  const statScore = Math.floor((statTotal / userVibes.length) * 0.5);
  return Math.max(12, Math.min(99, overlapScore + statScore));
}

async function fetchPersona(propertyFacts, userVibes) {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/persona`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property: propertyFacts, userVibes }),
    });
    if (!res.ok) throw new Error(`ai-service ${res.status}`);
    const data = await res.json();
    return {
      persona: data.persona,
      compatibility: data.compatibility,
      personaSource: data.mode === "stub" ? "ai-stub" : "ai-freesolo",
    };
  } catch {
    const persona = buildLocalPersona(propertyFacts);
    return {
      persona,
      compatibility: localCompatibility(persona, userVibes),
      personaSource: "local-fallback",
    };
  }
}

// GET /api/match/deck?city=Banff&vibes=adventure,luxury
router.get("/deck", async (req, res) => {
  const city = resolveCity(req.query.city ?? "Banff");
  if (!city) {
    return res.status(404).json({
      error: `unknown city: ${req.query.city}`,
      availableCities: MAP_CITIES.filter((c) => !c.startsWith("Toronto")),
    });
  }

  const userVibes = parseVibes(req.query.vibes);
  const { checkin, checkout } = nextWeekendDates();

  try {
    const acc = await getAccommodations(city);
    const results = acc.results ?? [];

    const cards = [];
    for (const p of results) {
      const price = cheapestTotal(p);
      if (price === null) continue;

      const propertyFacts = {
        id: p.id,
        name: p.name,
        type: p.type,
        destination: city,
        location: p.location,
        rating: p.rating,
        capacity: p.capacity,
        price,
        cheapestTotal: price,
        instantBook: p.policies?.instantBook,
        freeCancellation: p.policies?.freeCancellation,
        policies: p.policies,
      };

      const { persona, compatibility, personaSource } = await fetchPersona(propertyFacts, userVibes);
      const bookUrl = buildBookUrl(p, city, checkin, checkout);

      cards.push({
        id: p.id,
        property: {
          name: p.name,
          type: p.type,
          rating: p.rating,
          capacity: p.capacity,
          price,
          supplier: bestSupplier(p),
          instantBook: p.policies?.instantBook ?? null,
          freeCancellation: p.policies?.freeCancellation ?? null,
          lat: p.location?.lat ?? null,
          lng: p.location?.lng ?? null,
        },
        persona,
        compatibility,
        bookUrl,
        personaSource,
      });
    }

    cards.sort((a, b) => b.compatibility - a.compatibility);

    res.json({
      city,
      checkin,
      checkout,
      userVibes,
      mode: USE_REAL_STAY22 ? "live" : "mock",
      asOf: new Date().toISOString(),
      cards,
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "deck build failed", detail: String(err.message ?? err) });
  }
});

// POST /api/match/chat — proxy to ai-service /persona/chat
router.post("/chat", async (req, res) => {
  const { persona, messages, bookUrl } = req.body ?? {};
  if (!persona || !Array.isArray(messages)) {
    return res.status(400).json({ error: "persona and messages required" });
  }

  try {
    const upstream = await fetch(`${AI_SERVICE_URL}/persona/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona, messages, bookUrl }),
    });

    if (upstream.ok) {
      const data = await upstream.json();
      return res.json(data);
    }

    // Fallback local chat when ai-service returns 404/5xx
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content?.toLowerCase() ?? "";
    let reply = persona.openingLine || `Hey — ${persona.displayName} here.`;

    if (/\b(book|reserve|checkout|yes|down|let's go)\b/.test(lastUser)) {
      reply = `Say less — tap BOOK NOW (${bookUrl || "Stay22"}) before someone else swipes right on my last room.`;
    } else if (/\b(price|cost|expensive|cheap|budget)\b/.test(lastUser)) {
      reply = `Real talk: $${persona.price ?? "??"}/night. My love language is ${persona.loveLanguage} — invest in the vibe.`;
    } else if (/\b(hi|hey|hello|sup)\b/.test(lastUser)) {
      reply = persona.openingLine || reply;
    } else {
      reply = `${persona.archetype} energy — keep the ${persona.vibes?.[0] || "good"} vibes coming. Ready to book? ${bookUrl || ""}`;
    }

    return res.json({ reply, mode: "local-fallback" });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "chat proxy failed", detail: String(err.message ?? err) });
  }
});

export default router;
