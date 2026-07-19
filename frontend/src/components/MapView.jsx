import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./map.css";

const API_BASE = "http://localhost:4000";
const POLL_MS = 60_000;
const DEBOUNCE_MS = 300;

const CITIES = [
  "Toronto, ON",
  "Banff, AB",
  "Montreal, QC",
  "Tofino, BC",
  "Blue Mountain, ON",
  "Niagara-on-the-Lake, ON",
];

const RATING_OPTIONS = [
  { label: "ANY", value: "" },
  { label: "7+", value: "7" },
  { label: "8+", value: "8" },
  { label: "9+", value: "9" },
];

// ---------------------------------------------------------------------------
// Demo fallback dataset — downtown Toronto, used when the API is unreachable.
// ---------------------------------------------------------------------------
const DEMO_PROPERTIES = [
  { id: "d1",  name: "Fairmont Royal York",           type: "hotel",     lat: 43.6455, lng: -79.3813, price: 389, rating: 8.9, capacity: 4, supplier: "booking",   spreadPct: 9,  arb: false, freeCancellation: true,  instantBook: true,  bookUrl: "https://www.stay22.com" },
  { id: "d2",  name: "The Drake Hotel",               type: "hotel",     lat: 43.6428, lng: -79.4244, price: 245, rating: 8.6, capacity: 2, supplier: "expedia",   spreadPct: 6,  arb: false, freeCancellation: true,  instantBook: false, bookUrl: "https://www.stay22.com" },
  { id: "d3",  name: "HI Toronto Hostel",             type: "hostel",    lat: 43.6552, lng: -79.3785, price: 68,  rating: 7.4, capacity: 1, supplier: "booking",   spreadPct: 4,  arb: false, freeCancellation: false, instantBook: true,  bookUrl: "https://www.stay22.com" },
  { id: "d4",  name: "One King West Hotel",           type: "hotel",     lat: 43.6491, lng: -79.3778, price: 312, rating: 8.8, capacity: 4, supplier: "hotelscom", spreadPct: 14, arb: true,  freeCancellation: true,  instantBook: true,  bookUrl: "https://www.stay22.com" },
  { id: "d5",  name: "Chelsea Hotel Toronto",         type: "hotel",     lat: 43.6577, lng: -79.3833, price: 198, rating: 7.8, capacity: 5, supplier: "booking",   spreadPct: 5,  arb: false, freeCancellation: true,  instantBook: false, bookUrl: "https://www.stay22.com" },
  { id: "d6",  name: "King Blue Hotel",               type: "hotel",     lat: 43.6459, lng: -79.3892, price: 224, rating: 8.2, capacity: 3, supplier: "expedia",   spreadPct: 7,  arb: false, freeCancellation: false, instantBook: true,  bookUrl: "https://www.stay22.com" },
  { id: "d7",  name: "The Anndore House",             type: "hotel",     lat: 43.6669, lng: -79.3841, price: 259, rating: 8.7, capacity: 2, supplier: "booking",   spreadPct: 8,  arb: false, freeCancellation: true,  instantBook: true,  bookUrl: "https://www.stay22.com" },
  { id: "d8",  name: "Bond Place Hotel",              type: "hotel",     lat: 43.6561, lng: -79.3789, price: 152, rating: 7.2, capacity: 2, supplier: "hotelscom", spreadPct: 3,  arb: false, freeCancellation: false, instantBook: false, bookUrl: "https://www.stay22.com" },
  { id: "d9",  name: "Harbourfront Loft",             type: "apartment", lat: 43.6389, lng: -79.3817, price: 176, rating: 8.4, capacity: 4, supplier: "vrbo",      spreadPct: 11, arb: false, freeCancellation: true,  instantBook: true,  bookUrl: "https://www.stay22.com" },
  { id: "d10", name: "Entertainment District Suite",  type: "apartment", lat: 43.6465, lng: -79.3925, price: 205, rating: 8.5, capacity: 6, supplier: "vrbo",      spreadPct: 16, arb: true,  freeCancellation: true,  instantBook: false, bookUrl: "https://www.stay22.com" },
  { id: "d11", name: "The Planet Traveler",           type: "hostel",    lat: 43.6559, lng: -79.4021, price: 59,  rating: 7.9, capacity: 1, supplier: "booking",   spreadPct: 2,  arb: false, freeCancellation: false, instantBook: true,  bookUrl: "https://www.stay22.com" },
  { id: "d12", name: "Ace Hotel Toronto",             type: "hotel",     lat: 43.6452, lng: -79.3953, price: 335, rating: 9.1, capacity: 2, supplier: "expedia",   spreadPct: 10, arb: false, freeCancellation: true,  instantBook: true,  bookUrl: "https://www.stay22.com" },
  { id: "d13", name: "St. Lawrence Market B&B",       type: "bnb",       lat: 43.6497, lng: -79.3716, price: 142, rating: 8.1, capacity: 3, supplier: "booking",   spreadPct: 5,  arb: false, freeCancellation: true,  instantBook: false, bookUrl: "https://www.stay22.com" },
  { id: "d14", name: "Kensington Market Guesthouse",  type: "bnb",       lat: 43.6544, lng: -79.4005, price: 118, rating: 7.6, capacity: 2, supplier: "vrbo",      spreadPct: 6,  arb: false, freeCancellation: false, instantBook: true,  bookUrl: "https://www.stay22.com" },
  { id: "d15", name: "The Omni King Edward",          type: "hotel",     lat: 43.6490, lng: -79.3762, price: 358, rating: 8.9, capacity: 4, supplier: "hotelscom", spreadPct: 12, arb: false, freeCancellation: true,  instantBook: true,  bookUrl: "https://www.stay22.com" },
  { id: "d16", name: "Yorkville Boutique Flat",       type: "apartment", lat: 43.6708, lng: -79.3899, price: 288, rating: 9.0, capacity: 4, supplier: "vrbo",      spreadPct: 9,  arb: false, freeCancellation: true,  instantBook: true,  bookUrl: "https://www.stay22.com" },
];

