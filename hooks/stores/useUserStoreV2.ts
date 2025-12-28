import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from '@/lib/storage';
import { queryClient, queryKeys } from '@/lib/queryClient';
import { 
  useUsers, 
  useCurrentUser, 
  useCreateUser, 
  useDeleteUser, 
  useUpdateUser
} from '@/hooks/queries/useUserQueries';
import { getAllUsers, getUserById } from '@/server/queries/users';
import type { UserSchema } from '@/db/schema';
import { z } from 'zod';

type User = z.infer<typeof UserSchema>;

interface UserStoreState {
  // Current user session state
  currentUserId: string | null;
  
  // UI state
  isInitialized: boolean;
  isInitializing: boolean;
  
  // Authentication/session actions
  switchUser: (userId: string) => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
  
  // User preference state
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    soundEnabled: boolean;
    language: string;
  };
  updatePreferences: (prefs: Partial<UserStoreState['preferences']>) => void;
  
  // Gamification state (derived from user data but cached for performance)
  cachedUserStats: {
    xp: number;
    level: number;
    streak: number;
    totalRoadmaps: number;
    completedRoadmaps: number;
  } | null;
  updateCachedStats: (stats: UserStoreState['cachedUserStats']) => void;
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

export const useUserStore = create<UserStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentUserId: null,
      isInitialized: false,
      isInitializing: false,
      
      preferences: {
        theme: 'system',
        notifications: true,
        soundEnabled: true,
        language: 'en',
      },
      
      cachedUserStats: null,
      
      // Actions
      initialize: async () => {
        const { isInitialized, isInitializing } = get();
        if (isInitialized || isInitializing) {
          console.log('UserStore: Already initialized, skipping...');
          return;
        }
        
        set({ isInitializing: true });
        
        try {
          console.log('UserStore: Starting initialization...');
          
          // Prefetch all users to warm the cache using queryClient directly
          await queryClient.prefetchQuery({
            queryKey: queryKeys.users.all,
            queryFn: getAllUsers,
            staleTime: 10 * 60 * 1000,
          });
          
          // Get users from React Query cache
          const users = queryClient.getQueryData(queryKeys.users.all) as User[] | undefined;
          console.log(`UserStore: Found ${users?.length || 0} users`);
          
          let targetUserId = get().currentUserId; // From persisted state
          
          // Validate the persisted user still exists
          if (targetUserId && users) {
            const userExists = users.some(u => u.id === targetUserId);
            if (!userExists) {
              console.log('UserStore: Persisted user no longer exists');
              targetUserId = null;
            }
          }
          
          // If no valid user, pick the first available
          if (!targetUserId && users && users.length > 0) {
            targetUserId = users[0].id;
            console.log('UserStore: Using first available user:', users[0].name);
          }
          
          // If still no users, we'll need to create one via the UI
          if (targetUserId) {
            // Prefetch the current user's details using queryClient directly
            await queryClient.prefetchQuery({
              queryKey: queryKeys.users.detail(targetUserId),
              queryFn: () => getUserById(targetUserId),
              staleTime: 10 * 60 * 1000,
            });
            
            // Update stats from user data
            const userData = queryClient.getQueryData(queryKeys.users.detail(targetUserId)) as User | undefined;
            if (userData) {
              set({ 
                cachedUserStats: {
                  xp: userData.xp || 0,
                  level: userData.level || 1,
                  streak: userData.currentStreak || 0,
                  totalRoadmaps: 0, // Will be updated by roadmap queries
                  completedRoadmaps: 0, // Will be updated by roadmap queries
                }
              });
            }
          }
          
          set({ 
            currentUserId: targetUserId,
            isInitialized: true,
            isInitializing: false 
          });
          
          console.log('UserStore: Initialization completed');
        } catch (error) {
          console.error('UserStore: Initialization failed:', error);
          set({ 
            isInitializing: false,
            isInitialized: false,
            currentUserId: null 
          });
          throw error;
        }
      },
      
      switchUser: async (userId: string) => {
        try {
          console.log('UserStore: Switching to user:', userId);
          
          // Prefetch the new user's data using queryClient directly
          await queryClient.prefetchQuery({
            queryKey: queryKeys.users.detail(userId),
            queryFn: () => getUserById(userId),
            staleTime: 10 * 60 * 1000,
          });
          
          // Update the current user
          set({ currentUserId: userId });
          
          // Update React Query's current user cache
          const userData = queryClient.getQueryData(queryKeys.users.detail(userId)) as User | undefined;
          if (userData) {
            queryClient.setQueryData(queryKeys.users.current(userId), userData);
            
            // Update cached stats
            set({ 
              cachedUserStats: {
                xp: userData.xp || 0,
                level: userData.level || 1,
                streak: userData.currentStreak || 0,
                totalRoadmaps: 0,
                completedRoadmaps: 0,
              }
            });
          }
          
          // Invalidate user-specific caches to load fresh data for new user
          queryClient.invalidateQueries({
            predicate: (query) => {
              const key = query.queryKey[0];
              return key === 'roadmaps' || key === 'topics';
            }
          });
          
          console.log('UserStore: User switch completed');
        } catch (error) {
          console.error('UserStore: Failed to switch user:', error);
          throw error;
        }
      },
      
      logout: () => {
        console.log('UserStore: Logging out');
        set({ 
          currentUserId: null, 
          cachedUserStats: null,
          isInitialized: false 
        });
        
        // Clear all React Query caches
        queryClient.clear();
      },
      
      updatePreferences: (newPrefs) => {
        set(state => ({
          preferences: { ...state.preferences, ...newPrefs }
        }));
      },
      
      updateCachedStats: (stats) => {
        set({ cachedUserStats: stats });
      },
    }),
    {
      name: 'user-store', // Storage key
      storage: createJSONStorage(() => zustandStorage),
      // Only persist these fields
      partialize: (state) => ({
        currentUserId: state.currentUserId,
        preferences: state.preferences,
      }),
      // Merge strategy for hydration
      merge: (persistedState, currentState) => {
        return {
          ...currentState,
          ...(persistedState as Partial<UserStoreState>),
          // Always start with fresh initialization state
          isInitialized: false,
          isInitializing: false,
          cachedUserStats: null,
        };
      },
    }
  )
);

