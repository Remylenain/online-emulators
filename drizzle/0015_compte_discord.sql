ALTER TABLE `users` ADD `discord_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_discord_unique` ON `users` (`discord_id`);