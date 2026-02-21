// API service for connecting to Railway backend with persistent database
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://glue-factory-radio-production.up.railway.app';

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
  tags?: string[];
}

export interface UploadResponse {
  message: string;
  show: Show;
  file: {
    filename: string;
    originalName: string;
    size: number;
    url: string;
  };
}

export interface PageContent {
  id: number;
  page_name: string;
  content: string;
  updated_at: string;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Health check
  async checkHealth(): Promise<{ status: string; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  }

  // Get all shows
  async getShows(): Promise<Show[]> {
    const response = await fetch(`${this.baseUrl}/api/shows`);
    if (!response.ok) {
      throw new Error(`Failed to fetch shows: ${response.status}`);
    }
    return response.json();
  }

  // Get all uploaded files
  async getFiles(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/api/upload/files`);
    if (!response.ok) {
      throw new Error(`Failed to fetch files: ${response.status}`);
    }
    return response.json();
  }

  // Upload a new show
  async uploadShow(title: string, description: string, audioFile: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('audio', audioFile);

    const response = await fetch(`${this.baseUrl}/api/upload/audio`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }

    return response.json();
  }

  // Get the full URL for a show
  getShowUrl(filename: string): string {
    return `${this.baseUrl}/uploads/${filename}`;
  }

  // Get page content by name
  async getPageContent(pageName: string): Promise<PageContent> {
    const response = await fetch(`${this.baseUrl}/api/pages/${pageName}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch page content: ${response.status}`);
    }
    return response.json();
  }
}

// Create and export a singleton instance
export const apiService = new ApiService();

// Export the base URL for configuration
export { API_BASE_URL };
