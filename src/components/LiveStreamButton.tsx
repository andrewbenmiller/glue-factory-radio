import React from "react";
import { useLiveStatus } from "../hooks/useLiveStatus";
import { useAudio } from "../audio/AudioProvider";
import "./LiveStreamButton.css";

export function LiveStreamButton() {
  const { isLive, nowPlaying, streamUrl, error } = useLiveStatus();
  const { source, playLive, stopLive } = useAudio();

  const livePlaying = source === "live";

  if (error) {
    return (
      <button disabled className="liveButton disabled">
        Error: {error}
      </button>
    );
  }

  if (!isLive) {
    return (
      <button disabled className="liveButton disabled">
        No live stream available
      </button>
    );
  }

  return (
    <button
      className="liveButton"
      onClick={() => (livePlaying ? stopLive() : playLive(streamUrl))}
    >
      {!livePlaying && <span className="recordCircle"></span>}
      {livePlaying
        ? "Stop Live Stream"
        : `Now Streaming: ${nowPlaying ?? "Live"} — Click to play`}
    </button>
  );
}

