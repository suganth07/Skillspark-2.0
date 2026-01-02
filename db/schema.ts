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
    lastCompletedAt: integer("last_completed_at", { mode: "timestamp" }),

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
    
    // For prerequisites - previous topic that must be completed first
    previousTopicId: text("previous_topic_id").references((): any => topics.id),

    // JSON metadata: { difficulty: "basic"|"intermediate"|"advanced", estimatedHours: number, ... }
    metadata: text("metadata", { mode: "json" }).default("{}"),
    
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    index("topics_category_idx").on(t.category),
    index("topics_previous_idx").on(t.previousTopicId),
  ]
);

// Subtopics - direct children of topics for faster retrieval
export const subtopics = sqliteTable(
  "subtopics",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    parentTopicId: text("parent_topic_id").references(() => topics.id).notNull(),
    
    name: text("name").notNull(),
    
    // Three types of content for adaptive learning
    contentDefault: text("content_default"), // Normal default explanation
    contentSimplified: text("content_simplified"), // Simpler, longer with more examples
    contentStory: text("content_story"), // Story-based version
    
    order: integer("order").notNull(), // Display order within parent topic
    
    // JSON metadata: { example: string, exampleExplanation: string, keyPoints: string[], exampleSimplified: string, exampleStory: string }
    metadata: text("metadata", { mode: "json" }).default("{}"),
    
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    index("subtopics_parent_idx").on(t.parentTopicId),
    index("subtopics_order_idx").on(t.parentTopicId, t.order),
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

    // Content regeneration flag - set to true when quiz completed, reset to false after regeneration
    needsRegeneration: integer("needs_regeneration", { mode: "boolean" }).default(false),
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
  subtopicId: text("subtopic_id").references(() => subtopics.id), // Link to subtopic for tracking

  content: text("content").notNull(),
  type: text("type", { enum: ["multiple_choice", "text", "code"] }).default("multiple_choice"),

  // { options: ["A", "B"], correct: "A", codeSnippet: "...", subtopicName: "..." }
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

// Track user performance per subtopic
export const userSubtopicPerformance = sqliteTable(
  "user_subtopic_performance",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").references(() => users.id).notNull(),
    subtopicId: text("subtopic_id").references(() => subtopics.id).notNull(),
    topicId: text("topic_id").references(() => topics.id).notNull(),
    
    // Performance tracking
    correctCount: integer("correct_count").default(0),
    incorrectCount: integer("incorrect_count").default(0),
    totalAttempts: integer("total_attempts").default(0),
    
    // Strong/Weak status
    status: text("status", { enum: ["strong", "weak", "neutral"] }).default("neutral"),
    
    lastAttemptAt: integer("last_attempt_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    uniqueIndex("user_subtopic_performance_user_subtopic_idx").on(t.userId, t.subtopicId),
  ]
);

// --- Topic Videos ---
// Stores metadata for AI-generated videos (file stored locally, only metadata in DB)
export const topicVideos = sqliteTable(
  "topic_videos",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    topicId: text("topic_id").references(() => topics.id).notNull(),
    userId: text("user_id").references(() => users.id).notNull(),
    
    // HeyGen video ID
    heygenVideoId: text("heygen_video_id").notNull(),
    
    // Remote URL (expires after ~7 days)
    remoteUrl: text("remote_url").notNull(),
    
    // Local file path (persistent)
    localFilePath: text("local_file_path"),
    
    // Status of video
    status: text("status", { enum: ["pending", "downloading", "ready", "error"] }).default("pending"),
    
    // File size in bytes (for storage management)
    fileSizeBytes: integer("file_size_bytes"),
    
    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
    downloadedAt: integer("downloaded_at", { mode: "timestamp" }),
  },
  (t) => [
    uniqueIndex("topic_videos_topic_user_idx").on(t.topicId, t.userId),
    index("topic_videos_topic_idx").on(t.topicId),
  ]
);

