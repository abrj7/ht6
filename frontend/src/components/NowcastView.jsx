// Nowcast agent owns this file and nowcast.css.
import { useEffect, useMemo, useState } from "react";
import "./nowcast.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
const POLL_MS = 5 * 60 * 1000;

const VB_W = 720;
const VB_H = 220;
const PAD = { top: 18, right: 16, bottom: 32, left: 48 };

function round1(n) {
  return Math.round(n * 10) / 10;
}

function timeLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function signalLabel(signal) {
  if (signal === "heating") return "Heating";
  if (signal === "cooling") return "Cooling";
  return "Stable";
}

function buildDemoHistory() {
  const now = Date.now();
  const interval = 100 * 60 * 1000;
  const points = 29;
  return Array.from({ length: points }, (_, i) => {
    const t = new Date(now - (points - 1 - i) * interval).toISOString();
    const progress = i / (points - 1);
    const value = round1(100 + progress * 4.2 + Math.sin(i * 0.9) * 1.2);
    return { t, value, seeded: true };
  });
}

const DEMO_NOWCAST = {
  asOf: new Date().toISOString(),
  mode: "mock",
  composite: {
    label: "YONDER NOWCAST",
    index: 104.2,
    signal: "heating",
    momentum: 1.4,
    history: buildDemoHistory(),
    forecast: {
      horizonHours: 8.3,
      slope: 0.35,
      residualStd: 1.8,
      points: Array.from({ length: 5 }, (_, i) => {
        const step = i + 1;
        const value = round1(104.2 + step * 0.4);
        return {
          t: new Date(Date.now() + step * 100 * 60 * 1000).toISOString(),
          value,
          low: round1(value - 2.7),
          high: round1(value + 2.7),
        };
      }),
    },
  },
  cities: [
    { city: "Toronto, ON", symbol: "YTOR", hdx: 108.4, signal: "heating", momentum: 2.1, medianPrice: 268, freeCancelRate: 0.52, instantBookRate: 0.61, propertyCount: 18 },
    { city: "Banff, AB", symbol: "YBNF", hdx: 102.1, signal: "stable", momentum: 0.4, medianPrice: 172, freeCancelRate: 0.67, instantBookRate: 0.67, propertyCount: 3 },
    { city: "Montreal, QC", symbol: "YMTL", hdx: 99.8, signal: "stable", momentum: 0.2, medianPrice: 99, freeCancelRate: 0.5, instantBookRate: 0.67, propertyCount: 3 },
    { city: "Tofino, BC", symbol: "YTOF", hdx: 101.3, signal: "stable", momentum: 0.5, medianPrice: 192, freeCancelRate: 0.67, instantBookRate: 0.67, propertyCount: 3 },
    { city: "Prince Edward County, ON", symbol: "YPEC", hdx: 100.5, signal: "cooling", momentum: -0.3, medianPrice: 158, freeCancelRate: 0.5, instantBookRate: 0.5, propertyCount: 2 },
    { city: "Blue Mountain, ON", symbol: "YBLU", hdx: 103.6, signal: "heating", momentum: 0.9, medianPrice: 196, freeCancelRate: 0.5, instantBookRate: 0.5, propertyCount: 2 },
    { city: "Niagara-on-the-Lake, ON", symbol: "YNTL", hdx: 101.9, signal: "stable", momentum: 0.3, medianPrice: 234, freeCancelRate: 0.5, instantBookRate: 0.5, propertyCount: 2 },
  ],
  methodology: {
    name: "Hotel Demand Index (HDX)",
    compositeLabel: "YONDER NOWCAST",
    inspiration:
      "Jane Street Costco parking-lot proxy: prices + booking-policy shifts when ground-truth demand is unavailable.",
    weights: { medianPrice: 0.6, inverseFreeCancel: 0.25, instantBook: 0.15 },
    pollIntervalMinutes: 100,
    signalRules: "Momentum over last 6 snapshots (~10h).",
    forecast: "Naive OLS + ±1.5× residual band.",
  },
  events: [
    {
      id: "fifa-2026-toronto",
      name: "FIFA World Cup 2026 — Toronto host city",
      start: "2026-06-11T00:00:00.000Z",
      end: "2026-07-19T23:59:59.000Z",
      city: "Toronto, ON",
      expectedImpact: "heating",
      caseStudy:
        "Toronto hosts FIFA 2026 matches. Our HDX runs above composite as prices firm and free-cancellation share falls — " +
        "a demand proxy, not occupancy data.",
      currentHdx: 108.4,
      momentum: 2.1,
      signal: "heating",
    },
  ],
  meta: { snapshotCount: 29, seededCount: 29, realCount: 0, pollIntervalMinutes: 100, nextPollAt: null },
};

