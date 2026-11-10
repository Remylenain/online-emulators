CREATE TABLE `discord_app_servers` (
	`app_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`roles` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`app_id`, `guild_id`),
	FOREIGN KEY (`app_id`) REFERENCES `discord_apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Le serveur du verrou et ses rôles réservés passent dans la nouvelle table,
-- avant que leurs colonnes ne disparaissent : une application verrouillée le
-- reste, sur le même serveur et pour les mêmes rôles.
INSERT INTO `discord_app_servers` (`app_id`, `guild_id`, `roles`)
SELECT `id`, `guild_id`, `roles` FROM `discord_apps` WHERE `guild_id` <> '';
--> statement-breakpoint
ALTER TABLE `discord_apps` DROP COLUMN `guild_id`;--> statement-breakpoint
ALTER TABLE `discord_apps` DROP COLUMN `roles`;