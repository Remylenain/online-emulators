CREATE TABLE `pending_registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`pseudo` text NOT NULL,
	`password_hash` text NOT NULL,
	`code` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pending_registrations_code_unique` ON `pending_registrations` (`code`);--> statement-breakpoint
CREATE INDEX `pending_registrations_email_idx` ON `pending_registrations` (`email`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
