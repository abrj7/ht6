export function nextWeekendDates() {
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

export function cheapestTotal(property) {
  const totals = Object.values(property.suppliers ?? {})
    .map((s) => s?.price?.total)
    .filter((t) => typeof t === "number");
  return totals.length ? Math.min(...totals) : null;
}

export function buildBookUrl(property, destination, checkin, checkout) {
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
