ALTER TABLE `games` ADD `search_text` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `games_search_idx` ON `games` (`search_text`);