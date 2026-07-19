import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Sidebar from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import DashboardView from "./components/DashboardView.jsx";
import ExchangeView from "./components/ExchangeView.jsx";
import MapView from "./components/MapView.jsx";
import ConciergeView from "./components/ConciergeView.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import NowcastView from "./components/NowcastView.jsx";
import MatchView from "./components/MatchView.jsx";
import { useOpportunity, useMarket } from "./feeds.js";
import { loadGoals, saveGoals } from "./tripConfig.js";

// Person A owns this file and everything in /frontend except
// components/MapView.jsx and components/map.css (map agent's).
// Consumes the backend contracts in docs/PRD.md section 12 - do not call
// Stay22, FreeSolo, or Chexy directly from here.

export default function App() {
  const [view, setView] = useState("dashboard"); // "dashboard" | "exchange" | "map"
  const [focusSymbol, setFocusSymbol] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("yonder-theme") || "light";
  });
  // Whose data drives the board: the logged-in user's Auth0 sub, or the shared
  // "demo" sandbox when signed out. Changing this reloads that profile's goals.
  const { user, isAuthenticated } = useAuth0();
  const userId = isAuthenticated && user?.sub ? user.sub : "demo";

  // User-defined saving goals, scoped per profile. Reload when the user changes
  // (login/logout) so profiles never see each other's goals.
  const [goals, setGoals] = useState(() => loadGoals(userId));
  useEffect(() => {
    setGoals(loadGoals(userId));
  }, [userId]);

  // The hooks only poll while their `active` flag is true and keep the last
  // payload across view switches, so nothing refetches on navigation alone.
  const opportunity = useOpportunity(view === "dashboard", refreshKey, goals, userId);
  const marketFeed = useMarket(view === "dashboard" || view === "exchange", refreshKey);

  const { routes, coachMessage, live: oppLive, feedMode } = opportunity;
  const { market, live: marketLive } = marketFeed;

  const anyLive = oppLive || marketLive;
  const feedIsLive =
    (oppLive && feedMode === "live") || (marketLive && market && market.mode === "live");
  const feedLabel = !anyLive ? "DEMO" : feedIsLive ? "LIVE FEED" : "MOCK FEED";

  const lastUpdated =
    [opportunity.lastUpdated, marketFeed.lastUpdated]
      .filter(Boolean)
      .sort((a, b) => b - a)[0] || null;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("yonder-theme", theme);
  }, [theme]);

  const openExchangeAt = (symbol) => {
    setFocusSymbol(symbol);
    setView("exchange");
  };

  const handleSpendUpdated = () => {
    setRefreshKey((current) => current + 1);
  };

  const handleGoalsChange = (next) => {
    setGoals(next);
    saveGoals(userId, next);
    setRefreshKey((current) => current + 1);
  };

  const toggleTheme = () => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  };

  return (
    <div className="shell">
      <Sidebar
        view={view}
        onNavigate={(v) => {
          if (v !== "exchange") setFocusSymbol(null);
          setView(v);
        }}
        feedLabel={feedLabel}
        feedIsLive={feedIsLive}
      />

      <div className="main">
        <TopBar
          view={view}
          buyingPower={market ? market.buyingPower : null}
          lastUpdated={lastUpdated}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <main className="content">
          {view === "dashboard" && (
            <DashboardView
              routes={routes}
              coachMessage={coachMessage}
              tickers={market ? market.tickers : null}
              onOpenExchange={openExchangeAt}
              onSpendUpdated={handleSpendUpdated}
              goals={goals}
              onGoalsChange={handleGoalsChange}
            />
          )}

          {view === "exchange" && (
            <ExchangeView
              market={market}
              live={marketLive}
              lastUpdated={marketFeed.lastUpdated}
              focusSymbol={focusSymbol}
            />
          )}

          {view === "map" && (
            <div className="map-region">
              <div className="panel-head map-region__head">
                <span className="micro-label">Market map</span>
                <span className="micro-label">live Stay22 inventory</span>
              </div>
              <div className="map-region__body">
                <MapView />
              </div>
            </div>
          )}

          {view === "concierge" && (
            <ErrorBoundary label="Concierge hit an error">
              <ConciergeView />
            </ErrorBoundary>
          )}
          {view === "nowcast" && <NowcastView />}
          {view === "match" && <MatchView />}
        </main>
      </div>
    </div>
  );
}
