import { create } from 'zustand';
import { geminiService, type KnowledgeGraph, type Prerequisite } from '@/lib/gemini';
import { 
  createRoadmap, 
  createPrerequisiteQuiz,
  getUserRoadmaps,
  getRoadmapWithSteps,
  submitQuizAttempt,
  getUserRoadmapProgress,
  getQuizWithQuestions
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
        (error.message.toLowerCase().includes('network') ? 'Failed to connect. Please check your internet connection.' : error.message) :
        'Failed to load roadmaps';
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
      
      // Get quiz questions to calculate score
      const quizQuestions = get().currentQuiz?.questions || [];
      
      // Calculate score
      let correct = 0;
      const details: Record<string, any> = {};

      for (const question of quizQuestions) {
        const questionData = JSON.parse(question.data as string);
        const userAnswer = answers[question.id];
        const isCorrect = userAnswer === questionData.correct;
        
        if (isCorrect) correct++;
        
        details[question.id] = {
          answer: userAnswer,
          correct: isCorrect,
          correctAnswer: questionData.correct,
          explanation: questionData.explanation
        };
      }

      const score = Math.round((correct / quizQuestions.length) * 100);
      const passed = score >= 70;
      
      // Submit the quiz attempt
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
      
      // Create prerequisite object
      const prerequisite = {
        id: `temp-${Date.now()}`, // Temporary ID for quiz generation
        name: prerequisiteName,
        description: step.content || `Learn ${prerequisiteName}`,
        difficulty: step.difficulty || 'intermediate',
        estimatedHours: Math.ceil((step.durationMinutes || 120) / 60),
        topics: [],
        order: step.order || 1
      };
      
      // Generate quiz questions using Gemini
      const questions = await geminiService.generateQuizQuestions(prerequisite, roadmap.title);
      
      // Create quiz in database
      const quizId = await createPrerequisiteQuiz(
        roadmapId,
        prerequisite,
        step.topicId || stepId,
        questions
      );
      
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
  }
}));