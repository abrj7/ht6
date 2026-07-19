import { useEffect, useState } from "react";
import { useCurrency } from "../currency.jsx";
import TickerTape from "./TickerTape.jsx";
import TickerCard from "./TickerCard.jsx";

// Yonder Exchange: Stay22 inventory rendered as a securities exchange.
// Destinations are tickers, the 4 suppliers are market makers quoting the
// same room, the user's cut spending is buying power, BUY = affiliate link.
//
// Presentational: App owns the /api/market poll (shared with the dashboard
// watchlist) and passes the normalized market down. `focusSymbol` lets the
// dashboard watchlist deep-link into a specific ticker's order book.

function SkeletonCard() {
  return (
    <div className="ticker-card ticker-card--skeleton" aria-hidden="true">
      <div className="skeleton skeleton--label" />
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--chart" />
    </div>
  );
}

export default function ExchangeView({ market, live, lastUpdated, focusSymbol }) {
  const { format } = useCurrency();
  const [expandedSymbol, setExpandedSymbol] = useState(focusSymbol || null);

  // Follow watchlist jumps that happen while this view is already mounted.
  useEffect(() => {
    if (focusSymbol) setExpandedSymbol(focusSymbol);
  }, [focusSymbol]);

  if (!market) {
    return (
      <div className="exchange" aria-busy="true">
        <div className="market-grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const { buyingPower, tickers, movers, tape } = market;
  const affordableCount = tickers.filter((t) => t.affordable).length;
  const feedLabel = !live ? "DEMO" : market.mode === "live" ? "LIVE FEED" : "MOCK FEED";

  return (
    <div className="exchange">
      <TickerTape tape={tape} />

      <div className="power-strip">
        <div>
          <div className="micro-label">Buying power</div>
          <div className="power-amount">
            {format(buyingPower)}
            <span className="power-note">funded by your cut spending</span>
          </div>
        </div>
        <div className="power-right">
          <span
            className={`feed-badge${live && market.mode === "live" ? " feed-badge--live" : ""}`}
          >
            {feedLabel}
          </span>
          <div className="power-reach">
            {affordableCount} of {tickers.length} tickers within reach
          </div>
        </div>
      </div>

      <div className="market-grid">
        {tickers.map((t) => (
          <TickerCard
            key={t.symbol}
            ticker={t}
            moverDir={
              movers && movers.up === t.symbol
                ? "up"
                : movers && movers.down === t.symbol
                ? "down"
                : null
            }
            buyingPower={buyingPower}
            expanded={expandedSymbol === t.symbol}
            onToggle={() =>
              setExpandedSymbol((cur) => (cur === t.symbol ? null : t.symbol))
            }
          />
        ))}
      </div>

      <div className="meta">
        <span>
          {live ? "Live from backend" : "Demo data (backend offline)"} · quotes refresh
          every 10 minutes · for travelers, down is up
        </span>
        {lastUpdated && <span>Last updated {lastUpdated.toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}
