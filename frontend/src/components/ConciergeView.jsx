import { useCallback, useEffect, useRef, useState } from "react";
import "./concierge.css";

// Voice concierge: natural-language hotel search + TTS.
// Consumes POST /api/ask and /api/voice/* only — see docs/PRD.md section 12.

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

const STARTER_CHIPS = [
  "Hotels near Banff under $250",
  "Weekend cabin with hot tub",
  "Cheapest stay in Montreal",
  "Family-friendly with a pool",
];

const DEMO_CATALOG = [
  {
    id: "ybnf-spruce",
    name: "Spruce Ridge Lodge",
    type: "cabin",
    price: 214,
    rating: 9.2,
    capacity: 4,
    bookUrl: "https://www.stay22.com",
    amenities: ["Hot tub", "Kitchen", "Mountain view", "Wi-Fi"],
    nearestStation: "Banff Gondola — 2.1 km",
    freeCancellation: true,
    why: "Strong guest ratings and fits your Banff budget.",
    score: 0.92,
    destination: "Banff, AB",
  },
  {
    id: "ybnf-pine",
    name: "Pine Valley Retreat",
    type: "cabin",
    price: 189,
    rating: 8.8,
    capacity: 3,
    bookUrl: "https://www.stay22.com",
    amenities: ["Hot tub", "Fireplace", "Parking"],
    nearestStation: "Downtown Banff — 1.4 km",
    freeCancellation: true,
    why: "Cheapest cabin near Banff with a hot tub.",
    score: 0.86,
    destination: "Banff, AB",
  },
  {
    id: "ymtl-vieux",
    name: "Hôtel Le Vieux-Port",
    type: "hotel",
    price: 96,
    rating: 8.6,
    capacity: 2,
    bookUrl: "https://www.stay22.com",
    amenities: ["Breakfast", "Old Port views", "Wi-Fi"],
    nearestStation: "Place-d'Armes — 450 m",
    freeCancellation: true,
    why: "Lowest quote in Montreal with free cancellation.",
    score: 0.88,
    destination: "Montreal, QC",
  },
  {
    id: "ymtl-pool",
    name: "Hotel Bonaventure",
    type: "hotel",
    price: 178,
    rating: 8.4,
    capacity: 2,
    bookUrl: "https://www.stay22.com",
    amenities: ["Rooftop pool", "Garden terrace", "Gym"],
    nearestStation: "Bonaventure — 200 m",
    freeCancellation: true,
    why: "Iconic rooftop pool — great for families.",
    score: 0.84,
    destination: "Montreal, QC",
  },
  {
    id: "yblu-harbour",
    name: "Harbourfront Inn",
    type: "hotel",
    price: 128.5,
    rating: 8.2,
    capacity: 4,
    bookUrl: "https://www.stay22.com",
    amenities: ["Indoor pool", "Kids club", "Parking"],
    nearestStation: "Blue Mountain Village — 600 m",
    freeCancellation: false,
    why: "Family-friendly with pool access at Blue Mountain.",
    score: 0.81,
    destination: "Blue Mountain, ON",
  },
  {
    id: "ypec-auberge",
    name: "Auberge du Vieux Quartier",
    type: "hotel",
    price: 142.75,
    rating: 8.9,
    capacity: 2,
    bookUrl: "https://www.stay22.com",
    amenities: ["Wine bar", "Bicycle rental", "Wi-Fi"],
    nearestStation: "Main Street PEC — 350 m",
    freeCancellation: true,
    why: "Top-rated boutique stay in Prince Edward County.",
    score: 0.9,
    destination: "Prince Edward County, ON",
  },
  {
    id: "ybnf-lux",
    name: "Fairmont Banff Springs",
    type: "hotel",
    price: 389,
    rating: 9.4,
    capacity: 2,
    bookUrl: "https://www.stay22.com",
    amenities: ["Spa", "Indoor pool", "Golf", "Fine dining"],
    nearestStation: "Banff Upper Hot Springs — 1.8 km",
    freeCancellation: false,
    why: "Luxury landmark with full resort amenities.",
    score: 0.95,
    destination: "Banff, AB",
  },
];

let msgSeq = 0;
function nextId() {
  msgSeq += 1;
  return `m-${msgSeq}`;
}

function formatPrice(n) {
  return Number.isFinite(n) ? `$${n.toFixed(n % 1 ? 2 : 0)}` : "—";
}

