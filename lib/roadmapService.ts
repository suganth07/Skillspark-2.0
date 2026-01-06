import { geminiService, type KnowledgeGraph, type Prerequisite } from '@/lib/gemini';
import { 
  createRoadmap, 
  createPrerequisiteQuiz,
  getUserRoadmaps,
  getRoadmapWithSteps,
  submitQuizAttempt,
  getUserRoadmapProgress
} from '@/server/queries/roadmaps';

export class RoadmapGenerationService {
  async generateCompleteRoadmap(userId: string, topic: string, preferences?: string): Promise<{
    roadmapId: string;
    knowledgeGraph: KnowledgeGraph;
    message: string;
  }> {
    try {
      console.log(`🚀 Starting roadmap generation for topic: ${topic}`);
      if (preferences) {
        console.log(`📝 Using preferences: ${preferences}`);
      }
      
      // Step 1: Generate knowledge graph using Gemini
      console.log('📊 Generating knowledge graph with Gemini...');
      const knowledgeGraph = await geminiService.generateKnowledgeGraph(topic, preferences);
      
      console.log(`✅ Knowledge graph generated with ${knowledgeGraph.prerequisites.length} prerequisites`);
      
      // Step 2: Create roadmap and store in database
      console.log('💾 Creating roadmap in database...');
      const roadmapId = await createRoadmap(userId, knowledgeGraph, preferences);
      
      // Fetch roadmap and steps once to avoid N+1 queries
      const { roadmap, steps } = await getRoadmapWithSteps(roadmapId, userId);
      
      // Step 3: Generate quiz questions for each prerequisite
      console.log('❓ Generating quiz questions for prerequisites...');
      const quizGenerationPromises = knowledgeGraph.prerequisites.map(async (prerequisite) => {
        try {
          // Generate questions using Gemini
          const questions = await geminiService.generateQuizQuestions(prerequisite, topic);

          // Find matching step using cached steps
          const matchingStep = steps.find(step => step.prerequisiteName === prerequisite.name);

          if (matchingStep?.topicId) {
            const quizId = await createPrerequisiteQuiz(
              roadmapId, 
              prerequisite, 
              matchingStep.topicId, 
              questions
            );
            console.log(`✅ Quiz created for ${prerequisite.name}: ${quizId}`);
            return { prerequisite: prerequisite.name, quizId, questionsCount: questions.length };
          }

          return { prerequisite: prerequisite.name, error: 'No matching topic found' };
        } catch (error) {
          console.error(`❌ Failed to create quiz for ${prerequisite.name}:`, error);
          return { prerequisite: prerequisite.name, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });
      
      const quizResults = await Promise.all(quizGenerationPromises);
      const successfulQuizzes = quizResults.filter(result => result.quizId);
      const failedQuizzes = quizResults.filter(result => result.error);
      
      console.log(`📝 Quiz generation complete: ${successfulQuizzes.length} successful, ${failedQuizzes.length} failed`);
      
      if (failedQuizzes.length > 0) {
        console.warn('Some quizzes failed to generate:', failedQuizzes);
      }
      
      return {
        roadmapId,
        knowledgeGraph,
        message: `🎉 Successfully created learning roadmap for ${topic}! Generated ${knowledgeGraph.prerequisites.length} prerequisites with ${successfulQuizzes.length} interactive quizzes.`
      };
      
    } catch (error) {
      console.error('❌ Failed to generate roadmap:', error);
      throw new Error(`Failed to generate roadmap: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processQuizSubmission(
    userId: string,
    quizId: string,
    answers: Record<string, any>,
    roadmapId?: string
  ) {
    try {
      const result = await submitQuizAttempt(userId, quizId, answers, roadmapId);
      
      // Generate personalized feedback if part of a roadmap
      if (roadmapId && result.passed) {
        const progress = await getUserRoadmapProgress(userId, roadmapId);
        const completedPrerequisites = progress
          .filter(p => p.isCompleted)
          .map(p => p.prerequisiteName);
        const strugglingAreas = progress
          .filter(p => p.quizScore !== undefined && p.quizScore < 70)
          .map(p => p.prerequisiteName);
        
        // Get roadmap details to know the main topic
        const { roadmap } = await getRoadmapWithSteps(roadmapId, userId);
        const preferences = JSON.parse(roadmap.preferences as string || '{}');
        const mainTopic = preferences.topic || 'this topic';
        
        try {
          const personalizedFeedback = await geminiService.generatePersonalizedFeedback(
            mainTopic,
            completedPrerequisites,
            strugglingAreas
          );
          
          return {
            ...result,
            personalizedFeedback,
            completedPrerequisites: completedPrerequisites.length,
            totalPrerequisites: progress.length,
            nextUnlockedTopics: progress.filter(p => p.isUnlocked && !p.isCompleted).map(p => p.prerequisiteName)
          };
        } catch (feedbackError) {
          console.warn('Failed to generate personalized feedback:', feedbackError);
          return result;
        }
      }
      
      return result;
    } catch (error) {
      console.error('Failed to process quiz submission:', error);
      throw error;
    }
  }

  async getRoadmapAnalytics(userId: string, roadmapId: string) {
    try {
      const progress = await getUserRoadmapProgress(userId, roadmapId);
      const { roadmap, steps } = await getRoadmapWithSteps(roadmapId, userId);
      
      const analytics = {
        roadmapTitle: roadmap.title,
        totalPrerequisites: progress.length,
        completedPrerequisites: progress.filter(p => p.isCompleted).length,
        unlockedPrerequisites: progress.filter(p => p.isUnlocked).length,
        averageScore: progress
          .filter(p => p.quizScore !== undefined)
          .reduce((acc, p, _, arr) => acc + (p.quizScore! / arr.length), 0),
        progressByDifficulty: {
          basic: progress.filter(p => p.difficulty === 'basic'),
          intermediate: progress.filter(p => p.difficulty === 'intermediate'),
          advanced: progress.filter(p => p.difficulty === 'advanced')
        },
        overallProgress: roadmap.progress,
        status: roadmap.status,
        estimatedTimeRemaining: steps
          .filter(step => !step.isCompleted && step.durationMinutes)
          .reduce((acc, step) => acc + (step.durationMinutes || 0), 0),
        recentActivity: progress
          .filter(p => p.lastAttemptDate)
          .sort((a, b) => (b.lastAttemptDate?.getTime() || 0) - (a.lastAttemptDate?.getTime() || 0))
          .slice(0, 5)
      };
      
      return analytics;
    } catch (error) {
      console.error('Failed to get roadmap analytics:', error);
      throw error;
    }
  }

  async getUserDashboard(userId: string) {
    try {
      const roadmaps = await getUserRoadmaps(userId);
      
      // Get analytics for each active roadmap with limited concurrency
      // TODO: Consider introducing caching for dashboard metrics to reduce database load
      const activeRoadmaps = roadmaps.filter(r => r.status === 'active');
      
      // Process roadmap analytics with concurrency limit of 4
      const roadmapAnalytics: Array<{ roadmapId: string; analytics: any } | null> = [];
      const concurrency = 4;
      
      for (let i = 0; i < activeRoadmaps.length; i += concurrency) {
        const batch = activeRoadmaps.slice(i, i + concurrency);
        const batchResults = await Promise.all(
          batch.map(async (roadmap) => {
            try {
              const analytics = await this.getRoadmapAnalytics(userId, roadmap.id);
              return { roadmapId: roadmap.id, analytics };
            } catch (error) {
              console.warn(`Failed to get analytics for roadmap ${roadmap.id}:`, error);
              return null;
            }
          })
        );
        roadmapAnalytics.push(...batchResults);
      }
      
      const validAnalytics = roadmapAnalytics.filter(Boolean);
      
      return {
        roadmaps,
        totalActiveRoadmaps: roadmaps.filter(r => r.status === 'active').length,
        totalCompletedRoadmaps: roadmaps.filter(r => r.status === 'completed').length,
        overallProgress: roadmaps.length > 0 
          ? roadmaps.reduce((acc, r) => acc + r.progress, 0) / roadmaps.length 
          : 0,
        recentActivity: validAnalytics
          .flatMap(a => a?.analytics.recentActivity || [])
          .sort((a, b) => (b.lastAttemptDate?.getTime() || 0) - (a.lastAttemptDate?.getTime() || 0))
          .slice(0, 10),
        analytics: validAnalytics
      };
    } catch (error) {
      console.error('Failed to get user dashboard:', error);
      throw error;
    }
  }

  async suggestStudyPlan(userId: string, roadmapId: string): Promise<{
    dailyGoals: string[];
    weeklyMilestones: string[];
    focusAreas: string[];
    recommendedNextSteps: string[];
  }> {
    try {
      const progress = await getUserRoadmapProgress(userId, roadmapId);
      const { roadmap, steps } = await getRoadmapWithSteps(roadmapId, userId);
      
      const unlockedNotCompleted = progress.filter(p => p.isUnlocked && !p.isCompleted);
      const strugglingAreas = progress.filter(p => p.quizScore !== undefined && p.quizScore < 70);
      const totalTimeRemaining = steps
        .filter(step => !step.isCompleted && step.durationMinutes)
        .reduce((acc, step) => acc + (step.durationMinutes || 0), 0);
      
      // Generate personalized study plan
      const preferences = JSON.parse(roadmap.preferences as string || '{}');
      const mainTopic = preferences.topic || 'this topic';
      
      const studyPlan = {
        dailyGoals: [
          unlockedNotCompleted.length > 0 ? `Study ${unlockedNotCompleted[0].prerequisiteName}` : 'Review completed topics',
          'Take practice quiz if available',
          'Review any struggling areas'
        ],
        weeklyMilestones: [
          unlockedNotCompleted.length > 0 ? `Complete ${unlockedNotCompleted[0].prerequisiteName} prerequisite` : 'Review and reinforce knowledge',
          'Unlock next prerequisite',
          'Improve weak areas'
        ],
        focusAreas: strugglingAreas.length > 0 
          ? strugglingAreas.map(area => area.prerequisiteName)
          : unlockedNotCompleted.map(area => area.prerequisiteName),
        recommendedNextSteps: [
          ...unlockedNotCompleted.slice(0, 3).map(p => `Start learning ${p.prerequisiteName}`),
          ...strugglingAreas.slice(0, 2).map(p => `Review and retake quiz for ${p.prerequisiteName}`)
        ]
      };
      
      return studyPlan;
    } catch (error) {
      console.error('Failed to generate study plan:', error);
      return {
        dailyGoals: ['Continue your learning journey'],
        weeklyMilestones: ['Make steady progress'],
        focusAreas: ['Focus on understanding concepts'],
        recommendedNextSteps: ['Review your roadmap']
      };
    }
  }
}

export const roadmapService = new RoadmapGenerationService();