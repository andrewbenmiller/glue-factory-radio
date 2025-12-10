import { create } from 'zustand';

interface PlayerState {
  currentShowIndex: number;
  currentTrackIndex: number;
  autoPlay: boolean;
  
  // Actions
  setShow: (showIndex: number) => void;
  setTrack: (trackIndex: number) => void;
  toggleAutoPlay: () => void;
  resetTrack: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentShowIndex: 0,
  currentTrackIndex: 0,
  autoPlay: true,
  
  setShow: (showIndex: number) => set({ 
    currentShowIndex: showIndex, 
    currentTrackIndex: 0 // Reset to first track when changing shows
  }),
  
  setTrack: (trackIndex: number) => {
    console.log('Zustand: setTrack called with:', trackIndex);
    set({ currentTrackIndex: trackIndex });
    console.log('Zustand: setTrack completed');
  },
  
  toggleAutoPlay: () => set((state) => ({ 
    autoPlay: !state.autoPlay 
  })),
  
  resetTrack: () => set({ 
    currentTrackIndex: 0 
  }),
}));
