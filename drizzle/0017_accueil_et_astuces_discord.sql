CREATE TABLE `discord_tips` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `discord_apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `discord_tips_app_idx` ON `discord_tips` (`app_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `discord_apps` ADD `welcome` text DEFAULT '' NOT NULL;