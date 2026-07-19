// Yonder landing / gate. Faithful port of the pasted IntroAnimation:
// a single fixed full-screen stage driven by a VIRTUAL scroll (wheel/touch is
// hijacked, the page never actually scrolls). Cards fly in scatter -> line ->
// circle; then scrolling morphs the circle into a bottom "rainbow" arc and
// shuffles it. Two centered text blocks crossfade on the morph:
//   - intro copy fades in once the circle completes (morph < 0.5)
//   - the gate copy + Log in / Sign up glass buttons fade in as the arc forms
//     (morph > 0.8), centered in the middle of the screen.
// Sun/moon toggle (top-right) flips bright/dark, persisted to the shared
// yonder-theme key so the dashboard inherits it after login.

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, useTransform, useSpring, useMotionValue } from "framer-motion";
import { useAuth0 } from "@auth0/auth0-react";
import { AUTH_CONFIGURED } from "../authConfig.js";
import LiquidGlassButton from "./LiquidGlassButton.jsx";
import "./landing.css";

const IMG_WIDTH = 66;
const IMG_HEIGHT = 92;
const TOTAL_IMAGES = 20;
const MAX_SCROLL = 3000;

const lerp = (a, b, t) => a * (1 - t) + b * t;

// Scenic / hotel imagery (Unsplash). Broken loads fall back to a gradient tile.
const IMAGES = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=320&q=80",
  "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=320&q=80",
  "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=320&q=80",
  "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=320&q=80",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=320&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=320&q=80",
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=320&q=80",
  "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=320&q=80",
  "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=320&q=80",
  "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=320&q=80",
  "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=320&q=80",
  "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=320&q=80",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=320&q=80",
  "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=320&q=80",
  "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=320&q=80",
  "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=320&q=80",
  "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=320&q=80",
  "https://images.unsplash.com/photo-1549294413-26f195200c16?w=320&q=80",
  "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=320&q=80",
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=320&q=80",
];

const CAPTIONS = [
  "Bali", "Kyoto", "Santorini", "Dubai", "Banff", "Queenstown", "Paris",
  "Rome", "Venice", "Lombok", "Maldives", "Amalfi", "Lucerne", "Tulum",
  "Marina Bay", "Phuket", "Lisbon", "Vienna", "Cape Town", "Reykjavik",
];

