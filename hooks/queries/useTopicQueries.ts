import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { 
  getTopicById, 
  getTopicByIdOrName,
  getRoadmapByTopicId, 
  getSubtopics, 
  getUserSubtopicPerformance,
  createSubtopics,
  updateSubtopicsContent,
  updateSingleToneContent,
  checkNeedsRegeneration,
  setNeedsRegeneration
} from '@/server/queries/topics';
import { geminiService, type TopicExplanation } from '@/lib/gemini';
import { regenerateSingleContent, type ContentTone } from '@/server/agents/DynamicContent';

// ============================================
// TYPES
// ============================================

export interface SubtopicPerformance {
  subtopicId: string;
  correctCount: number;
  incorrectCount: number;
  totalAttempts: number;
  status: 'weak' | 'strong' | 'neutral';
  accuracy: number;
}

export interface TopicDetail {
  topic: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    metadata?: any;
  };
  explanation: TopicExplanation;
  subtopicPerformance: Map<string, SubtopicPerformance>;
}

// ============================================
// QUERY HOOKS
// ============================================

/**
 * Hook to fetch complete topic details with adaptive explanations
 * This combines topic data, subtopics, and generates AI explanations
 */
export function useTopicDetail(topicId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: queryKeys.
    topics.detail(topicId || '', userId || ''),
    queryFn: async (): Promise<TopicDetail> => {
      if (!topicId || !userId) {
        throw new Error('Topic ID and User ID are required');
      }

      // Get topic from database (supports both ID and name for career paths)
      const topic = await getTopicByIdOrName(topicId);
      
      if (!topic) {
        throw new Error('Topic not found');
      }

      // Get roadmap context for better explanation
      const roadmap = await getRoadmapByTopicId(topicId, userId);
      const context = roadmap?.title || topic.category;

      // Extract user preferences from roadmap if available
      let userPreferences: string | undefined;
      if (roadmap?.preferences) {
        try {
          const prefs = typeof roadmap.preferences === 'string' 
            ? JSON.parse(roadmap.preferences) 
            : roadmap.preferences;
          userPreferences = prefs?.userPreferences || undefined;
          if (userPreferences) {
            console.log(`📝 Found user preferences: ${userPreferences}`);
          }
        } catch (e) {
          console.warn('Failed to parse roadmap preferences:', e);
        }
      }

      // Get user's performance for subtopics
      const performanceData = await getUserSubtopicPerformance(userId, topicId);
      const performanceMap = new Map<string, SubtopicPerformance>();
      
      performanceData.forEach(perf => {
        const totalAttempts = perf.totalAttempts ?? 0;
        const correctCount = perf.correctCount ?? 0;
        const incorrectCount = perf.incorrectCount ?? 0;
        
        const accuracy = totalAttempts > 0 
          ? Math.round((correctCount / totalAttempts) * 100) 
          : 0;
        const validStatuses = ['weak', 'strong', 'neutral'] as const;
        const status = validStatuses.includes(perf.status as any) 
          ? (perf.status as 'weak' | 'strong' | 'neutral')
          : 'neutral';
        
        performanceMap.set(perf.subtopicId, {
          subtopicId: perf.subtopicId,
          correctCount,
          incorrectCount,
          totalAttempts,
          status,
          accuracy
        });
      });

      console.log(`📊 Loaded performance data for ${performanceMap.size} subtopics`);

      // Check if subtopics already exist in database
      const existingSubtopics = await getSubtopics(topicId);
      
      // Check if regeneration is needed (set after quiz completion)
      const needsRegeneration = await checkNeedsRegeneration(userId, topicId);
      console.log(`🔄 Needs regeneration: ${needsRegeneration}`);
      
      if (existingSubtopics.length > 0) {
        console.log(`📚 Found ${existingSubtopics.length} subtopics in database`);
        
        // SCENARIO 1: Content exists and needs regeneration (user completed a new quiz)
        if (needsRegeneration && performanceMap.size > 0) {
          console.log(`🎯 Regeneration flag is TRUE - Regenerating content based on updated performance`);

          // Prepare subtopic guidance with performance metrics
          const subtopicGuidance = existingSubtopics.map(st => {
            const perf = performanceMap.get(st.id);
            return {
              subtopicName: st.name,
              status: perf?.status || 'neutral',
              accuracy: perf?.accuracy || 0
            };
          });
          
          // Regenerate explanation with performance-based adaptations
          const explanation = await geminiService.generateTopicExplanation(
            topic.name,
            context,
            subtopicGuidance,
            userPreferences
          );
          
          // Map AI-generated subtopics back to database IDs to preserve references
          const dbSubtopicsByName = new Map(
            existingSubtopics.map(st => [st.name.toLowerCase(), st.id])
          );
          explanation.subtopics = explanation.subtopics.map((aiSubtopic) => {
            const dbId = dbSubtopicsByName.get(aiSubtopic.title.toLowerCase());
            return {
              ...aiSubtopic,
              id: dbId || aiSubtopic.id
            };
          });
          
          // Note: Side effects (updateSubtopicsContent, setNeedsRegeneration) should be
          // handled by calling usePersistTopicContent mutation after data is fetched
          console.log(`✅ Content regenerated - ready to persist`);
          return { topic, explanation, subtopicPerformance: performanceMap };
        }
        
        // SCENARIO 2: Content exists, no regeneration needed - Load from database
        console.log(`💾 Loading cached content from database (regeneration not needed)`);
        
        let topicMetadata: Record<string, any> = {};
        try {
          topicMetadata = JSON.parse(topic.metadata as string || '{}');
        } catch (error) {
          console.error(`Failed to parse topic metadata for topic ${topicId}:`, error);
          topicMetadata = {};
        }
        
        const explanation: TopicExplanation = {
          topicName: topic.name,
          overview: topic.description || '',
          difficulty: topicMetadata.difficulty || 'intermediate',
          subtopics: existingSubtopics.map(st => {
            let metadata: Record<string, any> = {};
            try {
              metadata = JSON.parse(st.metadata as string || '{}');
            } catch {
              console.warn(`Failed to parse subtopic metadata for ${st.id}`);
            }
            return {
              id: st.id,
              title: st.name,
              explanationDefault: st.contentDefault || '',
              explanationSimplified: st.contentSimplified || st.contentDefault || '',
              explanationStory: st.contentStory || st.contentDefault || '',
              example: metadata.example,
              exampleExplanation: metadata.exampleExplanation,
              exampleSimplified: metadata.exampleSimplified,
              exampleStory: metadata.exampleStory,
              keyPoints: metadata.keyPoints
            };
          }),
          bestPractices: topicMetadata.bestPractices,
          commonPitfalls: topicMetadata.commonPitfalls,
          whyLearn: topicMetadata.whyLearn
        };
        
        console.log(`✅ Loaded ${existingSubtopics.length} subtopics from cache`);
        return { topic, explanation, subtopicPerformance: performanceMap };
      }

      // SCENARIO 3: No subtopics in database - Generate fresh content with AI
      // Check if user has performance data (came from "Have Little Idea" quiz path)
      if (performanceMap.size > 0) {
        console.log(`🤖 First time content generation WITH performance data`);
        
        // Fetch subtopics to resolve IDs to names for performance guidance
        const subtopicsForPerf = await getSubtopics(topicId);
        const subtopicIdToName = new Map(subtopicsForPerf.map(st => [st.id, st.name]));
        
        // Resolve subtopic names from performance IDs
        const subtopicGuidance = Array.from(performanceMap.values())
          .map(perf => {
            const subtopicName = subtopicIdToName.get(perf.subtopicId);
            if (!subtopicName) {
              console.error(`Cannot resolve subtopic name for ID: ${perf.subtopicId}`);
              return null;
            }
            return {
              subtopicName,
              status: perf.status as 'strong' | 'weak' | 'neutral',
              accuracy: perf.accuracy
            };
          })
          .filter((item): item is { subtopicName: string; status: 'strong' | 'weak' | 'neutral'; accuracy: number } => item !== null);
        
        if (subtopicGuidance.length === 0) {
          console.error(`No valid subtopic names resolved from performance data`);
          throw new Error('Cannot generate adaptive content: subtopic names could not be resolved');
        }
        
        const explanation = await geminiService.generateTopicExplanation(
          topic.name,
          context,
          subtopicGuidance,
          userPreferences
        );
        
        // Note: createSubtopics side effect should be handled by usePersistTopicContent mutation
        console.log(`✅ New adaptive content generated with ${subtopicGuidance.length} resolved subtopics`);
        return { topic, explanation, subtopicPerformance: performanceMap };
      }
      
      // SCENARIO 4: No content, no performance - "Totally New" user, first visit
      console.log(`🤖 First time content generation for "Totally New" user`);
      
      const explanation = await geminiService.generateTopicExplanation(
        topic.name,
        context,
        undefined,
        userPreferences
      );

      // Note: createSubtopics side effect should be handled by usePersistTopicContent mutation
      console.log(`✅ New content generated with ${explanation.subtopics.length} subtopics`);
      
      return { topic, explanation, subtopicPerformance: performanceMap };
    },
    enabled: !!topicId && !!userId,
    staleTime: 10 * 60 * 1000, // Fresh for 10 minutes (topic content changes less often)
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

/**
 * Hook to fetch subtopics for a topic
 */
export function useSubtopics(topicId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.topics.subtopics(topicId || ''),
    queryFn: () => getSubtopics(topicId!),
    enabled: !!topicId,
    staleTime: 15 * 60 * 1000, // Fresh for 15 minutes
  });
}

