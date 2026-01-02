import { create } from 'zustand';
import { geminiService, type KnowledgeGraph, type Prerequisite } from '@/lib/gemini';
import { 
  createRoadmap, 
  createPrerequisiteQuiz,
  getUserRoadmaps,
  getRoadmapWithSteps,
  submitQuizAttempt,
  getUserRoadmapProgress,
  getQuizWithQuestions,
  deleteRoadmap
} from '@/server/queries/roadmaps';
import type { RoadmapWithProgress, RoadmapStep, UserProgress } from '@/server/queries/roadmaps';

interface RoadmapState {
  roadmaps: RoadmapWithProgress[];
  currentRoadmap: { roadmap: any; steps: RoadmapStep[] } | null;
  currentQuiz: { quiz: any; questions: any[] } | null;
  isLoading: boolean;
  isGenerating: boolean;
  generationProgress: string;
  error: string | null;
  isGeneratingQuiz: boolean; // New state for quiz generation

  // Actions
  loadUserRoadmaps: (userId: string) => Promise<void>;
  generateCompleteRoadmap: (userId: string, topic: string) => Promise<string>;
  generateQuizForPrerequisite: (userId: string, roadmapId: string, stepId: string, prerequisiteName: string) => Promise<string>; // New action
  loadRoadmapDetails: (roadmapId: string, userId: string) => Promise<void>;
  loadQuiz: (quizId: string) => Promise<void>;
  submitQuiz: (userId: string, quizId: string, answers: Record<string, any>, roadmapId?: string) => Promise<any>;
  deleteRoadmap: (userId: string, roadmapId: string) => Promise<void>;
  clearError: () => void;
}

