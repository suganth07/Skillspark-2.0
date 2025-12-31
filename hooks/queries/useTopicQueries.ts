import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { 
  getTopicById, 
  getRoadmapByTopicId, 
  getSubtopics, 
  getUserSubtopicPerformance,
  createSubtopics,
  updateSubtopicsContent,
  checkNeedsRegeneration,
  setNeedsRegeneration
} from '@/server/queries/topics';
import { geminiService, type TopicExplanation } from '@/lib/gemini';

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
    // queryKey: queryKeys.topics.detail(topicId || ''),
    queryKey: ['topics', 'detail', topicId || '', userId || ''],
    queryFn: async (): Promise<TopicDetail> => {
      if (!topicId || !userId) {
        throw new Error('Topic ID and User ID are required');
      }

      // Get topic from database
      const topic = await getTopicById(topicId);
      
      if (!topic) {
        throw new Error('Topic not found');
      }

      // Get roadmap context for better explanation
      const roadmap = await getRoadmapByTopicId(topicId, userId);
      const context = roadmap?.title || topic.category;

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
            subtopicGuidance
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
          
          // Save the adaptive content back to database
          console.log(`💾 Saving regenerated adaptive content to database...`);
          await updateSubtopicsContent(topicId, explanation);
          
          // Reset the regeneration flag to prevent unnecessary regeneration next time
          await setNeedsRegeneration(userId, topicId, false);
          
          console.log(`✅ Content regenerated and cached. Regeneration flag reset to FALSE.`);
          return { topic, explanation, subtopicPerformance: performanceMap };
        }
        
        // SCENARIO 2: Content exists, no regeneration needed - Load from database
        console.log(`💾 Loading cached content from database (regeneration not needed)`);
        const topicMetadata = JSON.parse(topic.metadata as string || '{}');
        
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
              explanation: st.description || '',
              example: metadata.example,
              exampleExplanation: metadata.exampleExplanation,
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
        
        // This shouldn't normally happen, but handle it gracefully
        // Generate adaptive content based on performance
        const subtopicGuidance = Array.from(performanceMap.values()).map(perf => ({
          subtopicName: perf.subtopicId, // We'll use ID as placeholder
          status: perf.status,
          accuracy: perf.accuracy
        }));
        
        const explanation = await geminiService.generateTopicExplanation(
          topic.name,
          context,
          subtopicGuidance
        );
        
        console.log(`💾 Caching ${explanation.subtopics.length} subtopics in database...`);
        await createSubtopics(topicId, topic.category, explanation);
        
        console.log(`✅ New adaptive content generated and cached`);
        return { topic, explanation, subtopicPerformance: performanceMap };
      }
      
      // SCENARIO 4: No content, no performance - "Totally New" user, first visit
      console.log(`🤖 First time content generation for "Totally New" user`);
      
      const explanation = await geminiService.generateTopicExplanation(
        topic.name,
        context
      );

      // Store generated subtopics in database for future use
      console.log(`💾 Caching ${explanation.subtopics.length} subtopics in database...`);
      await createSubtopics(topicId, topic.category, explanation);

      console.log(`✅ New content generated and cached with ${explanation.subtopics.length} subtopics`);
      
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
