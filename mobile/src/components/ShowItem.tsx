import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Show } from '../types';

interface ShowItemProps {
  show: Show;
  onPress: (show: Show) => void;
}

export const ShowItem: React.FC<ShowItemProps> = ({ show, onPress }) => {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <TouchableOpacity style={styles.container} onPress={() => onPress(show)}>
      <View style={styles.content}>
        <Text style={styles.title}>{show.title}</Text>
        {show.description && (
          <Text style={styles.description} numberOfLines={2}>
            {show.description}
          </Text>
        )}
        <Text style={styles.meta}>
          {show.total_tracks} track{show.total_tracks !== 1 ? 's' : ''} • {formatDuration(show.total_duration)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  meta: {
    fontSize: 12,
    color: '#999',
  },
});

