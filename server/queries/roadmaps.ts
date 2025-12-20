import { and, eq, desc, asc } from 'drizzle-orm';
import { db } from '@/db/drizzle';
import { 
  roadmaps, 
  roadmapSteps, 
  topics, 
  subtopics,
  quizzes, 
  questions, 
  quizAttempts, 
  userKnowledge,
  userSubtopicPerformance,
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
  hasAttempt?: boolean; // Whether user has attempted this quiz
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
      // Check if user knowledge already exists for this topic
      const existingKnowledge = await tx
        .select({ id: userKnowledge.id })
        .from(userKnowledge)
        .where(and(
          eq(userKnowledge.userId, userId),
          eq(userKnowledge.topicId, topicIds[prereq.id])
        ))
        .limit(1);

      if (existingKnowledge[0]) {
        continue; // Skip if already exists
      }

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

    // Create questions with subtopic linking
    for (const question of quizQuestions) {
      await tx.insert(questions).values({
        quizId,
        subtopicId: question.subtopicId || null, // Link to subtopic if available
        content: question.content,
        type: question.type,
        data: JSON.stringify({
          ...question.data,
          subtopicName: question.subtopicName // Store subtopic name in data for tracking
        })
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
      let hasAttempt = false;

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

        // Check if user has attempted this quiz
        if (quizId) {
          const attempt = await db
            .select({ id: quizAttempts.id })
            .from(quizAttempts)
            .where(and(
              eq(quizAttempts.userId, userId),
              eq(quizAttempts.quizId, quizId)
            ))
            .limit(1);
          
          hasAttempt = !!attempt[0];
        }
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
        hasAttempt,
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
): Promise<{ score: number; passed: boolean; feedback: string; weakSubtopics: string[] }> {
  return await db.transaction(async (tx) => {
    // Get quiz questions with subtopic info
    const quizQuestions = await tx
      .select({
        id: questions.id,
        content: questions.content,
        data: questions.data,
        subtopicId: questions.subtopicId
      })
      .from(questions)
      .where(eq(questions.quizId, quizId));

    // Get quiz to find topicId
    const quiz = await tx
      .select({ topicId: quizzes.topicId })
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .limit(1);

    // Calculate score and track subtopic performance
    let correct = 0;
    const details: Record<string, any> = {};
    const subtopicPerformance: Map<string, { correct: number; incorrect: number; name: string }> = new Map();

    for (const question of quizQuestions) {
      const userAnswer = answers[question.id];
      
      // Guard against malformed JSON data
      let questionData: any;
      try {
        questionData = JSON.parse(question.data as string);
      } catch (error) {
        console.error(`Failed to parse question data for question ${question.id}:`, error);
        // Provide safe fallback for malformed question data
        details[question.id] = {
          answer: userAnswer,
          correct: false,
          correctAnswer: null,
          explanation: 'Question data is malformed and could not be processed',
          error: 'Parse error'
        };
        continue; // Skip to next question
      }
      
      // Check if user selected "Not sure" (last option, typically index 4)
      const isNotSure = questionData.options && 
                        userAnswer === questionData.options.length - 1 && 
                        questionData.options[userAnswer]?.toLowerCase().includes('not sure');
      
      // Mark as correct only if answer matches and not "Not sure"
      const isCorrect = !isNotSure && userAnswer === questionData.correct;
      
      if (isCorrect) correct++;
      
      details[question.id] = {
        answer: userAnswer,
        correct: isCorrect,
        correctAnswer: questionData.correct,
        explanation: questionData.explanation,
        subtopicName: questionData.subtopicName
      };

      // Track subtopic performance
      if (question.subtopicId) {
        const existing = subtopicPerformance.get(question.subtopicId) || { 
          correct: 0, 
          incorrect: 0,
          name: questionData.subtopicName || 'Unknown'
        };
        
        if (isCorrect) {
          existing.correct++;
        } else {
          existing.incorrect++;
        }
        
        subtopicPerformance.set(question.subtopicId, existing);
      }
    }

    // Update user subtopic performance in database
    const weakSubtopics: string[] = [];
    
    for (const [subtopicId, perf] of subtopicPerformance.entries()) {
      const totalAttempts = perf.correct + perf.incorrect;
      const accuracy = totalAttempts > 0 ? (perf.correct / totalAttempts) : 0;
      
      // Determine status: weak if accuracy < 50%, strong if >= 70%, neutral otherwise
      let status: 'weak' | 'strong' | 'neutral' = 'neutral';
      if (accuracy < 0.5) {
        status = 'weak';
        weakSubtopics.push(perf.name);
      } else if (accuracy >= 0.7) {
        status = 'strong';
      }

      // Check if record exists
      const existingPerf = await tx
        .select({ id: userSubtopicPerformance.id })
        .from(userSubtopicPerformance)
        .where(and(
          eq(userSubtopicPerformance.userId, userId),
          eq(userSubtopicPerformance.subtopicId, subtopicId)
        ))
        .limit(1);

      if (existingPerf[0]) {
        // Update existing record
        const current = await tx
          .select()
          .from(userSubtopicPerformance)
          .where(eq(userSubtopicPerformance.id, existingPerf[0].id))
          .limit(1);

        const currentData = current[0];
        const newCorrect = (currentData.correctCount || 0) + perf.correct;
        const newIncorrect = (currentData.incorrectCount || 0) + perf.incorrect;
        const newTotal = (currentData.totalAttempts || 0) + totalAttempts;
        const newAccuracy = newTotal > 0 ? (newCorrect / newTotal) : 0;
        
        let newStatus: 'weak' | 'strong' | 'neutral' = 'neutral';
        if (newAccuracy < 0.5) {
          newStatus = 'weak';
        } else if (newAccuracy >= 0.7) {
          newStatus = 'strong';
        }

        await tx
          .update(userSubtopicPerformance)
          .set({
            correctCount: newCorrect,
            incorrectCount: newIncorrect,
            totalAttempts: newTotal,
            status: newStatus,
            lastAttemptAt: new Date()
          })
          .where(eq(userSubtopicPerformance.id, existingPerf[0].id));
      } else {
        // Create new record
        await tx.insert(userSubtopicPerformance).values({
          userId,
          subtopicId,
          topicId: quiz[0]?.topicId || '',
          correctCount: perf.correct,
          incorrectCount: perf.incorrect,
          totalAttempts,
          status,
          lastAttemptAt: new Date()
        });
      }
    }

    // Guard against division by zero
    const score = quizQuestions.length > 0 
      ? Math.round((correct / quizQuestions.length) * 100)
      : 0;
    const passed = score >= 70; // 70% passing score
    
    // Record quiz attempt
    const attemptId = createId();
    await tx.insert(quizAttempts).values({
      id: attemptId,
      userId,
      quizId,
      score,
      passed,
      details: details // Don't stringify - Drizzle handles it with mode: "json"
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
          const progress = allSteps.length > 0 ? Math.round((completedStepsCount / allSteps.length) * 100) 
            : 0;

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
      ? `Excellent! You scored ${score}% and can move to the next prerequisite.${weakSubtopics.length > 0 ? `\n\nNote: You may want to review these subtopics: ${weakSubtopics.join(', ')}` : ''}`
      : `You scored ${score}%. You need 70% or higher to proceed. Review the material and try again.${weakSubtopics.length > 0 ? `\n\nFocus on these weak areas: ${weakSubtopics.join(', ')}` : ''}`;

    return { score, passed, feedback, weakSubtopics };
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

export interface QuizResultDetail {
  questionId: string;
  question: string;
  options: string[];
  userAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
  explanation: string;
  subtopicName?: string;
}

export async function getQuizResults(
  userId: string,
  quizId: string
): Promise<{
  score: number;
  passed: boolean;
  completedAt: Date | null;
  results: QuizResultDetail[];
}> {
  console.log('🔍 getQuizResults called with:', { userId, quizId });
  
  // Get the latest quiz attempt for this user
  const attempt = await db
    .select()
    .from(quizAttempts)
    .where(and(
      eq(quizAttempts.userId, userId),
      eq(quizAttempts.quizId, quizId)
    ))
    .orderBy(desc(quizAttempts.completedAt))
    .limit(1);

  console.log('📊 Found attempts:', attempt.length);

  if (!attempt[0]) {
    console.error('❌ No quiz attempt found for userId:', userId, 'quizId:', quizId);
    throw new Error('No quiz attempt found');
  }

  console.log('✅ Attempt found:', { 
    id: attempt[0].id, 
    score: attempt[0].score, 
    passed: attempt[0].passed,
    completedAt: attempt[0].completedAt
  });

  // Get quiz questions
  const quizQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId));

  console.log('📝 Found questions:', quizQuestions.length);

  // Parse details to get user answers
  const attemptDetails = attempt[0].details as Record<string, any>;
  console.log('📋 Attempt details keys:', Object.keys(attemptDetails || {}));
  const results: QuizResultDetail[] = [];

  for (const question of quizQuestions) {
    const questionData = JSON.parse(question.data as string);
    const answerDetail = attemptDetails[question.id];

    if (answerDetail) {
      results.push({
        questionId: question.id,
        question: question.content,
        options: questionData.options,
        userAnswer: answerDetail.answer,
        correctAnswer: answerDetail.correctAnswer,
        isCorrect: answerDetail.correct,
        explanation: answerDetail.explanation,
        subtopicName: answerDetail.subtopicName
      });
    } else {
      console.warn('⚠️ No answer detail found for question:', question.id);
    }
  }

  console.log('✅ Returning', results.length, 'results');

  return {
    score: attempt[0].score || 0,
    passed: attempt[0].passed || false,
    completedAt: attempt[0].completedAt,
    results
  };
}

export async function deleteRoadmap(userId: string, roadmapId: string): Promise<void> {
  return await db.transaction(async (tx) => {
    console.log('🗑️ Starting roadmap deletion:', { userId, roadmapId });

    // Verify ownership
    const roadmap = await tx
      .select({ id: roadmaps.id })
      .from(roadmaps)
      .where(and(
        eq(roadmaps.id, roadmapId),
        eq(roadmaps.userId, userId)
      ))
      .limit(1);

    if (!roadmap[0]) {
      throw new Error('Roadmap not found or you do not have permission to delete it');
    }

    // Get all quizzes associated with this roadmap
    const roadmapQuizzes = await tx
      .select({ id: quizzes.id })
      .from(quizzes)
      .where(eq(quizzes.roadmapId, roadmapId));

    const quizIds = roadmapQuizzes.map(q => q.id);

    // Delete quiz attempts for all quizzes
    if (quizIds.length > 0) {
      for (const quizId of quizIds) {
        await tx
          .delete(quizAttempts)
          .where(eq(quizAttempts.quizId, quizId));
        
        console.log('✅ Deleted quiz attempts for quiz:', quizId);
      }

      // Delete questions for all quizzes
      for (const quizId of quizIds) {
        await tx
          .delete(questions)
          .where(eq(questions.quizId, quizId));
        
        console.log('✅ Deleted questions for quiz:', quizId);
      }

      // Delete all quizzes
      await tx
        .delete(quizzes)
        .where(eq(quizzes.roadmapId, roadmapId));
      
      console.log('✅ Deleted quizzes');
    }

    // Get all topics from roadmap steps
    const steps = await tx
      .select({ topicId: roadmapSteps.topicId })
      .from(roadmapSteps)
      .where(eq(roadmapSteps.roadmapId, roadmapId));

    const topicIds = steps.map(s => s.topicId).filter(Boolean) as string[];

    // Delete subtopics and their performance data
    if (topicIds.length > 0) {
      for (const topicId of topicIds) {
        // Get subtopic IDs
        const topicSubtopics = await tx
          .select({ id: subtopics.id })
          .from(subtopics)
          .where(eq(subtopics.parentTopicId, topicId));

        const subtopicIds = topicSubtopics.map(st => st.id);

        // Delete user subtopic performance
        if (subtopicIds.length > 0) {
          for (const subtopicId of subtopicIds) {
            await tx
              .delete(userSubtopicPerformance)
              .where(eq(userSubtopicPerformance.subtopicId, subtopicId));
          }
          console.log('✅ Deleted subtopic performance data');
        }

        // Delete subtopics
        await tx
          .delete(subtopics)
          .where(eq(subtopics.parentTopicId, topicId));
        
        console.log('✅ Deleted subtopics for topic:', topicId);

        // Delete user knowledge for topics
        await tx
          .delete(userKnowledge)
          .where(and(
            eq(userKnowledge.topicId, topicId),
            eq(userKnowledge.userId, userId)
          ));
        
        // Delete topics
        await tx
          .delete(topics)
          .where(eq(topics.id, topicId));
        
        console.log('✅ Deleted topic:', topicId);
      }
    }

    // Delete roadmap steps
    await tx
      .delete(roadmapSteps)
      .where(eq(roadmapSteps.roadmapId, roadmapId));
    
    console.log('✅ Deleted roadmap steps');

    // Delete the roadmap itself
    await tx
      .delete(roadmaps)
      .where(eq(roadmaps.id, roadmapId));
    
    console.log('✅ Deleted roadmap');
  });
}