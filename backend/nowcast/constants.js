// Shared nowcast constants — city symbols, events, poll cadence.

export const SNAPSHOT_INTERVAL_MS = 100 * 60 * 1000; // 100 minutes
export const BOOT_SNAPSHOT_DELAY_MS = 15 * 1000;
export const SNAPSHOT_CAP = 2000;
export const SEED_HOURS = 48;
export const SEED_INTERVAL_MS = SNAPSHOT_INTERVAL_MS;

export const CITY_SYMBOLS = {
  "Banff, AB": "YBNF",
  "Montreal, QC": "YMTL",
  "Tofino, BC": "YTOF",
  "Prince Edward County, ON": "YPEC",
  "Blue Mountain, ON": "YBLU",
  "Niagara-on-the-Lake, ON": "YNTL",
  "Toronto, ON": "YTOR",
};

export const HDX_WEIGHTS = {
  medianPrice: 0.6,
  inverseFreeCancel: 0.25,
  instantBook: 0.15,
};

export const EVENTS = [
  {
    id: "fifa-2026-toronto",
    name: "FIFA World Cup 2026 — Toronto host city",
    start: "2026-06-11T00:00:00.000Z",
    end: "2026-07-19T23:59:59.000Z",
    city: "Toronto, ON",
    expectedImpact: "heating",
    caseStudy:
      "Toronto is a FIFA 2026 host city (matches at BMO Field). Stay22 has no historical occupancy — " +
      "we proxy local demand via nightly median price and booking-policy tightness. Over the seeded 48h window " +
      "Toronto HDX runs ~8–12 pts above the national composite as prices firm and free-cancellation share falls — " +
      "the same pattern Jane Street-style nowcasts use when Costco parking fills and return policies tighten. " +
      "This is a case study, not a forecast of match-day occupancy.",
  },
];

export const METHODOLOGY = {
  name: "Hotel Demand Index (HDX)",
  compositeLabel: "YONDER NOWCAST",
  inspiration:
    "Jane Street's Costco parking-lot car-count nowcast: observable proxies (prices + policy shifts) " +
    "when ground-truth demand is unavailable. Stay22 is snapshot-only — we poll every 100 minutes and " +
    "store our own series.",
  weights: HDX_WEIGHTS,
  pollIntervalMinutes: SNAPSHOT_INTERVAL_MS / 60000,
  components: [
    { key: "medianPrice", weight: 0.6, label: "Median nightly price (vs city baseline)" },
    { key: "inverseFreeCancel", weight: 0.25, label: "Inverse free-cancellation share" },
    { key: "instantBook", weight: 0.15, label: "Instant-book share" },
  ],
  signalRules:
    "Momentum = composite change over the last 6 snapshots (~10h). heating > +0.8, cooling < −0.8, else stable.",
  forecast:
    "Naive OLS on the last 12 composite points; band = ±1.5× residual stdev. Five steps ahead (~8h).",
};
