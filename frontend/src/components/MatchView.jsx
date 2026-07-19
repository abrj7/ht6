import { useCallback, useEffect, useRef, useState } from "react";
import "./match.css";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

const VIBE_OPTIONS = [
  { id: "adventure", label: "Adventure" },
  { id: "luxury", label: "Luxury" },
  { id: "cozy", label: "Cozy" },
  { id: "party", label: "Party" },
  { id: "budget", label: "Budget" },
  { id: "nature", label: "Nature" },
  { id: "romantic", label: "Romantic" },
  { id: "social", label: "Social" },
];

const CITIES = [
  "Banff, AB",
  "Montreal, QC",
  "Tofino, BC",
  "Prince Edward County, ON",
  "Blue Mountain, ON",
  "Niagara-on-the-Lake, ON",
];

const MONOGRAM_COLORS = [
  "#2f8a86",
  "#b07417",
  "#5a7a9a",
  "#8b5a7a",
  "#6b8f71",
  "#9a6b4a",
];

function monogramColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * 17) % MONOGRAM_COLORS.length;
  return MONOGRAM_COLORS[h];
}

function initials(name = "?") {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function MatchView() {
  const [phase, setPhase] = useState("quiz");
  const [selectedVibes, setSelectedVibes] = useState(["adventure", "nature"]);
  const [city, setCity] = useState("Banff, AB");
  const [deck, setDeck] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);

  const [match, setMatch] = useState(null);
  const [showMatchOverlay, setShowMatchOverlay] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  const dragRef = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0 });
  const [drag, setDrag] = useState({ dx: 0, dy: 0, rot: 0 });

  const current = deck[index] ?? null;
  const next = deck[index + 1] ?? null;

  const toggleVibe = (id) => {
    setSelectedVibes((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((v) => v !== id) : prev) : [...prev, id]
    );
  };

  const loadDeck = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIndex(0);
    setMatch(null);
    setShowMatchOverlay(false);
    setMessages([]);
    try {
      const vibes = selectedVibes.join(",");
      const cityParam = encodeURIComponent(city.split(",")[0]);
      const res = await fetch(`${API_BASE}/api/match/deck?city=${cityParam}&vibes=${vibes}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `deck ${res.status}`);
      }
      const data = await res.json();
      setDeck(data.cards || []);
      setMeta(data);
      setPhase("deck");
    } catch (e) {
      setError(e.message || "Failed to load deck");
    } finally {
      setLoading(false);
    }
  }, [selectedVibes, city]);

  const openMatch = useCallback((card) => {
    setMatch(card);
    setShowMatchOverlay(true);
    setMessages([
      { role: "assistant", content: card.persona?.openingLine || `Hey — it's ${card.persona?.displayName}.` },
    ]);
  }, []);

  const swipe = useCallback(
    (direction) => {
      if (!current) return;
      if (direction === "right") openMatch(current);
      setDrag({ dx: 0, dy: 0, rot: 0 });
      setIndex((i) => i + 1);
    },
    [current, openMatch]
  );

  const onPointerDown = (e) => {
    if (!current) return;
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    dragRef.current.dx = dx;
    dragRef.current.dy = dy;
    setDrag({ dx, dy, rot: dx * 0.08 });
  };

  const onPointerUp = () => {
    if (!dragRef.current.active) return;
    const { dx } = dragRef.current;
    dragRef.current.active = false;
    if (dx > 100) swipe("right");
    else if (dx < -100) swipe("left");
    else setDrag({ dx: 0, dy: 0, rot: 0 });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (phase !== "deck" || !current) return;
      if (e.key === "ArrowRight") swipe("right");
      if (e.key === "ArrowLeft") swipe("left");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, current, swipe]);

  const sendChat = async (e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !match || chatBusy) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setChatInput("");
    setChatBusy(true);

    try {
      const res = await fetch(`${API_BASE}/api/match/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: match.persona,
          messages: nextMessages,
          bookUrl: match.bookUrl,
        }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply || "…" }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Connection hiccup — try again?" }]);
    } finally {
      setChatBusy(false);
    }
  };

  const stampOpacity = Math.min(1, Math.abs(drag.dx) / 120);
  const likeOpacity = drag.dx > 30 ? stampOpacity : 0;
  const nopeOpacity = drag.dx < -30 ? stampOpacity : 0;

  const renderCard = (card, { isTop = false, isBehind = false } = {}) => {
    if (!card) return null;
    const p = card.persona || {};
    const style = isTop
      ? { transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.rot}deg)` }
      : undefined;

    return (
      <div
        key={card.id}
        className={`match-card${isBehind ? " is-behind" : ""}`}
        style={style}
        onPointerDown={isTop ? onPointerDown : undefined}
        onPointerMove={isTop ? onPointerMove : undefined}
        onPointerUp={isTop ? onPointerUp : undefined}
        onPointerCancel={isTop ? onPointerUp : undefined}
      >
        <div className="match-card-photo">
          <div
            className="match-monogram"
            style={{ background: monogramColor(p.fullName || p.displayName) }}
            aria-hidden
          >
            {initials(p.fullName || p.displayName)}
          </div>
          <span className="match-compat">{card.compatibility}% match</span>
          {isTop && (
            <>
              <span className="match-stamp match-stamp-like" style={{ opacity: likeOpacity }}>
                BOOK
              </span>
              <span className="match-stamp match-stamp-nope" style={{ opacity: nopeOpacity }}>
                PASS
              </span>
            </>
          )}
        </div>
        <div className="match-card-body">
          <div className="match-card-name">
            {p.displayName}, {card.property?.price != null ? `$${card.property.price}` : "—"}
          </div>
          <div className="match-card-archetype">{p.archetype}</div>
          <p className="match-card-bio">{p.bio}</p>
          <div className="match-card-tags">
            {(p.vibes || []).slice(0, 4).map((v) => (
              <span key={v} className="match-tag">
                {v}
              </span>
            ))}
            {(p.greenFlags || []).slice(0, 1).map((g) => (
              <span key={g} className="match-tag match-tag-green">
                {g}
              </span>
            ))}
          </div>
          {p.stats && (
            <div className="match-stats-grid">
              {["romance", "adventure", "luxury", "budget"].map((k) => (
                <div key={k} className="match-stat">
                  {k} {p.stats[k]}
                  <div className="match-stat-bar">
                    <div className="match-stat-fill" style={{ width: `${p.stats[k]}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="match-price-row">
            <span>
              ★ {card.property?.rating} · {card.property?.type}
            </span>
            <span>sleeps {card.property?.capacity}</span>
          </div>
        </div>
      </div>
    );
  };

  if (phase === "quiz") {
    return (
      <div className="match-root">
        <div className="match-head">
          <div className="match-title-block">
            <h1>Suite Hearts</h1>
            <p>Tinder for hotels — pick your vibes, swipe stays, book through Stay22.</p>
          </div>
        </div>
        <div className="match-quiz">
          <div className="match-quiz-label">Step 1 — your travel vibes (pick 1+)</div>
          <div className="match-vibes">
            {VIBE_OPTIONS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`match-vibe-chip${selectedVibes.includes(v.id) ? " is-on" : ""}`}
                onClick={() => toggleVibe(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="match-quiz-actions">
            <label className="match-quiz-label" style={{ marginBottom: 0 }}>
              Destination
              <select
                className="match-city-select"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{ display: "block", marginTop: 6 }}
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="match-btn match-btn-primary" onClick={loadDeck} disabled={loading}>
              {loading ? "Loading…" : "Find my matches"}
            </button>
          </div>
          {error && <p className="match-error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="match-root">
      <div className="match-head">
        <div className="match-title-block">
          <h1>Suite Hearts</h1>
          <p>
            {meta?.city} · {selectedVibes.join(", ")} · {meta?.mode ?? "mock"} feed
          </p>
        </div>
        <span className="match-meta">
          {deck.length - index} left · ← pass · → match
        </span>
      </div>

      <div className="match-body">
        <div className="match-deck-wrap">
          {index >= deck.length ? (
            <div className="match-loading">Deck complete — adjust vibes or city to refresh.</div>
          ) : (
            <>
              <div className="match-deck">
                {renderCard(next, { isBehind: true })}
                {renderCard(current, { isTop: true })}
              </div>
              <div className="match-deck-controls">
                <button type="button" className="match-round-btn nope" onClick={() => swipe("left")} aria-label="Pass">
                  ✕
                </button>
                <button type="button" className="match-round-btn like" onClick={() => swipe("right")} aria-label="Match">
                  ♥
                </button>
              </div>
              <p className="match-hint">Drag cards or use arrow keys</p>
            </>
          )}
          <button type="button" className="match-btn match-btn-ghost" onClick={() => setPhase("quiz")}>
            ← New vibe quiz
          </button>
        </div>

        <aside className="match-side">
          <div className="match-side-head">
            <h3>{match ? `Chat · ${match.persona?.displayName}` : "Match chat"}</h3>
            {match && (
              <button
                type="button"
                className="match-btn"
                onClick={() => {
                  setMatch(null);
                  setShowMatchOverlay(false);
                  setMessages([]);
                }}
              >
                Close
              </button>
            )}
          </div>
          {!match ? (
            <div className="match-chat-empty">Swipe right on a stay to unlock chat and booking.</div>
          ) : (
            <>
              <div className="match-messages">
                {messages.map((m, i) => (
                  <div key={i} className={`match-msg match-msg-${m.role === "user" ? "you" : "them"}`}>
                    {m.content}
                  </div>
                ))}
              </div>
              <form className="match-chat-form" onSubmit={sendChat}>
                <input
                  className="match-chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Say hey…"
                  disabled={chatBusy}
                />
                <button type="submit" className="match-btn match-btn-primary" disabled={chatBusy}>
                  Send
                </button>
              </form>
              <div className="match-book-bar">
                <a
                  className="match-book-btn"
                  href={match.bookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  BOOK NOW · STAY22 AFFILIATE
                </a>
              </div>
            </>
          )}
        </aside>
      </div>

      {match && showMatchOverlay && (
        <div className="match-overlay">
          <div className="match-overlay-card">
            <h2>It&apos;s a match!</h2>
            <p>
              You and {match.persona?.fullName} ({match.compatibility}% compatible) are vibing. Chat now or book
              directly.
            </p>
            <button
              type="button"
              className="match-btn match-btn-primary"
              onClick={() => setShowMatchOverlay(false)}
            >
              Start chatting
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
