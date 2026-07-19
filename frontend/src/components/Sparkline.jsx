// Tiny inline SVG price-trend chart. Teal when the latest price is at or
// below the first point (price moving toward the user), amber otherwise.
export default function Sparkline({ history, width = 110, height = 28 }) {
  if (!Array.isArray(history) || history.length < 2) return null;

  const prices = history
    .map((p) => Number(p && p.price))
    .filter((n) => Number.isFinite(n));
  if (prices.length < 2) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const pad = 3;

  const points = prices.map((price, i) => [
    pad + (i / (prices.length - 1)) * (width - pad * 2),
    pad + (1 - (price - min) / span) * (height - pad * 2),
  ]);

  const d = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

  const improving = prices[prices.length - 1] <= prices[0];
  const stroke = improving ? "var(--route-teal)" : "var(--flap-amber)";
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Price trend, ${improving ? "falling" : "rising"}`}
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2.2" fill={stroke} />
    </svg>
  );
}
