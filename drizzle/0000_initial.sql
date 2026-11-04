CREATE TABLE `consoles` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`has_shoulder_buttons` integer DEFAULT false NOT NULL,
	`screen_width` integer NOT NULL,
	`screen_height` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`console_slug` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`author` text,
	`version` text,
	`language` text,
	`base_game` text,
	`year` integer,
	`rom_path` text NOT NULL,
	`rom_sha1` text NOT NULL,
	`rom_size` integer NOT NULL,
	`cover_path` text,
	`is_published` integer DEFAULT true NOT NULL,
	`released_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`rating_avg` real DEFAULT 0 NOT NULL,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`play_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`console_slug`) REFERENCES `consoles`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_console_slug_unique` ON `games` (`console_slug`,`slug`);--> statement-breakpoint
CREATE INDEX `games_console_title_idx` ON `games` (`console_slug`,`title`);--> statement-breakpoint
CREATE INDEX `games_rating_idx` ON `games` (`rating_avg`);--> statement-breakpoint
CREATE INDEX `games_plays_idx` ON `games` (`play_count`);--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`email` text,
	`created_by` text,
	`used_at` integer,
	`used_by` text,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_code_unique` ON `invites` (`code`);--> statement-breakpoint
CREATE TABLE `keymaps` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`console_slug` text NOT NULL,
	`mapping` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`console_slug`) REFERENCES `consoles`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `keymaps_user_console_unique` ON `keymaps` (`user_id`,`console_slug`);--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reset_tokens_user_idx` ON `password_reset_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `play_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game_id` text NOT NULL,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`duration_sec` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plays_user_recent_idx` ON `play_sessions` (`user_id`,`last_seen_at`);--> statement-breakpoint
CREATE INDEX `plays_game_idx` ON `play_sessions` (`game_id`);--> statement-breakpoint
CREATE TABLE `ratings` (
	`user_id` text NOT NULL,
	`game_id` text NOT NULL,
	`score` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `game_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ratings_game_idx` ON `ratings` (`game_id`);--> statement-breakpoint
CREATE TABLE `save_backups` (
	`id` text PRIMARY KEY NOT NULL,
	`save_file_id` text NOT NULL,
	`path` text NOT NULL,
	`size` integer NOT NULL,
	`revision` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`save_file_id`) REFERENCES `save_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `save_backups_file_idx` ON `save_backups` (`save_file_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `save_files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game_id` text NOT NULL,
	`path` text NOT NULL,
	`size` integer NOT NULL,
	`hash` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `save_files_user_game_unique` ON `save_files` (`user_id`,`game_id`);--> statement-breakpoint
CREATE TABLE `save_states` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game_id` text NOT NULL,
	`slot` integer NOT NULL,
	`label` text,
	`path` text NOT NULL,
	`thumb_path` text,
	`size` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `save_states_slot_unique` ON `save_states` (`user_id`,`game_id`,`slot`);--> statement-breakpoint
CREATE INDEX `save_states_user_game_idx` ON `save_states` (`user_id`,`game_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`user_agent` text,
	`ip_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`pseudo` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`avatar_path` text,
	`role` text DEFAULT 'USER' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_pseudo_unique` ON `users` (lower("pseudo"));--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (lower("email"));