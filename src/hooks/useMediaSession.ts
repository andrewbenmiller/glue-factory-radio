import { useEffect } from "react";

type MediaSessionConfig = {
  source: "none" | "track" | "live";
  trackTitle: string | null;
  showName: string;
  liveNowPlaying: string | null;
  liveShowTitle: string | null;
  artworkUrl: string;
  onPlay: (() => void) | null;
  onPause: (() => void) | null;
  onNext: (() => void) | null;
  onPrev: (() => void) | null;
};

export function useMediaSession(config: MediaSessionConfig): void {
  const {
    source,
    trackTitle,
    showName,
    liveNowPlaying,
    liveShowTitle,
    artworkUrl,
    onPlay,
    onPause,
    onNext,
    onPrev,
  } = config;

  // Sync metadata and playback state
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    if (source === "none") {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      return;
    }

    if (source === "live") {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: liveNowPlaying || "Live Stream",
        artist: liveShowTitle || "Glue Factory Radio",
        album: "Glue Factory Radio - Live",
        artwork: [{ src: artworkUrl, sizes: "512x512", type: "image/png" }],
      });
      navigator.mediaSession.playbackState = "playing";
      return;
    }

    if (source === "track") {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: trackTitle || "Unknown Track",
        artist: showName,
        album: "Glue Factory Radio",
        artwork: [{ src: artworkUrl, sizes: "512x512", type: "image/png" }],
      });
      navigator.mediaSession.playbackState = "playing";
      return;
    }
  }, [source, trackTitle, showName, liveNowPlaying, liveShowTitle, artworkUrl]);

  // Sync action handlers
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    type ActionEntry = [MediaSessionAction, MediaSessionActionHandler | null];
    const handlers: ActionEntry[] = [];

    if (source === "live") {
      handlers.push(
        ["play", () => onPlay?.()],
        ["pause", () => onPause?.()],
        ["stop", () => onPause?.()],
        ["nexttrack", null],
        ["previoustrack", null],
      );
    } else if (source === "track") {
      handlers.push(
        [
          "play",
          () => {
            onPlay?.();
            navigator.mediaSession.playbackState = "playing";
          },
        ],
        [
          "pause",
          () => {
            onPause?.();
            navigator.mediaSession.playbackState = "paused";
          },
        ],
        [
          "stop",
          () => {
            onPause?.();
            navigator.mediaSession.playbackState = "paused";
          },
        ],
        ["nexttrack", () => onNext?.()],
        ["previoustrack", () => onPrev?.()],
      );
    } else {
      handlers.push(
        ["play", null],
        ["pause", null],
        ["stop", null],
        ["nexttrack", null],
        ["previoustrack", null],
      );
    }

    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browsers don't support all actions
      }
    }

    return () => {
      const actions: MediaSessionAction[] = [
        "play",
        "pause",
        "stop",
        "nexttrack",
        "previoustrack",
      ];
      for (const action of actions) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {}
      }
    };
  }, [source, onPlay, onPause, onNext, onPrev]);
}