function FlipCard({ src, index, target }) {
  const [broken, setBroken] = useState(false);
  return (
    <motion.div
      animate={{
        x: target.x,
        y: target.y,
        rotate: target.rotation,
        scale: target.scale,
        opacity: target.opacity,
      }}
      transition={{ type: "spring", stiffness: 40, damping: 15 }}
      style={{
        position: "absolute",
        width: IMG_WIDTH,
        height: IMG_HEIGHT,
        transformStyle: "preserve-3d",
        perspective: "1000px",
      }}
      className="lp-card group"
    >
      <motion.div
        className="lp-card__inner"
        style={{ transformStyle: "preserve-3d" }}
        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
        whileHover={{ rotateY: 180 }}
      >
        <div className="lp-card__face lp-card__front">
          {broken ? (
            <div className="lp-card__fallback" />
          ) : (
            <img
              src={src}
              alt={CAPTIONS[index] || "destination"}
              loading="lazy"
              onError={() => setBroken(true)}
            />
          )}
          <div className="lp-card__shade" />
        </div>
        <div className="lp-card__face lp-card__back">
          <p className="lp-card__kicker">ESCAPE</p>
          <p className="lp-card__place">{CAPTIONS[index] || "Somewhere"}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function LandingPage({ onEnterDemo }) {
  const { loginWithRedirect } = useAuth0();
  const containerRef = useRef(null);
  const [phase, setPhase] = useState("scatter"); // scatter | line | circle
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Theme (shared with the dashboard via localStorage "yonder-theme").
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("yonder-theme") || "light";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("yonder-theme", theme);
  }, [theme]);

  // Container size for the responsive circle/arc.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const set = () =>
      setSize({ width: el.offsetWidth, height: el.offsetHeight });
    set();
    const obs = new ResizeObserver(set);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // --- Virtual scroll (wheel/touch hijack) ---
  const virtualScroll = useMotionValue(0);
  const scrollRef = useRef(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const next = Math.min(Math.max(scrollRef.current + e.deltaY, 0), MAX_SCROLL);
      scrollRef.current = next;
      virtualScroll.set(next);
    };
    let touchY = 0;
    const onTouchStart = (e) => { touchY = e.touches[0].clientY; };
    const onTouchMove = (e) => {
      const y = e.touches[0].clientY;
      const dy = touchY - y;
      touchY = y;
      const next = Math.min(Math.max(scrollRef.current + dy, 0), MAX_SCROLL);
      scrollRef.current = next;
      virtualScroll.set(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [virtualScroll]);

  const morphProgress = useTransform(virtualScroll, [0, 600], [0, 1]);
  const smoothMorph = useSpring(morphProgress, { stiffness: 40, damping: 20 });
  const scrollRotate = useTransform(virtualScroll, [600, 3000], [0, 360]);
  const smoothScrollRotate = useSpring(scrollRotate, { stiffness: 40, damping: 20 });

  // Mouse parallax.
  const mouseX = useMotionValue(0);
  const smoothMouseX = useSpring(mouseX, { stiffness: 30, damping: 20 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseX.set(nx * 100);
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, [mouseX]);

  // Intro sequence.
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("line"), 500);
    const t2 = setTimeout(() => setPhase("circle"), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const scatter = useMemo(
    () =>
      IMAGES.map(() => ({
        x: (Math.random() - 0.5) * 1500,
        y: (Math.random() - 0.5) * 1000,
        rotation: (Math.random() - 0.5) * 180,
        scale: 0.6,
        opacity: 0,
      })),
    []
  );

  // Mirror spring motion values into React state for the per-card math.
  const [morphValue, setMorphValue] = useState(0);
  const [rotateValue, setRotateValue] = useState(0);
  const [parallax, setParallax] = useState(0);
  useEffect(() => {
    const a = smoothMorph.on("change", setMorphValue);
    const b = smoothScrollRotate.on("change", setRotateValue);
    const c = smoothMouseX.on("change", setParallax);
    return () => { a(); b(); c(); };
  }, [smoothMorph, smoothScrollRotate, smoothMouseX]);

  // Crossfade drivers for the two centered text blocks.
  const contentOpacity = useTransform(smoothMorph, [0.8, 1], [0, 1]);
  const contentY = useTransform(smoothMorph, [0.8, 1], [20, 0]);

  const targetFor = (i) => {
    if (phase === "scatter") return scatter[i];
    if (phase === "line") {
      const spacing = 74;
      const totalW = TOTAL_IMAGES * spacing;
      return { x: i * spacing - totalW / 2, y: 0, rotation: 0, scale: 1, opacity: 1 };
    }

    // Circle + bottom-arc morph.
    const isMobile = size.width < 768;
    const minDim = Math.min(size.width || 900, size.height || 600);

    const circleRadius = Math.min(minDim * 0.35, 350);
    const circleAngle = (i / TOTAL_IMAGES) * 360;
    const circleRad = (circleAngle * Math.PI) / 180;
    const circlePos = {
      x: Math.cos(circleRad) * circleRadius,
      y: Math.sin(circleRad) * circleRadius,
      rotation: circleAngle + 90,
    };

    const baseRadius = Math.min(size.width, size.height * 1.5);
    const arcRadius = baseRadius * (isMobile ? 1.4 : 1.1);
    const arcApexY = size.height * (isMobile ? 0.35 : 0.25);
    const arcCenterY = arcApexY + arcRadius;
    const spreadAngle = isMobile ? 100 : 130;
    const startAngle = -90 - spreadAngle / 2;
    const step = spreadAngle / (TOTAL_IMAGES - 1);

    const scrollProgress = Math.min(Math.max(rotateValue / 360, 0), 1);
    const maxRotation = spreadAngle * 0.8;
    const boundedRotation = -scrollProgress * maxRotation;

    const currentArcAngle = startAngle + i * step + boundedRotation;
    const arcRad = (currentArcAngle * Math.PI) / 180;
    const arcPos = {
      x: Math.cos(arcRad) * arcRadius + parallax,
      y: Math.sin(arcRad) * arcRadius + arcCenterY,
      rotation: currentArcAngle + 90,
      scale: isMobile ? 1.4 : 1.8,
    };

    return {
      x: lerp(circlePos.x, arcPos.x, morphValue),
      y: lerp(circlePos.y, arcPos.y, morphValue),
      rotation: lerp(circlePos.rotation, arcPos.rotation, morphValue),
      scale: lerp(1, arcPos.scale, morphValue),
      opacity: 1,
    };
  };

  const startLogin = () => {
    if (!AUTH_CONFIGURED) return onEnterDemo?.();
    loginWithRedirect({ authorizationParams: { screen_hint: "login" } });
  };
  const startSignup = () => {
    if (!AUTH_CONFIGURED) return onEnterDemo?.();
    loginWithRedirect({ authorizationParams: { screen_hint: "signup" } });
  };

  return (
    <div ref={containerRef} className={`landing landing--${theme}`}>
      {/* SVG displacement filter powering the liquid-glass buttons */}
      <svg className="lp-svg-defs" aria-hidden="true">
        <filter id="container-glass" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.008"
            numOctaves="2"
            seed="4"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="1.4" result="soft" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="soft"
            scale="42"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      {/* Theme toggle */}
      <button
        type="button"
        className="lp-theme-toggle"
        onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
        aria-label={theme === "light" ? "Switch to dark mode" : "Switch to bright mode"}
        title={theme === "light" ? "Bright mode" : "Dark mode"}
      >
        {theme === "light" ? "☀️" : "🌙"}
      </button>

      {/* Intro copy — fades in once the circle completes, out as you scroll */}
      <div className="lp-center-layer lp-center-layer--intro">
        <motion.h1
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          animate={
            phase === "circle" && morphValue < 0.5
              ? { opacity: 1 - morphValue * 2, y: 0, filter: "blur(0px)" }
              : { opacity: 0, filter: "blur(10px)" }
          }
          transition={{ duration: 1 }}
          className="lp-intro-title"
        >
          Every dollar you don't spend<br />is a place you could go.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={
            phase === "circle" && morphValue < 0.5
              ? { opacity: 0.6 - morphValue }
              : { opacity: 0 }
          }
          transition={{ duration: 1, delay: 0.2 }}
          className="lp-intro-hint"
        >
          SCROLL TO EXPLORE
        </motion.p>
      </div>

      {/* Gate copy + buttons — fades in as the arc forms, centered on screen */}
      <div className="lp-center-layer lp-center-layer--gate">
        <motion.div style={{ opacity: contentOpacity, y: contentY }} className="lp-gate-content">
          <p className="lp-eyebrow">WELCOME TO YONDER</p>
          <h2 className="lp-gate-title">Your spending, as a passport.</h2>
          <p className="lp-gate-blurb">
            Yonder quietly converts the money you'd otherwise leak into the cost
            of a real trip — and moves a destination closer every time you skip a
            spend. Members only. Sign in to open your board.
          </p>
          <div className="lp-gate-actions">
            <LiquidGlassButton onClick={startLogin}>Log in</LiquidGlassButton>
            <LiquidGlassButton tinted onClick={startSignup}>
              Sign up
            </LiquidGlassButton>
          </div>
        </motion.div>
      </div>

      {/* Card stage */}
      <div className="lp-stage">
        {IMAGES.map((src, i) => (
          <FlipCard key={i} src={src} index={i} target={targetFor(i)} />
        ))}
      </div>
    </div>
  );
}
