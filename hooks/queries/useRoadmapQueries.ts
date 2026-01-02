import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, queryClient } from '@/lib/queryClient';
import { cacheInvalidation } from '@/lib/cacheInvalidation';
import { 
  getUserRoadmaps, 
  getRoadmapWithSteps, 
  createRoadmap,
  createPrerequisiteQuiz,
  deleteRoadmap,
  getQuizWithQuestions,
  submitQuizAttempt,
  updateStepCompletion,
  getCompletedTopicsForUpdates 
} from '@/server/queries/roadmaps';
import { getSubtopics, createSubtopics } from '@/server/queries/topics';
import { geminiService, type KnowledgeGraph } from '@/lib/gemini';
import { checkMultipleTopicsForUpdates } from '@/server/langSearchClient';
import type { RoadmapWithProgress, RoadmapStep } from '@/server/queries/roadmaps';

// ============================================
// QUERY HOOKS (for fetching data)
// ============================================

/**
 * Hook to fetch user's roadmaps with progress
 * Automatically caches and refetches when needed
 */
export function useUserRoadmaps(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.roadmaps.list(userId || ''),
    queryFn: () => getUserRoadmaps(userId!),
    enabled: !!userId, // Only run when userId is available
    staleTime: 5 * 60 * 1000, // Fresh for 5 minutes
  });
}

/**
 * Hook to fetch roadmap details with steps
 * Uses stale-while-revalidate pattern
 */
export function useRoadmapDetails(roadmapId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.roadmaps.detail(roadmapId || '', userId || ''),
    queryFn: () => getRoadmapWithSteps(roadmapId!, userId!),
    enabled: !!roadmapId && !!userId,
    staleTime: 2 * 60 * 1000, // Fresh for 2 minutes (roadmap details change more often)
  });
}

/**
 * Hook to fetch quiz with questions
 */
export function useQuiz(quizId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.quizzes.detail(quizId || ''),
    queryFn: () => getQuizWithQuestions(quizId!),
    enabled: !!quizId,
    staleTime: 10 * 60 * 1000, // Fresh for 10 minutes (quiz content rarely changes)
  });
}

// ============================================
// MUTATION HOOKS (for creating/updating/deleting)
// ============================================

/**
 * Hook to generate a complete roadmap with AI
 * Invalidates roadmaps cache on success
 */
export function useGenerateRoadmap() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, topic }: { userId: string; topic: string }) => {
      console.log(`🚀 Starting roadmap generation for topic: ${topic}`);
      
      // Step 1: Generate knowledge graph using Gemini
      const knowledgeGraph = await geminiService.generateKnowledgeGraph(topic);
      console.log(`✅ Knowledge graph generated with ${knowledgeGraph.prerequisites.length} prerequisites`);
      
      // Step 2: Create roadmap and store in database
      const roadmapId = await createRoadmap(userId, knowledgeGraph);
      console.log(`📚 Roadmap creation complete for topic: ${topic}`);
      
      return roadmapId;
    },
    onSuccess: (_, variables) => {
      // Invalidate roadmaps list to trigger refetch
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.roadmaps.list(variables.userId) 
      });
    },
    onError: (error) => {
      console.error('❌ Failed to generate roadmap:', error);
    },
  });
}

/**
 * Hook to generate quiz for a prerequisite
 */
