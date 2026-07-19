import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mockSearchAccommodations, MAP_CITIES } from "../mockStay22.js";
import {
  SNAPSHOT_INTERVAL_MS,
  BOOT_SNAPSHOT_DELAY_MS,
  SNAPSHOT_CAP,
  SEED_HOURS,
  SEED_INTERVAL_MS,
} from "./constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data", "nowcast");
const SNAPSHOTS_FILE = path.join(DATA_DIR, "snapshots.json");

/** @type {{ snapshots: object[], nextPollAt: string|null }} */
let store = { snapshots: [], nextPollAt: null };
let started = false;
let bootTimer = null;
let pollTimer = null;

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadStore() {
  ensureDataDir();
  if (!fs.existsSync(SNAPSHOTS_FILE)) {
    store = { snapshots: [], nextPollAt: null };
    return;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, "utf8"));
    store = {
      snapshots: Array.isArray(raw.snapshots) ? raw.snapshots : [],
      nextPollAt: raw.nextPollAt ?? null,
    };
  } catch {
    store = { snapshots: [], nextPollAt: null };
  }
}

function persistStore() {
  ensureDataDir();
  fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(store, null, 2));
}

function cheapestTotal(property) {
  const totals = Object.values(property.suppliers || {})
    .map((s) => s?.price?.total)
    .filter((n) => typeof n === "number" && Number.isFinite(n));
  return totals.length ? Math.min(...totals) : null;
}

function median(values) {
  const sorted = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Extract per-city demand proxies from Stay22-shaped results. */
export function extractCityMetrics(results) {
  const list = Array.isArray(results) ? results : [];
  const prices = list.map(cheapestTotal).filter((n) => Number.isFinite(n));
  const n = list.length || 1;
  const freeCancel = list.filter((r) => r.policies?.freeCancellation).length / n;
  const instantBook = list.filter((r) => r.policies?.instantBook).length / n;
  return {
    medianPrice: median(prices),
    freeCancelRate: Math.round(freeCancel * 1000) / 1000,
    instantBookRate: Math.round(instantBook * 1000) / 1000,
    propertyCount: list.length,
  };
}

function collectLiveMetrics(city) {
  const { results } = mockSearchAccommodations({ address: city });
  return extractCityMetrics(results);
}

// Deterministic wobble for seeded rows (stable across reboots).
function seededNoise(city, idx, channel) {
  const seed = city.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + idx * 17 + channel * 31;
  return ((Math.sin(seed * 0.713) + 1) / 2) * 2 - 1;
}

/** Hand-tuned baselines per catalog city (CAD nightly median). */
const CITY_BASELINES = {
  "Banff, AB": 168,
  "Montreal, QC": 98,
  "Tofino, BC": 189,
  "Prince Edward County, ON": 155,
  "Blue Mountain, ON": 191,
  "Niagara-on-the-Lake, ON": 229,
  "Toronto, ON": 262,
};

function seedMetricsForCity(city, idx, totalPoints) {
  const base = CITY_BASELINES[city] ?? 180;
  const progress = idx / Math.max(totalPoints - 1, 1);

  // Toronto ramps harder into FIFA window (case-study heating).
  const isToronto = city === "Toronto, ON";
  const priceDrift = isToronto ? progress * 0.14 : progress * 0.04;
  const policyTighten = isToronto ? progress * 0.22 : progress * 0.08;

  const medianPrice = Math.round(
    base * (1 + priceDrift + seededNoise(city, idx, 1) * 0.025)
  );
  const freeCancelRate = Math.max(
    0.15,
    Math.min(0.95, 0.78 - policyTighten + seededNoise(city, idx, 2) * 0.06)
  );
  const instantBookRate = Math.max(
    0.2,
    Math.min(0.9, 0.55 + progress * 0.12 + seededNoise(city, idx, 3) * 0.05)
  );

  return {
    medianPrice,
    freeCancelRate: Math.round(freeCancelRate * 1000) / 1000,
    instantBookRate: Math.round(instantBookRate * 1000) / 1000,
    propertyCount: city === "Toronto, ON" ? 18 : 3,
  };
}

function buildSnapshotRow(t, seeded, citiesMetrics) {
  return {
    t: new Date(t).toISOString(),
    seeded: Boolean(seeded),
    cities: citiesMetrics,
  };
}

function seedBackfill() {
  const pointCount = Math.max(2, Math.round((SEED_HOURS * 60 * 60 * 1000) / SEED_INTERVAL_MS));
  const now = Date.now();
  const rows = [];

  for (let i = 0; i < pointCount; i++) {
    const t = now - (pointCount - i) * SEED_INTERVAL_MS;
    const cities = {};
    for (const city of MAP_CITIES) {
      cities[city] = seedMetricsForCity(city, i, pointCount);
    }
    rows.push(buildSnapshotRow(t, true, cities));
  }

  store.snapshots = rows.slice(-SNAPSHOT_CAP);
  store.nextPollAt = new Date(now + SNAPSHOT_INTERVAL_MS).toISOString();
  persistStore();
}

function appendSnapshot(seeded) {
  const cities = {};
  for (const city of MAP_CITIES) {
    cities[city] = seeded ? seedMetricsForCity(city, store.snapshots.length, store.snapshots.length + 1) : collectLiveMetrics(city);
  }
  store.snapshots.push(buildSnapshotRow(Date.now(), seeded, cities));
  if (store.snapshots.length > SNAPSHOT_CAP) {
    store.snapshots = store.snapshots.slice(-SNAPSHOT_CAP);
  }
  store.nextPollAt = new Date(Date.now() + SNAPSHOT_INTERVAL_MS).toISOString();
  persistStore();
}

function takeLiveSnapshot() {
  appendSnapshot(false);
}

export function getSnapshots() {
  return store.snapshots;
}

export function getNextPollAt() {
  return store.nextPollAt;
}

export function startCollector() {
  if (started) return;
  started = true;
  loadStore();

  if (store.snapshots.length === 0) {
    seedBackfill();
  } else if (!store.nextPollAt) {
    store.nextPollAt = new Date(Date.now() + SNAPSHOT_INTERVAL_MS).toISOString();
    persistStore();
  }

  bootTimer = setTimeout(() => {
    takeLiveSnapshot();
    pollTimer = setInterval(takeLiveSnapshot, SNAPSHOT_INTERVAL_MS);
  }, BOOT_SNAPSHOT_DELAY_MS);
}

export function stopCollector() {
  if (bootTimer) clearTimeout(bootTimer);
  if (pollTimer) clearInterval(pollTimer);
  started = false;
}
