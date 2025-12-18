import { sql, relations } from "drizzle-orm";
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import type { z } from "zod";

// --- Users ---
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").default("Student"),
  avatarUrl: text("avatar_url"),

  // Gamification
  xp: integer("xp").default(0),
  level: integer("level").default(1),
  currentStreak: integer("current_streak").default(0),

  isOnboarded: integer("is_onboarded", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
});

// --- Roadmaps ---
export const roadmaps = sqliteTable("roadmaps", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),

  // Preferences: { detailLevel: string, tone: string, weeklyHours: number, ... }
  preferences: text("preferences", { mode: "json" }).default("{}"),

  status: text("status", { enum: ["active", "completed", "archived"] }).default("active"),
  progress: integer("progress").default(0),

  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// --- Roadmap Steps ---
export const roadmapSteps = sqliteTable(
  "roadmap_steps",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    roadmapId: text("roadmap_id").references(() => roadmaps.id).notNull(),

    order: integer("order").notNull(),
    title: text("title").notNull(),
    content: text("content"), // Markdown
    durationMinutes: integer("duration_minutes"),

    isCompleted: integer("is_completed", { mode: "boolean" }).default(false),

    // Link to graph (optional)
    topicId: text("topic_id"), // keep loose coupling (no FK) as you intended
  },
  (t) => [
    index("roadmap_steps_roadmap_id_idx").on(t.roadmapId),
  ]
);

// --- Knowledge Graph ---
export const topics = sqliteTable(
  "topics",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    name: text("name").notNull().unique(),
    description: text("description"),
    category: text("category").notNull(), // e.g., "React", "Algorithm", "Biology"

    // JSON metadata: { embeddings: number[], difficulty: "beginner"|"advanced", tags: string[] }
    metadata: text("metadata", { mode: "json" }).default("{}"),
  },
  (t) => [
    index("topics_category_idx").on(t.category),
  ]
);

export const topicRelationships = sqliteTable(
  "topic_relationships",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    sourceTopicId: text("source_topic_id").references(() => topics.id).notNull(),
    targetTopicId: text("target_topic_id").references(() => topics.id).notNull(),

    // "prerequisite", "related", "subtopic"
    type: text("type").notNull(),
  },
  (t) => [
    index("topic_relationships_source_target_idx").on(t.sourceTopicId, t.targetTopicId),
  ]
);

export const userKnowledge = sqliteTable(
  "user_knowledge",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").references(() => users.id).notNull(),
    topicId: text("topic_id").references(() => topics.id).notNull(),

    // State
    proficiencyLevel: integer("proficiency_level").default(0), // 0-100
    status: text("status", { enum: ["locked", "available", "coding", "mastered"] }).default("locked"),

    lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp" }),
    strength: integer("strength").default(100), // Spaced repetition strength
  },
  (t) => [
    uniqueIndex("user_knowledge_user_topic_idx").on(t.userId, t.topicId),
  ]
);

// --- Quizzes ---
export const quizzes = sqliteTable("quizzes", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  title: text("title"),

  topicId: text("topic_id").references(() => topics.id),
  roadmapId: text("roadmap_id").references(() => roadmaps.id),

  type: text("type", { enum: ["proficiency_check", "topic_quiz", "daily_review"] }).notNull(),
  difficulty: text("difficulty"),

  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  quizId: text("quiz_id").references(() => quizzes.id).notNull(),

  content: text("content").notNull(),
  type: text("type", { enum: ["multiple_choice", "text", "code"] }).default("multiple_choice"),

  // { options: ["A", "B"], correct: "A", codeSnippet: "..." }
  data: text("data", { mode: "json" }).notNull(),
});

export const quizAttempts = sqliteTable("quiz_attempts", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").references(() => users.id).notNull(),
  quizId: text("quiz_id").references(() => quizzes.id).notNull(),

  score: integer("score"),
  passed: integer("passed", { mode: "boolean" }),

  // { "q_id_1": { answer: "A", correct: true }, ... }
  details: text("details", { mode: "json" }),

  completedAt: integer("completed_at", { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
});

// ---------------- Relations ----------------

export const usersRelations = relations(users, ({ many }) => ({
  roadmaps: many(roadmaps),
  knowledge: many(userKnowledge),
  quizAttempts: many(quizAttempts),
}));

export const roadmapsRelations = relations(roadmaps, ({ one, many }) => ({
  user: one(users, { fields: [roadmaps.userId], references: [users.id] }),
  steps: many(roadmapSteps),
}));

export const roadmapStepsRelations = relations(roadmapSteps, ({ one }) => ({
  roadmap: one(roadmaps, { fields: [roadmapSteps.roadmapId], references: [roadmaps.id] }),
  topic: one(topics, { fields: [roadmapSteps.topicId], references: [topics.id] }),
}));

export const topicsRelations = relations(topics, ({ many }) => ({
  outgoingRelations: many(topicRelationships, { relationName: "source" }),
  incomingRelations: many(topicRelationships, { relationName: "target" }),
  userStates: many(userKnowledge),
}));

export const topicRelationshipsRelations = relations(topicRelationships, ({ one }) => ({
  source: one(topics, {
    fields: [topicRelationships.sourceTopicId],
    references: [topics.id],
    relationName: "source",
  }),
  target: one(topics, {
    fields: [topicRelationships.targetTopicId],
    references: [topics.id],
    relationName: "target",
  }),
}));

// ---------------- Zod Schemas ----------------

export const UserSchema = createSelectSchema(users);
export const InsertUserSchema = createInsertSchema(users);

export const RoadmapSchema = createSelectSchema(roadmaps);
export const TopicSchema = createSelectSchema(topics);
  