import { eq } from "drizzle-orm";
import { db } from "../../db/drizzle";
import { users, type UserSchema } from "../../db/schema";
import type { z } from "zod";
import { calculateLevel, checkLevelUp } from "@/lib/gamification";

type User = z.infer<typeof UserSchema>;

export const getAllUsers = async (): Promise<User[]> => {
  return await db.select().from(users).orderBy(users.createdAt);
};

export const getUserById = async (id: string): Promise<User | undefined> => {
  return await db.query.users.findFirst({
    where: eq(users.id, id),
  });
};

export const createUser = async (name: string): Promise<User> => {
  const [newUser] = await db.insert(users).values({ name }).returning();
  return newUser;
};

export const deleteUser = async (id: string): Promise<void> => {
  await db.delete(users).where(eq(users.id, id));
};

export const updateUser = async (id: string, data: Partial<User>): Promise<User> => {
  const [updated] = await db
    .update(users)
    .set(data)
    .where(eq(users.id, id))
    .returning();
  return updated;
};

/**
 * Award XP to a user and automatically update their level
 * Returns the updated user and whether they leveled up
 */
export const awardXP = async (
  userId: string, 
  xpAmount: number
): Promise<{ 
  user: User; 
  leveledUp: boolean; 
  oldLevel: number; 
  newLevel: number;
  xpGained: number;
  oldXP: number;
  newXP: number;
}> => {
  // Get current user
  const currentUser = await getUserById(userId);
  if (!currentUser) {
    throw new Error('User not found');
  }

  const oldXP = currentUser.xp || 0;
  const newXP = Math.max(0, oldXP + xpAmount); // Prevent negative XP
  const oldLevel = currentUser.level || 1;
  
  // Calculate new level based on new XP
  const newLevel = calculateLevel(newXP);
  
  // Update user with new XP and level
  const [updatedUser] = await db
    .update(users)
    .set({ 
      xp: newXP,
      level: newLevel,
    })
    .where(eq(users.id, userId))
    .returning();

  return {
    user: updatedUser,
    leveledUp: newLevel > oldLevel,
    oldLevel,
    newLevel,
    xpGained: xpAmount,
    oldXP,
    newXP,
  };
};
