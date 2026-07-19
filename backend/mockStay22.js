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
      amenities: ["wifi", "parking", "restaurant", "gym", "breakfast", "ski access"],
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
      amenities: ["wifi", "parking", "fireplace", "hot tub", "kitchen", "mountain view"],
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
      amenities: ["wifi", "kitchen", "laundry", "common room"],
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
      amenities: ["wifi", "restaurant", "bar", "air conditioning"],
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
      amenities: ["wifi", "kitchen", "laundry", "breakfast"],
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
      amenities: ["wifi", "kitchen", "parking", "pet friendly", "balcony"],
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
      amenities: ["wifi", "kitchen", "beach access", "hot tub", "fireplace", "parking"],
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
      amenities: ["wifi", "kitchen", "laundry", "surf storage"],
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
      amenities: ["wifi", "restaurant", "spa", "parking", "beach access"],
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
      amenities: ["wifi", "kitchen", "fireplace", "lake view", "parking", "pet friendly"],
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
      amenities: ["wifi", "restaurant", "parking", "lake view"],
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
      amenities: ["wifi", "parking", "restaurant", "pool", "ski access", "gym"],
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
      amenities: ["wifi", "fireplace", "hot tub", "ski access", "kitchen", "parking"],
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
      amenities: ["wifi", "restaurant", "bar", "parking", "spa"],
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
      amenities: ["wifi", "kitchen", "parking", "fireplace", "garden", "pet friendly"],
      suppliers: { vrbo: quote(289), expedia: quote(312), booking: quote(334) },
    },
  ],
  // Home city — feeds /api/map ONLY. Never a ticker on the exchange and never
  // a departure-board destination (it's the origin for the green layer).
  "Toronto, ON": [
    {
      id: "mock-tor-1",
      name: "King & Bay Grand Hotel",
      type: "hotel",
      location: { address: "Toronto, ON", lat: 43.6486, lng: -79.3812 },
      rating: 8.9,
      capacity: 2,
      policies: { instantBook: true, freeCancellation: true },
      amenities: ["wifi", "gym", "restaurant", "concierge", "room service", "parking"],
      suppliers: { booking: quote(312), expedia: quote(328), hotelscom: quote(341), vrbo: quote(336) },
    },
    {
      id: "mock-tor-2",
      name: "Harbourfront View Hotel",
      type: "hotel",
      location: { address: "Toronto, ON", lat: 43.6392, lng: -79.3819 },
      rating: 8.3,
      capacity: 3,
      policies: { instantBook: true, freeCancellation: false },
      amenities: ["wifi", "restaurant", "lake view", "fitness center"],
      suppliers: { expedia: quote(246), booking: quote(255), hotelscom: quote(268) },
    },
    {
      id: "mock-tor-3",
      name: "TIFF District Boutique Hotel",
      type: "hotel",
      location: { address: "Toronto, ON", lat: 43.6468, lng: -79.3907 },
      rating: 8.6,
      capacity: 2,
      policies: { instantBook: true, freeCancellation: true },
      amenities: ["wifi", "bar", "breakfast", "air conditioning"],
      suppliers: { booking: quote(228), hotelscom: quote(236), expedia: quote(249) },
    },
    {
      id: "mock-tor-4",
      name: "King West Backpackers",
      type: "hostel",
      location: { address: "Toronto, ON", lat: 43.6447, lng: -79.3958 },
      rating: 7.8,
      capacity: 1,
      policies: { instantBook: true, freeCancellation: false },
      amenities: ["wifi", "kitchen", "laundry", "common room"],
      suppliers: { hotelscom: quote(74), booking: quote(79), expedia: quote(81) },
    },
    {
      id: "mock-tor-5",
      name: "Queen West Art Hotel",
      type: "hotel",
      location: { address: "Toronto, ON", lat: 43.6473, lng: -79.4128 },
      rating: 8.4,
      capacity: 2,
      policies: { instantBook: true, freeCancellation: true },
      amenities: ["wifi", "restaurant", "bar", "art gallery"],
      suppliers: { expedia: quote(198), booking: quote(207), vrbo: quote(219) },
    },
    {
      id: "mock-tor-6",
      name: "Trinity Bellwoods Loft",
      type: "apartment",
      location: { address: "Toronto, ON", lat: 43.6479, lng: -79.4187 },
      rating: 8.9,
      capacity: 4,
      policies: { instantBook: false, freeCancellation: true },
      amenities: ["wifi", "kitchen", "washer dryer", "balcony", "pet friendly"],
      // Deliberate ~26% spread — a downtown arb candidate for the map layer.
      suppliers: { vrbo: quote(176), booking: quote(199), expedia: quote(221) },
    },
    {
      id: "mock-tor-7",
      name: "Yorkville Luxe Hotel",
      type: "hotel",
      location: { address: "Toronto, ON", lat: 43.6708, lng: -79.3903 },
      rating: 9.4,
      capacity: 2,
      policies: { instantBook: true, freeCancellation: true },
      amenities: ["wifi", "spa", "restaurant", "concierge", "valet parking", "gym"],
      suppliers: { booking: quote(438), expedia: quote(449), hotelscom: quote(462) },
    },
    {
      id: "mock-tor-8",
      name: "Avenue Road Suites",
      type: "apartment",
      location: { address: "Toronto, ON", lat: 43.6737, lng: -79.3964 },
      rating: 8.7,
      capacity: 4,
      policies: { instantBook: false, freeCancellation: true },
      amenities: ["wifi", "kitchen", "parking", "gym access"],
      suppliers: { vrbo: quote(265), booking: quote(281), expedia: quote(288) },
    },
    {
      id: "mock-tor-9",
      name: "Annex Victorian Guesthouse",
      type: "apartment",
      location: { address: "Toronto, ON", lat: 43.6669, lng: -79.4043 },
      rating: 8.5,
      capacity: 3,
      policies: { instantBook: true, freeCancellation: true },
      amenities: ["wifi", "breakfast", "garden", "kitchenette"],
      suppliers: { vrbo: quote(142), booking: quote(151) },
    },
    {
      id: "mock-tor-10",
      name: "Bloor Street Hostel",
      type: "hostel",
      location: { address: "Toronto, ON", lat: 43.6653, lng: -79.4098 },
      rating: 7.5,
      capacity: 1,
      policies: { instantBook: true, freeCancellation: false },
      amenities: ["wifi", "kitchen", "laundry"],
      suppliers: { booking: quote(71), hotelscom: quote(75) },
    },
    {
      id: "mock-tor-11",
      name: "Distillery Lane Lofts",
      type: "apartment",
      location: { address: "Toronto, ON", lat: 43.6503, lng: -79.3596 },
      rating: 9.0,
      capacity: 5,
      policies: { instantBook: false, freeCancellation: true },
      amenities: ["wifi", "kitchen", "parking", "exposed brick", "pet friendly"],
      // Second wide spread (~25%) so more than one Toronto arb pin can fire.
      suppliers: { vrbo: quote(232), hotelscom: quote(262), expedia: quote(289) },
    },
    {
      id: "mock-tor-12",
      name: "St Lawrence Market Inn",
      type: "hotel",
      location: { address: "Toronto, ON", lat: 43.6497, lng: -79.3718 },
      rating: 8.2,
      capacity: 2,
      policies: { instantBook: true, freeCancellation: true },
      amenities: ["wifi", "restaurant", "breakfast"],
      suppliers: { hotelscom: quote(184), booking: quote(191), expedia: quote(198) },
    },
    {
      id: "mock-tor-13",
      name: "Leslieville Brick House",
      type: "apartment",
      location: { address: "Toronto, ON", lat: 43.6624, lng: -79.3341 },
      rating: 8.8,
      capacity: 4,
      policies: { instantBook: false, freeCancellation: true },
      amenities: ["wifi", "kitchen", "parking", "patio", "pet friendly"],
      suppliers: { vrbo: quote(158), booking: quote(171) },
    },
    {
      id: "mock-tor-14",
      name: "Queen East Budget Inn",
      type: "hotel",
      location: { address: "Toronto, ON", lat: 43.6598, lng: -79.3407 },
      rating: 7.2,
      capacity: 2,
      policies: { instantBook: true, freeCancellation: false },
      amenities: ["wifi", "parking"],
      suppliers: { expedia: quote(109), hotelscom: quote(114), booking: quote(118) },
    },
    {
      id: "mock-tor-15",
      name: "Liberty Village Sky Suites",
      type: "apartment",
      location: { address: "Toronto, ON", lat: 43.6379, lng: -79.4206 },
      rating: 8.6,
      capacity: 4,
      policies: { instantBook: true, freeCancellation: true },
      amenities: ["wifi", "kitchen", "gym", "pool", "parking", "balcony"],
      suppliers: { vrbo: quote(203), expedia: quote(214), booking: quote(222) },
    },
    {
      id: "mock-tor-16",
      name: "Kensington Market Hostel",
      type: "hostel",
      location: { address: "Toronto, ON", lat: 43.6547, lng: -79.4005 },
      rating: 8.1,
      capacity: 2,
      policies: { instantBook: true, freeCancellation: true },
      amenities: ["wifi", "kitchen", "laundry", "common room", "breakfast"],
      suppliers: { booking: quote(82), hotelscom: quote(86), expedia: quote(93) },
    },
    {
      id: "mock-tor-17",
      name: "Airport Gateway Hotel",
      type: "hotel",
      location: { address: "Toronto, ON", lat: 43.6858, lng: -79.6032 },
      rating: 7.6,
      capacity: 2,
      policies: { instantBook: true, freeCancellation: true },
      amenities: ["wifi", "shuttle", "restaurant", "parking", "air conditioning"],
      suppliers: { expedia: quote(139), booking: quote(146), hotelscom: quote(152) },
    },
    {
      id: "mock-tor-18",
      name: "Dixon Road Value Inn",
      type: "hotel",
      location: { address: "Toronto, ON", lat: 43.6889, lng: -79.5867 },
      rating: 7.3,
      capacity: 2,
      policies: { instantBook: true, freeCancellation: false },
      amenities: ["wifi", "parking", "shuttle"],
      suppliers: { hotelscom: quote(98), booking: quote(104), expedia: quote(111) },
    },
  ],
};

