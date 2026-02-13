// LiveStreamButton.tsx
import React, { useState, useEffect, useCallback } from "react";
import "./LiveStreamButton.css";

type Props = {
  isLive: boolean;
  isPlaying: boolean;
  nowPlaying?: string | null;
  liveLabel?: string;
  onClick: () => void;
};

const MAX_WIDTH = 800;
const MIN_FONT = 80;
const MIN_VIEWPORT_FONT = 35;

export default function LiveStreamButton({
  isLive,
  isPlaying,
  nowPlaying,
  liveLabel,
  onClick,
}: Props) {
  const [fontSize, setFontSize] = useState<number | null>(null);
  const [allowWrap, setAllowWrap] = useState(false);
  const label = liveLabel || "LIVE NOW";

  const getBaseFontSize = useCallback(() => {
    if (typeof window === 'undefined') return 150;
    if (window.innerWidth <= 768) return 108;
    return 150;
  }, []);

  useEffect(() => {
    // Skip on mobile where text is display:none
    if (typeof window !== 'undefined' && window.innerWidth <= 480) return;

    const measure = () => {
      const baseFontSize = getBaseFontSize();
      const span = document.createElement('span');
      span.style.position = 'absolute';
      span.style.visibility = 'hidden';
      span.style.whiteSpace = 'nowrap';
      span.style.fontWeight = '700';
      span.style.letterSpacing = '0.6px';
      span.style.lineHeight = '1';
      span.style.fontSize = `${baseFontSize}px`;
      span.style.textTransform = 'uppercase';
      span.textContent = label;
      document.body.appendChild(span);
      const measuredWidth = span.offsetWidth;
      document.body.removeChild(span);

      // Step 1: Text-length scaling (fit label within MAX_WIDTH)
      let textSize: number;
      let shouldWrap = false;
      if (measuredWidth <= MAX_WIDTH) {
        textSize = baseFontSize;
      } else {
        const scaled = Math.floor(baseFontSize * (MAX_WIDTH / measuredWidth));
        if (scaled >= MIN_FONT) {
          textSize = scaled;
        } else {
          textSize = MIN_FONT;
          shouldWrap = true;
        }
      }

      // Step 2: Viewport-width scaling (shrink below 900px, floor at 35px)
      const w = window.innerWidth;
      const vpBreakpoint = baseFontSize === 108 ? 771 : 900;
      const vpScale = Math.min(1, w / vpBreakpoint);
      const finalSize = Math.max(MIN_VIEWPORT_FONT, Math.floor(textSize * vpScale));

      setFontSize(finalSize === baseFontSize ? null : finalSize);
      setAllowWrap(shouldWrap);
    };

    measure();

    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [label, getBaseFontSize]);

  const stateClass = isPlaying
    ? "live-stream-button-playing"
    : isLive
      ? "live-stream-button-live"
      : "live-stream-button-inactive";

  const textStyle: React.CSSProperties = {};
  if (fontSize !== null) {
    textStyle.fontSize = `${fontSize}px`;
  }
  if (allowWrap) {
    textStyle.whiteSpace = 'normal';
    textStyle.maxWidth = `${MAX_WIDTH}px`;
    textStyle.wordBreak = 'break-word';
    textStyle.textAlign = 'center';
  }

  return (
    <button
      className={`live-stream-button ${stateClass}`}
      onClick={onClick}
      aria-label={isPlaying ? "Stop live stream" : "Play live stream"}
      title={isPlaying ? "Stop live stream" : "Play live stream"}
      type="button"
    >
      {/* Custom label text - shown by default when not playing, hidden on hover */}
      <span className="live-stream-button-status" style={textStyle}>
        {label}
      </span>

      {/* Play icon - shown on hover when not playing */}
      <span className="live-stream-button-play-icon" aria-hidden>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <polygon points="4,2 4,22 22,12" />
        </svg>
      </span>

      {/* Stop icon - shown when playing (persists) */}
      <span className="live-stream-button-stop-icon" aria-hidden>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="3" width="18" height="18" />
        </svg>
      </span>
    </button>
  );
}
