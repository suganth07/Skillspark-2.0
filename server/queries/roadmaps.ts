import { and, eq, desc, asc } from 'drizzle-orm';
import { db } from '@/db/drizzle';
import { 
  roadmaps, 
  roadmapSteps, 
  topics, 
  quizzes, 
  questions, 
  quizAttempts, 
  userKnowledge,
  users
} from '@/db/schema';
import type { KnowledgeGraph, Prerequisite, QuizQuestion } from '@/lib/gemini';
import { createId } from '@paralleldrive/cuid2';

export interface RoadmapWithProgress {
  id: string;
  title: string;
  description: string | null;
  status: 'active' | 'completed' | 'archived';
  progress: number;
  createdAt: Date | null;
  stepsCount: number;
  completedSteps: number;
}

export interface RoadmapStep {
  id: string;
  roadmapId: string;
  order: number;
  title: string;
  content: string | null;
  durationMinutes: number | null;
  isCompleted: boolean;
  topicId: string | null;
  prerequisiteName?: string;
  difficulty?: 'basic' | 'intermediate' | 'advanced';
  quizId?: string;
  canStart: boolean; // Based on prerequisites completion
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  score: number | null;
  passed: boolean | null;
  completedAt: Date | null;
  details: any;
}

export interface UserProgress {
  prerequisiteId: string;
  prerequisiteName: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  isUnlocked: boolean;
  isCompleted: boolean;
  quizScore?: number;
  lastAttemptDate?: Date;
}

// Create a new roadmap from Gemini-generated knowledge graph
export async function createRoadmap(
  userId: string,
  knowledgeGraph: KnowledgeGraph
): Promise<string> {
  return await db.transaction(async (tx) => {
    // 1. Create the roadmap
    const roadmapId = createId();
    await tx.insert(roadmaps).values({
      id: roadmapId,
      userId,
      title: `${knowledgeGraph.mainTopic} Learning Path`,
      description: knowledgeGraph.description,
      status: 'active',
      preferences: JSON.stringify({ 
        topic: knowledgeGraph.mainTopic,
        totalPrerequisites: knowledgeGraph.prerequisites.length 
      })
    });

    // 2. Create topics for each prerequisite with prerequisite chain
    const topicIds: Record<string, string> = {};
    let previousTopicId: string | null = null;
    
    for (const prereq of knowledgeGraph.prerequisites) {
      const topicId = createId();
      topicIds[prereq.id] = topicId;
      
      // Insert or update topic
      try {
        await tx.insert(topics).values({
          id: topicId,
          name: prereq.name,
          description: prereq.description,
          category: knowledgeGraph.mainTopic,
          previousTopicId: previousTopicId, // Link to previous prerequisite
          metadata: JSON.stringify({
            difficulty: prereq.difficulty,
            estimatedHours: prereq.estimatedHours,
            prerequisiteOrder: prereq.order
          })
        });
        
        previousTopicId = topicId; // Set for next iteration
      } catch (error) {
        // Topic might already exist, update it
        await tx.update(topics)
          .set({
            description: prereq.description,
            previousTopicId: previousTopicId,
            metadata: JSON.stringify({
              difficulty: prereq.difficulty,
              estimatedHours: prereq.estimatedHours,
              prerequisiteOrder: prereq.order
            })
          })
          .where(eq(topics.name, prereq.name));
        
        // Get existing topic ID
        const existingTopic = await tx.select({ id: topics.id })
          .from(topics)
          .where(eq(topics.name, prereq.name))
          .limit(1);
        if (existingTopic[0]) {
          topicIds[prereq.id] = existingTopic[0].id;
          previousTopicId = existingTopic[0].id;
        }
      }
    }

    // 3. Create roadmap steps for each prerequisite
    for (const prereq of knowledgeGraph.prerequisites) {
      await tx.insert(roadmapSteps).values({
        roadmapId,
        order: prereq.order,
        title: prereq.name,
        content: `## ${prereq.name}\n\n${prereq.description}\n\n**Difficulty:** ${prereq.difficulty}\n**Estimated Time:** ${prereq.estimatedHours} hours`,
        durationMinutes: prereq.estimatedHours * 60,
        topicId: topicIds[prereq.id],
        isCompleted: false
      });
    }

    // 4. Initialize user knowledge tracking
    for (const prereq of knowledgeGraph.prerequisites) {
      await tx.insert(userKnowledge).values({
        userId,
        topicId: topicIds[prereq.id],
        proficiencyLevel: 0,
        status: prereq.order === 1 ? 'available' : 'locked' // Only first prerequisite is available initially
      });
    }

    return roadmapId;
  });
}