export const useRoadmapStore = create<RoadmapState>((set, get) => ({
  roadmaps: [],
  currentRoadmap: null,
  currentQuiz: null,
  isLoading: false,
  isGenerating: false,
  isGeneratingQuiz: false,
  generationProgress: '',
  error: null,

  clearError: () => set({ error: null }),

  loadUserRoadmaps: async (userId: string) => {
    try {
      set({ isLoading: true, error: null });
      const userRoadmaps = await getUserRoadmaps(userId);
      set({ roadmaps: userRoadmaps, isLoading: false });
    } catch (error) {
      console.error('Failed to load roadmaps:', error);
      const errorMessage = error instanceof Error ?
        (error.message.toLowerCase().includes('network') ? 'Failed to connect. Please check your internet connection.' : error.message)
        : 'Failed to load roadmaps';
      set({
        error: errorMessage,
        isLoading: false
      });
    }
  },

  generateCompleteRoadmap: async (userId: string, topic: string) => {
    try {
      console.log(`🚀 Starting roadmap generation for topic: ${topic}`);
      set({ isGenerating: true, generationProgress: 'Analyzing topic and generating knowledge graph...', error: null });

      // Step 1: Generate knowledge graph using Gemini
      const knowledgeGraph = await geminiService.generateKnowledgeGraph(topic);
      console.log(`✅ Knowledge graph generated with ${knowledgeGraph.prerequisites.length} prerequisites`);

      set({ generationProgress: 'Creating prerequisite structure...' });

      // Step 2: Create roadmap and store in database
      const roadmapId = await createRoadmap(userId, knowledgeGraph);

      set({
        generationProgress: 'Complete! 🎉',
        isGenerating: false
      });

      console.log(`📚 Roadmap creation complete for topic: ${topic}`);

      // Refresh roadmap list
      await get().loadUserRoadmaps(userId);

      return roadmapId;

    } catch (error) {
      console.error('❌ Failed to generate roadmap:', error);

      // Handle specific error types
      let errorMessage = 'Failed to generate roadmap';
      if (error instanceof Error) {
        if (error.message.toLowerCase().includes('overloaded') ||
            error.message.toLowerCase().includes('quota') ||
            error.message.toLowerCase().includes('rate limit')) {
          errorMessage = 'AI service is temporarily overloaded. Please try again in a few minutes.';
        } else if (error.message.toLowerCase().includes('network') ||
                   error.message.toLowerCase().includes('fetch')) {
          errorMessage = 'Network connection failed. Please check your internet connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }

      set({
        error: errorMessage,
        isGenerating: false,
        generationProgress: ''
      });
      throw new Error(errorMessage);
    }
  },

  loadRoadmapDetails: async (roadmapId: string, userId: string) => {
    try {
      set({ isLoading: true, error: null });
      const roadmapWithSteps = await getRoadmapWithSteps(roadmapId, userId);
      set({
        currentRoadmap: roadmapWithSteps,
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to load roadmap details:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load roadmap',
        isLoading: false
      });
    }
  },

  loadQuiz: async (quizId: string) => {
    try {
      set({ isLoading: true, error: null });
      const quizData = await getQuizWithQuestions(quizId);
      set({
        currentQuiz: quizData,
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to load quiz:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load quiz',
        isLoading: false
      });
    }
  },

  submitQuiz: async (userId: string, quizId: string, answers: Record<string, any>, roadmapId?: string) => {
    try {
      set({ isLoading: true, error: null });

      // Submit the quiz attempt (server will compute score and result)
      const result = await submitQuizAttempt(userId, quizId, answers, roadmapId);

      set({ isLoading: false });

      // Refresh roadmap data if this was part of a roadmap
      if (roadmapId) {
        await get().loadRoadmapDetails(roadmapId, userId);
        await get().loadUserRoadmaps(userId);
      }

      return result;

    } catch (error) {
      console.error('Failed to submit quiz:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to submit quiz',
        isLoading: false
      });
      throw error;
    }
  },

  generateQuizForPrerequisite: async (userId: string, roadmapId: string, stepId: string, prerequisiteName: string) => {
    try {
      set({ isGeneratingQuiz: true, error: null });

      // Get the roadmap to find the topic
      const { roadmap, steps } = await getRoadmapWithSteps(roadmapId, userId);
      const step = steps.find(s => s.id === stepId);

      if (!step) {
        throw new Error('Step not found');
      }

      // Validate that step has a valid topicId
      if (!step.topicId) {
        throw new Error(`Step "${step.title || stepId}" is missing a topicId. Cannot generate quiz for prerequisite without a valid topic reference.`);
      }

      // Get subtopics for this topic
      const { getSubtopics } = await import('@/server/queries/topics');
      const subtopics = await getSubtopics(step.topicId);

      let quizId: string;

      if (subtopics.length > 0) {
        // Generate quiz from subtopics (questions covering different subtopics)
        console.log(`🎯 Generating quiz with ${subtopics.length} subtopics for ${prerequisiteName}`);

        const subtopicsData = subtopics.map(st => ({
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

        // Create prerequisite object
        const prerequisite = {
          id: `temp-${Date.now()}`,
          name: prerequisiteName,
          description: step.content || `Learn ${prerequisiteName}`,
          difficulty: step.difficulty || 'intermediate',
          estimatedHours: Math.ceil((step.durationMinutes || 120) / 60),
          topics: [],
          order: step.order || 1
        };

        quizId = await createPrerequisiteQuiz(
          roadmapId,
          prerequisite,
          step.topicId,
          questions
        );

        console.log(`✅ Quiz created with questions from ${subtopics.length} subtopics`);
      } else {
        // Generate subtopics first, then create quiz
        console.log(`⚠️ No subtopics found for ${prerequisiteName}, generating subtopics first`);

        // Generate subtopics using AI
        const { createSubtopics } = await import('@/server/queries/topics');
        const topicExplanation = await geminiService.generateTopicExplanation(
          prerequisiteName,
          roadmap.title
        );

        // Use roadmap title as topic category
        const topicCategory = roadmap.title || 'General';
        // Store subtopics in database
        await createSubtopics(step.topicId, topicCategory, topicExplanation);
        console.log(`✅ Generated ${topicExplanation.subtopics.length} subtopics for ${prerequisiteName}`);

        // Now fetch the newly created subtopics
        const newSubtopics = await getSubtopics(step.topicId);

        const subtopicsData = newSubtopics.map(st => ({
          id: st.id,
          name: st.name,
          description: st.description || ''
        }));

        // Generate quiz from newly created subtopics
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

        quizId = await createPrerequisiteQuiz(
          roadmapId,
          prerequisite,
          step.topicId,
          questions
        );

        console.log(`✅ Quiz created with questions from ${newSubtopics.length} newly generated subtopics`);
      }

      set({ isGeneratingQuiz: false });

      // Refresh roadmap data to show the new quiz
      await get().loadRoadmapDetails(roadmapId, userId);

      return quizId;

    } catch (error) {
      console.error('Failed to generate quiz for prerequisite:', error);

      let errorMessage = 'Failed to generate quiz';
      if (error instanceof Error) {
        if (error.message.toLowerCase().includes('overloaded') ||
            error.message.toLowerCase().includes('quota') ||
            error.message.toLowerCase().includes('rate limit')) {
          errorMessage = 'AI service is temporarily overloaded. Please try again in a few minutes.';
        } else {
          errorMessage = error.message;
        }
      }

      set({
        error: errorMessage,
        isGeneratingQuiz: false
      });
      throw new Error(errorMessage);
    }
  },

  deleteRoadmap: async (userId: string, roadmapId: string) => {
    try {
      set({ isLoading: true, error: null });

      await deleteRoadmap(userId, roadmapId);

      // Remove from local state
      const updatedRoadmaps = get().roadmaps.filter(r => r.id !== roadmapId);
      set({
        roadmaps: updatedRoadmaps,
        currentRoadmap: get().currentRoadmap?.roadmap.id === roadmapId ? null : get().currentRoadmap,
        isLoading: false
      });

      console.log('✅ Roadmap deleted successfully');
    } catch (error) {
      console.error('Failed to delete roadmap:', error);

      let errorMessage = 'Failed to delete roadmap';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      set({
        error: errorMessage,
        isLoading: false
      });
      throw new Error(errorMessage);
    }
  }
}));
