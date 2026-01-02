// hooks/queries/useCareerQueries.ts - TanStack Query hooks for career paths
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generateCareerPath, type CareerPathResult } from '@/server/agents/CareerPath';
import {
  createCareerPath,
  getUserCareerPaths,
  getCareerPathWithTopics,
  deleteCareerPath,
  linkRoadmapToCareerTopic,
  getCareerTopicById,
} from '@/server/queries/careers';
import { createRoadmap } from '@/server/queries/roadmaps';
import { geminiService } from '@/lib/gemini';
import { queryKeys } from '@/lib/queryClient';

/**
 * Get all career paths for a user
 */
export function useUserCareerPaths(userId?: string) {
  return useQuery({
    queryKey: ['careerPaths', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');
      return await getUserCareerPaths(userId);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get a single career path with all topics
 */
export function useCareerPathDetail(careerPathId?: string, userId?: string) {
  return useQuery({
    queryKey: ['careerPath', careerPathId, userId],
    queryFn: async () => {
      if (!careerPathId || !userId) throw new Error('Career path ID and user ID required');
      return await getCareerPathWithTopics(careerPathId, userId);
    },
    enabled: !!careerPathId && !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Create a new career path
 */
export function useCreateCareerPath() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      roleName,
      currentLevel,
      targetLevel,
      preferences
    }: { 
      userId: string; 
      roleName: string;
      currentLevel?: string;
      targetLevel?: string;
      preferences?: string;
    }) => {
      console.log('🚀 Generating career path for:', roleName);
      if (currentLevel || targetLevel) {
        console.log(`📊 Level transition: ${currentLevel || 'N/A'} → ${targetLevel || 'N/A'}`);
      }
      if (preferences) {
        console.log('📝 User preferences:', preferences);
      }
      
      // Step 1: Generate career path topics using AI
      const careerPathData = await generateCareerPath({
        roleName,
        currentLevel,
        targetLevel,
        preferences
      });
      
      // Step 2: Save to database
      const careerPathId = await createCareerPath(userId, careerPathData);
      
      return { careerPathId, careerPathData };
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch career paths list
      queryClient.invalidateQueries({ 
        queryKey: ['careerPaths', variables.userId] 
      });
      
      console.log('✅ Career path created successfully:', data.careerPathId);
    },
    onError: (error) => {
      console.error('❌ Failed to create career path:', error);
    },
  });
}

/**
 * Delete a career path
 */
export function useDeleteCareerPath() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, careerPathId }: { userId: string; careerPathId: string }) => {
      await deleteCareerPath(userId, careerPathId);
    },
    onSuccess: (_data, variables) => {
      // Invalidate career paths list
      queryClient.invalidateQueries({ 
        queryKey: ['careerPaths', variables.userId] 
      });
      
      // Remove specific career path from cache
      queryClient.removeQueries({ 
        queryKey: ['careerPath', variables.careerPathId] 
      });
      
      console.log('✅ Career path deleted successfully');
    },
    onError: (error) => {
      console.error('❌ Failed to delete career path:', error);
    },
  });
}

/**
 * Generate a roadmap from a career topic
 * This creates a full learning roadmap for a specific skill in the career path
 */
export function useGenerateCareerTopicRoadmap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      careerTopicId,
      careerPathId,
      topicName,
      preferences
    }: { 
      userId: string;
      careerTopicId: string;
      careerPathId: string;
      topicName: string;
      preferences?: string;
    }) => {
      console.log(`🚀 Generating roadmap for career topic: ${topicName}`);
      
      // Step 1: Generate knowledge graph using AI
      const knowledgeGraph = await geminiService.generateKnowledgeGraph(topicName, preferences);
      console.log(`✅ Knowledge graph generated with ${knowledgeGraph.prerequisites.length} prerequisites`);
      
      // Step 2: Create roadmap in database
      const roadmapId = await createRoadmap(userId, knowledgeGraph, preferences);
      console.log(`📚 Roadmap created: ${roadmapId}`);
      
      // Step 3: Link roadmap to career topic
      await linkRoadmapToCareerTopic(careerTopicId, roadmapId);
      console.log(`🔗 Linked roadmap to career topic`);
      
      return { roadmapId, topicName };
    },
    onSuccess: (data, variables) => {
      // Invalidate roadmaps list
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.roadmaps.list(variables.userId) 
      });
      
      // Invalidate career path detail to show updated linked roadmap
      queryClient.invalidateQueries({ 
        queryKey: ['careerPath', variables.careerPathId] 
      });
      
      console.log('✅ Career topic roadmap generated:', data.roadmapId);
    },
    onError: (error) => {
      console.error('❌ Failed to generate career topic roadmap:', error);
    },
  });
}
