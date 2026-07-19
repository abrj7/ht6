import { enrichPoiDistance, HOME_CITY, POI_WALK_MAX, SUBWAY_WALK_MAX } from "./corpus.js";

export function hardFilter(docs, parsed) {
  return docs.filter((doc) => {
    if (parsed.city && doc.city !== parsed.city) return false;
    if (parsed.type && doc.property.type !== parsed.type) return false;

    if (parsed.minPrice != null && (doc.price == null || doc.price < parsed.minPrice)) return false;
    if (parsed.maxPrice != null && (doc.price == null || doc.price > parsed.maxPrice)) return false;
    if (parsed.minRating != null && (doc.property.rating ?? 0) < parsed.minRating) return false;

    if (parsed.freeCancellation === true && !doc.property.policies?.freeCancellation) return false;

    if (parsed.minCapacity != null && (doc.property.capacity ?? 0) < parsed.minCapacity) return false;

    if (parsed.amenities.length) {
      const have = new Set((doc.amenities ?? []).map((a) => a.toLowerCase()));
      for (const want of parsed.amenities) {
        if (!have.has(want.toLowerCase())) return false;
      }
    }

    if (parsed.nearSubway && doc.city === HOME_CITY) {
      if (!doc.nearestStation || doc.nearestStation.walkMinutes > SUBWAY_WALK_MAX) return false;
    }

    if (parsed.poi && doc.city === HOME_CITY) {
      const poiDist = enrichPoiDistance(doc.property, parsed.poi);
      if (!poiDist || poiDist.walkMinutes > POI_WALK_MAX) return false;
    }

    return true;
  });
}

export function buildWhy(doc, parsed, score) {
  const reasons = [];
  if (parsed.type && doc.property.type === parsed.type) reasons.push(`${parsed.type} match`);
  if (doc.price != null) {
    if (parsed.minPrice != null && parsed.maxPrice != null) {
      reasons.push(`$${doc.price} within $${parsed.minPrice}-$${parsed.maxPrice}`);
    } else if (parsed.maxPrice != null) {
      reasons.push(`$${doc.price} under $${parsed.maxPrice}`);
    } else {
      reasons.push(`$${doc.price}/night`);
    }
  }
  if (parsed.freeCancellation && doc.property.policies?.freeCancellation) {
    reasons.push("free cancellation");
  }
  if (doc.nearestStation && (parsed.nearSubway || doc.city === HOME_CITY)) {
    reasons.push(`${doc.nearestStation.walkMinutes} min walk to ${doc.nearestStation.name}`);
  }
  if (parsed.poi && doc.city === HOME_CITY) {
    const poiDist = enrichPoiDistance(doc.property, parsed.poi);
    if (poiDist) reasons.push(`${poiDist.walkMinutes} min walk to ${poiDist.name}`);
  }
  if (doc.property.rating != null) reasons.push(`rating ${doc.property.rating}`);
  if (score > 0) reasons.push(`relevance ${score.toFixed(2)}`);
  return reasons.join("; ") || "matches your search";
}
