// Expanded panel of a ticker card: mini supplier depth table + property line
// + the BUY CTA. The four Stay22 suppliers act as market makers quoting the
// same room; best (lowest) quote is the teal "BEST" row, worst is dimmed with
// the spread annotation.

const money = (n) => `$${Number(n).toFixed(2)}`;

// The live payload sends raw supplier keys (e.g. "hotelscom").
const SUPPLIER_LABELS = {
  booking: "Booking.com",
  vrbo: "Vrbo",
  expedia: "Expedia",
  hotelscom: "Hotels.com",
};

const supplierLabel = (s) => SUPPLIER_LABELS[String(s).toLowerCase()] || s;

export default function OrderBook({ ticker, buyingPower, panelId }) {
  const book = Array.isArray(ticker.book) ? ticker.book : [];
  const prices = book.map((r) => Number(r.price)).filter(Number.isFinite);
  const maxPrice = prices.length ? Math.max(...prices) : 1;
  const bestPrice = prices.length ? Math.min(...prices) : null;

  const shortBy =
    Number.isFinite(ticker.last) && Number.isFinite(buyingPower)
      ? ticker.last - buyingPower
      : null;

  return (
    <div className="order-book" id={panelId}>
      <div className="micro-label">Order book · same room, 4 market makers</div>
      <table className="book-table">
        <tbody>
          {book.map((row, i) => {
            const price = Number(row.price);
            const isBest = i === 0;
            const isWorst = i === book.length - 1 && book.length > 1;
            const width = Number.isFinite(price)
              ? Math.max(8, (price / maxPrice) * 100)
              : 0;
            return (
              <tr
                key={row.supplier || i}
                className={`book-row${isBest ? " book-row--best" : ""}${
                  isWorst ? " book-row--worst" : ""
                }`}
              >
                <td className="book-supplier">
                  {supplierLabel(row.supplier)}
                  {isBest && <span className="book-best-tag">BEST</span>}
                </td>
                <td className="book-price">{Number.isFinite(price) ? money(price) : "\u2014"}</td>
                <td className="book-bar-cell">
                  <div className="book-bar" style={{ width: `${width}%` }} />
                </td>
                <td className="book-note">
                  {isWorst && Number.isFinite(price) && Number.isFinite(bestPrice)
                    ? `+$${Math.round(price - bestPrice)} vs best`
                    : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="order-foot">
        <div className="order-property">
          {ticker.property && (
            <>
              <div className="order-property__name">{ticker.property.name}</div>
              <div className="order-property__meta">
                {[
                  ticker.property.type,
                  Number.isFinite(ticker.property.rating)
                    ? `\u2605 ${Number(ticker.property.rating).toFixed(1)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" \u00B7 ")}
              </div>
            </>
          )}
          {ticker.affordable ? (
            <span className="tag tag--good order-fund-tag">FUNDED</span>
          ) : (
            shortBy != null &&
            shortBy > 0 && (
              <span className="tag order-fund-tag">NEED ${Math.round(shortBy)} MORE</span>
            )
          )}
        </div>
        {ticker.buyUrl && (
          <a
            className="buy-cta"
            href={ticker.buyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            BUY @ {Number.isFinite(ticker.last) ? money(ticker.last) : "\u2014"} · 2 NIGHTS
          </a>
        )}
      </div>
    </div>
  );
}
