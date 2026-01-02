import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { cacheInvalidation } from '@/lib/cacheInvalidation';
import { createSubtopics } from '@/server/queries/topics';
import type { TopicExplanation } from '@/lib/gemini';

/**
 * Mutation for updating subtopic performance
 * Invalidates all related caches to ensure consistency
 * Note: This is a placeholder - implement actual performance update function
 */
export function useUpdateSubtopicPerformance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      userId, 
      topicId, 
      subtopicId, 
      performance 
    }: { 
      userId: string; 
      topicId: string; 
      subtopicId: string; 
      performance: {
        correct: boolean;
        timeTaken: number;
        difficulty: string;
      };
    }) => {
      // TODO: Implement actual subtopic performance update
      console.log('Updating subtopic performance:', { userId, topicId, subtopicId, performance });
      return { userId, topicId, subtopicId };
    },
    onSuccess: ({ userId, topicId }) => {
      // Use centralized cache invalidation for comprehensive updates
      cacheInvalidation.invalidateTopicData(topicId, userId);
    },
  });
}

/**
 * Mutation for creating new subtopics
 * Invalidates topic and related roadmap caches
 */
export function useCreateSubtopics() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      topicId, 
      category, 
      explanation 
    }: { 
      topicId: string; 
      category: string; 
      explanation: TopicExplanation;
    }) => {
      await createSubtopics(topicId, category, explanation);
      return { topicId };
    },
    onSuccess: ({ topicId }) => {
      // Use centralized cache invalidation for comprehensive updates
      cacheInvalidation.invalidateTopicData(topicId);
    },
  });
}

/**
 * Helper to invalidate all caches related to a specific topic
 * Useful for manual cache invalidation when topic data changes externally
 */
export function useInvalidateTopicCaches() {
  const queryClient = useQueryClient();
  
  return (topicId: string, userId?: string) => {
    cacheInvalidation.invalidateTopicData(topicId, userId);
  };
}