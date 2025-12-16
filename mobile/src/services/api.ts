import { Show } from '../types';

const API_BASE_URL = 'https://glue-factory-radio-production.up.railway.app';

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async getShows(): Promise<Show[]> {
    const response = await fetch(`${this.baseUrl}/api/shows`);
    if (!response.ok) {
      throw new Error(`Failed to fetch shows: ${response.status}`);
    }
    return response.json();
  }

  getAudioUrl(filename: string): string {
    return `${this.baseUrl}/api/audio/${filename}`;
  }
}

export const apiService = new ApiService();
export { API_BASE_URL };