// Create quiz for a prerequisite
export async function createPrerequisiteQuiz(
  roadmapId: string,
  prerequisite: Prerequisite,
  topicId: string,
  quizQuestions: QuizQuestion[]
): Promise<string> {
  return await db.transaction(async (tx) => {
    // Create quiz
    const quizId = createId();
    await tx.insert(quizzes).values({
      id: quizId,
      title: `${prerequisite.name} Assessment`,
      topicId,
      roadmapId,
      type: 'proficiency_check',
      difficulty: prerequisite.difficulty
    });

    // Create questions
    for (const question of quizQuestions) {
      await tx.insert(questions).values({
        quizId,
        content: question.content,
        type: question.type,
        data: JSON.stringify(question.data)
      });
    }

    return quizId;
  });
}

// Get user's roadmaps with progress
export async function getUserRoadmaps(userId: string): Promise<RoadmapWithProgress[]> {
  const roadmapsList = await db
    .select({
      id: roadmaps.id,
      title: roadmaps.title,
      description: roadmaps.description,
      status: roadmaps.status,
      progress: roadmaps.progress,
      createdAt: roadmaps.createdAt,
    })
    .from(roadmaps)
    .where(eq(roadmaps.userId, userId))
    .orderBy(desc(roadmaps.createdAt));

  // Get step counts and progress for each roadmap
  const roadmapsWithProgress = await Promise.all(
    roadmapsList.map(async (roadmap) => {
      const steps = await db
        .select({
          total: roadmapSteps.id,
          completed: roadmapSteps.isCompleted
        })
        .from(roadmapSteps)
        .where(eq(roadmapSteps.roadmapId, roadmap.id));

      const stepsCount = steps.length;
      const completedSteps = steps.filter(step => step.completed).length;

      return {
        ...roadmap,
        status: roadmap.status || 'active',
        progress: roadmap.progress || 0,
        stepsCount,
        completedSteps
      } as RoadmapWithProgress;
    })
  );

  return roadmapsWithProgress;
}

// Get roadmap details with steps
export async function getRoadmapWithSteps(roadmapId: string, userId: string): Promise<{
  roadmap: typeof roadmaps.$inferSelect;
  steps: RoadmapStep[];
}> {
  // Get roadmap
  const roadmap = await db
    .select()
    .from(roadmaps)
    .where(and(eq(roadmaps.id, roadmapId), eq(roadmaps.userId, userId)))
    .limit(1);

  if (!roadmap[0]) {
    throw new Error('Roadmap not found');
  }

  // Get steps with topic information
  const steps = await db
    .select({
      id: roadmapSteps.id,
      roadmapId: roadmapSteps.roadmapId,
      order: roadmapSteps.order,
      title: roadmapSteps.title,
      content: roadmapSteps.content,
      durationMinutes: roadmapSteps.durationMinutes,
      isCompleted: roadmapSteps.isCompleted,
      topicId: roadmapSteps.topicId,
      topicName: topics.name,
      topicMetadata: topics.metadata
    })
    .from(roadmapSteps)
    .leftJoin(topics, eq(roadmapSteps.topicId, topics.id))
    .where(eq(roadmapSteps.roadmapId, roadmapId))
    .orderBy(asc(roadmapSteps.order));

  // Get user knowledge status for each step - all steps are now available
  const stepsWithProgress = await Promise.all(
    steps.map(async (step) => {
      let quizId: string | undefined;

      if (step.topicId) {
        // Get quiz ID for this topic
        const quiz = await db
          .select({ id: quizzes.id })
          .from(quizzes)
          .where(and(
            eq(quizzes.topicId, step.topicId),
            eq(quizzes.roadmapId, roadmapId)
          ))
          .limit(1);
        
        quizId = quiz[0]?.id;
      }

      const metadata = step.topicMetadata ? JSON.parse(step.topicMetadata as string) : {};

      return {
        id: step.id,
        roadmapId: step.roadmapId,
        order: step.order,
        title: step.title,
        content: step.content,
        durationMinutes: step.durationMinutes,
        isCompleted: step.isCompleted,
        topicId: step.topicId,
        prerequisiteName: step.topicName,
        difficulty: metadata.difficulty,
        quizId,
        canStart: true // All steps are always available now
      } as RoadmapStep;
    })
  );

  return {
    roadmap: roadmap[0],
    steps: stepsWithProgress
  };
}

