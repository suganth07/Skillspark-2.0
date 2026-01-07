import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '@/lib/storage';
import * as SecureStore from 'expo-secure-store';

export type WebSearchProvider = 'langsearch' | 'serper';

interface WebSearchProviderStoreState {
  // Current web search provider selection
  provider: WebSearchProvider;
  
  // Actions
  setProvider: (provider: WebSearchProvider) => Promise<void>;
  
  // Provider availability check
  isProviderAvailable: (provider: WebSearchProvider) => Promise<boolean>;
  
  // Refresh availability after key changes
  refreshAvailability: () => Promise<void>;
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

export const useWebSearchProviderStore = create<WebSearchProviderStoreState>()(
  persist(
    (set, get) => ({
      // Default to LangSearch
      provider: 'langsearch',
      
      setProvider: async (provider: WebSearchProvider) => {
        const isAvailable = await get().isProviderAvailable(provider);
        if (!isAvailable) {
          console.warn(`⚠️ Cannot switch to ${provider}: API key not configured`);
          return;
        }
        
        console.log(`🔄 Switching web search provider to: ${provider}`);
        set({ provider });
      },
      
      isProviderAvailable: async (provider: WebSearchProvider) => {
        try {
          if (provider === 'langsearch') {
            const key = await SecureStore.getItemAsync('api_key_langsearch');
            return !!(key && key.trim());
          }
          if (provider === 'serper') {
            const key = await SecureStore.getItemAsync('api_key_googleserper');
            return !!(key && key.trim());
          }
          return false;
        } catch (error) {
          console.error(`Failed to check ${provider} availability:`, error);
          return false;
        }
      },
      
      refreshAvailability: async () => {
        // This method can be called to trigger UI updates after key changes
        const currentProvider = get().provider;
        const isAvailable = await get().isProviderAvailable(currentProvider);
        
        if (!isAvailable) {
          // If current provider is no longer available, try to switch to the other one
          const otherProvider: WebSearchProvider = currentProvider === 'langsearch' ? 'serper' : 'langsearch';
          const otherAvailable = await get().isProviderAvailable(otherProvider);
          
          if (otherAvailable) {
            console.log(`Current provider ${currentProvider} unavailable, switching to ${otherProvider}`);
            set({ provider: otherProvider });
          }
        }
      },
    }),
    {
      name: 'web-search-provider-storage',
      storage: zustandStorage,
    }
  )
);

// Hooks for easy access
export const useWebSearchProvider = () => useWebSearchProviderStore((state) => state.provider);
export const useSetWebSearchProvider = () => useWebSearchProviderStore((state) => state.setProvider);
export const useIsWebSearchProviderAvailable = () => useWebSearchProviderStore((state) => state.isProviderAvailable);
export const useRefreshWebSearchProviderAvailability = () => useWebSearchProviderStore((state) => state.refreshAvailability);
