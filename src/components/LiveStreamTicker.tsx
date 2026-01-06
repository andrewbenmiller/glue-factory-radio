import React from "react";
import { useLiveStatus } from "../hooks/useLiveStatus";
import { useAudio } from "../audio/AudioProvider";
import "./LiveStreamTicker.css";

export function LiveStreamTicker() {
  const { isLive, nowPlaying, streamUrl, error } = useLiveStatus();
  const { source, playLive, stopLive } = useAudio();

  const livePlaying = source === "live";

  // Show scrolling white ticker when not live
  if (error || !isLive) {
    const emptyText = "• NOTHING.CURRENTLY.STREAMING";
    return (
      <div className="liveStreamTicker liveStreamTicker-empty">
        <div className="tickerContent">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className="tickerText tickerText-empty">{emptyText}•</span>
          ))}
        </div>
      </div>
    );
  }

  const tickerText = livePlaying
    ? `● LIVE NOW: ${nowPlaying ?? "Live Stream"} — Click to stop`
    : `● NOW STREAMING: ${nowPlaying ?? "Live"} — Click to play`;

  return (
    <div 
      className="liveStreamTicker"
      onClick={() => (livePlaying ? stopLive() : playLive(streamUrl))}
    >
      <div className="tickerContent">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="tickerText">{tickerText}•</span>
        ))}
      </div>
    </div>
  );
}

