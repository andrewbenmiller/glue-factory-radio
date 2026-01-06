import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import { Track } from "../types";
import { apiService } from "../services/api";

interface AudioPlayerProps {
  track: Track;
  onClose: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ track, onClose }) => {
  const soundRef = useRef<Audio.Sound | null>(null);
  const loadGenRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const updateFromStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setIsPlaying(Boolean(status.isPlaying));
    setPosition(status.positionMillis ?? 0);
    setDuration(status.durationMillis ?? 0);
  }, []);

  const unloadCurrent = useCallback(async () => {
    const s = soundRef.current;
    soundRef.current = null;
    if (s) {
      try {
        // stop first (prevents "ghost audio" in edge cases)
        await s.stopAsync();
      } catch {}
      try {
        await s.unloadAsync();
      } catch {}
    }
  }, []);

  const loadAndPlay = useCallback(async () => {
    loadGenRef.current += 1;
    const myGen = loadGenRef.current;

    // unload previous sound immediately
    await unloadCurrent();

    // NOTE: better to call this once at app startup, but safe here too.
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,

      // Use string values to avoid undefined enums in some expo-av builds
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
        progressUpdateIntervalMillis: 250, // updates UI 4x/sec without polling
      }
    );

    // If a newer track load started while we were awaiting, discard this one
    if (myGen !== loadGenRef.current) {
      try { await sound.unloadAsync(); } catch {}
      return;
    }

    sound.setOnPlaybackStatusUpdate(updateFromStatus);
    soundRef.current = sound;
  }, [track.filename, unloadCurrent, updateFromStatus]);

  useEffect(() => {
    loadAndPlay().catch((e) => console.error("Error loading audio:", e));
    return () => {
      // prevent late status updates + clean up
      unloadCurrent().catch(() => {});
    };
  }, [loadAndPlay, unloadCurrent]);

  const togglePlayPause = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;

    const status = await sound.getStatusAsync();
    if (!status.isLoaded) return;

    if (status.isPlaying) {
      await sound.pauseAsync(); // resumes from same position later
    } else {
      await sound.playAsync();
    }
    // UI will update via status callback
  }, []);

  const handleClose = useCallback(async () => {
    await unloadCurrent();
    onClose();
  }, [onClose, unloadCurrent]);

  const formatTime = (millis: number): string => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.trackTitle} numberOfLines={1}>
          {track.title}
        </Text>

        <View style={styles.controls}>
          <TouchableOpacity onPress={togglePlayPause} style={styles.playButton}>
            <Text style={styles.playButtonText}>{isPlaying ? "⏸" : "▶"}</Text>
          </TouchableOpacity>

          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>
              {formatTime(position)} / {formatTime(duration)}
            </Text>
          </View>

          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0B0B0B",
    borderTopWidth: 1,
    borderTopColor: "#222",
    padding: 16,

    // subtle elevation so it feels anchored, not floating
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 12,
  },

  content: {
    flex: 1,
  },

  trackTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    color: "#FF5F1F",
  },

  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FF5F1F",
    justifyContent: "center",
    alignItems: "center",
  },

  playButtonText: {
    fontSize: 20,
    color: "#000",
    fontWeight: "700",
  },

  timeContainer: {
    flex: 1,
    alignItems: "center",
  },

  timeText: {
    fontSize: 13,
    color: "#8D8D8D",
    fontVariant: ["tabular-nums"],
  },

  closeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },

  closeButtonText: {
    fontSize: 20,
    color: "#8D8D8D",
  },
});