function Gauge({ index, signal, label }) {
  const pct = Math.min(Math.max((index - 80) / 40, 0), 1);
  const signalColor =
    signal === "heating" ? "var(--stamp-red)" : signal === "cooling" ? "var(--route-teal)" : "var(--chalk-dim)";

  return (
    <div className="nowcast-gauge">
      <div className="nowcast-gauge__label">{label}</div>
      <svg className="nowcast-gauge__ring" viewBox="0 0 160 160" aria-hidden="true">
        <circle cx="80" cy="80" r="62" fill="none" stroke="var(--panel-line)" strokeWidth="10" strokeLinecap="round" />
        <circle
          cx="80"
          cy="80"
          r="62"
          fill="none"
          stroke={signalColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${pct * 389} 389`}
          transform="rotate(-135 80 80)"
        />
      </svg>
      <div className="nowcast-gauge__value">
        {round1(index)}
        <span className="nowcast-gauge__base"> / 100</span>
      </div>
      <span className={`nowcast-signal nowcast-signal--${signal}`}>{signalLabel(signal)}</span>
    </div>
  );
}

function NowcastChart({ composite, events }) {
  const history = composite?.history ?? [];
  const forecast = composite?.forecast?.points ?? [];

  const seededHist = history.filter((p) => p.seeded);
  const realHist = history.filter((p) => !p.seeded);

  const allPoints = [
    ...history.map((p) => ({ ...p, kind: "hist" })),
    ...forecast.map((p) => ({ ...p, kind: "forecast", seeded: false })),
  ];

  if (allPoints.length < 2) {
    return <div className="micro-label">Waiting for snapshot history…</div>;
  }

  const values = allPoints.map((p) => p.value);
  const min = Math.min(...values, ...forecast.map((p) => p.low));
  const max = Math.max(...values, ...forecast.map((p) => p.high));
  const span = max - min || 1;

  const plotW = VB_W - PAD.left - PAD.right;
  const plotH = VB_H - PAD.top - PAD.bottom;
  const t0 = new Date(allPoints[0].t).getTime();
  const t1 = new Date(allPoints[allPoints.length - 1].t).getTime();
  const tSpan = t1 - t0 || 1;

  const xy = (p) => {
    const tx = (new Date(p.t).getTime() - t0) / tSpan;
    return [
      PAD.left + tx * plotW,
      PAD.top + (1 - (p.value - min) / span) * plotH,
    ];
  };

  const linePath = (pts) =>
    pts
      .map((p, i) => {
        const [x, y] = xy(p);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  const bandPath = () => {
    if (!forecast.length) return "";
    const anchor = history[history.length - 1];
    const fwd = [anchor, ...forecast];
    const upper = fwd.map((p, i) => {
      const low = p.low ?? p.value;
      const high = p.high ?? p.value;
      const val = i === 0 ? p.value : high;
      const [x, y] = xy({ ...p, value: val });
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const lower = [...fwd].reverse().map((p, i, arr) => {
      const val = i === arr.length - 1 ? p.value : (p.low ?? p.value);
      const [x, y] = xy({ ...p, value: val });
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M${upper.join(" L")} L${lower.join(" L")} Z`;
  };

  const eventMarkers = (events ?? [])
    .map((ev) => {
      const ts = new Date(ev.start).getTime();
      if (ts < t0 || ts > t1) return null;
      const x = PAD.left + ((ts - t0) / tSpan) * plotW;
      return { ...ev, x };
    })
    .filter(Boolean);

  const yBase = PAD.top + plotH;

  return (
    <div className="nowcast-chart-panel">
      <div className="nowcast-chart-head">
        <span className="micro-label">Composite index · 48h window + forecast</span>
        <div className="nowcast-chart-legend">
          <span className="nowcast-legend-item">
            <span className="nowcast-legend-line nowcast-legend-line--dashed" /> Seeded
          </span>
          <span className="nowcast-legend-item">
            <span className="nowcast-legend-line nowcast-legend-line--solid" /> Live polls
          </span>
          <span className="nowcast-legend-item">
            <span className="nowcast-legend-band" /> Forecast band
          </span>
        </div>
      </div>
      <svg
        className="nowcast-chart"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label={`YONDER NOWCAST at ${composite.index}, ${signalLabel(composite.signal)}`}
      >
        <line
          x1={PAD.left}
          x2={PAD.left + plotW}
          y1={yBase}
          y2={yBase}
          stroke="var(--panel-line)"
          strokeWidth="1"
        />
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={yBase}
          stroke="var(--panel-line)"
          strokeWidth="1"
        />

        {[100].map((ref) => {
          const y = PAD.top + (1 - (ref - min) / span) * plotH;
          return (
            <g key={ref}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y}
                y2={y}
                stroke="var(--panel-line)"
                strokeDasharray="4 6"
                strokeWidth="1"
              />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="nowcast-chart-tick">
                {ref}
              </text>
            </g>
          );
        })}

        {bandPath() && (
          <path d={bandPath()} fill="rgba(47, 138, 134, 0.12)" stroke="none" />
        )}

        {seededHist.length >= 2 && (
          <path
            d={linePath(seededHist)}
            fill="none"
            stroke="var(--chalk-dim)"
            strokeWidth="1.5"
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
        )}

        {realHist.length >= 2 && (
          <path
            d={linePath(realHist)}
            fill="none"
            stroke="var(--flap-amber)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}

        {realHist.length === 1 && seededHist.length >= 1 && (
          <path
            d={linePath([seededHist[seededHist.length - 1], realHist[0]])}
            fill="none"
            stroke="var(--flap-amber)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}

        {forecast.length >= 1 && history.length >= 1 && (
          <path
            d={linePath([history[history.length - 1], ...forecast])}
            fill="none"
            stroke="var(--route-teal)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            strokeLinecap="round"
          />
        )}

        {eventMarkers.map((ev) => (
          <g key={ev.id} className="nowcast-event-marker">
            <line
              x1={ev.x}
              x2={ev.x}
              y1={PAD.top}
              y2={yBase}
              stroke="var(--stamp-red)"
              strokeWidth="1"
              strokeDasharray="2 4"
              opacity="0.55"
            />
            <text x={ev.x + 4} y={PAD.top + 10} className="nowcast-chart-tick" fill="var(--stamp-red)">
              FIFA
            </text>
          </g>
        ))}

        <text x={PAD.left} y={VB_H - 8} className="nowcast-chart-tick">
          {timeLabel(allPoints[0].t)}
        </text>
        <text x={PAD.left + plotW} y={VB_H - 8} textAnchor="end" className="nowcast-chart-tick">
          {timeLabel(allPoints[allPoints.length - 1].t)}
        </text>
      </svg>
    </div>
  );
}

function CityCard({ city }) {
  return (
    <article className="nowcast-city">
      <div className="nowcast-city__top">
        <span className="nowcast-city__symbol">{city.symbol}</span>
        <span className="nowcast-city__hdx">{city.hdx != null ? round1(city.hdx) : "—"}</span>
      </div>
      <div className="nowcast-city__name">{city.city}</div>
      <span className={`nowcast-signal nowcast-signal--${city.signal}`}>{signalLabel(city.signal)}</span>
      <dl className="nowcast-city__stats">
        <dt>Median</dt>
        <dd>{city.medianPrice != null ? `$${Math.round(city.medianPrice)}` : "—"}</dd>
        <dt>Free cancel</dt>
        <dd>{city.freeCancelRate != null ? `${Math.round(city.freeCancelRate * 100)}%` : "—"}</dd>
        <dt>Instant</dt>
        <dd>{city.instantBookRate != null ? `${Math.round(city.instantBookRate * 100)}%` : "—"}</dd>
        <dt>Momentum</dt>
        <dd>{city.momentum != null ? (city.momentum > 0 ? "+" : "") + round1(city.momentum) : "—"}</dd>
      </dl>
    </article>
  );
}

export default function NowcastView() {
  const [state, setState] = useState({ data: null, live: false, lastUpdated: null });

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const r = await fetch(`${BACKEND_URL}/api/nowcast`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        if (cancelled) return;
        if (!json.composite || !Array.isArray(json.cities)) throw new Error("invalid payload");
        setState({ data: json, live: true, lastUpdated: new Date() });
      } catch {
        if (cancelled) return;
        setState((s) =>
          s.live
            ? s
            : { data: s.data || DEMO_NOWCAST, live: false, lastUpdated: new Date() }
        );
      }
    }

    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const payload = state.data ?? DEMO_NOWCAST;
  const composite = payload.composite;
  const label = useMemo(() => composite?.label ?? "YONDER NOWCAST", [composite]);

  return (
    <div className="nowcast">
      <div className="nowcast-hero">
        <Gauge index={composite.index} signal={composite.signal} label={label} />
        <NowcastChart composite={composite} events={payload.events} />
      </div>

      <div>
        <div className="micro-label" style={{ marginBottom: "0.65rem" }}>
          City HDX grid · {payload.cities.length} markets
        </div>
        <div className="nowcast-grid">
          {payload.cities.map((c) => (
            <CityCard key={c.symbol} city={c} />
          ))}
        </div>
      </div>

      <div className="nowcast-panels">
        <section className="nowcast-panel">
          <h3>Methodology</h3>
          <p>{payload.methodology?.inspiration}</p>
          <p>{payload.methodology?.name}: weighted blend of nightly median price (vs city baseline), inverse free-cancellation share, and instant-book share.</p>
          <ul className="nowcast-weights">
            <li>
              <span>Median price</span>
              <span>{Math.round((payload.methodology?.weights?.medianPrice ?? 0.6) * 100)}%</span>
            </li>
            <li>
              <span>Inverse free cancel</span>
              <span>{Math.round((payload.methodology?.weights?.inverseFreeCancel ?? 0.25) * 100)}%</span>
            </li>
            <li>
              <span>Instant book</span>
              <span>{Math.round((payload.methodology?.weights?.instantBook ?? 0.15) * 100)}%</span>
            </li>
          </ul>
          <p style={{ marginTop: "0.75rem", fontSize: "0.78rem" }}>
            Poll every {payload.meta?.pollIntervalMinutes ?? 100} min · {payload.methodology?.signalRules}
          </p>
        </section>

        <section className="nowcast-panel">
          <h3>Event case studies</h3>
          {(payload.events ?? []).map((ev) => (
            <div key={ev.id} className="nowcast-event">
              <div className="nowcast-event__title">{ev.name}</div>
              <div className="nowcast-event__meta">
                {ev.city} · HDX {ev.currentHdx != null ? round1(ev.currentHdx) : "—"} ·{" "}
                {signalLabel(ev.signal)} ({ev.momentum > 0 ? "+" : ""}
                {ev.momentum != null ? round1(ev.momentum) : "—"} momentum)
              </div>
              <p>{ev.caseStudy}</p>
            </div>
          ))}
        </section>
      </div>

      <div className="nowcast-meta">
        <span>
          <span className={`nowcast-feed-badge${state.live ? " nowcast-feed-badge--live" : ""}`}>
            {state.live ? "LIVE" : "DEMO"}
          </span>{" "}
          {state.live ? "Backend nowcast feed" : "Demo fallback (backend offline)"} · momentum{" "}
          {composite.momentum > 0 ? "+" : ""}
          {round1(composite.momentum)} · {payload.meta?.snapshotCount ?? 0} snapshots (
          {payload.meta?.realCount ?? 0} live)
        </span>
        {state.lastUpdated && <span>Updated {state.lastUpdated.toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}
