import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ImageBackground,
  Dimensions,
} from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import { Track } from "../types";
import { apiService } from "../services/api";

interface AudioPlayerProps {
  track: Track;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onEnded?: () => void;
  trackIndex?: number; // 0-based
  trackCount?: number;
  backgroundImageUri?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  track,
  onClose,
  onPrev,
  onNext,
  onEnded,
  trackIndex,
  trackCount,
  backgroundImageUri,
}) => {
  const soundRef = useRef<Audio.Sound | null>(null);
  const loadGenRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const updateFromStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;

      setIsPlaying(Boolean(status.isPlaying));
      setPosition(status.positionMillis ?? 0);
      setDuration(status.durationMillis ?? 0);

      if ((status as any).didJustFinish) {
        onEnded?.();
      }
    },
    [onEnded]
  );

  const unloadCurrent = useCallback(async () => {
    const s = soundRef.current;
    soundRef.current = null;
    if (s) {
      try { await s.stopAsync(); } catch {}
      try { await s.unloadAsync(); } catch {}
    }
  }, []);

  const loadAndPlay = useCallback(async () => {
    loadGenRef.current += 1;
    const myGen = loadGenRef.current;

    await unloadCurrent();

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: "DoNotMix" as any,
      interruptionModeAndroid: "DuckOthers" as any,
      shouldDuckAndroid: true,
    });

    const uri = apiService.getAudioUrl(track.filename);

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, positionMillis: 0, progressUpdateIntervalMillis: 250 }
    );

    if (myGen !== loadGenRef.current) {
      try { await sound.unloadAsync(); } catch {}
      return;
    }

    sound.setOnPlaybackStatusUpdate(updateFromStatus);
    soundRef.current = sound;
  }, [track.filename, unloadCurrent, updateFromStatus]);

  useEffect(() => {
    loadAndPlay().catch((e) => console.error("Error loading audio:", e));
    return () => { unloadCurrent().catch(() => {}); };
  }, [loadAndPlay, unloadCurrent]);

  const togglePlayPause = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;

    const status = await sound.getStatusAsync();
    if (!status.isLoaded) return;

    if (status.isPlaying) await sound.pauseAsync();
    else await sound.playAsync();
  }, []);

  const heroTitle = "Glue Factory Radio";

  const subtitle = useMemo(() => {
    if (typeof trackIndex === "number" && typeof trackCount === "number") {
      return `Track ${trackIndex + 1} of ${trackCount}`;
    }
    return "";
  }, [trackIndex, trackCount]);

  const byline = useMemo(() => {
    return track?.title ?? "";
  }, [track]);

  const buttonSize = Math.min(140, Math.floor((Dimensions.get("window").width - 64) / 3));

  const Body = (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>{heroTitle}</Text>
        {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
        <Text style={styles.headerByline} numberOfLines={1}>{byline}</Text>
      </View>

      <View style={[styles.transportRow, { gap: 16 }]}>
        <Pressable
          onPress={onPrev}
          disabled={!onPrev}
          style={({ pressed }) => [
            styles.transportBtn,
            { width: buttonSize, height: buttonSize, opacity: !onPrev ? 0.5 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <Text style={styles.transportIcon}>⏮</Text>
        </Pressable>

        <Pressable
          onPress={togglePlayPause}
          style={({ pressed }) => [
            styles.transportBtn,
            styles.transportBtnCenter,
            { width: buttonSize, height: buttonSize, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <Text style={styles.transportIcon}>{isPlaying ? "⏸" : "▶"}</Text>
        </Pressable>

        <Pressable
          onPress={onNext}
          disabled={!onNext}
          style={({ pressed }) => [
            styles.transportBtn,
            { width: buttonSize, height: buttonSize, opacity: !onNext ? 0.5 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <Text style={styles.transportIcon}>⏭</Text>
        </Pressable>
      </View>

      {/* Optional: keep a tiny close hit-area somewhere unobtrusive */}
      <Pressable onPress={onClose} style={styles.closeHit}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
    </View>
  );

  if (backgroundImageUri) {
    return (
      <ImageBackground
        source={{ uri: backgroundImageUri }}
        style={styles.bg}
        imageStyle={styles.bgImg}
      >
        <View style={styles.bgOverlay} />
        {Body}
      </ImageBackground>
    );
  }

  return <View style={[styles.bg, { backgroundColor: "#0B0B0B" }]}>{Body}</View>;
};

const ORANGE = "#FF5F1F";

const styles = StyleSheet.create({
  bg: { flex: 1 },
  bgImg: { resizeMode: "cover" },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  screen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    justifyContent: "center",
  },

  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: ORANGE,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "700",
    color: ORANGE,
    opacity: 0.95,
  },
  headerByline: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: "800",
    color: ORANGE,
    textAlign: "center",
  },

  transportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    alignSelf: "center",
  },

  transportBtn: {
    backgroundColor: ORANGE,
    justifyContent: "center",
    alignItems: "center",
  },
  transportBtnCenter: {
    backgroundColor: "#C94B12", // slightly darker middle block like your screenshot
  },
  transportIcon: {
    fontSize: 52,
    color: "#000",
    fontWeight: "900",
  },

  closeHit: {
    position: "absolute",
    top: 18,
    right: 16,
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  closeText: {
    fontSize: 22,
    color: ORANGE,
    opacity: 0.85,
    fontWeight: "800",
  },
});
