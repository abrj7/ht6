// Slim bar above the content region: current view title, buying-power chip
// (from /api/market once it has loaded), last-updated timestamp.

const TITLES = {
  dashboard: "Dashboard",
  exchange: "Yonder Exchange",
  map: "Market Map",
};

export default function TopBar({ view, buyingPower, lastUpdated }) {
  return (
    <div className="topbar">
      <h1 className="topbar-title">{TITLES[view] || "Yonder"}</h1>
      <div className="topbar-right">
        {Number.isFinite(buyingPower) && (
          <span className="power-chip" title="Funded by your cut spending">
            <span className="power-chip__label">Buying power</span>
            <span className="power-chip__amount">${buyingPower.toFixed(2)}</span>
          </span>
        )}
        {lastUpdated && (
          <span className="topbar-updated">upd {lastUpdated.toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}