// Fallback photos for the offline demo dataset (real live pins carry their own
// Stay22 thumbnail). Seeded so each demo property keeps a stable image.
const DEMO_IMAGES = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=70",
  "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&q=70",
  "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=400&q=70",
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400&q=70",
  "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=400&q=70",
];
DEMO_PROPERTIES.forEach((p, idx) => {
  p.image = DEMO_IMAGES[idx % DEMO_IMAGES.length];
  p.images = [p.image];
});

function computeStats(props) {
  if (!props.length) {
    return { count: 0, minPrice: 0, maxPrice: 0, avgPrice: 0, arbCount: 0 };
  }
  const prices = props.map((p) => p.price);
  return {
    count: props.length,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / props.length),
    arbCount: props.filter((p) => p.arb).length,
  };
}

function buildDemoData(filters) {
  const all = DEMO_PROPERTIES;
  const min = filters.min === "" ? -Infinity : Number(filters.min);
  const max = filters.max === "" ? Infinity : Number(filters.max);
  const minRating = filters.minRating === "" ? 0 : Number(filters.minRating);
  const properties = all.filter(
    (p) =>
      (!filters.type || p.type === filters.type) &&
      p.price >= min &&
      p.price <= max &&
      p.rating >= minRating
  );
  const allPrices = all.map((p) => p.price);
  return {
    city: "Toronto, ON",
    center: { lat: 43.6532, lng: -79.3832 },
    asOf: new Date().toISOString(),
    mode: "demo",
    properties,
    stats: computeStats(properties),
    filters: {
      types: [...new Set(all.map((p) => p.type))],
      priceRange: { min: Math.min(...allPrices), max: Math.max(...allPrices) },
    },
  };
}