// Toronto is the user's home city: it feeds the /api/map layer but must never
// list on the exchange or appear as a departure-board destination.
const HOME_CITY = "Toronto, ON";

// Every destination on the exchange (drives /api/market ticker coverage).
export const CATALOG_DESTINATIONS = Object.keys(CATALOG).filter(
  (d) => d !== HOME_CITY
);

// Every city the /api/map endpoint can serve (home city included).
export const MAP_CITIES = Object.keys(CATALOG);

// Category -> destination pairing for the demo. Swap for real user prefs later.
export const CATEGORY_DESTINATIONS = {
  food_delivery: "Banff, AB",
  subscriptions: "Montreal, QC",
  shopping: "Tofino, BC",
  gaming: "Paris, France",
  transport: "Blue Mountain, ON",
};

// One representative lat/lng per destination, used by the green/carbon layer
// (works in both mock and live mode - it's static geography, not pricing).
// Excludes the home city: Toronto is the trip ORIGIN, so it must never show
// up as a "greener alternative" destination (0 km / 0 kg would beat anything).
export const DESTINATION_COORDS = Object.fromEntries(
  CATALOG_DESTINATIONS.map((dest) => [
    dest,
    { lat: CATALOG[dest][0].location.lat, lng: CATALOG[dest][0].location.lng },
  ])
);

// Map centers per city (rough downtown/centroid, static geography).
export const CITY_CENTERS = {
  ...DESTINATION_COORDS,
  [HOME_CITY]: { lat: 43.6532, lng: -79.3832 },
};

// Accepts "Toronto" or "Toronto, ON" (any case) and returns the canonical
// catalog key, or null if the city isn't in the catalog.
export function resolveCity(input) {
  if (!input) return null;
  const wanted = String(input).trim().toLowerCase();
  for (const key of Object.keys(CATALOG)) {
    const cityOnly = key.split(",")[0].trim().toLowerCase();
    if (key.toLowerCase() === wanted || cityOnly === wanted) return key;
  }
  return null;
}

/** Flat catalog for RAG corpus indexing (stable mock prices, no jitter). */
export function listAllProperties() {
  return Object.entries(CATALOG).flatMap(([city, props]) =>
    props.map((property) => ({ property, city }))
  );
}

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
