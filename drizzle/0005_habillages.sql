CREATE TABLE `bezel_choices` (
	`user_id` text NOT NULL,
	`console_slug` text NOT NULL,
	`bezel_id` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `console_slug`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`console_slug`) REFERENCES `consoles`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bezels` (
	`id` text PRIMARY KEY NOT NULL,
	`console_slug` text NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`screen_x` real NOT NULL,
	`screen_y` real NOT NULL,
	`screen_w` real NOT NULL,
	`screen_h` real NOT NULL,
	`hash` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`console_slug`) REFERENCES `consoles`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bezels_console_idx` ON `bezels` (`console_slug`);