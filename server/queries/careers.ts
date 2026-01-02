// server/queries/careers.ts - Server-side queries for career paths
import { db } from '@/db/drizzle';
import { careerPaths, careerTopics } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type { CareerPathResult, CareerTopic } from '@/server/agents/CareerPath';

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
 * Get all career paths for a user
 */
export async function getUserCareerPaths(userId: string) {
  const paths = await db
    .select()
    .from(careerPaths)
    .where(eq(careerPaths.userId, userId))
    .orderBy(desc(careerPaths.createdAt));

  return paths;
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
    categories: JSON.parse(path.categories as string) as string[],
    topics: topics.map(topic => ({
      ...topic,
      prerequisites: JSON.parse(topic.prerequisites as string) as string[],
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
