// Mock Stay22 responses matching the real /v2/accommodations shape
// (results[].suppliers.*.price.total, location, rating, capacity, policies, type).
// Used automatically when STAY22_API_KEY is blank so everyone can build
// against the contract before Person B wires the real key in.
//
// Exchange mechanic: every property carries 2-4 suppliers (booking / vrbo /
// expedia / hotelscom) quoting DIFFERENT prices for the same property, giving
// /api/market a real bid/ask spread. Spreads are hand-tuned 3-20% with a
// couple of ~25% outliers for arbitrage flags; per-poll jitter moves them.

function quote(total) {
  return { price: { total, currency: "CAD" } };
}

const CATALOG = {
  "Banff, AB": [
    {
      id: "mock-banff-1",
      name: "Spruce Grove Inn",
      type: "hotel",
      location: { address: "Banff, AB", lat: 51.1784, lng: -115.5708 },
      rating: 8.4,
      capacity: 2,
      policies: { instantBook: true, freeCancellation: true },
      suppliers: { booking: quote(214), expedia: quote(226), hotelscom: quote(239) },
    },
    {
      id: "mock-banff-2",
      name: "Tunnel Mountain Cabin",
      type: "cabin",
      location: { address: "Banff, AB", lat: 51.1812, lng: -115.5542 },
      rating: 9.1,
      capacity: 4,
      policies: { instantBook: false, freeCancellation: true },
      suppliers: { vrbo: quote(296), booking: quote(327), expedia: quote(344) },
    },
    {
      id: "mock-banff-3",
      name: "Bow Valley Backpackers",
      type: "hostel",
      location: { address: "Banff, AB", lat: 51.1761, lng: -115.5698 },
      rating: 8.2,
      capacity: 1,
      policies: { instantBook: true, freeCancellation: false },
      suppliers: { hotelscom: quote(88), expedia: quote(91), booking: quote(94) },
    },
  ],
  "Montreal, QC": [
    {
      id: "mock-mtl-1",
      name: "Hotel Le Plateau",
      type: "hotel",
      location: { address: "Montreal, QC", lat: 45.5231, lng: -73.5817 },
      rating: 8.0,
      capacity: 2,
      policies: { instantBook: true, freeCancellation: false },
      suppliers: { expedia: quote(96), booking: quote(101), hotelscom: quote(108) },
    },
    {
      id: "mock-mtl-2",
      name: "Old Port Hostel",
      type: "hostel",
      location: { address: "Montreal, QC", lat: 45.5049, lng: -73.5537 },
      rating: 8.7,
      capacity: 1,
      policies: { instantBook: true, freeCancellation: true },
      suppliers: { hotelscom: quote(54), booking: quote(59) },
    },
    {
      id: "mock-mtl-3",
      name: "Mile End Loft Villa",
      type: "villa",
      location: { address: "Montreal, QC", lat: 45.5266, lng: -73.6023 },
      rating: 9.0,
      capacity: 5,
      policies: { instantBook: false, freeCancellation: true },
      suppliers: { vrbo: quote(242), expedia: quote(261), booking: quote(275) },
    },
  ],
  "Tofino, BC": [
    {
      id: "mock-tofino-1",
      name: "Chesterman Beach Villa",
      type: "villa",
      location: { address: "Tofino, BC", lat: 49.1246, lng: -125.8931 },
      rating: 9.3,
      capacity: 6,
      policies: { instantBook: false, freeCancellation: true },
      // ~25% outlier spread on purpose: vrbo lists at 338 while expedia asks
      // 424 for the same villa - textbook arbitrage flag for the exchange.
      suppliers: { vrbo: quote(338), booking: quote(371), expedia: quote(424) },
    },
    {
      id: "mock-tofino-2",
      name: "Surf Junction Hostel",
      type: "hostel",
      location: { address: "Tofino, BC", lat: 49.1103, lng: -125.8845 },
      rating: 8.5,
      capacity: 2,
      policies: { instantBook: true, freeCancellation: true },
      suppliers: { hotelscom: quote(76), booking: quote(82) },
    },
    {
      id: "mock-tofino-3",
      name: "Pacific Rim Hotel",
      type: "hotel",
      location: { address: "Tofino, BC", lat: 49.153, lng: -125.9066 },
      rating: 8.6,
      capacity: 2,
      policies: { instantBook: true, freeCancellation: false },
      suppliers: { booking: quote(189), expedia: quote(197), hotelscom: quote(214), vrbo: quote(221) },
    },
  ],
  "Prince Edward County, ON": [
    {
      id: "mock-pec-1",
      name: "Wellington Lakeside Cabin",
      type: "cabin",
      location: { address: "Prince Edward County, ON", lat: 43.9515, lng: -77.3505 },
      rating: 8.8,
      capacity: 4,
      policies: { instantBook: true, freeCancellation: true },
      suppliers: { booking: quote(178), vrbo: quote(186), expedia: quote(203) },
    },
    {
      id: "mock-pec-2",
      name: "Picton Harbour Hotel",
      type: "hotel",
      location: { address: "Prince Edward County, ON", lat: 44.0058, lng: -77.1409 },
      rating: 8.1,
      capacity: 2,
      policies: { instantBook: true, freeCancellation: false },
      suppliers: { expedia: quote(132), hotelscom: quote(137), booking: quote(146) },
    },
  ],
  "Blue Mountain, ON": [
    {
      id: "mock-blue-1",
      name: "Blue Mountain Village Hotel",
      type: "hotel",
      location: { address: "Blue Mountain, ON", lat: 44.5001, lng: -80.3163 },
      rating: 8.3,
      capacity: 2,
      policies: { instantBook: true, freeCancellation: true },
      suppliers: { booking: quote(158), expedia: quote(164), hotelscom: quote(176) },
    },
    {
      id: "mock-blue-2",
      name: "Craigleith Ski Cabin",
      type: "cabin",
      location: { address: "Blue Mountain, ON", lat: 44.5245, lng: -80.3512 },
      rating: 8.9,
      capacity: 6,
      policies: { instantBook: false, freeCancellation: true },
      // Second deliberate outlier (~24%) so more than one arb can fire.
      suppliers: { vrbo: quote(224), booking: quote(278) },
    },
  ],
  "Niagara-on-the-Lake, ON": [
    {
      id: "mock-notl-1",
      name: "Queen Street Boutique Hotel",
      type: "hotel",
      location: { address: "Niagara-on-the-Lake, ON", lat: 43.2557, lng: -79.0717 },
      rating: 8.6,
      capacity: 2,
      policies: { instantBook: true, freeCancellation: true },
      suppliers: { expedia: quote(168), booking: quote(174), hotelscom: quote(185), vrbo: quote(196) },
    },
    {
      id: "mock-notl-2",
      name: "Vineyard Guest Villa",
      type: "villa",
      location: { address: "Niagara-on-the-Lake, ON", lat: 43.2311, lng: -79.1006 },
      rating: 9.2,
      capacity: 4,
      policies: { instantBook: false, freeCancellation: true },
      suppliers: { vrbo: quote(289), expedia: quote(312), booking: quote(334) },
    },
  ],
};

