import Sparkline from "./Sparkline.jsx";
import OrderBook from "./OrderBook.jsx";
import { useCurrency } from "../currency.jsx";

// One destination = one ticker. In the exchange framing, a price DROP is a
// win for the traveler, so negative changePct renders teal and positive
// renders red ("for travelers, down is up").

function ChangeChip({ changeAbs, changePct }) {
  const { format } = useCurrency();
  if (!Number.isFinite(changePct)) return null;
  const dropped = changePct < 0;
  const flat = changePct === 0;
  return (
    <span
      className={`change-chip${
        flat ? "" : dropped ? " change-chip--down" : " change-chip--up"
      }`}
      title="For travelers, down is up - a falling price means the trip got cheaper"
    >
      {flat ? "\u25AC" : dropped ? "\u25BC" : "\u25B2"}{" "}
      {Number.isFinite(changeAbs) ? `${format(Math.abs(changeAbs))} ` : ""}(
      {Math.abs(changePct).toFixed(1)}%)
    </span>
  );
}

export default function TickerCard({ ticker, moverDir, buyingPower, expanded, onToggle }) {
  const { format: money } = useCurrency();
  const panelId = `book-${ticker.symbol}`;
  const history = Array.isArray(ticker.history) ? ticker.history : [];
  const prices = history.map((p) => Number(p && p.price)).filter(Number.isFinite);
  const priceDown =
    prices.length >= 2 ? prices[prices.length - 1] <= prices[0] : (ticker.changePct ?? 0) <= 0;
  const chartStroke = priceDown ? "var(--route-teal)" : "var(--stamp-red)";

  const spreadPct =
    ticker.spread && Number.isFinite(ticker.spread.spreadPct)
      ? ticker.spread.spreadPct
      : null;

  return (
    <div className={`ticker-card${expanded ? " ticker-card--open" : ""}`}>
      <button
        type="button"
        className="ticker-head"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <div className="ticker-top">
          <div className="ticker-id">
            <span className="ticker-symbol">{ticker.symbol}</span>
            <span className="ticker-destination">{ticker.destination}</span>
          </div>
          <div className="ticker-badges">
            {moverDir && (
              <span className="mover-tag">
                {moverDir === "up" ? "\u25B2" : "\u25BC"} TOP MOVER
              </span>
            )}
            {ticker.arb && spreadPct != null && (
              <span className="arb-badge">ARB {spreadPct.toFixed(1)}%</span>
            )}
          </div>
        </div>

        <div className="ticker-quote">
          <span className="ticker-last">
            {Number.isFinite(ticker.last) ? money(ticker.last) : "\u2014"}
          </span>
          <ChangeChip changeAbs={ticker.changeAbs} changePct={ticker.changePct} />
        </div>

        {history.length >= 2 && (
          <div className="ticker-chart">
            <Sparkline history={history} width={300} height={40} stroke={chartStroke} stretch />
          </div>
        )}

        <div className="ticker-range">
          <span className="micro-label">Day range</span>
          <span className="ticker-range__values">
            {ticker.dayRange && Number.isFinite(ticker.dayRange.low)
              ? money(ticker.dayRange.low)
              : "\u2014"}
            {" to "}
            {ticker.dayRange && Number.isFinite(ticker.dayRange.high)
              ? money(ticker.dayRange.high)
              : "\u2014"}
          </span>
        </div>
      </button>

      {expanded && (
        <OrderBook ticker={ticker} buyingPower={buyingPower} panelId={panelId} />
      )}
    </div>
  );
}
