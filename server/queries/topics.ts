import { eq, and } from 'drizzle-orm';
import { db } from '@/db/drizzle';
import { topics, roadmapSteps, roadmaps, subtopics, userSubtopicPerformance } from '@/db/schema';
import { createId } from '@paralleldrive/cuid2';
import type { TopicExplanation } from '@/lib/gemini';

export async function getTopicById(topicId: string) {
  const result = await db
    .select()
    .from(topics)
    .where(eq(topics.id, topicId))
    .limit(1);

  return result[0] || null;
}

export async function getRoadmapByTopicId(topicId: string, userId: string) {
  // Find roadmap that contains this topic
  const result = await db
    .select({
      id: roadmaps.id,
      title: roadmaps.title,
      description: roadmaps.description
    })
    .from(roadmapSteps)
    .innerJoin(roadmaps, eq(roadmapSteps.roadmapId, roadmaps.id))
    .where(
      and(
        eq(roadmapSteps.topicId, topicId),
        eq(roadmaps.userId, userId)
      )
    )
    .limit(1);

  return result[0] || null;
}



// Create subtopics and store them in database
export async function createSubtopics(
  parentTopicId: string,
  category: string,
  explanation: TopicExplanation
) {
  return await db.transaction(async (tx) => {
    // Update parent topic with metadata
    const parentTopic = await tx
      .select()
      .from(topics)
      .where(eq(topics.id, parentTopicId))
      .limit(1);

    if (parentTopic[0]) {
      let existingMetadata = {};
      try {
        existingMetadata = JSON.parse(parentTopic[0].metadata as string || '{}');
      } catch {
        console.warn('Failed to parse existing metadata, using empty object');
      }

      await tx
        .update(topics)
        .set({
          metadata: JSON.stringify({
            ...existingMetadata,
            bestPractices: explanation.bestPractices,
            commonPitfalls: explanation.commonPitfalls,
            whyLearn: explanation.whyLearn,
            difficulty: explanation.difficulty
          })
        })
        .where(eq(topics.id, parentTopicId));
    }

    // Create each subtopic in subtopics table
    const errors: Array<{ subtopicId: string; title: string; error: string }> = [];
    
    for (let i = 0; i < explanation.subtopics.length; i++) {
      const subtopic = explanation.subtopics[i];
      const subtopicId = createId();
      
      try {
        await tx.insert(subtopics).values({
          id: subtopicId,
          parentTopicId: parentTopicId,
          name: subtopic.title,
          description: subtopic.explanation,
          order: i + 1,
          metadata: JSON.stringify({
            example: subtopic.example,
            exampleExplanation: subtopic.exampleExplanation,
            keyPoints: subtopic.keyPoints
          })
        });

        console.log(`✅ Created subtopic: ${subtopic.title}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to create subtopic ${subtopic.title}:`, error);
        errors.push({
          subtopicId,
          title: subtopic.title,
          error: errorMessage
        });
      }
    }

    // If any subtopics failed, abort the transaction
    if (errors.length > 0) {
      const failedTitles = errors.map(e => `${e.title} (${e.error})`).join(', ');
      throw new Error(`Failed to create ${errors.length} subtopic(s): ${failedTitles}`);
    }
  });
}

// Get all subtopics for a parent topic - OPTIMIZED with single query
export async function getSubtopics(parentTopicId: string) {
  const result = await db
    .select({
      id: subtopics.id,
      name: subtopics.name,
      description: subtopics.description,
      metadata: subtopics.metadata,
      order: subtopics.order
    })
    .from(subtopics)
    .where(eq(subtopics.parentTopicId, parentTopicId))
    .orderBy(subtopics.order); // Order by display order

  return result;
}

// Get user performance for subtopics
export async function getUserSubtopicPerformance(userId: string, topicId: string) {
  const result = await db
    .select({
      subtopicId: userSubtopicPerformance.subtopicId,
      correctCount: userSubtopicPerformance.correctCount,
      incorrectCount: userSubtopicPerformance.incorrectCount,
      totalAttempts: userSubtopicPerformance.totalAttempts,
      status: userSubtopicPerformance.status,
      lastAttemptAt: userSubtopicPerformance.lastAttemptAt
    })
    .from(userSubtopicPerformance)
    .where(and(
      eq(userSubtopicPerformance.userId, userId),
      eq(userSubtopicPerformance.topicId, topicId)
    ));

  return result;
}
