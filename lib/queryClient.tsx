import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';

// Create a client with optimized caching defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Cache is kept for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Retry failed queries 2 times
      retry: 2,
      // Don't refetch on window focus for mobile
      refetchOnWindowFocus: false,
      // Don't refetch on reconnect automatically
      refetchOnReconnect: false,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

// Query Keys - centralized for cache management
export const queryKeys = {
  // Roadmaps
  roadmaps: {
    all: ['roadmaps'] as const,
    list: (userId: string) => ['roadmaps', 'list', userId] as const,
    detail: (roadmapId: string, userId: string) => ['roadmaps', 'detail', roadmapId, userId] as const,
  },
  // Quizzes
  quizzes: {
    all: ['quizzes'] as const,
    detail: (quizId: string) => ['quizzes', 'detail', quizId] as const,
  },
  // Topics
  topics: {
    all: ['topics'] as const,
    detail: (topicId: string, userId?: string) => 
      userId ? ['topics', 'detail', topicId, userId] as const : ['topics', 'detail', topicId] as const,
    subtopics: (topicId: string) => ['topics', 'subtopics', topicId] as const,
    performance: (userId: string, topicId: string) => ['topics', 'performance', userId, topicId] as const,
  },
  // Users
  users: {
    all: ['users'] as const,
    current: (userId: string) => ['users', 'current', userId] as const,
    detail: (userId: string) => ['users', 'detail', userId] as const,
  },
} as const;

// Provider component
interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
