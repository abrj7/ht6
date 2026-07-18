// Person B owns this file. Wraps the Stay22 accommodations search.
// Docs: https://dev.stay22.com/docs/api/accommodations/search
// IMPORTANT: price cache is ~10min on their end - don't poll faster than that.
import fetch from "node-fetch";

const BASE_URL = "https://api.stay22.com/v2/accommodations";

export async function searchAccommodations({ address, checkin, checkout, min, max, type }) {
  const params = new URLSearchParams();
  if (address) params.set("address", address);
  if (checkin) params.set("checkin", checkin);
  if (checkout) params.set("checkout", checkout);
  if (min) params.set("min", String(min));
  if (max) params.set("max", String(max));
  if (type) params.set("type", type);

  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { "X-API-KEY": process.env.STAY22_API_KEY },
  });

  if (!res.ok) {
    throw new Error(`Stay22 error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
