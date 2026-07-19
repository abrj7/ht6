import { useState } from "react";
import PortfolioStrip from "./PortfolioStrip.jsx";
import LineChart from "./LineChart.jsx";
import SpendInputForm from "./SpendInputForm.jsx";
import Watchlist from "./Watchlist.jsx";
import RouteRow from "./RouteRow.jsx";

// GoStock-style dashboard: portfolio strip on top, big chart panel + the
// split-flap departure board on the left, watchlist / coach / green route on
// the right. Data comes from App (which owns both polls).

function labelize(category) {
  return String(category).replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}

function routeProgress(route) {
  if (Number.isFinite(route.progress)) return Math.min(Math.max(route.progress, 0), 1);
  if (
    Number.isFinite(route.recoverableSpend) &&
    Number.isFinite(route.livePrice) &&
    route.livePrice > 0
  ) {
    return Math.min(route.recoverableSpend / route.livePrice, 1);
  }
  return 0;
}

function ChartPanel({ route }) {
  if (!route) {
    return (
      <section className="panel chart-panel" aria-busy="true">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--bigchart" />
      </section>
    );
  }

  const progress = routeProgress(route);
  const pct = Math.round(progress * 100);
  const delta = route.priceDelta;
  const dropped = Number.isFinite(delta) && delta < 0;

  return (
    <section className="panel chart-panel" aria-label={`${route.destination} price chart`}>
      <div className="chart-head">
        <div className="chart-head__id">
          <span className="micro-label">{labelize(route.category)}</span>
          <h2 className="chart-head__destination">{route.destination}</h2>
          {route.property && <span className="chart-head__property">{route.property.name}</span>}
        </div>
        <div className="chart-head__quote">
          <span className="chart-head__price flap">
            {Number.isFinite(route.livePrice) ? `$${Math.round(route.livePrice)}` : "\u2014"}
          </span>
          {Number.isFinite(delta) && delta !== 0 && (
            <span className={`delta-chip ${dropped ? "delta-chip--down" : "delta-chip--up"}`}>
              {dropped ? "\u25BC" : "\u25B2"} ${Math.round(Math.abs(delta))} vs yesterday
            </span>
          )}
        </div>
      </div>

      <LineChart history={route.priceHistory} id={route.category} />

      <div className="chart-foot">
        <div className="chart-goal">
          <div className="chart-goal__top">
            <span className="micro-label">Progress to goal</span>
            <span className="chart-goal__pct">{pct}%</span>
          </div>
          <div className="route-progress__track">
            <div className="route-progress__fill" style={{ width: `${pct}%` }} />
          </div>
          {Number.isFinite(route.recoverableSpend) && (
            <span className="chart-goal__note">
              ${Math.round(route.recoverableSpend)}/mo recoverable vs $
              {Number.isFinite(route.livePrice) ? Math.round(route.livePrice) : "\u2014"} live price
            </span>
          )}
        </div>
        {route.bookUrl && (
          <a className="book-now" href={route.bookUrl} target="_blank" rel="noopener noreferrer">
            Book now {"\u2192"}
          </a>
        )}
      </div>
    </section>
  );
}

function GreenCard({ route }) {
  const green = route && route.green;
  if (!green) return null;
  const alt = green.greenerAlternative;
  return (
    <section className="panel green-card" aria-label="Green route">
      <div className="panel-head">
        <span className="micro-label micro-label--teal">Green route</span>
        <span className="micro-label">{route.destination}</span>
      </div>
      <div className="green-card__stats">
        {Number.isFinite(green.distanceKm) && (
          <div className="green-stat">
            <span className="green-stat__value">~{Math.round(green.distanceKm)} km</span>
            <span className="micro-label">from Toronto</span>
          </div>
        )}
        {Number.isFinite(green.carbonKgCO2e) && (
          <div className="green-stat">
            <span className="green-stat__value">~{Math.round(green.carbonKgCO2e)} kg</span>
            <span className="micro-label">CO2e round trip</span>
          </div>
        )}
      </div>
      {alt && (
        <div className="green-card__alt">
          Greener: <strong>{alt.destination}</strong> saves ~{Math.round(alt.savingsKg)} kg CO2e
        </div>
      )}
    </section>
  );
}

export default function DashboardView({ routes, coachMessage, tickers, onOpenExchange, onSpendUpdated }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);

  const selectedRoute = routes
    ? routes.find((r) => r.category === selectedCategory) || routes[0]
    : null;

  return (
    <div className="dashboard">
      <PortfolioStrip
        routes={routes}
        selectedCategory={selectedRoute ? selectedRoute.category : null}
        onSelect={setSelectedCategory}
      />

      <div className="dashboard-main">
        <div className="dashboard-left">
          <ChartPanel route={selectedRoute} />

          <section className="board" aria-label="Departure board">
            <div className="board-labels">
              <span>Category</span>
              <span>Destination</span>
              <span>Trend</span>
              <span>Live price</span>
              <span>Status</span>
            </div>
            {routes ? (
              routes.map((r) => (
                <RouteRow
                  key={r.category}
                  route={r}
                  expanded={expandedCategory === r.category}
                  onToggle={() =>
                    setExpandedCategory((cur) => (cur === r.category ? null : r.category))
                  }
                />
              ))
            ) : (
              <div aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="route-card route-card--skeleton">
                    <div className="skeleton skeleton--title" />
                    <div className="skeleton skeleton--label" />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="dashboard-right">
          <Watchlist tickers={tickers} onOpenExchange={onOpenExchange} />

          <SpendInputForm onSpendUpdated={onSpendUpdated} />

          <section className="coach-card" aria-label="Coach">
            <div className="coach-label">Coach</div>
            <div className="coach-message">{coachMessage}</div>
          </section>

          <GreenCard route={selectedRoute} />
        </div>
      </div>
    </div>
  );
}