// Every destination on the exchange (drives /api/market ticker coverage).
export const CATALOG_DESTINATIONS = Object.keys(CATALOG);

// Category -> destination pairing for the demo. Swap for real user prefs later.
export const CATEGORY_DESTINATIONS = {
  food_delivery: "Banff, AB",
  subscriptions: "Montreal, QC",
  shopping: "Tofino, BC",
  gaming: "Prince Edward County, ON",
  transport: "Blue Mountain, ON",
};

// One representative lat/lng per destination, used by the green/carbon layer
// (works in both mock and live mode - it's static geography, not pricing).
export const DESTINATION_COORDS = Object.fromEntries(
  Object.entries(CATALOG).map(([dest, props]) => [
    dest,
    { lat: props[0].location.lat, lng: props[0].location.lng },
  ])
);

export function mockSearchAccommodations({ address, type }) {
  const all = CATALOG[address] ?? CATALOG["Banff, AB"];
  // Type filter mirrors the real API's `type` param. Fall back to the full
  // list if the filter would return nothing (keeps the demo alive).
  const filtered = type ? all.filter((r) => r.type === type) : all;
  const results = filtered.length ? filtered : all;
  // Per-supplier jitter so repeated polls show "live" movement AND the
  // bid/ask spread itself shifts between refreshes (each market maker
  // reprices independently).
  const jittered = results.map((r) => {
    const suppliers = Object.fromEntries(
      Object.entries(r.suppliers).map(([name, s]) => {
        const jitter = Math.round((Math.random() - 0.5) * 8);
        return [name, { price: { total: Math.max(20, s.price.total + jitter), currency: "CAD" } }];
      })
    );
    return { ...r, suppliers };
  });
  return { results: jittered };
}