// ============================================
// COMBINED HOOKS FOR EASY USAGE
// ============================================

/**
 * Hook that combines Zustand store with React Query for complete user management
 * Provides both the current user data and all user management functions
 */
export function useUserManagement() {
  const { 
    currentUserId, 
    isInitialized, 
    isInitializing,
    switchUser, 
    logout, 
    initialize,
    preferences,
    updatePreferences,
    cachedUserStats,
    updateCachedStats 
  } = useUserStore();
  
  // React Query hooks for data fetching
  const usersQuery = useUsers();
  const currentUserQuery = useCurrentUser(currentUserId || undefined);
  
  // React Query mutations
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  
  // Enhanced actions that combine Zustand + React Query
  const enhancedActions = {
    // Create user and auto-switch to it
    createUser: async (name: string) => {
      const newUser = await createUserMutation.mutateAsync(name);
      await switchUser(newUser.id);
      return newUser;
    },
    
    // Delete user with proper cleanup
    deleteUser: async (userId: string) => {
      const { currentUserId } = useUserStore.getState();
      
      // If deleting current user, switch to another user first
      if (userId === currentUserId) {
        const users = usersQuery.data || [];
        const remainingUsers = users.filter(u => u.id !== userId);
        if (remainingUsers.length > 0) {
          await switchUser(remainingUsers[0].id);
        } else {
          logout(); // No users left
        }
      }
      
      return deleteUserMutation.mutateAsync(userId);
    },
    
    // Update current user with stats caching
    updateCurrentUser: async (data: Partial<User>) => {
      if (!currentUserId) throw new Error('No current user');
      
      const updatedUser = await updateUserMutation.mutateAsync({ 
        userId: currentUserId, 
        data 
      });
      
      // Update cached stats if XP/level related fields changed
      if (data.xp !== undefined || data.level !== undefined || data.currentStreak !== undefined) {
        updateCachedStats({
          xp: updatedUser.xp || 0,
          level: updatedUser.level || 1,
          streak: updatedUser.currentStreak || 0,
          totalRoadmaps: cachedUserStats?.totalRoadmaps || 0,
          completedRoadmaps: cachedUserStats?.completedRoadmaps || 0,
        });
      }
      
      return updatedUser;
    },
  };
  
  return {
    // State
    currentUserId,
    currentUser: currentUserQuery.data,
    users: usersQuery.data || [],
    isInitialized,
    isInitializing,
    preferences,
    cachedUserStats,
    
    // Loading states
    isLoading: usersQuery.isLoading || currentUserQuery.isLoading,
    isError: usersQuery.isError || currentUserQuery.isError,
    error: usersQuery.error || currentUserQuery.error,
    
    // Mutation states
    isCreatingUser: createUserMutation.isPending,
    isUpdatingUser: updateUserMutation.isPending,
    isDeletingUser: deleteUserMutation.isPending,
    
    // Actions
    initialize,
    switchUser,
    logout,
    updatePreferences,
    updateCachedStats,
    
    // Enhanced actions
    ...enhancedActions,
    
    // Raw mutations for advanced usage
    mutations: {
      createUser: createUserMutation,
      updateUser: updateUserMutation,
      deleteUser: deleteUserMutation,
    },
    
    // Query refetch functions
    refetch: {
      users: usersQuery.refetch,
      currentUser: currentUserQuery.refetch,
    },
  };
}

// ============================================
// UTILITY HOOKS
// ============================================

/**
 * Simple hook to get just the current user ID
 */
export function useCurrentUserId() {
  return useUserStore(state => state.currentUserId);
}

/**
 * Hook to get current user preferences
 */
export function useUserPreferences() {
  const preferences = useUserStore(state => state.preferences);
  const updatePreferences = useUserStore(state => state.updatePreferences);
  return { preferences, updatePreferences };
}

/**
 * Hook to get cached user stats (for performance)
 */
export function useUserStats() {
  const stats = useUserStore(state => state.cachedUserStats);
  const updateStats = useUserStore(state => state.updateCachedStats);
  return { stats, updateStats };
}