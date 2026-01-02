import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '@/lib/storage';

export type AIProvider = 'gemini' | 'groq';

interface AIProviderStoreState {
  // Current AI provider selection
  provider: AIProvider;
  
  // Actions
  setProvider: (provider: AIProvider) => void;
  
  // Provider availability check
  isProviderAvailable: (provider: AIProvider) => boolean;
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
      
      setProvider: (provider: AIProvider) => {
        const isAvailable = get().isProviderAvailable(provider);
        if (!isAvailable) {
          console.warn(`⚠️ Cannot switch to ${provider}: API key not configured`);
          return;
        }
        
        console.log(`🔄 Switching AI provider to: ${provider}`);
        set({ provider });
      },
      
      isProviderAvailable: (provider: AIProvider) => {
        if (provider === 'gemini') {
          return !!process.env.EXPO_PUBLIC_GEMINI_API_KEY;
        }
        if (provider === 'groq') {
          return !!process.env.EXPO_PUBLIC_GROQ_API_KEY;
        }
        return false;
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
