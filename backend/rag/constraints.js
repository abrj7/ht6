import { resolveCity } from "../mockStay22.js";
import { findPoi, POI_ALIASES } from "../data/torontoTransit.js";

const TYPE_WORDS = ["hostel", "hotel", "cabin", "villa", "apartment", "all_inclusive"];
const AMENITY_WORDS = [
  "wifi",
  "parking",
  "pool",
  "gym",
  "breakfast",
  "kitchen",
  "pet friendly",
  "pets",
  "hot tub",
  "fireplace",
  "lake view",
  "ski access",
  "beach access",
  "spa",
  "restaurant",
  "bar",
  "laundry",
  "air conditioning",
  "ac",
];

function cityFromQuery(q) {
  const inMatch = q.match(/\bin\s+([a-z][a-z\s-]+?)(?:\s+(?:with|near|for|under|between|below|cheap|budget)|$)/);
  if (inMatch) {
    const resolved = resolveCity(inMatch[1].trim());
    if (resolved) return resolved;
  }
  for (const key of ["banff", "montreal", "tofino", "toronto", "niagara", "blue mountain", "prince edward"]) {
    if (q.includes(key)) {
      const resolved = resolveCity(key);
      if (resolved) return resolved;
    }
  }
  return null;
}

function matchesTerm(q, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(q);
}

function poiFromQuery(q) {
  const nearMatch = q.match(/near\s+(?:the\s+)?([a-z][a-z\s-]+?)(?:\s+(?:with|for|under|between|in)|$)/);
  if (nearMatch) {
    const alias = nearMatch[1].trim();
    const poi = findPoi(alias);
    if (poi) return { alias, poi };
  }
  for (const alias of Object.keys(POI_ALIASES).sort((a, b) => b.length - a.length)) {
    if (matchesTerm(q, alias)) {
      const poi = findPoi(alias);
      if (poi) return { alias, poi };
    }
  }
  return { alias: null, poi: null };
}

export function parseQuery(query, cityOverride) {
  const q = String(query).toLowerCase();
  const parsed = {
    raw: query,
    city: resolveCity(cityOverride) || cityFromQuery(q) || resolveCity("Toronto"),
    type: null,
    minPrice: null,
    maxPrice: null,
    minRating: null,
    freeCancellation: null,
    nearSubway: false,
    nearPoi: null,
    poi: null,
    amenities: [],
    minCapacity: null,
    keywords: [],
  };

  for (const t of TYPE_WORDS) {
    if (new RegExp(`\\b${t.replace("_", "[_ ]")}\\b`).test(q)) {
      parsed.type = t;
      break;
    }
  }

  const between = q.match(/between\s+\$?(\d+)\s+and\s+\$?(\d+)/);
  if (between) {
    parsed.minPrice = Number(between[1]);
    parsed.maxPrice = Number(between[2]);
  }

  const under = q.match(/(?:under|below|max|less than)\s+\$?(\d+)/);
  if (under) parsed.maxPrice = Number(under[1]);

  const over = q.match(/(?:over|above|min|more than|at least)\s+\$?(\d+)/);
  if (over) parsed.minPrice = Number(over[1]);

  if (/\b(cheap|budget|affordable|inexpensive)\b/.test(q)) {
    parsed.maxPrice = parsed.maxPrice ?? 120;
  }
  if (/\b(luxury|upscale|premium|splurge)\b/.test(q)) {
    parsed.minPrice = parsed.minPrice ?? 250;
  }

  if (/\bfree\s+cancel/.test(q)) parsed.freeCancellation = true;
  if (/\b(highly rated|top rated|best rated|excellent)\b/.test(q)) parsed.minRating = 8.5;
  if (/\b(romantic|cozy|intimate)\b/.test(q)) parsed.keywords.push("romantic");

  if (/near\s+(?:the\s+)?subway|close\s+to\s+(?:the\s+)?subway|by\s+(?:the\s+)?subway|subway\s+access/.test(q)) {
    parsed.nearSubway = true;
  }

  const { alias, poi } = poiFromQuery(q);
  if (poi) {
    parsed.nearPoi = alias;
    parsed.poi = poi;
  }

  for (const a of AMENITY_WORDS) {
    if (q.includes(a)) parsed.amenities.push(a === "pets" ? "pet friendly" : a);
  }

  const cap =
    q.match(/\bfor\s+(\d+)\b/) ||
    q.match(/\b(\d+)\s+(?:people|guests|persons)\b/) ||
    q.match(/\b(?:sleeps|sleep|capacity)\s+(\d+)\b/);
  if (cap) parsed.minCapacity = Number(cap[1]);

  return parsed;
}

export function summarizeConstraints(parsed) {
  const parts = [];
  if (parsed.type) parts.push(parsed.type);
  if (parsed.minPrice != null && parsed.maxPrice != null) {
    parts.push(`$${parsed.minPrice}-$${parsed.maxPrice}`);
  } else if (parsed.maxPrice != null) {
    parts.push(`under $${parsed.maxPrice}`);
  } else if (parsed.minPrice != null) {
    parts.push(`over $${parsed.minPrice}`);
  }
  if (parsed.freeCancellation) parts.push("free cancellation");
  if (parsed.nearSubway) parts.push("near subway");
  if (parsed.nearPoi) parts.push(`near ${parsed.nearPoi}`);
  if (parsed.minCapacity) parts.push(`for ${parsed.minCapacity}+ guests`);
  if (parsed.amenities.length) parts.push(parsed.amenities.join(", "));
  return parts.length ? parts.join(", ") : "your criteria";
}
