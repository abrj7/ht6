const R = 6371;

export function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough walk time at ~4.8 km/h (80 m/min). */
export function walkMinutes(from, to) {
  const meters = haversineKm(from, to) * 1000;
  return Math.max(1, Math.round(meters / 80));
}

export function nearestPoint(origin, points) {
  let best = null;
  for (const pt of points) {
    const minutes = walkMinutes(origin, pt);
    if (!best || minutes < best.walkMinutes) {
      best = { ...pt, walkMinutes: minutes };
    }
  }
  return best;
}
