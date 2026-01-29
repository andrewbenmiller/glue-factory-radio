// LiveStreamTicker.tsx
import React, { useMemo, useRef, useEffect, useState } from "react";
import "./LiveStreamTicker.css";

type Props = {
  displayText: string;     // Text to display (live stream info or track info)
  isEmpty: boolean;        // True when nothing is playing
};

// Target speed in pixels per second (consistent across all screen sizes)
const TICKER_SPEED_PX_PER_SEC = 50;

export default function LiveStreamTicker({
  displayText,
  isEmpty,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [animationDuration, setAnimationDuration] = useState<number | null>(null);

  // Calculate animation duration based on content width for consistent speed
  useEffect(() => {
    const measureAndSetDuration = () => {
      if (contentRef.current) {
        const contentWidth = contentRef.current.offsetWidth;
        // Duration = distance / speed
        // We move -50% (one copy), so distance = contentWidth (one copy width)
        const duration = contentWidth / TICKER_SPEED_PX_PER_SEC;
        setAnimationDuration(duration);
      }
    };

    // Measure after render
    measureAndSetDuration();

    // Re-measure on resize
    window.addEventListener('resize', measureAndSetDuration);
    return () => window.removeEventListener('resize', measureAndSetDuration);
  }, [displayText]);

  // One "copy" worth of chunks (we'll render it twice for a seamless loop)
  const copy = useMemo(() => {
    return (
      <>
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className={`tickerChunk ${isEmpty ? "tickerChunk-empty" : ""}`}
          >
            {!isEmpty && <span className="bullet" aria-hidden="true">•</span>}
            <span className="text">{displayText}</span>
            {!isEmpty && <span className="bullet" aria-hidden="true">•</span>}
          </span>
        ))}
      </>
    );
  }, [isEmpty, displayText]);

  // Build inline style for dynamic animation duration
  const trackStyle: React.CSSProperties = animationDuration
    ? { animationDuration: `${animationDuration}s` }
    : {};

  return (
    <div
      className={`liveStreamTicker ${isEmpty ? "liveStreamTicker-empty" : ""}`}
      aria-label={displayText}
    >
      {/* tickerTrack contains TWO identical copies for a seamless infinite loop */}
      {/* Stable key prevents React from recreating the element, preserving animation state */}
      <div className="tickerTrack" key="ticker-animation" style={trackStyle}>
        <div className="tickerContent" ref={contentRef}>{copy}</div>
        <div className="tickerContent" aria-hidden="true">{copy}</div>
      </div>
    </div>
  );
}
