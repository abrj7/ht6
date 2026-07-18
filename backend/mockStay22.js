// Mock Stay22 responses matching the real /v2/accommodations shape
// (results[].suppliers.*.price.total, location, rating, capacity, policies, type).
// Used automatically when STAY22_API_KEY is blank so everyone can build
// against the contract before Person B wires the real key in.

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
      suppliers: { booking: { price: { total: 214, currency: "CAD" } } },
    },
    {
      id: "mock-banff-2",
      name: "Tunnel Mountain Cabin",
      type: "cabin",
      location: { address: "Banff, AB", lat: 51.1812, lng: -115.5542 },
      rating: 9.1,
      capacity: 4,
      policies: { instantBook: false, freeCancellation: true },
      suppliers: { vrbo: { price: { total: 296, currency: "CAD" } } },
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
      suppliers: { expedia: { price: { total: 96, currency: "CAD" } } },
    },
    {
      id: "mock-mtl-2",
      name: "Old Port Hostel",
      type: "hostel",
      location: { address: "Montreal, QC", lat: 45.5049, lng: -73.5537 },
      rating: 8.7,
      capacity: 1,
      policies: { instantBook: true, freeCancellation: true },
      suppliers: { hotelscom: { price: { total: 54, currency: "CAD" } } },
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
      suppliers: { vrbo: { price: { total: 338, currency: "CAD" } } },
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
      suppliers: { booking: { price: { total: 178, currency: "CAD" } } },
    },
  ],
};

// Category -> destination pairing for the demo. Swap for real user prefs later.
export const CATEGORY_DESTINATIONS = {
  food_delivery: "Banff, AB",
  subscriptions: "Montreal, QC",
  shopping: "Tofino, BC",
  gaming: "Prince Edward County, ON",
  transport: "Montreal, QC",
};

export function mockSearchAccommodations({ address }) {
  const results = CATALOG[address] ?? CATALOG["Banff, AB"];
  // Tiny deterministic-ish jitter so repeated polls show "live" movement in demos.
  const jittered = results.map((r) => {
    const supplierKey = Object.keys(r.suppliers)[0];
    const base = r.suppliers[supplierKey].price.total;
    const jitter = Math.round((Math.random() - 0.5) * 8);
    return {
      ...r,
      suppliers: {
        [supplierKey]: { price: { total: base + jitter, currency: "CAD" } },
      },
    };
  });
  return { results: jittered };
}
