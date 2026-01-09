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
        <span className="live-stream-button-status">LIVE NOW</span>

        <span className="live-stream-button-icon" aria-hidden>
          <svg
            viewBox="0 0 24 24"
            width="30"
            height="30"
            fill="currentColor"
          >
            {isPlaying ? (
              <>
                {/* PAUSE — left edge locked at x = 4 */}
                <rect x="4" y="4" width="5" height="16" />
                <rect x="11" y="4" width="5" height="16" />
              </>
            ) : (
              <>
                {/* PLAY — left edge also locked at x = 4 */}
                <polygon points="4,4 4,20 18,12" />
              </>
            )}
          </svg>
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
