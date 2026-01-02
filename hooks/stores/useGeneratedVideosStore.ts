import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from '@/lib/storage';

interface GeneratedVideosStoreState {
  // Generated videos state
  isGeneratedVideosEnabled: boolean;
  
  // Actions
  toggleGeneratedVideos: () => void;
  setGeneratedVideos: (enabled: boolean) => void;
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

export const useGeneratedVideosStore = create<GeneratedVideosStoreState>()(
  persist(
    (set) => ({
      // Initial state - generated videos is disabled by default
      isGeneratedVideosEnabled: false,
      
      // Toggle generated videos on/off
      toggleGeneratedVideos: () => {
        set((state) => ({ 
          isGeneratedVideosEnabled: !state.isGeneratedVideosEnabled 
        }));
      },
      
      // Set generated videos state explicitly
      setGeneratedVideos: (enabled: boolean) => {
        set({ isGeneratedVideosEnabled: enabled });
      },
    }),
    {
      name: 'generated-videos-store', // Storage key
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);

// Utility hook to get just the generated videos state
export function useIsGeneratedVideosEnabled() {
  return useGeneratedVideosStore(state => state.isGeneratedVideosEnabled);
}
