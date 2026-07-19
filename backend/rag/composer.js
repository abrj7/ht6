// Grounded answer composer — swap this module for FreeSolo inference later.
import { summarizeConstraints } from "./constraints.js";

export function composeAnswer(query, results, parsed) {
  if (!results.length) {
    return `No stays in ${parsed.city} matched ${summarizeConstraints(parsed)}. Try relaxing price or location filters.`;
  }

  const count = results.length;
  const header = `Found ${count} stay${count === 1 ? "" : "s"} in ${parsed.city} for "${query}":`;

  const lines = results.slice(0, 3).map((r, i) => {
    const p = r.property;
    const bits = [
      `${p.name}`,
      p.type,
      r.price != null ? `$${r.price} CAD/night` : null,
      p.rating != null ? `rating ${p.rating}` : null,
      p.policies?.freeCancellation ? "free cancellation" : null,
      r.nearestStation ? `${r.nearestStation.walkMinutes} min to ${r.nearestStation.name}` : null,
    ].filter(Boolean);
    return `${i + 1}. ${bits.join(" · ")}.`;
  });

  const top = results[0];
  const footer =
    count === 1
      ? `Best match: ${top.property.name} at $${top.price} CAD/night.`
      : `Top pick: ${top.property.name} at $${top.price} CAD/night — ${top.why}.`;

  return [header, ...lines, footer].join("\n");
}
