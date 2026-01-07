import { useState } from 'react';
import { db } from '@/db/drizzle';
import { quizzes, quizAttempts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getRoadmapByTopicId } from '@/server/queries/topics';
import { getRoadmapWithSteps } from '@/server/queries/roadmaps';
import { useGenerateQuiz } from './useRoadmapQueries';

interface QuizWorkflowState {
  isGenerating: boolean;
  quizId: string | null;
  error: string | null;
}

interface QuizWorkflowResult extends QuizWorkflowState {
  initiateQuiz: (topicId: string, topicName: string, userId: string) => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook to handle quiz workflow:
 * - Check for existing quiz
 * - Determine if user has attempted it
 * - Generate new quiz if needed
 * - Manage loading and error states
 */
export function useQuizWorkflow(): QuizWorkflowResult {
  const [state, setState] = useState<QuizWorkflowState>({
    isGenerating: false,
    quizId: null,
    error: null,
  });

  const generateQuizMutation = useGenerateQuiz();

  const reset = () => {
    setState({
      isGenerating: false,
      quizId: null,
      error: null,
    });
  };

  const initiateQuiz = async (topicId: string, topicName: string, userId: string) => {
    try {
      setState(prev => ({ ...prev, isGenerating: true, error: null }));

      // Step 1: Get the roadmap for this topic
      const roadmap = await getRoadmapByTopicId(topicId, userId);
      
      if (!roadmap) {
        throw new Error('This topic is not part of any roadmap. Please access it through a roadmap to take a quiz.');
      }

      // Step 2: Check if quiz already exists for this topic
      const existingQuiz = await db
        .select({
          id: quizzes.id,
        })
        .from(quizzes)
        .where(and(
          eq(quizzes.topicId, topicId),
          eq(quizzes.roadmapId, roadmap.id)
        ))
        .limit(1);

      if (existingQuiz.length > 0) {
        // Step 3: Check if user has attempted this quiz
        const attempt = await db
          .select()
          .from(quizAttempts)
          .where(and(
            eq(quizAttempts.quizId, existingQuiz[0].id),
            eq(quizAttempts.userId, userId)
          ))
          .limit(1);

        // If quiz exists and not attempted, reuse it
        if (attempt.length === 0) {
          console.log('📋 Reusing existing unattempted quiz:', existingQuiz[0].id);
          setState({
            isGenerating: false,
            quizId: existingQuiz[0].id,
            error: null,
          });
          return;
        }
      }

      // Step 4: Get roadmap steps to find the step for this topic
      const { steps } = await getRoadmapWithSteps(roadmap.id, userId);
      
      const step = steps.find(s => s.topicId === topicId);
      
      if (!step) {
        throw new Error('Could not find the roadmap step for this topic.');
      }

      // Step 5: Generate new quiz
      const result = await generateQuizMutation.mutateAsync({
        userId,
        roadmapId: roadmap.id,
        stepId: step.id,
        prerequisiteName: topicName
      });

      setState({
        isGenerating: false,
        quizId: result.quizId,
        error: null,
      });
    } catch (error) {
      console.error('Error in quiz workflow:', error);
      setState({
        isGenerating: false,
        quizId: null,
        error: error instanceof Error ? error.message : 'Failed to generate quiz. Please try again.',
      });
    }
  };

  return {
    ...state,
    initiateQuiz,
    reset,
  };
}
