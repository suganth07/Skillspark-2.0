// server/queries/careers.ts - Server-side queries for career paths
import { db } from '@/db/drizzle';
import { careerPaths, careerTopics } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type { CareerPathResult, CareerTopic } from '@/server/agents/CareerPath';

/**
 * Safely parse JSON string to array with fallback
 */
function safeParseJsonArray(value: unknown, defaultValue: string[] = []): string[] {
  if (typeof value !== 'string') return defaultValue;
  
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    console.warn('JSON parsed successfully but result is not an array:', parsed);
    return defaultValue;
  } catch (error) {
    console.error('Failed to parse JSON array:', error instanceof Error ? error.message : String(error), 'Value:', value);
    return defaultValue;
  }
}

/**
 * Create a new career path with topics
 */
export async function createCareerPath(
  userId: string,
  careerPathData: CareerPathResult
): Promise<string> {
  console.log('💼 Creating career path:', careerPathData.roleName);

  // Insert career path
  const [careerPath] = await db.insert(careerPaths).values({
    id: createId(),
    userId,
    roleName: careerPathData.roleName,
    roleDescription: careerPathData.roleDescription,
    totalEstimatedHours: careerPathData.totalEstimatedHours,
    categories: JSON.stringify(careerPathData.categories),
    status: 'active',
    progress: 0,
  }).returning();

  // Insert career topics
  const topicsToInsert = careerPathData.topics.map((topic: CareerTopic) => ({
    id: createId(),
    careerPathId: careerPath.id,
    name: topic.name,
    description: topic.description,
    category: topic.category,
    difficulty: topic.difficulty,
    estimatedHours: topic.estimatedHours,
    order: topic.order,
    isCore: topic.isCore,
    prerequisites: JSON.stringify(topic.prerequisites),
    linkedTopicId: null, // Will be linked later when topics are created
    isCompleted: false,
  }));

  await db.insert(careerTopics).values(topicsToInsert);

  console.log(`✅ Created career path with ${topicsToInsert.length} topics`);
  return careerPath.id;
}

/**
 * Get all career paths for a user with topic counts
 */
export async function getUserCareerPaths(userId: string) {
  const paths = await db
    .select()
    .from(careerPaths)
    .where(eq(careerPaths.userId, userId))
    .orderBy(desc(careerPaths.createdAt));

  // Get topic counts for each path
  const pathsWithCounts = await Promise.all(
    paths.map(async (path) => {
      const topics = await db
        .select()
        .from(careerTopics)
        .where(eq(careerTopics.careerPathId, path.id));

      const completedCount = topics.filter(t => t.isCompleted).length;

      return {
        ...path,
        categories: safeParseJsonArray(path.categories, []),
        topicsCount: topics.length,
        completedTopics: completedCount,
      };
    })
  );

  return pathsWithCounts;
}

/**
 * Get a single career path with all its topics
 */
export async function getCareerPathWithTopics(careerPathId: string, userId: string) {
  // Get career path
  const [path] = await db
    .select()
    .from(careerPaths)
    .where(
      and(
        eq(careerPaths.id, careerPathId),
        eq(careerPaths.userId, userId)
      )
    );

  if (!path) {
    throw new Error('Career path not found');
  }

  // Get all topics for this career path
  const topics = await db
    .select()
    .from(careerTopics)
    .where(eq(careerTopics.careerPathId, careerPathId))
    .orderBy(careerTopics.order);

  return {
    ...path,
    categories: safeParseJsonArray(path.categories, []),
    topics: topics.map(topic => ({
      ...topic,
      prerequisites: safeParseJsonArray(topic.prerequisites, []),
    })),
  };
}

/**
 * Delete a career path and all its topics
 */
export async function deleteCareerPath(userId: string, careerPathId: string) {
  // First delete all topics
  await db
    .delete(careerTopics)
    .where(eq(careerTopics.careerPathId, careerPathId));

  // Then delete the career path
  await db
    .delete(careerPaths)
    .where(
      and(
        eq(careerPaths.id, careerPathId),
        eq(careerPaths.userId, userId)
      )
    );

  console.log('🗑️ Deleted career path:', careerPathId);
}

/**
 * Update career topic completion status
 */
export async function updateCareerTopicCompletion(
  topicId: string,
  isCompleted: boolean
) {
  await db
    .update(careerTopics)
    .set({
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
    })
    .where(eq(careerTopics.id, topicId));

  console.log(`✅ Updated topic ${topicId} completion:`, isCompleted);
}

/**
 * Link a roadmap to a career topic
 */
export async function linkRoadmapToCareerTopic(
  careerTopicId: string,
  roadmapId: string
) {
  await db
    .update(careerTopics)
    .set({
      linkedRoadmapId: roadmapId,
    })
    .where(eq(careerTopics.id, careerTopicId));

  console.log(`🔗 Linked roadmap ${roadmapId} to career topic ${careerTopicId}`);
}

/**
 * Get a career topic by ID
 */
export async function getCareerTopicById(topicId: string) {
  const [topic] = await db
    .select()
    .from(careerTopics)
    .where(eq(careerTopics.id, topicId));

  if (!topic) {
    return null;
  }

  return {
    ...topic,
    prerequisites: JSON.parse(topic.prerequisites as string) as string[],
  };
}
