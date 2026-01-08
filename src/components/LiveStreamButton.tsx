// LiveStreamButton.tsx
import React from "react";
import "./LiveStreamButton.css";

type Props = {
  isLive: boolean;           // True if Icecast stream is available (for styling/display)
  isPlaying: boolean;        // True if live stream is currently playing
  nowPlaying?: string | null; // Current show/track name from Icecast
  onClick: () => void;       // Play/stop toggle handler
};

export default function LiveStreamButton({
  isLive,
  isPlaying,
  nowPlaying,
  onClick,
}: Props) {
  return (
    <button
      className={`live-stream-button ${isLive ? "live-stream-button-active" : "live-stream-button-inactive"} ${isPlaying ? "live-stream-button-playing" : ""}`}
      onClick={onClick}
      aria-label={isPlaying ? "Stop live stream" : "Play live stream"}
      title={isPlaying ? "Stop live stream" : "Play live stream"}
    >
      <div className="live-stream-button-top">
        <span className="live-stream-button-icon">
          {isPlaying ? "⏸" : "▶"}
        </span>
        <span className="live-stream-button-status">
          {isPlaying ? "PLAYING NOW" : "LIVE NOW"}
          {isLive && (
            <span className="live-stream-button-record-indicator" aria-label="Live">
              ●
            </span>
          )}
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
