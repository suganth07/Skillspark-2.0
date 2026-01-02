import { eq, and } from 'drizzle-orm';
import { db } from '@/db/drizzle';
import { topics, roadmapSteps, roadmaps, subtopics, userSubtopicPerformance, userKnowledge } from '@/db/schema';
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



// Create subtopics and store them in database with three content types
export async function createSubtopics(
  parentTopicId: string,
  category: string,
  explanation: TopicExplanation
) {
  console.log(`🗄️ [DB] createSubtopics called for topic: ${parentTopicId}`);
  console.log(`🗄️ [DB] Subtopics to insert: ${explanation.subtopics.length}`);
  
  return await db.transaction(async (tx) => {
    // Update parent topic with metadata
    const parentTopic = await tx
      .select()
      .from(topics)
      .where(eq(topics.id, parentTopicId))
      .limit(1);

    console.log(`🗄️ [DB] Parent topic found: ${parentTopic.length > 0}`);

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
        
      console.log(`🗄️ [DB] Parent topic metadata updated`);
    }

    // Create each subtopic in subtopics table with three content versions
    const errors: Array<{ subtopicId: string; title: string; error: string }> = [];
    
    console.log(`🗄️ [DB] Starting subtopic insertion loop...`);
    
    for (let i = 0; i < explanation.subtopics.length; i++) {
      const subtopic = explanation.subtopics[i];
      const subtopicId = createId();
      
      console.log(`🗄️ [DB] Inserting subtopic ${i + 1}/${explanation.subtopics.length}: "${subtopic.title}"`);
      console.log(`🗄️ [DB] Content lengths - Default: ${subtopic.explanationDefault?.length || 0}, Simplified: ${subtopic.explanationSimplified?.length || 0}, Story: ${subtopic.explanationStory?.length || 0}`);
      
      try {
        await tx.insert(subtopics).values({
          id: subtopicId,
          parentTopicId: parentTopicId,
          name: subtopic.title,
          contentDefault: subtopic.explanationDefault,
          contentSimplified: subtopic.explanationSimplified,
          contentStory: subtopic.explanationStory,
          order: i + 1,
          metadata: JSON.stringify({
            example: subtopic.example,
            exampleExplanation: subtopic.exampleExplanation,
            exampleSimplified: subtopic.exampleSimplified,
            exampleStory: subtopic.exampleStory,
            keyPoints: subtopic.keyPoints
          })
        });

        console.log(`✅ [DB] Created subtopic with 3 content types: ${subtopic.title}`);
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
      contentDefault: subtopics.contentDefault,
      contentSimplified: subtopics.contentSimplified,
      contentStory: subtopics.contentStory,
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

// Update existing subtopics with new adaptive content (after performance-based regeneration)
export async function updateSubtopicsContent(
  parentTopicId: string,
  explanation: TopicExplanation
) {
  return await db.transaction(async (tx) => {
    // Update parent topic metadata
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

    // Update each subtopic with new adaptive content (all three versions)
    const errors: Array<{ subtopic: string; error: unknown }> = [];
    
    for (const subtopic of explanation.subtopics) {
      try {
        await tx
          .update(subtopics)
          .set({
            contentDefault: subtopic.explanationDefault,
            contentSimplified: subtopic.explanationSimplified,
            contentStory: subtopic.explanationStory,
            metadata: JSON.stringify({
              example: subtopic.example,
              exampleExplanation: subtopic.exampleExplanation,
              exampleSimplified: subtopic.exampleSimplified,
              exampleStory: subtopic.exampleStory,
              keyPoints: subtopic.keyPoints
            })
          })
          .where(eq(subtopics.id, subtopic.id));

        console.log(`✅ Updated subtopic with 3 content types: ${subtopic.title}`);
      } catch (error) {
        console.error(`Failed to update subtopic ${subtopic.title}:`, error);
        errors.push({ subtopic: subtopic.title, error });
      }
    }

    // If any errors occurred, abort transaction
    if (errors.length > 0) {
      const errorDetails = errors.map(e => `${e.subtopic}: ${e.error}`).join('; ');
      throw new Error(`Failed to update ${errors.length} subtopic(s): ${errorDetails}`);
    }

    console.log(`💾 Updated ${explanation.subtopics.length} subtopics with adaptive content (3 versions each)`);
  });
}

// Update a single content tone for all subtopics (used when regenerating failed tone)
export async function updateSingleToneContent(
  parentTopicId: string,
  tone: 'default' | 'simplified' | 'story',
  rawContent: {
    subtopics: Array<{
      id?: string;
      title: string;
      explanation: string;
      example?: string;
      exampleExplanation?: string;
      keyPoints?: string[];
    }>;
  }
) {
  console.log(`🔄 Updating ${tone} content for topic ${parentTopicId}`);
  
  // Get existing subtopics to match by title
  const existingSubtopics = await db
    .select({ id: subtopics.id, name: subtopics.name, metadata: subtopics.metadata })
    .from(subtopics)
    .where(eq(subtopics.parentTopicId, parentTopicId));

  const subtopicByTitle = new Map(
    existingSubtopics.map(st => [st.name.toLowerCase().trim(), st])
  );

  let updated = 0;
  for (const newSubtopic of rawContent.subtopics) {
    const existing = subtopicByTitle.get(newSubtopic.title.toLowerCase().trim());
    if (!existing) {
      console.warn(`⚠️ No matching subtopic for "${newSubtopic.title}"`);
      continue;
    }

    // Parse existing metadata
    let metadata: Record<string, any> = {};
    try {
      metadata = JSON.parse(existing.metadata as string || '{}');
    } catch {
      metadata = {};
    }

    // Update only the specific tone
    const updateData: Record<string, any> = {};
    if (tone === 'default') {
      updateData.contentDefault = newSubtopic.explanation;
      metadata.example = newSubtopic.example;
      metadata.exampleExplanation = newSubtopic.exampleExplanation;
      metadata.keyPoints = newSubtopic.keyPoints;
    } else if (tone === 'simplified') {
      updateData.contentSimplified = newSubtopic.explanation;
      metadata.exampleSimplified = newSubtopic.example;
    } else {
      updateData.contentStory = newSubtopic.explanation;
      metadata.exampleStory = newSubtopic.example;
    }
    updateData.metadata = JSON.stringify(metadata);

    await db
      .update(subtopics)
      .set(updateData)
      .where(eq(subtopics.id, existing.id));
    
    updated++;
  }

  console.log(`✅ Updated ${updated}/${rawContent.subtopics.length} subtopics with ${tone} content`);
  return updated;
}

// Check if user needs content regeneration for a topic
export async function checkNeedsRegeneration(userId: string, topicId: string): Promise<boolean> {
  const result = await db
    .select({ needsRegeneration: userKnowledge.needsRegeneration })
    .from(userKnowledge)
    .where(and(
      eq(userKnowledge.userId, userId),
      eq(userKnowledge.topicId, topicId)
    ))
    .limit(1);

  return result[0]?.needsRegeneration ?? false;
}

// Set needsRegeneration flag for a user-topic pair
export async function setNeedsRegeneration(userId: string, topicId: string, value: boolean) {
  await db
    .update(userKnowledge)
    .set({ needsRegeneration: value })
    .where(and(
      eq(userKnowledge.userId, userId),
      eq(userKnowledge.topicId, topicId)
    ));
  
  console.log(`🔄 Set needsRegeneration=${value} for user ${userId}, topic ${topicId}`);
}

// Mark content regeneration as needed after quiz completion
export async function markContentForRegeneration(userId: string, topicId: string) {
  // Check if user knowledge record exists
  const existing = await db
    .select({ id: userKnowledge.id })
    .from(userKnowledge)
    .where(and(
      eq(userKnowledge.userId, userId),
      eq(userKnowledge.topicId, topicId)
    ))
    .limit(1);

  if (existing[0]) {
    await setNeedsRegeneration(userId, topicId, true);
  } else {
    // Create user knowledge record with needsRegeneration = true
    await db.insert(userKnowledge).values({
      userId,
      topicId,
      status: 'available',
      needsRegeneration: true
    });
    console.log(`📝 Created userKnowledge with needsRegeneration=true for user ${userId}, topic ${topicId}`);
  }
}
