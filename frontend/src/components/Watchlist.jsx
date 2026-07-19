import Sparkline from "./Sparkline.jsx";
import { useCurrency } from "../currency.jsx";

// Right-column watchlist: one row per exchange ticker. Clicking a row jumps
// to the Exchange view.

function ChangeChip({ changePct }) {
  if (!Number.isFinite(changePct)) return null;
  const dropped = changePct < 0;
  const flat = changePct === 0;
  return (
    <span
      className={`change-chip${flat ? "" : dropped ? " change-chip--down" : " change-chip--up"}`}
    >
      {flat ? "\u25AC" : dropped ? "\u25BC" : "\u25B2"} {Math.abs(changePct).toFixed(1)}%
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="watch-row watch-row--skeleton" aria-hidden="true">
      <div className="skeleton skeleton--label" />
      <div className="skeleton skeleton--chart" />
    </div>
  );
}

export default function Watchlist({ tickers, onOpenExchange }) {
  const { format } = useCurrency();
  return (
    <section className="panel watch-panel" aria-label="Watchlist">
      <div className="panel-head">
        <span className="micro-label">Watchlist</span>
        <span className="micro-label">/api/market</span>
      </div>
      {!tickers ? (
        <div aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : (
        tickers.map((t) => {
          const history = Array.isArray(t.history) ? t.history : [];
          const prices = history.map((p) => Number(p && p.price)).filter(Number.isFinite);
          const priceDown =
            prices.length >= 2
              ? prices[prices.length - 1] <= prices[0]
              : (t.changePct ?? 0) <= 0;
          return (
            <button
              key={t.symbol}
              type="button"
              className="watch-row"
              onClick={() => onOpenExchange(t.symbol)}
              title={`${t.destination} \u2014 open in Exchange`}
            >
              <span className="watch-row__symbol">{t.symbol}</span>
              <span className="watch-row__spark">
                {history.length >= 2 && (
                  <Sparkline
                    history={history}
                    width={70}
                    height={22}
                    stroke={priceDown ? "var(--route-teal)" : "var(--stamp-red)"}
                    stretch
                  />
                )}
              </span>
              <span className="watch-row__last">
                {Number.isFinite(t.last) ? format(t.last) : "\u2014"}
              </span>
              <span className="watch-row__meta">
                <ChangeChip changePct={t.changePct} />
                {t.arb && <span className="arb-badge arb-badge--mini">ARB</span>}
              </span>
            </button>
          );
        })
      )}
    </section>
  );
}
