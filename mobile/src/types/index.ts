export interface Track {
  id: number;
  show_id: number;
  title: string;
  filename: string;
  duration: number;
  file_size: number;
  track_order: number;
  upload_date: string;
  is_active: boolean;
  play_count: number;
  last_played?: string;
  url: string;
}

export interface Show {
  id: number;
  title: string;
  description?: string;
  created_date: string;
  is_active: boolean;
  total_duration: number;
  total_tracks: number;
  tracks: Track[];
}

