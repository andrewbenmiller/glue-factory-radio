// LiveStreamButton.tsx
import React from "react";
import "./LiveStreamButton.css";

type Props = {
  isLive: boolean;
  isPlaying: boolean;
  nowPlaying?: string | null;
  onClick: () => void;
};

export default function LiveStreamButton({
  isLive,
  isPlaying,
  nowPlaying,
  onClick,
}: Props) {
  const stateClass = isPlaying
    ? "live-stream-button-playing"
    : isLive
      ? "live-stream-button-live"
      : "live-stream-button-inactive";

  return (
    <button
      className={`live-stream-button ${stateClass}`}
      onClick={onClick}
      aria-label={isPlaying ? "Stop live stream" : "Play live stream"}
      title={isPlaying ? "Stop live stream" : "Play live stream"}
      type="button"
    >
      {/* LIVE NOW text - shown by default when not playing, hidden on hover */}
      <span className="live-stream-button-status">LIVE NOW</span>

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