/**
 * Hook to fetch user's performance on subtopics
 */
export function useSubtopicPerformance(userId: string | undefined, topicId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.topics.performance(userId || '', topicId || ''),
    queryFn: () => getUserSubtopicPerformance(userId!, topicId!),
    enabled: !!userId && !!topicId,
    staleTime: 2 * 60 * 1000, // Fresh for 2 minutes (performance data changes with quizzes)
  });
}

/**
 * Mutation to persist generated topic content to database
 * Handles both initial content creation and regeneration scenarios
 */
export function usePersistTopicContent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      topicId,
      userId,
      category,
      explanation,
      isRegeneration,
    }: {
      topicId: string;
      userId: string;
      category: string;
      explanation: TopicExplanation;
      isRegeneration: boolean;
    }) => {
      console.log(`💾 [Mutation] Starting persistence for topic: ${topicId}`);
      console.log(`💾 [Mutation] Subtopics to save: ${explanation.subtopics.length}`);
      console.log(`💾 [Mutation] Is regeneration: ${isRegeneration}`);
      console.log(`💾 [Mutation] First subtopic sample:`, {
        id: explanation.subtopics[0]?.id,
        title: explanation.subtopics[0]?.title,
        hasDefault: !!explanation.subtopics[0]?.explanationDefault,
        hasSimplified: !!explanation.subtopics[0]?.explanationSimplified,
        hasStory: !!explanation.subtopics[0]?.explanationStory,
      });
      
      if (isRegeneration) {
        // Update existing content
        console.log(`💾 [Mutation] Calling updateSubtopicsContent...`);
        await updateSubtopicsContent(topicId, explanation);
        
        // Reset the regeneration flag
        await setNeedsRegeneration(userId, topicId, false);
        console.log(`✅ [Mutation] Content regenerated and cached. Regeneration flag reset to FALSE.`);
      } else {
        // Create new content
        console.log(`💾 [Mutation] Calling createSubtopics...`);
        await createSubtopics(topicId, category, explanation);
        console.log(`✅ [Mutation] New content cached in database`);
      }
      
      return { topicId, userId };
    },
    onSuccess: ({ topicId, userId }) => {
      // Invalidate the topic detail query to refetch with persisted data
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.topics.detail(topicId, userId) 
      });
      // Also invalidate subtopics query
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.topics.subtopics(topicId) 
      });
    },
  });
}

