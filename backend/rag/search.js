import { listAllProperties } from "../mockStay22.js";
import { BM25 } from "./bm25.js";
import { buildCorpus } from "./corpus.js";
import { parseQuery } from "./constraints.js";
import { hardFilter, buildWhy } from "./filter.js";
import { composeAnswer } from "./composer.js";
import { buildBookUrl, nextWeekendDates, cheapestTotal } from "./bookUrl.js";
import { enrichPoiDistance } from "./corpus.js";

const USE_REAL_STAY22 = Boolean(process.env.STAY22_API_KEY);

let corpusCache = null;

function getCorpus() {
  if (!corpusCache) {
    corpusCache = buildCorpus(listAllProperties());
  }
  return corpusCache;
}

function toResult(doc, parsed, score, checkin, checkout) {
  let nearestStation = doc.nearestStation;
  if (parsed.poi && doc.city === "Toronto, ON") {
    const poiDist = enrichPoiDistance(doc.property, parsed.poi);
    if (poiDist) nearestStation = poiDist;
  }

  return {
    id: doc.property.id,
    name: doc.property.name,
    type: doc.property.type,
    city: doc.city,
    rating: doc.property.rating,
    capacity: doc.property.capacity,
    price: doc.price,
    freeCancellation: doc.property.policies?.freeCancellation ?? false,
    amenities: doc.amenities,
    score: Math.round(score * 100) / 100,
    why: buildWhy(doc, parsed, score),
    bookUrl: buildBookUrl(doc.property, doc.city, checkin, checkout),
    nearestStation,
    property: doc.property,
  };
}

export function searchRag({ query, city }) {
  const parsed = parseQuery(query, city);
  const corpus = getCorpus();
  const filtered = hardFilter(corpus, parsed);

  const ranked =
    filtered.length === 0
      ? []
      : (() => {
          const bm25 = new BM25(filtered);
          return bm25.score(query).map((s) => ({ doc: filtered[s.index], score: s.score }));
        })();

  // If BM25 zeroed everyone, fall back to price sort
  const ordered =
    ranked.length > 0
      ? ranked.sort((a, b) => b.score - a.score || (a.doc.price ?? 999) - (b.doc.price ?? 999))
      : filtered
          .map((doc) => ({ doc, score: 0 }))
          .sort((a, b) => (a.doc.price ?? 999) - (b.doc.price ?? 999));

  const { checkin, checkout } = nextWeekendDates();
  const results = ordered.slice(0, 6).map(({ doc, score }) => toResult(doc, parsed, score, checkin, checkout));

  const stripped = results.map(({ property, ...rest }) => rest);
  const answer = composeAnswer(query, results, parsed);

  return {
    answer,
    parsed,
    results: stripped,
    mode: USE_REAL_STAY22 ? "live" : "mock",
  };
}

export function resetCorpusCache() {
  corpusCache = null;
}