// Submit quiz attempt
export async function submitQuizAttempt(
  userId: string,
  quizId: string,
  answers: Record<string, any>,
  roadmapId?: string
): Promise<{ score: number; passed: boolean; feedback: string }> {
  return await db.transaction(async (tx) => {
    // Get quiz questions
    const quizQuestions = await tx
      .select()
      .from(questions)
      .where(eq(questions.quizId, quizId));

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
    const passed = score >= 70; // 70% passing score
    
    // Record quiz attempt
    const attemptId = createId();
    await tx.insert(quizAttempts).values({
      id: attemptId,
      userId,
      quizId,
      score,
      passed,
      details: JSON.stringify(details)
    });

    // Update user knowledge if passed
    if (passed) {
      const quiz = await tx
        .select({ topicId: quizzes.topicId })
        .from(quizzes)
        .where(eq(quizzes.id, quizId))
        .limit(1);

      if (quiz[0]?.topicId) {
        // Mark this topic as mastered
        await tx
          .update(userKnowledge)
          .set({
            proficiencyLevel: score,
            status: 'mastered',
            lastReviewedAt: new Date()
          })
          .where(and(
            eq(userKnowledge.userId, userId),
            eq(userKnowledge.topicId, quiz[0].topicId)
          ));

        // Unlock next prerequisites - topics that have this as previousTopicId
        const nextTopics = await tx
          .select({ id: topics.id })
          .from(topics)
          .where(eq(topics.previousTopicId, quiz[0].topicId));

        for (const nextTopic of nextTopics) {
          await tx
            .update(userKnowledge)
            .set({ status: 'available' })
            .where(and(
              eq(userKnowledge.userId, userId),
              eq(userKnowledge.topicId, nextTopic.id),
              eq(userKnowledge.status, 'locked')
            ));
        }

        // Mark roadmap step as completed if this was part of a roadmap
        if (roadmapId) {
          await tx
            .update(roadmapSteps)
            .set({ isCompleted: true })
            .where(and(
              eq(roadmapSteps.roadmapId, roadmapId),
              eq(roadmapSteps.topicId, quiz[0].topicId)
            ));

          // Update roadmap progress
          const allSteps = await tx
            .select({ isCompleted: roadmapSteps.isCompleted })
            .from(roadmapSteps)
            .where(eq(roadmapSteps.roadmapId, roadmapId));

          const completedStepsCount = allSteps.filter(step => step.isCompleted).length;
          const progress = Math.round((completedStepsCount / allSteps.length) * 100);

          await tx
            .update(roadmaps)
            .set({ 
              progress,
              status: progress === 100 ? 'completed' : 'active',
              updatedAt: new Date()
            })
            .where(eq(roadmaps.id, roadmapId));
        }
      }
    }

    const feedback = passed 
      ? `Excellent! You scored ${score}% and can move to the next prerequisite.`
      : `You scored ${score}%. You need 70% or higher to proceed. Review the material and try again.`;

    return { score, passed, feedback };
  });
}

// Get user progress for a roadmap
export async function getUserRoadmapProgress(userId: string, roadmapId: string): Promise<UserProgress[]> {
  const progress = await db
    .select({
      prerequisiteId: topics.id,
      prerequisiteName: topics.name,
      difficulty: topics.metadata,
      knowledgeStatus: userKnowledge.status,
      proficiencyLevel: userKnowledge.proficiencyLevel,
      lastReviewed: userKnowledge.lastReviewedAt
    })
    .from(roadmapSteps)
    .innerJoin(topics, eq(roadmapSteps.topicId, topics.id))
    .leftJoin(userKnowledge, and(
      eq(userKnowledge.topicId, topics.id),
      eq(userKnowledge.userId, userId)
    ))
    .where(eq(roadmapSteps.roadmapId, roadmapId))
    .orderBy(asc(roadmapSteps.order));

  // Get latest quiz scores
  const progressWithScores = await Promise.all(
    progress.map(async (item) => {
      const metadata = item.difficulty ? JSON.parse(item.difficulty as string) : {};
      
      // Get latest quiz attempt
      const latestAttempt = await db
        .select({
          score: quizAttempts.score,
          completedAt: quizAttempts.completedAt
        })
        .from(quizAttempts)
        .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
        .where(and(
          eq(quizAttempts.userId, userId),
          eq(quizzes.topicId, item.prerequisiteId)
        ))
        .orderBy(desc(quizAttempts.completedAt))
        .limit(1);

      return {
        prerequisiteId: item.prerequisiteId,
        prerequisiteName: item.prerequisiteName,
        difficulty: metadata.difficulty || 'basic',
        isUnlocked: item.knowledgeStatus !== 'locked',
        isCompleted: item.knowledgeStatus === 'mastered',
        quizScore: latestAttempt[0]?.score || undefined,
        lastAttemptDate: latestAttempt[0]?.completedAt || undefined
      } as UserProgress;
    })
  );

  return progressWithScores;
}

// Get quiz with questions
export async function getQuizWithQuestions(quizId: string): Promise<{
  quiz: typeof quizzes.$inferSelect;
  questions: (typeof questions.$inferSelect)[];
}> {
  const quiz = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);

  if (!quiz[0]) {
    throw new Error('Quiz not found');
  }

  const quizQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId));

  return {
    quiz: quiz[0],
    questions: quizQuestions
  };
}