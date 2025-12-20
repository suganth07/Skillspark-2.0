CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`content` text NOT NULL,
	`type` text DEFAULT 'multiple_choice',
	`data` text NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE no action
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
	`description` text,
	`order` integer NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`parent_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `subtopics_parent_idx` ON `subtopics` (`parent_topic_id`);--> statement-breakpoint
CREATE INDEX `subtopics_order_idx` ON `subtopics` (`parent_topic_id`,`order`);--> statement-breakpoint
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
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_knowledge_user_topic_idx` ON `user_knowledge` (`user_id`,`topic_id`);--> statement-breakpoint
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
