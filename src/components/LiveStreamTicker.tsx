// LiveStreamTicker.tsx
import React, { useMemo } from "react";
import "./LiveStreamTicker.css";

type Props = {
  isLive: boolean;
  emptyText?: string;      // e.g. "NOTHING CURRENTLY STREAMING"
  tickerText: string;      // e.g. "NOW STREAMING: DJ SET"
  onClick?: () => void;    // click-to-play when live
};

export default function LiveStreamTicker({
  isLive,
  emptyText = "NOTHING CURRENTLY STREAMING",
  tickerText,
  onClick,
}: Props) {
  const chunkText = isLive ? tickerText : emptyText;

  // One "copy" worth of chunks (we'll render it twice for a seamless loop)
  const copy = useMemo(() => {
    return (
      <>
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className={`tickerChunk ${!isLive ? "tickerChunk-empty" : ""}`}
          >
            {isLive && <span className="bullet" aria-hidden="true">•</span>}
            <span className="text">{chunkText}</span>
            {isLive && <span className="bullet" aria-hidden="true">•</span>}
          </span>
        ))}
      </>
    );
  }, [isLive, chunkText]);

  return (
    <div
      className={`liveStreamTicker ${!isLive ? "liveStreamTicker-empty" : ""}`}
      onClick={isLive ? onClick : undefined}
      role={isLive && onClick ? "button" : undefined}
      tabIndex={isLive && onClick ? 0 : -1}
      aria-label={chunkText}
      onKeyDown={(e) => {
        if (!isLive || !onClick) return;
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      {/* tickerTrack contains TWO identical copies for a seamless infinite loop */}
      <div className="tickerTrack">
        <div className="tickerContent">{copy}</div>
        <div className="tickerContent" aria-hidden="true">{copy}</div>
      </div>
    </div>
  );
}
