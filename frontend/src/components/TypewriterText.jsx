import { useEffect, useMemo } from "react";

// Word-by-word fade-in (ChatGPT-style): split into segments, each fades/rises
// in on a staggered animation-delay. Whitespace (incl. newlines) is preserved
// in its own segment so line breaks in itineraries survive. Respects
// prefers-reduced-motion (renders instantly).
export default function TypewriterText({ text = "", stepMs = 22, onReady }) {
  // Split keeping the whitespace tokens so spacing/newlines are preserved.
  const segments = useMemo(() => (text ? text.split(/(\s+)/) : []), [text]);

  useEffect(() => {
    onReady?.();
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (reduce || !text) return <>{text}</>;

  let wordIndex = 0;
  return (
    <span className="fade-text">
      {segments.map((seg, i) => {
        const isSpace = /^\s+$/.test(seg);
        // Delay advances per word so whitespace doesn't add extra steps.
        const delay = wordIndex * stepMs;
        if (!isSpace) wordIndex += 1;
        return (
          <span
            key={i}
            className={`fade-segment${isSpace ? " fade-segment-space" : ""}`}
            style={{ animationDelay: `${delay}ms` }}
          >
            {seg}
          </span>
        );
      })}
    </span>
  );
}
