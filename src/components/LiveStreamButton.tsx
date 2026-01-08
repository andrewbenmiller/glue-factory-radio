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
      <div className="live-stream-button-top">
        {/* Always render to reserve space; hide visually when not live */}
        <span
          className={`live-stream-button-record-indicator ${
            isLive ? "is-live" : "is-not-live"
          }`}
          aria-hidden={!isLive}
          title={isLive ? "Live" : ""}
        >
          ●
        </span>

        <span className="live-stream-button-status">LIVE NOW</span>

        <span className="live-stream-button-icon" aria-hidden="true">
          {isPlaying ? "⏸" : "▶"}
        </span>
      </div>

      {nowPlaying ? (
        <div className="live-stream-button-info-container">
          <span className="live-stream-button-info">"{nowPlaying}"</span>
        </div>
      ) : isLive ? (
        <div className="live-stream-button-info-container">
          <span className="live-stream-button-info">Available</span>
        </div>
      ) : null}
    </button>
  );
}