/** Client-side demo RAG when POST /api/ask returns 501. */
function demoAsk(query, ctx) {
  const q = query.toLowerCase();
  let pool = ctx.lastResults?.length ? [...ctx.lastResults] : [...DEMO_CATALOG];

  if (/\bcheaper\b|\blower\b|\bless\b|\baffordable\b/.test(q)) {
    pool.sort((a, b) => a.price - b.price);
  }
  if (/\bpool\b|\bswim\b/.test(q)) {
    pool = pool.filter((r) => r.amenities.some((a) => /pool/i.test(a)));
  }
  if (/\bhot tub\b|\bhottub\b/.test(q)) {
    pool = pool.filter((r) => r.amenities.some((a) => /hot tub/i.test(a)));
  }
  if (/\bfamily\b|\bkids\b|\bchildren\b/.test(q)) {
    pool = pool.filter((r) => r.capacity >= 3 || /kids|pool/i.test(r.amenities.join(" ")));
  }
  if (/banff/.test(q)) pool = pool.filter((r) => /banff/i.test(r.destination));
  if (/montreal/.test(q)) pool = pool.filter((r) => /montreal/i.test(r.destination));
  if (/blue mountain/.test(q)) pool = pool.filter((r) => /blue mountain/i.test(r.destination));

  const under = q.match(/under\s*\$?\s*(\d+)/);
  if (under) pool = pool.filter((r) => r.price <= Number(under[1]));

  if (/cabin/.test(q)) pool = pool.filter((r) => r.type === "cabin");
  if (/hotel/.test(q) && !/cabin/.test(q)) pool = pool.filter((r) => r.type === "hotel");

  pool.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const results = pool.slice(0, 4);

  const answer =
    results.length === 0
      ? "Nothing matched that filter — try widening your search or pick a starter question."
      : results.length === 1
        ? `Top match: ${results[0].name} at ${formatPrice(results[0].price)}/night — ${results[0].why}`
        : `I found ${results.length} picks. Best value is ${results[0].name} at ${formatPrice(results[0].price)}/night.`;

  return {
    answer,
    parsed: { intent: "search", query, followUp: Boolean(ctx.lastResults?.length) },
    results,
    mode: "demo",
    tookMs: Math.round(80 + Math.random() * 120),
    warming: true,
  };
}

