// Full-width scrolling tape under the header. Content is duplicated once so
// the CSS keyframes loop (-50% translate) is seamless. Pauses on hover;
// prefers-reduced-motion kills the animation globally in index.css.

// In the exchange framing, a price DROP is good for the traveler, so ▼ = teal
// and ▲ = red.
function TapeItem({ text }) {
  const dir = text.startsWith("\u25B2") ? "up" : text.startsWith("\u25BC") ? "down" : null;
  return (
    <span className="tape-item">
      {dir ? (
        <>
          <span className={dir === "down" ? "tape-dir--down" : "tape-dir--up"}>
            {text[0]}
          </span>
          {text.slice(1)}
        </>
      ) : (
        text
      )}
    </span>
  );
}

export default function TickerTape({ tape }) {
  if (!Array.isArray(tape) || tape.length === 0) return null;
  const run = (keyPrefix, hidden) => (
    <div className="tape-run" aria-hidden={hidden || undefined}>
      {tape.map((line, i) => (
        <TapeItem key={`${keyPrefix}-${i}`} text={String(line)} />
      ))}
    </div>
  );
  return (
    <div className="tape" role="marquee" aria-label="Market tape">
      <div className="tape-track">
        {run("a", false)}
        {run("b", true)}
      </div>
    </div>
  );
}
