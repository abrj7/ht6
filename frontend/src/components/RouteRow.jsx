import { useEffect, useRef, useState } from "react";
import Sparkline from "./Sparkline.jsx";

function labelize(category) {
  return category.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}

function routeProgress(route) {
  if (Number.isFinite(route.progress)) return Math.min(Math.max(route.progress, 0), 1);
  if (Number.isFinite(route.recoverableSpend) && Number.isFinite(route.livePrice) && route.livePrice > 0) {
    return Math.min(route.recoverableSpend / route.livePrice, 1);
  }
  return 0;
}

function Flap({ value, tick }) {
  return <span className={`flap${tick ? " flap--tick" : ""}`}>{value}</span>;
}

function DeltaChip({ delta }) {
  if (delta == null || !Number.isFinite(delta) || delta === 0) return null;
  const dropped = delta < 0;
  return (
    <span
      className={`delta-chip ${dropped ? "delta-chip--down" : "delta-chip--up"}`}
      title={dropped ? "Price dropped since yesterday - you're closer to the goal" : "Price rose since yesterday"}
    >
      {dropped ? "\u25BC" : "\u25B2"} ${Math.round(Math.abs(delta))}
    </span>
  );
}

function StatusPill({ progress }) {
  const boarding = progress >= 0.5;
  return (
    <span className={`status ${boarding ? "status--boarding" : "status--waiting"}`}>
      {boarding ? "boarding" : "waiting"}
    </span>
  );
}

function PropertyTags({ property }) {
  if (!property) return null;
  return (
    <div className="detail-tags">
      {property.type && <span className="tag tag--type">{property.type}</span>}
      {Number.isFinite(property.rating) && (
        <span className="tag">{"\u2605"} {property.rating.toFixed(1)}</span>
      )}
      {Number.isFinite(property.capacity) && (
        <span className="tag">sleeps {property.capacity}</span>
      )}
      {property.freeCancellation && <span className="tag tag--good">free cancellation</span>}
      {property.instantBook && <span className="tag tag--good">instant book</span>}
    </div>
  );
}

function GreenLine({ green }) {
  if (!green) return null;
  const bits = [];
  if (Number.isFinite(green.distanceKm)) bits.push(`~${Math.round(green.distanceKm)} km from Toronto`);
  if (Number.isFinite(green.carbonKgCO2e)) bits.push(`~${Math.round(green.carbonKgCO2e)} kg CO2e`);
  const alt = green.greenerAlternative;
  return (
    <div className="detail-green">
      {bits.length > 0 && <span>{bits.join(" \u00B7 ")}</span>}
      {alt && (
        <span className="detail-green__alt">
          Greener: {alt.destination} saves ~{Math.round(alt.savingsKg)} kg
        </span>
      )}
    </div>
  );
}

export default function RouteRow({ route, expanded, onToggle }) {
  const progress = routeProgress(route);
  const pct = Math.round(progress * 100);
  const panelId = `route-detail-${route.category}`;

  // Flip the flap briefly when livePrice changes between polls.
  const prevPrice = useRef(route.livePrice);
  const [tick, setTick] = useState(false);
  useEffect(() => {
    const changed = prevPrice.current != null && prevPrice.current !== route.livePrice;
    prevPrice.current = route.livePrice;
    if (changed) {
      setTick(true);
      const t = setTimeout(() => setTick(false), 320);
      return () => clearTimeout(t);
    }
  }, [route.livePrice]);

  return (
    <div className={`route-card${expanded ? " route-card--open" : ""}`}>
      <button
        type="button"
        className="route-row"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <div className="route-category">{labelize(route.category)}</div>
        <div className="route-destination">{route.destination.toUpperCase()}</div>
        <Sparkline history={route.priceHistory} />
        <div className="route-price">
          <Flap
          value={route.livePrice != null ? `$${Math.round(route.livePrice)}` : "\u2014"}
          tick={tick}
        />
          <DeltaChip delta={route.priceDelta} />
        </div>
        <StatusPill progress={progress} />
      </button>

      <div className="route-progress">
        <div className="route-progress__track">
          <div className="route-progress__fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="route-progress__label">{pct}%</span>
      </div>

      {expanded && (
        <div className="route-detail" id={panelId}>
          <div className="detail-main">
            {route.property && (
              <div className="detail-property">
                <div className="detail-property__name">{route.property.name}</div>
                <PropertyTags property={route.property} />
              </div>
            )}
            <GreenLine green={route.green} />
            {Number.isFinite(route.recoverableSpend) && Number.isFinite(route.monthlyTotal) && (
              <div className="detail-spend">
                ${Math.round(route.recoverableSpend)}/mo recoverable of $
                {Math.round(route.monthlyTotal)}/mo spend
              </div>
            )}
          </div>
          {route.bookUrl && (
            <a
              className="book-now"
              href={route.bookUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Book now {"\u2192"}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