export function useGenerateQuiz() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      userId, 
      roadmapId, 
      stepId, 
      prerequisiteName 
    }: { 
      userId: string; 
      roadmapId: string; 
      stepId: string; 
      prerequisiteName: string;
    }) => {
      // Get the roadmap to find the topic
      const { roadmap, steps } = await getRoadmapWithSteps(roadmapId, userId);
      const step = steps.find(s => s.id === stepId);
      
      if (!step) {
        throw new Error('Step not found');
      }
      
      if (!step.topicId) {
        throw new Error(`Step "${step.title || stepId}" is missing a topicId.`);
      }
      
      // Get subtopics for this topic
      const subtopics = await getSubtopics(step.topicId);
      
      let quizId: string;
      
      if (subtopics.length > 0) {
        console.log(`🎯 Generating quiz with ${subtopics.length} subtopics for ${prerequisiteName}`);
        
        const subtopicsData = subtopics.map((st: any) => ({
          id: st.id,
          name: st.name,
          description: st.description || ''
        }));
        
        const questions = await geminiService.generateQuizQuestionsFromSubtopics(
          prerequisiteName,
          subtopicsData,
          step.difficulty || 'intermediate',
          roadmap.title
        );
        
        const prerequisite = {
          id: `temp-${Date.now()}`,
          name: prerequisiteName,
          description: step.content || `Learn ${prerequisiteName}`,
          difficulty: step.difficulty || 'intermediate',
          estimatedHours: Math.ceil((step.durationMinutes || 120) / 60),
          topics: [],
          order: step.order || 1
        };
        
        quizId = await createPrerequisiteQuiz(roadmapId, prerequisite, step.topicId, questions);
        console.log(`✅ Quiz created with questions from ${subtopics.length} subtopics`);
      } else {
        // Generate subtopics first
        console.log(`⚠️ No subtopics found for ${prerequisiteName}, generating first`);
        
        const topicExplanation = await geminiService.generateTopicExplanation(
          prerequisiteName, 
          roadmap.title
        );
        
        const topicCategory = roadmap.title.split(' ')[0] || 'General';
        await createSubtopics(step.topicId, topicCategory, topicExplanation);
        
        const newSubtopics = await getSubtopics(step.topicId);
        
        const subtopicsData = newSubtopics.map((st: any) => ({
          id: st.id,
          name: st.name,
          description: st.description || ''
        }));
        
        const questions = await geminiService.generateQuizQuestionsFromSubtopics(
          prerequisiteName,
          subtopicsData,
          step.difficulty || 'intermediate',
          roadmap.title
        );
        
        const prerequisite = {
          id: `temp-${Date.now()}`,
          name: prerequisiteName,
          description: step.content || `Learn ${prerequisiteName}`,
          difficulty: step.difficulty || 'intermediate',
          estimatedHours: Math.ceil((step.durationMinutes || 120) / 60),
          topics: [],
          order: step.order || 1
        };
        
        quizId = await createPrerequisiteQuiz(roadmapId, prerequisite, step.topicId, questions);
        console.log(`✅ Quiz created from ${newSubtopics.length} newly generated subtopics`);
      }
      
      return { quizId, roadmapId, userId };
    },
    onSuccess: async ({ roadmapId, userId }) => {
      // Use centralized cache invalidation for comprehensive updates
      await cacheInvalidation.invalidateRoadmapData(roadmapId, userId);
    },
  });
}

/**
 * Hook to submit quiz answers
 * Invalidates related caches on success
 */
export function useSubmitQuiz() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      userId, 
      quizId, 
      answers, 
      roadmapId 
    }: { 
      userId: string; 
      quizId: string; 
      answers: Record<string, any>; 
      roadmapId?: string;
    }) => {
      const result = await submitQuizAttempt(userId, quizId, answers, roadmapId);
      return { result, userId, roadmapId };
    },
    onSuccess: async ({ userId, roadmapId }) => {
      // Use centralized cache invalidation for comprehensive cross-invalidation
      await cacheInvalidation.invalidateQuizSubmission(
        userId,
        '',  // quizId not available in result, will trigger broader invalidation
        roadmapId
      );
    },
  });
}

/**
 * Hook to delete a roadmap
 */
export function useDeleteRoadmap() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, roadmapId }: { userId: string; roadmapId: string }) => {
      await deleteRoadmap(userId, roadmapId);
      return { userId, roadmapId };
    },
    onSuccess: async ({ userId, roadmapId }) => {
      // Use centralized cache cleanup for comprehensive deletion
      await cacheInvalidation.cleanupDeletedRoadmap(roadmapId, userId);
    },
  });
}

/**
 * Hook to manually update step completion status
 */
export function useUpdateStepCompletion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      stepId, 
      userId, 
      roadmapId, 
      isCompleted 
    }: { 
      stepId: string; 
      userId: string; 
      roadmapId: string; 
      isCompleted: boolean;
    }) => {
      await updateStepCompletion(stepId, userId, isCompleted);
      return { stepId, userId, roadmapId, isCompleted };
    },
    onSuccess: async ({ userId, roadmapId }) => {
      // Invalidate both list and detail queries to update progress
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.roadmaps.list(userId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.roadmaps.detail(roadmapId, userId) 
      });
    },
  });
}

/**
 * Hook to check for updates on completed topics
 */
export function useCheckTopicUpdates() {
  return useMutation({
    mutationFn: async ({ 
      roadmapId, 
      userId 
    }: { 
      roadmapId: string; 
      userId: string;
    }) => {
      console.log('🔍 Checking for topic updates...');
      
      // Get completed topics
      const completedTopics = await getCompletedTopicsForUpdates(roadmapId, userId);
      
      if (completedTopics.length === 0) {
        return { hasUpdates: false, updates: [] };
      }

      // Check for updates using Lang Search
      const updates = await checkMultipleTopicsForUpdates(
        completedTopics.map(topic => ({
          name: topic.name,
          completedDate: topic.completedDate,
        }))
      );

      return {
        hasUpdates: updates.length > 0,
        updates,
      };
    },
    onError: (error) => {
      console.error('❌ Failed to check topic updates:', error);
    },
  });
}

// ============================================
// PREFETCH HELPERS
// ============================================

/**
 * Prefetch roadmap details (useful for list → detail navigation)
 */
export function prefetchRoadmapDetails(roadmapId: string, userId: string) {
  return queryClient.prefetchQuery({
    queryKey: queryKeys.roadmaps.detail(roadmapId, userId),
    queryFn: () => getRoadmapWithSteps(roadmapId, userId),
    staleTime: 2 * 60 * 1000,
  });
}
