import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, Switch } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { apiService } from "../services/api";
import { Show, Track } from "../types";
import { NowPlayingDock } from "../components/NowPlayingDock";

export default function ShowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const showId = Number(id);

  const [shows, setShows] = useState<Show[]>([]);
  const [show, setShow] = useState<Show | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [continueToNextShow, setContinueToNextShow] = useState(false);

  useEffect(() => {
    (async () => {
      const allShows = await apiService.getShows();
      setShows(allShows);
      const found = allShows.find((s) => s.id === showId) || null;
      setShow(found);
    })();
  }, [showId]);

  const tracks = useMemo(() => show?.tracks ?? [], [show]);
  const trackCount = tracks.length;

  const currentIndex = currentTrack
    ? Math.max(
        0,
        tracks.findIndex((t) => t.id === currentTrack.id)
      )
    : 0;

  const showIndex = show ? shows.findIndex((s) => s.id === show.id) : -1;
  const isLast = trackCount === 0 ? true : currentIndex >= trackCount - 1;

  const handlePrev = () => {
    if (trackCount < 2) return;
    const nextIndex = (currentIndex - 1 + trackCount) % trackCount;
    setCurrentTrack(tracks[nextIndex]);
  };

  const handleNext = () => {
    if (trackCount < 2) return;
    if (currentIndex >= trackCount - 1) return; // stop at end
    setCurrentTrack(tracks[currentIndex + 1]);
  };

  const handleEnded = () => {
    // Not last track: always advance within show
    if (!isLast) {
      setCurrentTrack(tracks[currentIndex + 1]);
      return;
    }

    // Last track: toggle OFF => stop
    if (!continueToNextShow) return;

    // Toggle ON => first track of next show
    const nextShow = shows[showIndex + 1];
    if (!nextShow?.tracks?.length) return;

    // Navigate to next show - would need router.push or similar
    // For now, just set the track (would need to handle show navigation separately)
    setCurrentTrack(nextShow.tracks[0]);
  };

  if (!show) {
    return (
      <View style={styles.screen}>
        <Text style={styles.muted}>Loading show…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContent,
          // leave space for mini-player when it appears
          { paddingBottom: currentTrack ? 120 : 24 },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>
              {show.title}
            </Text>
            {!!show.description && (
              <Text style={styles.desc} numberOfLines={3}>
                {show.description}
              </Text>
            )}
            <Text style={styles.meta}>🎵 {show.total_tracks} tracks</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isActive = currentTrack?.id === item.id;
          return (
            <Pressable
              onPress={() => setCurrentTrack(item)}
              style={({ pressed }) => [
                styles.trackRow,
                isActive && styles.trackRowActive,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.trackNum}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.trackMeta}>
                  {formatDuration(item.duration)} • {Math.round(item.file_size / 1024 / 1024)} MB
                </Text>
              </View>
              <Text style={styles.playGlyph}>{isActive ? "⏸" : "▶"}</Text>
            </Pressable>
          );
        }}
      />

      {currentTrack ? (
        <View style={styles.playerControlsRow}>
          <Text style={styles.playerControlsLabel}>Continue to next show</Text>
          <Switch value={continueToNextShow} onValueChange={setContinueToNextShow} />
        </View>
      ) : null}

      {currentTrack && continueToNextShow ? (
        <Text style={styles.upNextText} numberOfLines={1}>
          Up next: {shows?.[showIndex + 1]?.title ?? "—"}
        </Text>
      ) : null}

      <NowPlayingDock
        track={currentTrack}
        onClose={() => setCurrentTrack(null)}
        onPrev={trackCount > 1 ? handlePrev : undefined}
        onNext={!isLast ? handleNext : undefined}
        onEnded={handleEnded}
        trackIndex={currentIndex}
        trackCount={trackCount}
      />
    </View>
  );
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0B0B" },
  listContent: { padding: 16, gap: 10 },
  header: { marginBottom: 10 },
  title: { color: "#FF5F1F", fontSize: 22, fontWeight: "800", marginBottom: 6 },
  desc: { color: "#C9C9C9", fontSize: 13, lineHeight: 18, marginBottom: 8 },
  meta: { color: "#8D8D8D", fontSize: 12 },
  muted: { color: "#8D8D8D", padding: 16 },

  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#222",
  },
  trackRowActive: {
    borderColor: "#FF5F1F",
  },
  trackNum: { color: "#8D8D8D", width: 28, fontVariant: ["tabular-nums"] as any },
  trackTitle: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  trackMeta: { color: "#8D8D8D", fontSize: 12, marginTop: 2 },
  playGlyph: { color: "#FF5F1F", fontSize: 16, width: 24, textAlign: "right" },

  miniPlayerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0B0B0B",
    borderTopWidth: 1,
    borderTopColor: "#222",
  },
  playerControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  playerControlsLabel: {
    color: "#FF5F1F",
    fontWeight: "700",
    fontSize: 14,
  },
  upNextText: {
    color: "#8D8D8D",
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 12,
  },
});
