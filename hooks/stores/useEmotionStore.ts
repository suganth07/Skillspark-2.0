import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from '@/lib/storage';

interface EmotionStoreState {
  // Emotion detection state
  isEmotionDetectionEnabled: boolean;
  
  // Actions
  toggleEmotionDetection: () => void;
  setEmotionDetection: (enabled: boolean) => void;
}

// Custom storage adapter for Zustand persist
const zustandStorage = {
  getItem: (name: string) => {
    try {
      const value = storage.getString(name);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: any) => {
    storage.set(name, JSON.stringify(value));
  },
  removeItem: (name: string) => {
    storage.delete(name);
  },
};

export const useEmotionStore = create<EmotionStoreState>()(
  persist(
    (set) => ({
      // Initial state - emotion detection is disabled by default
      isEmotionDetectionEnabled: false,
      
      // Toggle emotion detection on/off
      toggleEmotionDetection: () => {
        set((state) => ({ 
          isEmotionDetectionEnabled: !state.isEmotionDetectionEnabled 
        }));
      },
      
      // Set emotion detection state explicitly
      setEmotionDetection: (enabled: boolean) => {
        set({ isEmotionDetectionEnabled: enabled });
      },
    }),
    {
      name: 'emotion-detection-store', // Storage key
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);

// Utility hook to get just the emotion detection state
export function useIsEmotionDetectionEnabled() {
  return useEmotionStore(state => state.isEmotionDetectionEnabled);
}
