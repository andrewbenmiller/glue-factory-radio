import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Track } from '../types';

interface TrackItemProps {
  track: Track;
  isPlaying: boolean;
  onPress: (track: Track) => void;
}

export const TrackItem: React.FC<TrackItemProps> = ({ track, isPlaying, onPress }) => {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <TouchableOpacity
      style={[styles.container, isPlaying && styles.playingContainer]}
      onPress={() => onPress(track)}
    >
      <View style={styles.content}>
        <Text style={[styles.title, isPlaying && styles.playingTitle]}>
          {track.title}
        </Text>
        <Text style={styles.meta}>
          Track {track.track_order} • {formatDuration(track.duration)}
        </Text>
      </View>
      {isPlaying && <Text style={styles.playingIndicator}>▶</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  playingContainer: {
    backgroundColor: '#f0f0f0',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
    color: '#000',
  },
  playingTitle: {
    color: '#0066cc',
  },
  meta: {
    fontSize: 12,
    color: '#999',
  },
  playingIndicator: {
    fontSize: 16,
    color: '#0066cc',
    marginLeft: 8,
  },
});