export default function ConciergeView() {
  const [messages, setMessages] = useState([]);
  const [results, setResults] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [ttsProvider, setTtsProvider] = useState(null);
  const [muted, setMuted] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [lastMode, setLastMode] = useState(null);

  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const ctxRef = useRef({
    history: [],
    lastResults: [],
    lastParsed: null,
  });

  const scrollThread = useCallback(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollThread();
  }, [messages, thinking, scrollThread]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/voice/status`)
      .then((r) => (r.ok ? r.json() : { provider: "browser" }))
      .then((d) => setTtsProvider(d.provider === "elevenlabs" ? "elevenlabs" : "browser"))
      .catch(() => setTtsProvider("browser"));
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text) => {
      if (muted || !text?.trim()) return;
      stopSpeaking();

      try {
        const res = await fetch(`${BACKEND_URL}/api/voice/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim().slice(0, 600) }),
        });

        const ctype = res.headers.get("content-type") || "";
        if (res.ok && ctype.includes("audio")) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => {
            URL.revokeObjectURL(url);
            setSpeaking(false);
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            setSpeaking(false);
          };
          setSpeaking(true);
          await audio.play();
          return;
        }
      } catch {
        /* fall through to browser TTS */
      }

      if ("speechSynthesis" in window) {
        const utt = new SpeechSynthesisUtterance(text.trim().slice(0, 600));
        utt.onend = () => setSpeaking(false);
        utt.onerror = () => setSpeaking(false);
        setSpeaking(true);
        window.speechSynthesis.speak(utt);
      }
    },
    [muted, stopSpeaking]
  );

  useEffect(() => () => stopSpeaking(), [stopSpeaking]);

  const submitQuery = useCallback(
    async (raw) => {
      const query = raw.trim();
      if (!query || thinking) return;

      setInput("");
      setThinking(true);

      const userMsg = { id: nextId(), role: "user", text: query };
      setMessages((m) => [...m, userMsg]);

      const ctx = ctxRef.current;
      ctx.history = [...ctx.history, { role: "user", content: query }].slice(-12);

      try {
        let payload;
        let warming = false;

        try {
          const res = await fetch(`${BACKEND_URL}/api/ask`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query,
              history: ctx.history,
              context: {
                previousResults: ctx.lastResults,
                previousParsed: ctx.lastParsed,
              },
            }),
          });

          if (res.status === 501) {
            payload = demoAsk(query, ctx);
            warming = true;
          } else if (!res.ok) {
            throw new Error(`Search failed (${res.status})`);
          } else {
            payload = await res.json();
          }
        } catch (err) {
          if (err.message?.startsWith("Search failed")) throw err;
          payload = demoAsk(query, ctx);
          warming = true;
        }

        const answer = payload.answer || "Here are some options for you.";
        const nextResults = Array.isArray(payload.results) ? payload.results : [];

        ctx.lastResults = nextResults;
        ctx.lastParsed = payload.parsed ?? null;
        ctx.history = [...ctx.history, { role: "assistant", content: answer }].slice(-12);

        const batch = [{ id: nextId(), role: "assistant", text: answer, tookMs: payload.tookMs }];
        if (warming || payload.warming) {
          batch.unshift({
            id: nextId(),
            role: "system",
            text: "Concierge warming up — demo exchange picks",
          });
        }

        setMessages((m) => [...m, ...batch]);
        setResults(nextResults);
        setLastMode(payload.mode || (warming ? "demo" : null));
        speak(answer);
      } catch (err) {
        setMessages((m) => [
          ...m,
          { id: nextId(), role: "error", text: err.message || "Something went wrong. Try again." },
        ]);
      } finally {
        setThinking(false);
        inputRef.current?.focus();
      }
    },
    [thinking, speak]
  );

  const onSubmit = (e) => {
    e.preventDefault();
    submitQuery(input);
  };

  const toggleMic = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages((m) => [
        ...m,
        { id: nextId(), role: "error", text: "Speech recognition is not supported in this browser." },
      ]);
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-CA";
    rec.onresult = (ev) => {
      const transcript = ev.results[0]?.[0]?.transcript ?? "";
      if (transcript) setInput(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };

  const ttsLabel =
    ttsProvider === "elevenlabs" ? "ElevenLabs voice" : ttsProvider ? "Browser voice" : "Voice…";

  return (
    <div className="cg-root">
      <header className="cg-header">
        <span className="cg-title">Voice concierge</span>
        <span
          className={`cg-tts-badge${ttsProvider === "elevenlabs" ? " cg-tts-badge--premium" : ""}`}
          title={speaking ? "Speaking…" : muted ? "TTS muted" : "TTS active"}
        >
          {ttsLabel}
          {muted ? " · muted" : speaking ? " · speaking" : ""}
        </span>
      </header>

      <div className="cg-layout">
        <section className="cg-thread" aria-label="Concierge chat">
          <div className="cg-chips" role="group" aria-label="Starter questions">
            {STARTER_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                className="cg-chip"
                disabled={thinking}
                onClick={() => submitQuery(chip)}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="cg-messages" ref={threadRef}>
            {messages.length === 0 && !thinking && (
              <div className="cg-empty">
                <strong>Ask anything</strong>
                Natural-language hotel search over live Stay22 inventory. Try a chip above or type
                a follow-up like &ldquo;cheaper&rdquo; or &ldquo;with a pool&rdquo;.
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`cg-bubble cg-bubble--${msg.role}`}>
                {msg.text}
                {msg.role === "assistant" && msg.tookMs != null && (
                  <span className="cg-meta">{msg.tookMs} ms</span>
                )}
              </div>
            ))}

            {thinking && (
              <div className="cg-thinking" aria-label="Concierge is thinking">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>

          <form className="cg-composer" onSubmit={onSubmit}>
            <textarea
              ref={inputRef}
              className="cg-input"
              rows={1}
              placeholder="Ask about stays, prices, amenities…"
              value={input}
              disabled={thinking}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitQuery(input);
                }
              }}
              aria-label="Message"
            />
            <button
              type="button"
              className={`cg-btn cg-btn--mic${listening ? " cg-btn--active" : ""}`}
              onClick={toggleMic}
              disabled={thinking}
              title={listening ? "Stop listening" : "Voice input"}
              aria-pressed={listening}
            >
              MIC
            </button>
            <button
              type="button"
              className={`cg-btn cg-btn--mute${muted ? " cg-btn--active" : ""}`}
              onClick={() => {
                if (!muted) stopSpeaking();
                setMuted((v) => !v);
              }}
              title={muted ? "Unmute voice replies" : "Mute voice replies"}
              aria-pressed={muted}
            >
              {muted ? "UNMUTE" : "MUTE"}
            </button>
            <button type="submit" className="cg-btn cg-btn--send" disabled={thinking || !input.trim()}>
              SEND
            </button>
          </form>
        </section>

        <aside className="cg-rail" aria-label="Search results">
          <div className="cg-rail-head">
            <span className="cg-rail-title">Matches</span>
            <span className="cg-rail-count">
              {results.length ? `${results.length} result${results.length === 1 ? "" : "s"}` : "—"}
              {lastMode ? ` · ${lastMode}` : ""}
            </span>
          </div>

          <div className="cg-results">
            {results.length === 0 ? (
              <p className="cg-rail-empty">
                Results appear here after you ask. Each card links to a Stay22 booking URL.
              </p>
            ) : (
              results.map((r) => (
                <article key={r.id || r.name} className="cg-card">
                  <div className="cg-card-top">
                    <h3 className="cg-card-name">{r.name}</h3>
                    <span className="cg-price">{formatPrice(r.price)}/nt</span>
                  </div>
                  <div className="cg-card-meta">
                    {r.type && <span>{r.type}</span>}
                    {r.rating != null && <span>★ {r.rating}</span>}
                    {r.capacity != null && <span>Sleeps {r.capacity}</span>}
                    {r.freeCancellation && <span>Free cancel</span>}
                  </div>
                  {r.nearestStation && (
                    <div className="cg-card-meta">
                      <span>{r.nearestStation}</span>
                    </div>
                  )}
                  {r.why && <p className="cg-card-why">{r.why}</p>}
                  {Array.isArray(r.amenities) && r.amenities.length > 0 && (
                    <div className="cg-amenities">
                      {r.amenities.slice(0, 4).map((a) => (
                        <span key={a} className="cg-amenity">
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.bookUrl && (
                    <a
                      className="cg-book"
                      href={r.bookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      BOOK
                    </a>
                  )}
                </article>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
