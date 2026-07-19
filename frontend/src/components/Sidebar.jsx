// Fixed left navigation rail. Collapses to an icon-only rail under 900px
// (labels hidden via CSS - markup stays identical).

const ICONS = {
  dashboard: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="1.5" width="5.5" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="7.5" width="5.5" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="10.5" width="5.5" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  exchange: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M1.5 11.5l3.6-4 2.8 2.4 4-5.4 2.6 2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11 4.5h3.5V8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  map: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M8 14.5s4.75-4.3 4.75-8A4.75 4.75 0 0 0 3.25 6.5c0 3.7 4.75 8 4.75 8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="6.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "exchange", label: "Exchange" },
  { id: "map", label: "Map" },
];

export default function Sidebar({ view, onNavigate, feedLabel, feedIsLive }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand">
          yon<span>der</span>
        </div>
        <div className="tagline">where your spending is actually going</div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item${view === item.id ? " nav-item--active" : ""}`}
            aria-current={view === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-item__icon">{ICONS[item.id]}</span>
            <span className="nav-item__label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <span className={`feed-badge${feedIsLive ? " feed-badge--live" : ""}`}>{feedLabel}</span>
        <span className="sidebar-foot__note">prices on a 10-min cache</span>
      </div>
    </aside>
  );
}