// Terciles by price within the current result set → pill border class.
function tercileOf(price, sortedPrices) {
  const n = sortedPrices.length;
  if (n < 3) return "mid";
  const t1 = sortedPrices[Math.floor(n / 3)];
  const t2 = sortedPrices[Math.floor((2 * n) / 3)];
  if (price < t1) return "low";
  if (price < t2) return "mid";
  return "high";
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function popupHtml(p) {
  const tags = [];
  if (p.freeCancellation) tags.push('<span class="mv-tag mv-tag-good">FREE CANCEL</span>');
  if (p.instantBook) tags.push('<span class="mv-tag">INSTANT BOOK</span>');
  if (p.arb) tags.push('<span class="mv-tag mv-tag-arb">ARB</span>');
  const imgs = Array.isArray(p.images) && p.images.length ? p.images : p.image ? [p.image] : [];
  const gallery = imgs.length
    ? `<div class="mv-gallery">${imgs
        .map((u) => `<img class="mv-gallery-img" src="${esc(u)}" loading="lazy" alt="" />`)
        .join("")}</div>`
    : "";
  return `
    <div class="mv-popup">
      ${gallery}
      <div class="mv-popup-name">${esc(p.name)}</div>
      <div class="mv-popup-meta">${esc(p.type).toUpperCase()} · ★ ${esc(p.rating)} · SLEEPS ${esc(p.capacity)}</div>
      <div class="mv-popup-supplier">best via <b>${esc(p.supplier)}</b> · ${esc(p.spreadPct)}% spread across suppliers</div>
      ${tags.length ? `<div class="mv-popup-tags">${tags.join("")}</div>` : ""}
      <a class="mv-popup-book" href="${esc(p.bookUrl)}" target="_blank" rel="noopener noreferrer">BOOK NOW · $${esc(p.price)}</a>
    </div>`;
}

export default function MapView() {
  const [filters, setFilters] = useState({
    city: "Toronto, ON",
    type: "",
    min: "",
    max: "",
    minRating: "",
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const lastFitCityRef = useRef(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // --- map lifecycle: init once, clean up on unmount --------------------
  useEffect(() => {
    const map = L.map(containerRef.current, {
      center: [43.6532, -79.3832],
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      maxZoom: 19,
    }).addTo(map);
    const markers = L.layerGroup().addTo(map);

    mapRef.current = map;
    markersRef.current = markers;

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      markers.clearLayers();
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // --- data fetch: debounced on filter change, poll every 60s ----------
  useEffect(() => {
    let cancelled = false;
    let controller = null;

    async function load(f) {
      controller?.abort();
      controller = new AbortController();
      const params = new URLSearchParams();
      params.set("city", f.city.trim());
      if (f.type) params.set("type", f.type);
      if (f.min !== "") params.set("min", f.min);
      if (f.max !== "") params.set("max", f.max);
      if (f.minRating !== "") params.set("minRating", f.minRating);

      try {
        const res = await fetch(`${API_BASE}/api/map?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        if (!Array.isArray(json.properties)) throw new Error("bad shape");
        setData(json);
        setOffline(false);
      } catch (err) {
        if (cancelled || err.name === "AbortError") return;
        setData(buildDemoData(f));
        setOffline(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const debounce = setTimeout(() => load(filters), DEBOUNCE_MS);
    const poll = setInterval(() => load(filtersRef.current), POLL_MS);
    return () => {
      cancelled = true;
      controller?.abort();
      clearTimeout(debounce);
      clearInterval(poll);
    };
  }, [filters]);

  // --- markers: rebuild layer group on data change ----------------------
  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers || !data) return;

    markers.clearLayers();
    const sortedPrices = data.properties.map((p) => p.price).sort((a, b) => a - b);
    const bounds = [];

    data.properties.forEach((p) => {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") return;
      const tercile = p.arb ? "arb" : tercileOf(p.price, sortedPrices);
      const icon = L.divIcon({
        className: "mv-pill-anchor",
        iconSize: null,
        html: `<div class="mv-pill mv-pill-${tercile}">$${Math.round(p.price)}${
          p.arb ? '<sup class="mv-pill-arb">ARB</sup>' : ""
        }</div>`,
      });
      const marker = L.marker([p.lat, p.lng], { icon });
      marker.bindPopup(popupHtml(p), {
        className: "mv-leaflet-popup",
        closeButton: true,
        maxWidth: 280,
      });
      markers.addLayer(marker);
      bounds.push([p.lat, p.lng]);
    });

    // Fit bounds only on first load / city change — keep pan/zoom on polls.
    const cityKey = data.city || filtersRef.current.city;
    if (bounds.length && lastFitCityRef.current !== cityKey) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [48, 48], maxZoom: 15 });
      lastFitCityRef.current = cityKey;
    } else if (!bounds.length && data.center && lastFitCityRef.current !== cityKey) {
      map.setView([data.center.lat, data.center.lng], 12);
      lastFitCityRef.current = cityKey;
    }
  }, [data]);

  // --- derived UI values -------------------------------------------------
  const types = data?.filters?.types ?? [];
  const priceRange = data?.filters?.priceRange ?? { min: 0, max: 1000 };
  const stats = data?.stats;
  const empty = !loading && data && data.properties.length === 0;

  const statsLine = useMemo(() => {
    if (!stats || !stats.count) return "no inventory";
    return `${stats.count} properties · $${stats.minPrice}–$${stats.maxPrice} · avg $${stats.avgPrice} · ${stats.arbCount} ARB`;
  }, [stats]);

  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch }));

  const onCityChange = (city) => setFilters((f) => ({ ...f, city }));

  return (
    <div className="mv-root">
      <div className="mv-filterbar">
        <div className="mv-field">
          <span className="mv-microlabel">CITY OR AREA</span>
          <input
            className="mv-select"
            type="text"
            list="mv-cities"
            placeholder="Search any city or area…"
            value={filters.city}
            onChange={(e) => onCityChange(e.target.value)}
          />
          <datalist id="mv-cities">
            {CITIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="mv-field mv-field-grow">
          <span className="mv-microlabel">TYPE</span>
          <div className="mv-chips">
            <button
              type="button"
              className={`mv-chip${filters.type === "" ? " mv-chip-on" : ""}`}
              onClick={() => setFilter({ type: "" })}
            >
              ALL
            </button>
            {types.map((t) => (
              <button
                key={t}
                type="button"
                className={`mv-chip${filters.type === t ? " mv-chip-on" : ""}`}
                onClick={() => setFilter({ type: filters.type === t ? "" : t })}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="mv-field">
          <span className="mv-microlabel">PRICE / NIGHT</span>
          <div className="mv-pricepair">
            <input
              className="mv-num"
              type="number"
              placeholder={String(priceRange.min ?? 0)}
              min={priceRange.min}
              max={priceRange.max}
              value={filters.min}
              onChange={(e) => setFilter({ min: e.target.value })}
            />
            <span className="mv-pricedash">–</span>
            <input
              className="mv-num"
              type="number"
              placeholder={String(priceRange.max ?? 999)}
              min={priceRange.min}
              max={priceRange.max}
              value={filters.max}
              onChange={(e) => setFilter({ max: e.target.value })}
            />
          </div>
        </div>

        <div className="mv-field">
          <span className="mv-microlabel">MIN RATING</span>
          <select
            className="mv-select"
            value={filters.minRating}
            onChange={(e) => setFilter({ minRating: e.target.value })}
          >
            {RATING_OPTIONS.map((r) => (
              <option key={r.label} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="mv-field mv-stats">
          <span className="mv-microlabel">MARKET</span>
          <span className="mv-statsline">{statsLine}</span>
        </div>
      </div>

      <div className="mv-legend">
        <span className="mv-legend-item"><i className="mv-swatch mv-swatch-low" />CHEAPEST ⅓</span>
        <span className="mv-legend-item"><i className="mv-swatch mv-swatch-mid" />MID ⅓</span>
        <span className="mv-legend-item"><i className="mv-swatch mv-swatch-high" />TOP ⅓</span>
        <span className="mv-legend-item"><i className="mv-swatch mv-swatch-arb" />ARB SPREAD</span>
      </div>

      {offline && (
        <div className="mv-banner">map feed offline — showing demo data</div>
      )}

      <div className="mv-maparea">
        <div ref={containerRef} className="mv-map" />
        {loading && !data && (
          <div className="mv-overlay">
            <div className="mv-skeleton">
              <span className="mv-skeleton-pulse" />
              <span className="mv-skeleton-label">loading market map…</span>
            </div>
          </div>
        )}
        {empty && (
          <div className="mv-overlay mv-overlay-empty">
            <div className="mv-empty">
              no inventory matches — widen the filters
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
