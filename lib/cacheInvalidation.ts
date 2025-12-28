import { queryClient, queryKeys } from './queryClient';

/**
 * Service for managing cross-cache invalidation patterns
 * Ensures data consistency across roadmaps, topics, and subtopics
 */
export class CacheInvalidationService {
  /**
   * Invalidates all caches related to a specific user's roadmaps
   * Use when user data changes globally
   */
  static invalidateUserData(userId: string) {
    // Roadmap caches
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.roadmaps.list(userId) 
    });
    
    queryClient.invalidateQueries({
      predicate: (query) => {
        return query.queryKey[0] === 'roadmaps' && 
               query.queryKey[1] === 'detail' &&
               query.queryKey[3] === userId; // userId is 4th parameter
      }
    });
    
    // Topic performance caches for this user
    queryClient.invalidateQueries({
      predicate: (query) => {
        return query.queryKey[0] === 'topics' && 
               query.queryKey[1] === 'performance' &&
               query.queryKey[2] === userId;
      }
    });
  }

  /**
   * Invalidates all caches related to a specific roadmap
   * Includes topics and subtopics that are part of the roadmap
   */
  static async invalidateRoadmapData(roadmapId: string, userId: string) {
    try {
      // Get roadmap details to find affected topics
      const roadmapQuery = queryClient.getQueryData(
        queryKeys.roadmaps.detail(roadmapId, userId)
      ) as any;
      
      let affectedTopicIds: string[] = [];
      
      if (roadmapQuery?.steps) {
        const topicIds = roadmapQuery.steps
          .map((step: any) => step.topicId)
          .filter((id: any): id is string => Boolean(id) && typeof id === 'string');
        affectedTopicIds = Array.from(new Set(topicIds));
      }
      
      // Invalidate roadmap caches
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.roadmaps.detail(roadmapId, userId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.roadmaps.list(userId) 
      });
      
      // Invalidate related topic caches
      affectedTopicIds.forEach(topicId => {
        this.invalidateTopicData(topicId, userId);
      });
      
      // Invalidate quiz caches related to this roadmap
      queryClient.invalidateQueries({
        predicate: (query) => {
          return query.queryKey[0] === 'quizzes' && 
                 query.queryKey.some(key => key === roadmapId);
        }
      });
      
    } catch (error) {
      console.warn('Cache invalidation fallback - invalidating broader scope:', error);
      // Fallback to broader invalidation
      this.invalidateUserData(userId);
    }
  }

  /**
   * Invalidates all caches related to a specific topic
   * Includes subtopics and any roadmaps containing this topic
   */
  static invalidateTopicData(topicId: string, userId?: string) {
    // Topic-specific caches
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.topics.detail(topicId) 
    });
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.topics.subtopics(topicId) 
    });
    
    if (userId) {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.topics.performance(userId, topicId) 
      });
    }
    
    // Find and invalidate roadmaps that contain this topic
    queryClient.invalidateQueries({
      predicate: (query) => {
        return query.queryKey[0] === 'roadmaps' && 
               query.queryKey[1] === 'detail';
      }
    });
  }

  /**
   * Handles quiz submission invalidation across all related caches
   * This is the most complex invalidation pattern as it affects multiple entities
   */
  static async invalidateQuizSubmission(
    userId: string, 
    quizId: string, 
    roadmapId?: string,
    topicId?: string
  ) {
    // Always invalidate user's roadmap list for progress updates
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.roadmaps.list(userId) 
    });
    
    // Invalidate quiz cache
    if (quizId) {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.quizzes.detail(quizId) 
      });
    }
    
    // Invalidate roadmap if provided
    if (roadmapId) {
      await this.invalidateRoadmapData(roadmapId, userId);
    }
    
    // Invalidate topic if provided
    if (topicId) {
      this.invalidateTopicData(topicId, userId);
    }
    
    // If we don't have specific IDs, do a broader invalidation
    if (!roadmapId && !topicId) {
      this.invalidateUserData(userId);
    }
  }

  /**
   * Cleans up all caches for a deleted roadmap
   * Removes rather than invalidates for better memory usage
   */
  static async cleanupDeletedRoadmap(roadmapId: string, userId: string) {
    try {
      // Get roadmap data before deletion for cleanup
      const roadmapQuery = queryClient.getQueryData(
        queryKeys.roadmaps.detail(roadmapId, userId)
      ) as any;
      
      let affectedTopicIds: string[] = [];
      
      if (roadmapQuery?.steps) {
        const topicIds = roadmapQuery.steps
          .map((step: any) => step.topicId)
          .filter((id: any): id is string => Boolean(id) && typeof id === 'string');
        affectedTopicIds = Array.from(new Set(topicIds));
      }
      
      // Remove roadmap caches
      queryClient.removeQueries({ 
        queryKey: queryKeys.roadmaps.detail(roadmapId, userId) 
      });
      
      // Update roadmap list optimistically
      queryClient.setQueryData(
        queryKeys.roadmaps.list(userId),
        (old: any[]) => old?.filter(r => r.id !== roadmapId)
      );
      
      // Clean up topic caches only if they're not used by other roadmaps
      // Note: In a real app, you'd check if topics are used elsewhere
      affectedTopicIds.forEach(topicId => {
        // For now, just invalidate rather than remove
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.topics.detail(topicId) 
        });
      });
      
      // Remove quiz caches related to this roadmap
      queryClient.removeQueries({
        predicate: (query) => {
          return query.queryKey[0] === 'quizzes' && 
                 query.queryKey.some(key => key === roadmapId);
        }
      });
      
    } catch (error) {
      console.warn('Cache cleanup fallback - using invalidation:', error);
      // Fallback to invalidation if removal fails
      this.invalidateUserData(userId);
    }
  }

  /**
   * Prefetches related data when navigating between roadmaps and topics
   * Improves perceived performance by loading likely-needed data
   */
  static async prefetchRelatedData(userId: string, roadmapId?: string, topicId?: string) {
    if (roadmapId) {
      // Prefetch roadmap details
      queryClient.prefetchQuery({
        queryKey: queryKeys.roadmaps.detail(roadmapId, userId),
        staleTime: 2 * 60 * 1000,
      });
    }
    
    if (topicId) {
      // Prefetch topic details and subtopics
      queryClient.prefetchQuery({
        queryKey: queryKeys.topics.detail(topicId),
        staleTime: 10 * 60 * 1000,
      });
      
      queryClient.prefetchQuery({
        queryKey: queryKeys.topics.subtopics(topicId),
        staleTime: 15 * 60 * 1000,
      });
      
      if (userId) {
        queryClient.prefetchQuery({
          queryKey: queryKeys.topics.performance(userId, topicId),
          staleTime: 2 * 60 * 1000,
        });
      }
    }
  }
}

// Export singleton instance
export const cacheInvalidation = CacheInvalidationService;