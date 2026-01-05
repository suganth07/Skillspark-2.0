import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '@/lib/storage';

export type WebSearchProvider = 'langsearch' | 'serper';

interface WebSearchProviderStoreState {
  // Current web search provider selection
  provider: WebSearchProvider;
  
  // Actions
  setProvider: (provider: WebSearchProvider) => void;
  
  // Provider availability check
  isProviderAvailable: (provider: WebSearchProvider) => boolean;
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
      
      setProvider: (provider: WebSearchProvider) => {
        const isAvailable = get().isProviderAvailable(provider);
        if (!isAvailable) {
          console.warn(`⚠️ Cannot switch to ${provider}: API key not configured`);
          return;
        }
        
        console.log(`🔄 Switching web search provider to: ${provider}`);
        set({ provider });
      },
      
      isProviderAvailable: (provider: WebSearchProvider) => {
        if (provider === 'langsearch') {
          return !!process.env.EXPO_PUBLIC_LANG_SEARCH_API_KEY;
        }
        if (provider === 'serper') {
          return !!process.env.EXPO_PUBLIC_SERPER_API_KEY;
        }
        return false;
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
