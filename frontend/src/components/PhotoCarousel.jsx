import { useEffect, useState } from "react";

// Simple image carousel. Stay22's search API returns a single thumbnail per
// property, so today `images` usually has one slide — the arrows/dots only
// appear when there are more (e.g. if a details API is wired up later).
export default function PhotoCarousel({ images, alt = "", className = "" }) {
  const list = Array.isArray(images) ? images.filter(Boolean) : [];
  const [i, setI] = useState(0);

  // Reset when the property (image set) changes.
  useEffect(() => setI(0), [list.join("|")]);

  if (list.length === 0) return null;

  const go = (delta) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setI((cur) => (cur + delta + list.length) % list.length);
  };

  return (
    <div className={`carousel ${className}`.trim()}>
      <img className="carousel__img" src={list[i]} alt={alt} loading="lazy" />
      {list.length > 1 && (
        <>
          <button type="button" className="carousel__nav carousel__nav--prev" onClick={go(-1)} aria-label="Previous photo">
            ‹
          </button>
          <button type="button" className="carousel__nav carousel__nav--next" onClick={go(1)} aria-label="Next photo">
            ›
          </button>
          <div className="carousel__dots" aria-hidden="true">
            {list.map((_, d) => (
              <span key={d} className={`carousel__dot${d === i ? " carousel__dot--on" : ""}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
