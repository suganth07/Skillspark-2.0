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
// Note: createJSONStorage handles JSON serialization, so this adapter only handles raw strings
const zustandStorage = {
  getItem: (name: string): string | null => {
    try {
      const value = storage.getString(name);
      return value ?? null;
    } catch (error) {
      console.error(`Failed to get item '${name}' from storage:`, error);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      storage.set(name, value);
    } catch (error) {
      console.error(`Failed to set item '${name}' in storage:`, error);
    }
  },
  removeItem: (name: string) => {
    try {
      storage.delete(name);
    } catch (error) {
      console.error(`Failed to remove item '${name}' from storage:`, error);
    }
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
