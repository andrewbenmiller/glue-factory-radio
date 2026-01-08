type IcecastSource = {
  listenurl?: string;
  title?: string;
  yp_currently_playing?: string;
  server_name?: string;
};

type IcecastStatus = {
  icestats?: {
    source?: IcecastSource | IcecastSource[];
  };
};

export function parseIcecastLiveStatus(
  data: IcecastStatus,
  mountPath = "/stream"
) {
  const sourcesRaw = data?.icestats?.source;

  const sources: IcecastSource[] = Array.isArray(sourcesRaw)
    ? sourcesRaw
    : sourcesRaw
    ? [sourcesRaw]
    : [];

  const match = sources.find((s) => {
    const url = s.listenurl ?? "";
    return url.endsWith(mountPath) || url.includes(mountPath);
  });

  return {
    isLive: Boolean(match),
    nowPlaying: match?.yp_currently_playing?.trim() || match?.title?.trim() || null,
    showTitle: match?.title?.trim() || null,
    source: match ?? null,
  };
}

