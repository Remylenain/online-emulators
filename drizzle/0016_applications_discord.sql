CREATE TABLE `discord_apps` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`host` text NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text NOT NULL,
	`guild_id` text DEFAULT '' NOT NULL,
	`bot_token` text DEFAULT '' NOT NULL,
	`game_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_apps_host_unique` ON `discord_apps` (`host`);