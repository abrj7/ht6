// Liquid-glass button: a bevelled glass slab whose backdrop is warped by the
// #container-glass SVG displacement filter (defined once in LandingPage).
// Three stacked layers, matching the reference markup:
//   .lgb__shadow  — layered box-shadow bevel + inner highlights
//   .lgb__glass   — backdrop-filter: url(#container-glass) (the refraction)
//   .lgb__label   — the text, on top
// `tinted` gives the primary (Sign up) a warmer, more saturated fill.

import React from "react";

export default function LiquidGlassButton({ children, tinted = false, onClick, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`lgb${tinted ? " lgb--tinted" : ""}`}
    >
      <span className="lgb__shadow" aria-hidden="true" />
      <span className="lgb__glass" aria-hidden="true" />
      <span className="lgb__label">{children}</span>
    </button>
  );
}
