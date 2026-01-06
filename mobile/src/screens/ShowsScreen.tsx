import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { apiService } from "../services/api";
import { Show } from "../types";

export default function ShowsScreen() {
  const router = useRouter();
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.getShows();
        setShows(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading shows…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={shows}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/show/${item.id}`)}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>

            {!!item.description && (
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            <View style={styles.metaRow}>
              <Text style={styles.meta}>🎵 {item.total_tracks} tracks</Text>
              <Text style={styles.meta}>{formatDuration(item.total_duration)}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.muted}>No shows yet.</Text>
          </View>
        }
      />
    </View>
  );
}

function formatDuration(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return hrs > 0 ? `${hrs}h ${remMins}m` : `${mins}m`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0B0B" },
  listContent: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#222",
    padding: 14,
    borderRadius: 14,
  },
  cardTitle: { color: "#FF5F1F", fontSize: 18, fontWeight: "700", marginBottom: 6 },
  cardDesc: { color: "#C9C9C9", fontSize: 13, lineHeight: 18, marginBottom: 10 },
  metaRow: { flexDirection: "row", justifyContent: "space-between" },
  meta: { color: "#8D8D8D", fontSize: 12 },
  muted: { color: "#8D8D8D", marginTop: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0B0B0B" },
});
