// Minimal type declarations for Google Cast SDK (Web Sender)
// Only the subset used by AudioProvider

declare namespace chrome {
  namespace cast {
    const AutoJoinPolicy: {
      ORIGIN_SCOPED: string;
    };

    class SessionRequest {
      constructor(appId: string);
    }

    namespace media {
      class MediaInfo {
        constructor(contentId: string, contentType: string);
        metadata: any;
        streamType: string;
      }

      class LoadRequest {
        constructor(mediaInfo: MediaInfo);
        autoplay: boolean;
        currentTime: number;
      }

      class MusicTrackMediaMetadata {
        title: string;
        albumName: string;
        artist: string;
        images: Image[];
      }

      const StreamType: {
        BUFFERED: string;
        LIVE: string;
      };
    }

    class Image {
      constructor(url: string);
    }
  }
}

declare namespace cast {
  namespace framework {
    class CastContext {
      static getInstance(): CastContext;
      setOptions(options: any): void;
      requestSession(): Promise<any>;
      getCurrentSession(): CastSession | null;
      addEventListener(type: string, handler: (event: any) => void): void;
      removeEventListener(type: string, handler: (event: any) => void): void;
    }

    class CastSession {
      loadMedia(request: chrome.cast.media.LoadRequest): Promise<any>;
      getSessionState(): string;
    }

    const CastContextEventType: {
      SESSION_STATE_CHANGED: string;
      CAST_STATE_CHANGED: string;
    };

    const CastState: {
      NO_DEVICES_AVAILABLE: string;
      NOT_CONNECTED: string;
      CONNECTING: string;
      CONNECTED: string;
    };

    const SessionState: {
      NO_SESSION: string;
      SESSION_STARTING: string;
      SESSION_STARTED: string;
      SESSION_START_FAILED: string;
      SESSION_ENDING: string;
      SESSION_ENDED: string;
      SESSION_RESUMED: string;
    };
  }
}

interface Window {
  __onGCastApiAvailable?: (isAvailable: boolean) => void;
  cast?: typeof cast;
  chrome?: typeof chrome & { cast?: typeof chrome.cast };
}
