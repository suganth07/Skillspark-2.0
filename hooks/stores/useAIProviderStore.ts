import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '@/lib/storage';
import * as SecureStore from 'expo-secure-store';

export type AIProvider = 'gemini' | 'groq';

interface AIProviderStoreState {
  // Current AI provider selection
  provider: AIProvider;
  
  // Refresh key to trigger UI updates
  refreshKey: number;
  
  // Actions
  setProvider: (provider: AIProvider) => void;
  
  // Provider availability check (async)
  isProviderAvailable: (provider: AIProvider) => Promise<boolean>;
  
  // Refresh availability status
  refreshAvailability: () => Promise<void>;
}

// Custom storage adapter for Zustand persist (same pattern as useUserStore)
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

export const useAIProviderStore = create<AIProviderStoreState>()(
  persist(
    (set, get) => ({
      // Default to Gemini
      provider: 'gemini',
      
      // Initialize refresh key
      refreshKey: 0,
      
      setProvider: async (provider: AIProvider) => {
        const isAvailable = await get().isProviderAvailable(provider);
        if (!isAvailable) {
          console.warn(`⚠️ Cannot switch to ${provider}: API key not configured`);
          return;
        }
        
        console.log(`🔄 Switching AI provider to: ${provider}`);
        set({ provider });
      },
      
      isProviderAvailable: async (provider: AIProvider) => {
        try {
          if (provider === 'gemini') {
            const key = await SecureStore.getItemAsync('api_key_gemini');
            return !!(key && key.trim());
          }
          if (provider === 'groq') {
            const key = await SecureStore.getItemAsync('api_key_groq');
            return !!(key && key.trim());
          }
          return false;
        } catch (error) {
          console.error(`Failed to check ${provider} availability:`, error);
          return false;
        }
      },
      
      refreshAvailability: async () => {
        // Increment refresh key to trigger UI updates
        set((state) => ({ refreshKey: state.refreshKey + 1 }));
        
        // This method can be called to trigger UI updates after key changes
        const currentProvider = get().provider;
        const isAvailable = await get().isProviderAvailable(currentProvider);
        
        if (!isAvailable) {
          // If current provider is no longer available, try to switch to the other one
          const otherProvider: AIProvider = currentProvider === 'gemini' ? 'groq' : 'gemini';
          const otherAvailable = await get().isProviderAvailable(otherProvider);
          
          if (otherAvailable) {
            console.log(`Current provider ${currentProvider} unavailable, switching to ${otherProvider}`);
            set({ provider: otherProvider });
          }
        }
      },
    }),
    {
      name: 'ai-provider-storage',
      storage: zustandStorage,
    }
  )
);

// Hooks for easy access
export const useAIProvider = () => useAIProviderStore((state) => state.provider);
export const useSetAIProvider = () => useAIProviderStore((state) => state.setProvider);
export const useIsProviderAvailable = () => useAIProviderStore((state) => state.isProviderAvailable);
export const useRefreshProviderAvailability = () => useAIProviderStore((state) => state.refreshAvailability);
export const useAIProviderRefreshKey = () => useAIProviderStore((state) => state.refreshKey);
