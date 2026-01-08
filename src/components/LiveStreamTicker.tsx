// LiveStreamTicker.tsx
import React, { useMemo } from "react";
import "./LiveStreamTicker.css";

type Props = {
  displayText: string;     // Text to display (live stream info or track info)
  isEmpty: boolean;        // True when nothing is playing
};

export default function LiveStreamTicker({
  displayText,
  isEmpty,
}: Props) {
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

  return (
    <div
      className={`liveStreamTicker ${isEmpty ? "liveStreamTicker-empty" : ""}`}
      aria-label={displayText}
    >
      {/* tickerTrack contains TWO identical copies for a seamless infinite loop */}
      {/* Stable key prevents React from recreating the element, preserving animation state */}
      <div className="tickerTrack" key="ticker-animation">
        <div className="tickerContent">{copy}</div>
        <div className="tickerContent" aria-hidden="true">{copy}</div>
      </div>
    </div>
  );
}