/**
 * Mutation to regenerate a single content tone (default, simplified, or story)
 * Used when one tone fails during initial generation
 */
export function useRegenerateSingleTone() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      topicId,
      userId,
      topicName,
      context,
      tone,
      canonicalTitles,
    }: {
      topicId: string;
      userId: string;
      topicName: string;
      context: string;
      tone: ContentTone;
      canonicalTitles: string[];
    }) => {
      console.log(`🔄 [Regenerate] Starting ${tone} content regeneration for "${topicName}"`);
      
      // Generate the single tone content
      const content = await regenerateSingleContent(
        tone,
        topicName,
        context,
        canonicalTitles
      );
      
      if (!content) {
        throw new Error(`Failed to regenerate ${tone} content after retries`);
      }
      
      console.log(`✅ [Regenerate] ${tone} content generated with ${content.subtopics.length} subtopics`);
      
      // Update only this tone in the database
      await updateSingleToneContent(topicId, tone, content);
      
      return { topicId, userId, tone, content };
    },
    onSuccess: ({ topicId, userId, tone }) => {
      console.log(`✅ [Regenerate] ${tone} content saved, invalidating queries...`);
      
      // Invalidate queries to refetch updated content
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.topics.detail(topicId, userId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.topics.subtopics(topicId) 
      });
    },
    onError: (error, { tone }) => {
      console.error(`❌ [Regenerate] Failed to regenerate ${tone} content:`, error);
    },
  });
}
