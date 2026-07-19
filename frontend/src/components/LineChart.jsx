// Big SVG line chart for the dashboard's main panel. Same visual DNA as
// Sparkline (single line + end dot) but with a soft area fill, min/max price
// gridlines and first/last time labels.

const VB_W = 720;
const VB_H = 240;
const PAD = { top: 16, right: 12, bottom: 26, left: 46 };

function timeLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function LineChart({ history, id = "chart" }) {
  const points = (Array.isArray(history) ? history : [])
    .map((p) => ({ t: p && p.t, price: Number(p && p.price) }))
    .filter((p) => Number.isFinite(p.price));

  if (points.length < 2) {
    return <div className="linechart-empty micro-label">waiting for price history…</div>;
  }

  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;

  const plotW = VB_W - PAD.left - PAD.right;
  const plotH = VB_H - PAD.top - PAD.bottom;

  const xy = points.map((p, i) => [
    PAD.left + (i / (points.length - 1)) * plotW,
    PAD.top + (1 - (p.price - min) / span) * plotH,
  ]);

  const line = xy
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${(PAD.left + plotW).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} L${PAD.left} ${(PAD.top + plotH).toFixed(1)} Z`;

  const improving = prices[prices.length - 1] <= prices[0];
  const stroke = improving ? "var(--route-teal)" : "var(--flap-amber)";
  const [lastX, lastY] = xy[xy.length - 1];
  const gradId = `lc-fill-${id}`;

  const yMax = PAD.top + (1 - (max - min) / span) * plotH;
  const yMin = PAD.top + plotH;

  return (
    <svg
      className="linechart"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={`Price history, ${improving ? "falling" : "rising"}, from $${points[0].price} to $${points[points.length - 1].price}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* min/max gridlines + price labels */}
      {[
        { y: yMax, label: `$${Math.round(max)}` },
        { y: yMin, label: `$${Math.round(min)}` },
      ].map(({ y, label }) => (
        <g key={label}>
          <line
            x1={PAD.left}
            x2={PAD.left + plotW}
            y1={y}
            y2={y}
            stroke="var(--panel-line)"
            strokeWidth="1"
            strokeDasharray="3 5"
            vectorEffect="non-scaling-stroke"
          />
          <text x={PAD.left - 8} y={y + 3.5} textAnchor="end" className="linechart-tick">
            {label}
          </text>
        </g>
      ))}

      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="3.5" fill={stroke} />

      {/* first/last time labels */}
      <text x={PAD.left} y={VB_H - 8} textAnchor="start" className="linechart-tick">
        {timeLabel(points[0].t)}
      </text>
      <text x={PAD.left + plotW} y={VB_H - 8} textAnchor="end" className="linechart-tick">
        {timeLabel(points[points.length - 1].t)}
      </text>
    </svg>
  );
}
