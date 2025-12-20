import { create } from 'zustand';
import { geminiService, type TopicExplanation } from '@/lib/gemini';
import { getTopicById, getRoadmapByTopicId } from '@/server/queries/topics';

interface TopicDetail {
  topic: {
    id: string;
    name: string;
    description: string | null;
    category: string;
  };
  explanation: TopicExplanation;
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

      // Check if we have cached explanation
      const cached = get().cachedExplanations.get(topicId);
      
      if (cached) {
        set({
          currentTopicDetail: { topic, explanation: cached },
          isLoading: false
        });
        return;
      }

      // Get roadmap context for better explanation
      const roadmap = await getRoadmapByTopicId(topicId, userId);
      const context = roadmap?.title || topic.category;

      // Generate explanation using Gemini
      console.log(`🤖 Generating explanation for topic: ${topic.name}`);
      const explanation = await geminiService.generateTopicExplanation(
        topic.name,
        context
      );

      // Cache the explanation
      const newCache = new Map(get().cachedExplanations);
      newCache.set(topicId, explanation);

      set({
        currentTopicDetail: { topic, explanation },
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
