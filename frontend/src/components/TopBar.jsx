// Slim bar above the content region: current view title, buying-power chip
// (from /api/market once it has loaded), last-updated timestamp.

import AuthControls from "./AuthControls.jsx";
import { CURRENCIES, useCurrency } from "../currency.jsx";

const TITLES = {
  dashboard: "Dashboard",
  exchange: "Yonder Exchange",
  map: "Market Map",
  concierge: "Concierge",
  nowcast: "Economic Nowcast",
  match: "Suite Hearts",
};

export default function TopBar({ view, buyingPower, lastUpdated, theme, onToggleTheme }) {
  const { code, setCode, currency, format } = useCurrency();
  return (
    <div className="topbar">
      <h1 className="topbar-title">{TITLES[view] || "Yonder"}</h1>
      <div className="topbar-right">
        <label className="currency-picker" title="Display currency (static rates)">
          <span className="currency-picker__flag" aria-hidden="true">
            {currency.flag}
          </span>
          <select
            className="currency-picker__select"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="Display currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.code} — {c.name}
              </option>
            ))}
          </select>
        </label>
        <button className="theme-toggle" type="button" onClick={onToggleTheme}>
          {theme === "light" ? "🌙 Dark" : "☀ Bright"}
        </button>
        {Number.isFinite(buyingPower) && (
          <span className="power-chip" title="Funded by your cut spending">
            <span className="power-chip__label">Buying power</span>
            <span className="power-chip__amount">{format(buyingPower)}</span>
          </span>
        )}
        {lastUpdated && (
          <span className="topbar-updated">upd {lastUpdated.toLocaleTimeString()}</span>
        )}
        <AuthControls />
      </div>
    </div>
  );
}
