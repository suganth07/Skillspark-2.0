import { eq } from "drizzle-orm";
import { db } from "../../db/drizzle";
import { users, type UserSchema } from "../../db/schema";
import type { z } from "zod";

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
