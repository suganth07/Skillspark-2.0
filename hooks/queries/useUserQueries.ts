import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { cacheInvalidation } from '@/lib/cacheInvalidation';
import { 
  getAllUsers, 
  getUserById, 
  createUser, 
  deleteUser, 
  updateUser 
} from '@/server/queries/users';
import type { UserSchema } from '@/db/schema';
import type { z } from 'zod';

type User = z.infer<typeof UserSchema>;

// ============================================
// QUERY HOOKS FOR USER DATA
// ============================================

/**
 * Hook to fetch all users
 * Used for user management and selection
 */
export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: getAllUsers,
    staleTime: 10 * 60 * 1000, // Fresh for 10 minutes (users don't change often)
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

/**
 * Hook to fetch current user details
 */
export function useCurrentUser(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? queryKeys.users.current(userId) : ['users', 'current', 'none'],
    queryFn: () => getUserById(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Fresh for 5 minutes
    gcTime: 20 * 60 * 1000, // Keep in cache for 20 minutes
  });
}

/**
 * Hook to fetch specific user by ID
 */
export function useUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['users', 'detail', userId],
    queryFn: () => getUserById(userId!),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // Fresh for 10 minutes
  });
}

// ============================================
// MUTATION HOOKS FOR USER ACTIONS
// ============================================

/**
 * Hook to create a new user
 * Invalidates user cache and handles optimistic updates
 */
export function useCreateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (name: string) => {
      const newUser = await createUser(name);
      return newUser;
    },
    onMutate: async (name: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.users.all });
      
      // Snapshot the previous value
      const previousUsers = queryClient.getQueryData<User[]>(queryKeys.users.all);
      
      // Optimistically update to the new value
      const tempUser: User = {
        id: `temp-${Date.now()}`,
        name,
        avatarUrl: null,
        xp: 0,
        level: 1,
        currentStreak: 0,
        isOnboarded: false,
        createdAt: new Date(),
      };
      
      queryClient.setQueryData<User[]>(
        queryKeys.users.all,
        (old) => [...(old || []), tempUser]
      );
      
      return { previousUsers, tempUser };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousUsers) {
        queryClient.setQueryData(queryKeys.users.all, context.previousUsers);
      }
    },
    onSuccess: (newUser, variables, context) => {
      // Update the optimistic entry with real data
      queryClient.setQueryData<User[]>(
        queryKeys.users.all,
        (old) => {
          if (!old) return [newUser];
          return old.map(user => 
            user.id === context?.tempUser?.id ? newUser : user
          );
        }
      );
      
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

/**
 * Hook to update user details
 * Handles profile updates, XP, level changes, etc.
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: Partial<User> }) => {
      const updatedUser = await updateUser(userId, data);
      return updatedUser;
    },
    onMutate: async ({ userId, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.users.all });
      await queryClient.cancelQueries({ queryKey: ['users', 'detail', userId] });
      
      // Snapshot the previous values
      const previousUsers = queryClient.getQueryData<User[]>(queryKeys.users.all);
      const previousUser = queryClient.getQueryData<User>(['users', 'detail', userId]);
      
      // Optimistically update user in the list
      queryClient.setQueryData<User[]>(
        queryKeys.users.all,
        (old) => old?.map(user => 
          user.id === userId ? { ...user, ...data } : user
        ) || []
      );
      
      // Optimistically update individual user cache
      queryClient.setQueryData(['users', 'detail', userId], (old: User | undefined) => 
        old ? { ...old, ...data } : undefined
      );
      
      // Update current user cache if it's the same user
      const currentUserKey = queryKeys.users.current(userId);
      const currentUser = queryClient.getQueryData<User>(currentUserKey);
      if (currentUser) {
        queryClient.setQueryData(currentUserKey, { ...currentUser, ...data });
      }
      
      return { previousUsers, previousUser };
    },
    onError: (err, { userId }, context) => {
      // Rollback on error
      if (context?.previousUsers) {
        queryClient.setQueryData(queryKeys.users.all, context.previousUsers);
      }
      if (context?.previousUser) {
        queryClient.setQueryData(['users', 'detail', userId], context.previousUser);
      }
    },
    onSuccess: (updatedUser, { userId }) => {
      // Update all related caches with fresh data
      queryClient.setQueryData<User[]>(
        queryKeys.users.all,
        (old) => old?.map(user => user.id === userId ? updatedUser : user) || []
      );
      
      queryClient.setQueryData(['users', 'detail', userId], updatedUser);
      
      // Update current user if it matches
      const currentUserKey = queryKeys.users.current(userId);
      const currentUser = queryClient.getQueryData<User>(currentUserKey);
      if (currentUser) {
        queryClient.setQueryData(currentUserKey, updatedUser);
      }
      
      // Invalidate user-related caches across the app
      cacheInvalidation.invalidateUserData(userId);
    },
  });
}

/**
 * Hook to delete a user
 * Handles cleanup of all related data
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId: string) => {
      await deleteUser(userId);
      return userId;
    },
    onMutate: async (userId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.users.all });
      
      // Snapshot the previous value
      const previousUsers = queryClient.getQueryData<User[]>(queryKeys.users.all);
      
      // Optimistically remove from cache
      queryClient.setQueryData<User[]>(
        queryKeys.users.all,
        (old) => old?.filter(user => user.id !== userId) || []
      );
      
      return { previousUsers };
    },
    onError: (err, userId, context) => {
      // Rollback on error
      if (context?.previousUsers) {
        queryClient.setQueryData(queryKeys.users.all, context.previousUsers);
      }
    },
    onSuccess: (userId) => {
      // Clean up all caches related to this user
      queryClient.removeQueries({ queryKey: ['users', 'detail', userId] });
      
      // Clean up user's data across the app
      cacheInvalidation.invalidateUserData(userId);
      
      // Ensure users list is updated
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

// ============================================
// PREFETCH HELPERS (Non-hook utilities)
// ============================================

/**
 * Prefetch user details (useful for user switching)
 * NOTE: Pass queryClient instance to avoid hook call issues
 */
export function createPrefetchUser(queryClient: any) {
  return (userId: string) => {
    return queryClient.prefetchQuery({
      queryKey: ['users', 'detail', userId],
      queryFn: () => getUserById(userId),
      staleTime: 10 * 60 * 1000,
    });
  };
}

/**
 * Prefetch all users (useful for settings screen)
 * NOTE: Pass queryClient instance to avoid hook call issues
 */
export function createPrefetchAllUsers(queryClient: any) {
  return () => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.users.all,
      queryFn: getAllUsers,
      staleTime: 10 * 60 * 1000,
    });
  };
}