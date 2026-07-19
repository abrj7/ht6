import Sparkline from "./Sparkline.jsx";
import { useCurrency } from "../currency.jsx";

// Horizontally scrollable row of compact portfolio cards, one per route.
// Clicking a card selects the route for the main chart panel.

function labelize(category) {
  return String(category).replaceAll("_", " ");
}

function DeltaChip({ delta }) {
  const { formatInt } = useCurrency();
  if (delta == null || !Number.isFinite(delta) || delta === 0) {
    return <span className="delta-chip delta-chip--flat">{"\u25AC"} flat</span>;
  }
  const dropped = delta < 0;
  return (
    <span className={`delta-chip ${dropped ? "delta-chip--down" : "delta-chip--up"}`}>
      {dropped ? "\u25BC" : "\u25B2"} {formatInt(Math.abs(delta))}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="portfolio-card portfolio-card--skeleton" aria-hidden="true">
      <div className="skeleton skeleton--label" />
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--chart" />
    </div>
  );
}

export default function PortfolioStrip({ routes, selectedCategory, onSelect }) {
  const { formatInt } = useCurrency();
  if (!routes) {
    return (
      <div className="portfolio-strip" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="portfolio-strip" role="tablist" aria-label="Routes">
      {routes.map((r) => {
        const selected = r.category === selectedCategory;
        return (
          <button
            key={r.category}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`portfolio-card${selected ? " portfolio-card--selected" : ""}`}
            onClick={() => onSelect(r.category)}
          >
            <span className="portfolio-card__category micro-label">{labelize(r.category)}</span>
            <span className="portfolio-card__destination">{r.destination}</span>
            <span className="portfolio-card__row">
              <span className="portfolio-card__price">
                {Number.isFinite(r.livePrice) ? formatInt(r.livePrice) : "\u2014"}
              </span>
              <DeltaChip delta={r.priceDelta} />
            </span>
            <Sparkline history={r.priceHistory} width={150} height={30} stretch />
          </button>
        );
      })}
    </div>
  );
}
