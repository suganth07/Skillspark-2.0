CREATE TABLE `career_paths` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role_name` text NOT NULL,
	`role_description` text,
	`total_estimated_hours` integer DEFAULT 0,
	`categories` text DEFAULT '[]',
	`progress` integer DEFAULT 0,
	`status` text DEFAULT 'active',
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `career_paths_user_idx` ON `career_paths` (`user_id`);--> statement-breakpoint
CREATE TABLE `career_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`career_path_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`difficulty` text NOT NULL,
	`estimated_hours` integer DEFAULT 0,
	`order` integer NOT NULL,
	`is_core` integer DEFAULT true,
	`prerequisite_ids` text DEFAULT '[]',
	`linked_topic_id` text,
	`linked_roadmap_id` text,
	`is_completed` integer DEFAULT false,
	`completed_at` integer,
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`career_path_id`) REFERENCES `career_paths`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`linked_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_roadmap_id`) REFERENCES `roadmaps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `career_topics_career_path_idx` ON `career_topics` (`career_path_id`);--> statement-breakpoint
CREATE INDEX `career_topics_linked_topic_idx` ON `career_topics` (`linked_topic_id`);--> statement-breakpoint
CREATE INDEX `career_topics_linked_roadmap_idx` ON `career_topics` (`linked_roadmap_id`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`subtopic_id` text,
	`content` text NOT NULL,
	`type` text DEFAULT 'multiple_choice',
	`data` text NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subtopic_id`) REFERENCES `subtopics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`quiz_id` text NOT NULL,
	`score` integer,
	`passed` integer,
	`details` text,
	`completed_at` integer DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`topic_id` text,
	`roadmap_id` text,
	`type` text NOT NULL,
	`difficulty` text,
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`roadmap_id`) REFERENCES `roadmaps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `roadmap_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`roadmap_id` text NOT NULL,
	`order` integer NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`duration_minutes` integer,
	`is_completed` integer DEFAULT false,
	`last_completed_at` integer,
	`topic_id` text,
	FOREIGN KEY (`roadmap_id`) REFERENCES `roadmaps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `roadmap_steps_roadmap_id_idx` ON `roadmap_steps` (`roadmap_id`);--> statement-breakpoint
CREATE TABLE `roadmaps` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`preferences` text DEFAULT '{}',
	`status` text DEFAULT 'active',
	`progress` integer DEFAULT 0,
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `subtopics` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_topic_id` text NOT NULL,
	`name` text NOT NULL,
	`content_default` text,
	`content_simplified` text,
	`content_story` text,
	`order` integer NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`parent_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `subtopics_parent_idx` ON `subtopics` (`parent_topic_id`);--> statement-breakpoint
CREATE INDEX `subtopics_order_idx` ON `subtopics` (`parent_topic_id`,`order`);--> statement-breakpoint
CREATE UNIQUE INDEX `subtopics_parent_name_idx` ON `subtopics` (`parent_topic_id`,`name`);--> statement-breakpoint
CREATE TABLE `topic_videos` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`user_id` text NOT NULL,
	`heygen_video_id` text NOT NULL,
	`remote_url` text NOT NULL,
	`local_file_path` text,
	`status` text DEFAULT 'pending',
	`file_size_bytes` integer,
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	`downloaded_at` integer,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topic_videos_topic_user_idx` ON `topic_videos` (`topic_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `topic_videos_topic_idx` ON `topic_videos` (`topic_id`);--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`previous_topic_id` text,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`previous_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topics_name_unique` ON `topics` (`name`);--> statement-breakpoint
CREATE INDEX `topics_category_idx` ON `topics` (`category`);--> statement-breakpoint
CREATE INDEX `topics_previous_idx` ON `topics` (`previous_topic_id`);--> statement-breakpoint
CREATE TABLE `user_knowledge` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`proficiency_level` integer DEFAULT 0,
	`status` text DEFAULT 'locked',
	`last_reviewed_at` integer,
	`strength` integer DEFAULT 100,
	`needs_regeneration` integer DEFAULT false,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_knowledge_user_topic_idx` ON `user_knowledge` (`user_id`,`topic_id`);--> statement-breakpoint
CREATE TABLE `user_subtopic_performance` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subtopic_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`correct_count` integer DEFAULT 0,
	`incorrect_count` integer DEFAULT 0,
	`total_attempts` integer DEFAULT 0,
	`status` text DEFAULT 'neutral',
	`last_attempt_at` integer,
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subtopic_id`) REFERENCES `subtopics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_subtopic_performance_user_subtopic_idx` ON `user_subtopic_performance` (`user_id`,`subtopic_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'Student',
	`avatar_url` text,
	`xp` integer DEFAULT 0,
	`level` integer DEFAULT 1,
	`current_streak` integer DEFAULT 0,
	`is_onboarded` integer DEFAULT false,
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP)
);
