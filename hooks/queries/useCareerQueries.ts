// hooks/queries/useCareerQueries.ts - TanStack Query hooks for career paths
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generateCareerPath, type CareerPathResult } from '@/server/agents/CareerPath';
import {
  createCareerPath,
  getUserCareerPaths,
  getCareerPathWithTopics,
  deleteCareerPath,
} from '@/server/queries/careers';

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
    mutationFn: async ({ userId, roleName }: { userId: string; roleName: string }) => {
      console.log('🚀 Generating career path for:', roleName);
      
      // Step 1: Generate career path topics using AI
      const careerPathData = await generateCareerPath(roleName);
      
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
