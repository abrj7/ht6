import {
  CITY_SYMBOLS,
  EVENTS,
  HDX_WEIGHTS,
  METHODOLOGY,
  SNAPSHOT_INTERVAL_MS,
} from "./constants.js";
import { getSnapshots, getNextPollAt } from "./collector.js";

const MOMENTUM_WINDOW = 6;
const FORECAST_INPUT_POINTS = 12;
const FORECAST_STEPS = 5;
const SIGNAL_HEAT = 0.8;
const SIGNAL_COOL = -0.8;

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function computeBaselines(snapshots) {
  const baselines = {};
  for (const snap of snapshots) {
    for (const [city, m] of Object.entries(snap.cities || {})) {
      if (Number.isFinite(m.medianPrice) && !baselines[city]) {
        baselines[city] = m.medianPrice;
      }
    }
  }
  return baselines;
}

/** HDX = weighted blend of price vs baseline, inverse free-cancel, instant-book. */
export function computeCityHDX(metrics, baselinePrice) {
  const base = baselinePrice && baselinePrice > 0 ? baselinePrice : metrics.medianPrice || 1;
  const priceScore = ((metrics.medianPrice ?? base) / base) * 100;
  const policyScore = (1 - (metrics.freeCancelRate ?? 0)) * 100;
  const instantScore = (metrics.instantBookRate ?? 0) * 100;

  return round1(
    HDX_WEIGHTS.medianPrice * priceScore +
      HDX_WEIGHTS.inverseFreeCancel * policyScore +
      HDX_WEIGHTS.instantBook * instantScore
  );
}

function signalFromMomentum(momentum) {
  if (momentum > SIGNAL_HEAT) return "heating";
  if (momentum < SIGNAL_COOL) return "cooling";
  return "stable";
}

function compositeAtSnapshot(snap, baselines) {
  const cities = Object.keys(snap.cities || {});
  if (!cities.length) return null;
  const hdxValues = cities.map((city) =>
    computeCityHDX(snap.cities[city], baselines[city])
  );
  return round1(hdxValues.reduce((a, b) => a + b, 0) / hdxValues.length);
}

function momentumFromSeries(series) {
  if (series.length < 2) return 0;
  const window = Math.min(MOMENTUM_WINDOW, series.length - 1);
  const prev = series[series.length - 1 - window];
  const last = series[series.length - 1];
  return round2(last - prev);
}

function linearForecast(values, steps) {
  const n = values.length;
  if (n < 2) {
    const v = values[0] ?? 100;
    return {
      points: Array.from({ length: steps }, (_, i) => ({
        step: i + 1,
        value: v,
        low: v - 2,
        high: v + 2,
      })),
      residualStd: 1,
    };
  }

  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den ? num / den : 0;
  const intercept = meanY - slope * meanX;

  const residuals = values.map((y, i) => y - (intercept + slope * i));
  const residualStd =
    Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / Math.max(n - 2, 1)) || 1.5;

  const points = [];
  for (let s = 1; s <= steps; s++) {
    const x = n - 1 + s;
    const value = round1(intercept + slope * x);
    const band = round1(residualStd * 1.5);
    points.push({
      step: s,
      value,
      low: round1(value - band),
      high: round1(value + band),
    });
  }

  return { points, slope: round2(slope), residualStd: round1(residualStd) };
}

function enrichEvents(snapshots) {
  const last = snapshots[snapshots.length - 1];
  return EVENTS.map((ev) => {
    const cityMetrics = last?.cities?.[ev.city];
    const baselines = computeBaselines(snapshots);
    const hdx = cityMetrics ? computeCityHDX(cityMetrics, baselines[ev.city]) : null;

    const series = snapshots
      .map((s) => ({
        t: s.t,
        hdx: s.cities?.[ev.city] ? computeCityHDX(s.cities[ev.city], baselines[ev.city]) : null,
      }))
      .filter((p) => p.hdx != null);

    const momentum = momentumFromSeries(series.map((p) => p.hdx));

    return {
      ...ev,
      currentHdx: hdx,
      momentum,
      signal: signalFromMomentum(momentum),
    };
  });
}

