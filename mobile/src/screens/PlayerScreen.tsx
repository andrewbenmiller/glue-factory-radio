import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { AudioPlayer } from "../components/AudioPlayer";
import { Track } from "../types";

interface PlayerScreenProps {
  tracks: Track[];
  initialIndex?: number;
  onClose?: () => void;
}

export default function PlayerScreen({ tracks, initialIndex = 0, onClose }: PlayerScreenProps) {
  const [index, setIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  const track = useMemo(() => tracks[index], [tracks, index]);
  const trackCount = tracks.length;

  const onPrev = useCallback(() => {
    setIndex((i) => (trackCount ? (i - 1 + trackCount) % trackCount : 0));
  }, [trackCount]);

  const onNext = useCallback(() => {
    setIndex((i) => (trackCount ? (i + 1) % trackCount : 0));
  }, [trackCount]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  if (loading || !track) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0B0B0B",
        }}
      >
        <ActivityIndicator color="#FF5F1F" />
      </View>
    );
  }

  return (
    <AudioPlayer
      track={track}
      onClose={handleClose}
      onPrev={trackCount > 1 ? onPrev : undefined}
      onNext={trackCount > 1 ? onNext : undefined}
      trackIndex={index}
      trackCount={trackCount}
    />
  );
}

