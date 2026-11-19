CREATE TABLE `access_group_games` (
	`group_id` text NOT NULL,
	`game_id` text NOT NULL,
	PRIMARY KEY(`group_id`, `game_id`),
	FOREIGN KEY (`group_id`) REFERENCES `access_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `access_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`rule` text DEFAULT 'liste' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_groups_name_unique` ON `access_groups` (lower("name"));--> statement-breakpoint
CREATE TABLE `user_access_groups` (
	`user_id` text NOT NULL,
	`group_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `group_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `access_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_access_groups_group_idx` ON `user_access_groups` (`group_id`);--> statement-breakpoint
-- La colonne `users.access_mode` n'est plus lue, mais elle reste en base : un
-- déploiement applique les migrations avant de construire et de redémarrer, et
-- l'ancien code, qui la lit encore pendant ce temps, ne doit pas tomber. Une
-- migration ultérieure pourra la retirer.
--
-- Les modes d'accès deviennent des groupes, sans rien changer à ce que chaque
-- compte voyait : un groupe « tout le catalogue », par défaut pour les nouveaux
-- comptes comme l'était le mode normal, où entrent les comptes normaux et
-- testeurs. Les comptes restreints n'entrent dans aucun groupe : ils gardent
-- les jeux qu'on leur a attribués (`user_games`), et rien d'autre.
INSERT INTO `access_groups` (`id`, `name`, `rule`, `is_default`)
VALUES ('bibliotheque-complete', 'Bibliothèque complète', 'tout', 1);
--> statement-breakpoint
INSERT INTO `user_access_groups` (`user_id`, `group_id`)
SELECT `id`, 'bibliotheque-complete' FROM `users` WHERE `access_mode` <> 'restreint';