export function buildNowcastResponse() {
  const snapshots = getSnapshots();
  const baselines = computeBaselines(snapshots);
  const now = new Date().toISOString();

  const compositeHistory = snapshots
    .map((snap) => {
      const value = compositeAtSnapshot(snap, baselines);
      return value == null ? null : { t: snap.t, value, seeded: snap.seeded };
    })
    .filter(Boolean);

  const compositeValues = compositeHistory.map((p) => p.value);
  const compositeIndex = compositeValues.length
    ? compositeValues[compositeValues.length - 1]
    : 100;
  const compositeMomentum = momentumFromSeries(compositeValues);
  const compositeSignal = signalFromMomentum(compositeMomentum);

  const recentForForecast = compositeValues.slice(-FORECAST_INPUT_POINTS);
  const { points: forecastRaw, slope, residualStd } = linearForecast(
    recentForForecast,
    FORECAST_STEPS
  );
  const lastT = snapshots.length ? new Date(snapshots[snapshots.length - 1].t).getTime() : Date.now();
  const forecast = {
    horizonHours: round1((FORECAST_STEPS * SNAPSHOT_INTERVAL_MS) / 3600000),
    slope,
    residualStd,
    points: forecastRaw.map((p) => ({
      t: new Date(lastT + p.step * SNAPSHOT_INTERVAL_MS).toISOString(),
      value: p.value,
      low: p.low,
      high: p.high,
    })),
  };

  const lastSnap = snapshots[snapshots.length - 1];
  const prevSnap = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;

  const cities = Object.keys(CITY_SYMBOLS).map((city) => {
    const latest = lastSnap?.cities?.[city] ?? null;
    const prev = prevSnap?.cities?.[city] ?? null;
    const hdx = latest ? computeCityHDX(latest, baselines[city]) : null;
    const prevHdx = prev ? computeCityHDX(prev, baselines[city]) : null;

    const citySeries = snapshots
      .map((s) => (s.cities?.[city] ? computeCityHDX(s.cities[city], baselines[city]) : null))
      .filter((v) => v != null);
    const momentum = momentumFromSeries(citySeries);

    return {
      city,
      symbol: CITY_SYMBOLS[city],
      hdx,
      signal: signalFromMomentum(momentum),
      momentum,
      delta: prevHdx != null && hdx != null ? round2(hdx - prevHdx) : null,
      medianPrice: latest?.medianPrice ?? null,
      freeCancelRate: latest?.freeCancelRate ?? null,
      instantBookRate: latest?.instantBookRate ?? null,
      propertyCount: latest?.propertyCount ?? 0,
      history: snapshots
        .map((s) =>
          s.cities?.[city]
            ? {
                t: s.t,
                hdx: computeCityHDX(s.cities[city], baselines[city]),
                seeded: s.seeded,
              }
            : null
        )
        .filter(Boolean),
    };
  });

  const seededCount = snapshots.filter((s) => s.seeded).length;
  const realCount = snapshots.filter((s) => !s.seeded).length;

  return {
    asOf: now,
    mode: "mock",
    composite: {
      label: METHODOLOGY.compositeLabel,
      index: compositeIndex,
      signal: compositeSignal,
      momentum: compositeMomentum,
      history: compositeHistory,
      forecast,
    },
    cities,
    methodology: METHODOLOGY,
    events: enrichEvents(snapshots),
    meta: {
      snapshotCount: snapshots.length,
      seededCount,
      realCount,
      pollIntervalMinutes: SNAPSHOT_INTERVAL_MS / 60000,
      nextPollAt: getNextPollAt(),
      weights: HDX_WEIGHTS,
    },
  };
}
