import { create } from 'zustand';
import { geminiService, type TopicExplanation } from '@/lib/gemini';
import { getTopicById, getRoadmapByTopicId, createSubtopics, getSubtopics, getUserSubtopicPerformance } from '@/server/queries/topics';

interface SubtopicPerformance {
  subtopicId: string;
  correctCount: number;
  incorrectCount: number;
  totalAttempts: number;
  status: 'weak' | 'strong' | 'neutral';
  accuracy: number; // percentage
}

interface TopicDetail {
  topic: {
    id: string;
    name: string;
    description: string | null;
    category: string;
  };
  explanation: TopicExplanation;
  subtopicPerformance: Map<string, SubtopicPerformance>;
}

interface TopicState {
  currentTopicDetail: TopicDetail | null;
  isLoading: boolean;
  error: string | null;
  cachedExplanations: Map<string, TopicExplanation>;

  // Actions
  loadTopicDetail: (topicId: string, userId: string) => Promise<void>;
  clearError: () => void;
}

export const useTopicStore = create<TopicState>((set, get) => ({
  currentTopicDetail: null,
  isLoading: false,
  error: null,
  cachedExplanations: new Map(),

  clearError: () => set({ error: null }),

  loadTopicDetail: async (topicId: string, userId: string) => {
    try {
      set({ isLoading: true, error: null });

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
        const accuracy = perf.totalAttempts > 0 
          ? Math.round((perf.correctCount / perf.totalAttempts) * 100) 
          : 0;
        
        performanceMap.set(perf.subtopicId, {
          subtopicId: perf.subtopicId,
          correctCount: perf.correctCount,
          incorrectCount: perf.incorrectCount,
          totalAttempts: perf.totalAttempts,
          status: perf.status as 'weak' | 'strong' | 'neutral',
          accuracy
        });
      });

      console.log(`📊 Loaded performance data for ${performanceMap.size} subtopics`);

      // Check if we have cached explanation
      const cached = get().cachedExplanations.get(topicId);
      
      if (cached) {
        console.log(`✅ Using cached explanation with performance data for ${performanceMap.size} subtopics`);
        set({
          currentTopicDetail: { topic, explanation: cached, subtopicPerformance: performanceMap },
          isLoading: false
        });
        return;
      }

      // Check if subtopics already exist in database
      const existingSubtopics = await getSubtopics(topicId);
      
      if (existingSubtopics.length > 0) {
        console.log(`📚 Loading ${existingSubtopics.length} subtopics from database`);
        
        // If user has performance data, regenerate content with adaptive explanations
        if (performanceMap.size > 0) {
          console.log(`🔄 Regenerating content with performance-based adaptations`);
          
          // Create performance map by subtopic name
          const performanceByName = new Map<string, { status: string; accuracy: number }>();
          existingSubtopics.forEach(st => {
            const perf = performanceMap.get(st.id);
            if (perf) {
              performanceByName.set(st.name, {
                status: perf.status,
                accuracy: perf.accuracy
              });
            }
          });
          
          // Prepare subtopic guidance with names
          const subtopicGuidance = existingSubtopics.map(st => {
            const perf = performanceMap.get(st.id);
            return {
              subtopicName: st.name,
              status: perf?.status || 'neutral',
              accuracy: perf?.accuracy || 0
            };
          });
          
          // Regenerate explanation with performance guidance
          const explanation = await geminiService.generateTopicExplanation(
            topic.name,
            context,
            subtopicGuidance
          );
          
          // Map AI-generated subtopics back to database IDs
          explanation.subtopics = explanation.subtopics.map((aiSubtopic, index) => {
            const dbSubtopic = existingSubtopics[index];
            return {
              ...aiSubtopic,
              id: dbSubtopic?.id || aiSubtopic.id // Use database ID if available
            };
          });
          
          const newCache = new Map(get().cachedExplanations);
          newCache.set(topicId, explanation);
          
          set({
            currentTopicDetail: { topic, explanation, subtopicPerformance: performanceMap },
            cachedExplanations: newCache,
            isLoading: false
          });
          return;
        }
        
        // No performance data, load from database as-is
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
        
        const newCache = new Map(get().cachedExplanations);
        newCache.set(topicId, explanation);
        
        set({
          currentTopicDetail: { topic, explanation, subtopicPerformance: performanceMap },
          cachedExplanations: newCache,
          isLoading: false
        });
        return;
      }

      // Generate explanation using Gemini with performance-based detail level
      console.log(`🤖 Generating explanation for topic: ${topic.name}`);
      
      const explanation = await geminiService.generateTopicExplanation(
        topic.name,
        context
      );

      // Store subtopics in database
      console.log(`💾 Storing ${explanation.subtopics.length} subtopics in database...`);
      await createSubtopics(topicId, topic.category, explanation);

      // Cache the explanation
      const newCache = new Map(get().cachedExplanations);
      newCache.set(topicId, explanation);

      set({
        currentTopicDetail: { topic, explanation, subtopicPerformance: performanceMap },
        cachedExplanations: newCache,
        isLoading: false
      });

      console.log(`✅ Topic explanation loaded with ${explanation.subtopics.length} subtopics`);
    } catch (error) {
      console.error('Failed to load topic detail:', error);
      
      let errorMessage = 'Failed to load topic details';
      if (error instanceof Error) {
        if (error.message.toLowerCase().includes('overloaded') || 
            error.message.toLowerCase().includes('quota') ||
            error.message.toLowerCase().includes('rate limit')) {
          errorMessage = 'AI service is temporarily overloaded. Please try again in a few minutes.';
        } else if (error.message.toLowerCase().includes('network') || 
                   error.message.toLowerCase().includes('fetch')) {
          errorMessage = 'Failed to connect. Please check your internet connection.';
        } else {
          errorMessage = error.message;
        }
      }
      
      set({ 
        error: errorMessage,
        isLoading: false,
        currentTopicDetail: null
      });
    }
  }
}));