// --- Career Paths ---
export const careerPaths = sqliteTable(
  "career_paths",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").references(() => users.id).notNull(),
    roleName: text("role_name").notNull(),
    roleDescription: text("role_description"),
    totalEstimatedHours: integer("total_estimated_hours").default(0),
    
    // JSON array of category names
    categories: text("categories", { mode: "json" }).default("[]"),
    
    progress: integer("progress").default(0), // 0-100
    status: text("status", { enum: ["active", "completed", "archived"] }).default("active"),
    
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (t) => [
    index("career_paths_user_idx").on(t.userId),
  ]
);

// --- Career Topics (topics within a career path) ---
export const careerTopics = sqliteTable(
  "career_topics",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    careerPathId: text("career_path_id").references(() => careerPaths.id).notNull(),
    
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    difficulty: text("difficulty", { enum: ["basic", "intermediate", "advanced"] }).notNull(),
    estimatedHours: integer("estimated_hours").default(0),
    order: integer("order").notNull(),
    isCore: integer("is_core", { mode: "boolean" }).default(true),
    
    // JSON array of prerequisite topic names
    prerequisites: text("prerequisites", { mode: "json" }).default("[]"),
    
    // Link to actual topic if it exists
    linkedTopicId: text("linked_topic_id").references(() => topics.id),
    
    isCompleted: integer("is_completed", { mode: "boolean" }).default(false),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    index("career_topics_career_path_idx").on(t.careerPathId),
    index("career_topics_linked_topic_idx").on(t.linkedTopicId),
  ]
);

// ---------------- Relations ----------------

export const usersRelations = relations(users, ({ many }) => ({
  roadmaps: many(roadmaps),
  knowledge: many(userKnowledge),
  quizAttempts: many(quizAttempts),
  careerPaths: many(careerPaths),
}));

export const roadmapsRelations = relations(roadmaps, ({ one, many }) => ({
  user: one(users, { fields: [roadmaps.userId], references: [users.id] }),
  steps: many(roadmapSteps),
}));

export const roadmapStepsRelations = relations(roadmapSteps, ({ one }) => ({
  roadmap: one(roadmaps, { fields: [roadmapSteps.roadmapId], references: [roadmaps.id] }),
  topic: one(topics, { fields: [roadmapSteps.topicId], references: [topics.id] }),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
  previousTopic: one(topics, {
    fields: [topics.previousTopicId],
    references: [topics.id],
    relationName: "prerequisite",
  }),
  nextTopics: many(topics, { relationName: "prerequisite" }),
  subtopics: many(subtopics),
  userStates: many(userKnowledge),
}));

export const subtopicsRelations = relations(subtopics, ({ one }) => ({
  parentTopic: one(topics, {
    fields: [subtopics.parentTopicId],
    references: [topics.id],
  }),
}));

export const topicVideosRelations = relations(topicVideos, ({ one }) => ({
  topic: one(topics, {
    fields: [topicVideos.topicId],
    references: [topics.id],
  }),
  user: one(users, {
    fields: [topicVideos.userId],
    references: [users.id],
  }),
}));

export const careerPathsRelations = relations(careerPaths, ({ one, many }) => ({
  user: one(users, {
    fields: [careerPaths.userId],
    references: [users.id],
  }),
  topics: many(careerTopics),
}));

export const careerTopicsRelations = relations(careerTopics, ({ one }) => ({
  careerPath: one(careerPaths, {
    fields: [careerTopics.careerPathId],
    references: [careerPaths.id],
  }),
  linkedTopic: one(topics, {
    fields: [careerTopics.linkedTopicId],
    references: [topics.id],
  }),
}));

// ---------------- Zod Schemas ----------------

export const UserSchema = createSelectSchema(users);
export const InsertUserSchema = createInsertSchema(users);

export const RoadmapSchema = createSelectSchema(roadmaps);
export const TopicSchema = createSelectSchema(topics);
export const TopicVideoSchema = createSelectSchema(topicVideos);
export const InsertTopicVideoSchema = createInsertSchema(topicVideos);

export const CareerPathSchema = createSelectSchema(careerPaths);
export const InsertCareerPathSchema = createInsertSchema(careerPaths);
export const CareerTopicSchema = createSelectSchema(careerTopics);
export const InsertCareerTopicSchema = createInsertSchema(careerTopics);
  