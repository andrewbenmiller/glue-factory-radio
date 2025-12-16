import React, { useEffect, useState } from 'react';
import { View, FlatList, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { TrackItem } from '../components/TrackItem';
import { Show, Track } from '../types';
import { apiService } from '../services/api';
import { AudioPlayer } from '../components/AudioPlayer';

export default function ShowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [show, setShow] = useState<Show | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);

  useEffect(() => {
    loadShow();
  }, [id]);

  const loadShow = async () => {
    try {
      setLoading(true);
      setError(null);
      const shows = await apiService.getShows();
      const foundShow = shows.find((s) => s.id.toString() === id);
      if (foundShow) {
        setShow(foundShow);
      } else {
        setError('Show not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load show');
    } finally {
      setLoading(false);
    }
  };

  const handleTrackPress = (track: Track) => {
    setCurrentTrack(track);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading show...</Text>
      </View>
    );
  }

  if (error || !show) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          {error || 'Show not found'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{show.title}</Text>
        {show.description && (
          <Text style={styles.description}>{show.description}</Text>
        )}
        <Text style={styles.meta}>
          {show.total_tracks} track{show.total_tracks !== 1 ? 's' : ''}
        </Text>
      </View>
      <FlatList
        data={show.tracks}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TrackItem
            track={item}
            isPlaying={currentTrack?.id === item.id}
            onPress={handleTrackPress}
          />
        )}
        contentContainerStyle={styles.listContent}
      />
      {currentTrack && (
        <AudioPlayer
          track={currentTrack}
          onClose={() => setCurrentTrack(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  meta: {
    fontSize: 14,
    color: '#999',
  },
  listContent: {
    paddingBottom: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    padding: 16,
  },
});

