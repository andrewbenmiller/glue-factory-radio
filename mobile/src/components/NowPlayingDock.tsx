import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import { Track } from "../types";
import { apiService } from "../services/api";

type Props = {
  track: Track | null;
  onClose: () => void;

  onPrev?: () => void;
  onNext?: () => void;

  // Called only when the *current track finishes* (your show/next-show logic lives above this)
  onEnded?: () => void;

  trackIndex?: number;
  trackCount?: number;
};

export function NowPlayingDock({
  track,
  onClose,
  onPrev,
  onNext,
  onEnded,
  trackIndex,
  trackCount,
}: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const loadGenRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const [isOpen, setIsOpen] = useState(false);

  const screenH = Dimensions.get("window").height;
  const sheetH = Math.round(screenH / 3);
  const animY = useRef(new Animated.Value(sheetH)).current;

  const openSheet = useCallback(() => {
    setIsOpen(true);
    Animated.timing(animY, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [animY]);

  const closeSheet = useCallback(() => {
    Animated.timing(animY, {
      toValue: sheetH,
      duration: 160,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setIsOpen(false);
    });
  }, [animY, sheetH]);

  const unloadCurrent = useCallback(async () => {
    const s = soundRef.current;
    soundRef.current = null;
    if (s) {
      try { await s.stopAsync(); } catch {}
      try { await s.unloadAsync(); } catch {}
    }
  }, []);

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

  const loadAndPlay = useCallback(async () => {
    if (!track) return;

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
      {
        shouldPlay: true,
        positionMillis: 0,
        progressUpdateIntervalMillis: 250,
      }
    );

    if (myGen !== loadGenRef.current) {
      try { await sound.unloadAsync(); } catch {}
      return;
    }

    sound.setOnPlaybackStatusUpdate(updateFromStatus);
    soundRef.current = sound;
  }, [track, unloadCurrent, updateFromStatus]);

  useEffect(() => {
    loadAndPlay().catch(console.error);
    return () => {
      unloadCurrent().catch(() => {});
    };
  }, [loadAndPlay, unloadCurrent]);

  const togglePlayPause = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;

    const status = await sound.getStatusAsync();
    if (!status.isLoaded) return;

    if (status.isPlaying) {
      await sound.pauseAsync();
      return;
    }

    // If near end, restart (polish)
    const pos = status.positionMillis ?? 0;
    const dur = status.durationMillis ?? 0;
    const nearEnd = dur > 0 && pos >= dur - 500;
    if (nearEnd) {
      try { await sound.setPositionAsync(0); } catch {}
    }

    await sound.playAsync();
  }, []);

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const subtitle = useMemo(() => {
    if (typeof trackIndex === "number" && typeof trackCount === "number") {
      return `Track ${trackIndex + 1} of ${trackCount}`;
    }
    return "";
  }, [trackIndex, trackCount]);

  if (!track) return null;

  return (
    <>
      {/* MINI PLAYER (always visible, pinned bottom) */}
      <Pressable onPress={openSheet} style={styles.miniWrap}>
        <View style={styles.miniLeft}>
          <Text style={styles.miniTitle} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={styles.miniMeta} numberOfLines={1}>
            {subtitle || `${formatTime(position)} / ${formatTime(duration)}`}
          </Text>
        </View>

        <View style={styles.miniRight}>
          <Pressable onPress={togglePlayPause} style={styles.miniPlay}>
            <Text style={styles.miniPlayText}>{isPlaying ? "⏸" : "▶"}</Text>
          </Pressable>
        </View>
      </Pressable>

      {/* EXPANDED SHEET (1/3 screen) */}
      <Modal visible={isOpen} transparent animationType="none" onRequestClose={closeSheet}>
        <Pressable style={styles.backdrop} onPress={closeSheet} />

        <Animated.View
          style={[
            styles.sheet,
            { height: sheetH, transform: [{ translateY: animY }] },
          ]}
        >
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {track.title}
              </Text>
              {!!subtitle && <Text style={styles.sheetSubtitle}>{subtitle}</Text>}
              <Text style={styles.sheetTime}>
                {formatTime(position)} / {formatTime(duration)}
              </Text>
            </View>

            <Pressable onPress={closeSheet} style={styles.sheetClose}>
              <Text style={styles.sheetCloseText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.transportRow}>
            <Pressable
              onPress={onPrev}
              disabled={!onPrev}
              style={[styles.transportBtn, !onPrev && styles.disabled]}
            >
              <Text style={styles.transportIcon}>⏮</Text>
            </Pressable>

            <Pressable onPress={togglePlayPause} style={[styles.transportBtn, styles.transportCenter]}>
              <Text style={styles.transportIcon}>{isPlaying ? "⏸" : "▶"}</Text>
            </Pressable>

            <Pressable
              onPress={onNext}
              disabled={!onNext}
              style={[styles.transportBtn, !onNext && styles.disabled]}
            >
              <Text style={styles.transportIcon}>⏭</Text>
            </Pressable>
          </View>

          <Pressable onPress={onClose} style={styles.stopWrap}>
            <Text style={styles.stopText}>Stop</Text>
          </Pressable>
        </Animated.View>
      </Modal>
    </>
  );
}

const ORANGE = "#FF5F1F";

const styles = StyleSheet.create({
  miniWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,

    backgroundColor: "#0B0B0B",
    borderTopWidth: 1,
    borderTopColor: "#222",

    paddingHorizontal: 14,
    paddingVertical: 12,

    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  miniLeft: { flex: 1 },
  miniTitle: {
    color: ORANGE,
    fontSize: 14,
    fontWeight: "800",
  },
  miniMeta: {
    marginTop: 4,
    color: "#8D8D8D",
    fontSize: 12,
    fontWeight: "600",
  },
  miniRight: { justifyContent: "center", alignItems: "center" },
  miniPlay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  miniPlayText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "900",
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0B0B0B",
    borderTopWidth: 1,
    borderTopColor: "#222",
    padding: 16,
  },

  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  sheetTitle: {
    color: ORANGE,
    fontSize: 18,
    fontWeight: "900",
  },
  sheetSubtitle: {
    marginTop: 4,
    color: ORANGE,
    opacity: 0.9,
    fontSize: 13,
    fontWeight: "700",
  },
  sheetTime: {
    marginTop: 8,
    color: "#8D8D8D",
    fontSize: 12,
    fontWeight: "700",
  },
  sheetClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCloseText: {
    color: "#8D8D8D",
    fontSize: 20,
    fontWeight: "900",
  },

  transportRow: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  transportBtn: {
    flex: 1,
    height: 64,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  transportCenter: {
    backgroundColor: "#C94B12",
  },
  transportIcon: {
    color: "#000",
    fontSize: 30,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.5,
  },

  stopWrap: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 10,
  },
  stopText: {
    color: ORANGE,
    fontWeight: "800",
  },
});

