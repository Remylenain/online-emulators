ALTER TABLE `games` ADD `group_slug` text;--> statement-breakpoint
ALTER TABLE `games` ADD `group_title` text;--> statement-breakpoint
ALTER TABLE `games` ADD `part_number` integer;--> statement-breakpoint
CREATE INDEX `games_group_idx` ON `games` (`console_slug`,`group_slug`);