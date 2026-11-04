-- Rend l'adresse e-mail facultative : retire le NOT NULL de users.email.
--
-- SQLite ne sait pas retirer un NOT NULL : il faut recréer la table. Mais
-- drizzle applique les migrations dans une transaction, où
-- « PRAGMA foreign_keys=OFF » est sans effet. Le DROP TABLE users supprimait
-- alors en cascade les sauvegardes, états, notes et sessions de tous les
-- comptes (vérifié sur une copie de base).
--
-- On referme donc la transaction de drizzle le temps de couper les clés
-- étrangères, on recrée la table dans une transaction à nous, puis on en
-- rouvre une pour que drizzle enregistre la migration et la valide.
COMMIT;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
BEGIN;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`pseudo` text NOT NULL,
	`email` text,
	`password_hash` text NOT NULL,
	`avatar_path` text,
	`role` text DEFAULT 'USER' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "pseudo", "email", "password_hash", "avatar_path", "role", "is_active", "created_at", "updated_at") SELECT "id", "pseudo", "email", "password_hash", "avatar_path", "role", "is_active", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_pseudo_unique` ON `users` (lower("pseudo"));--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (lower("email"));--> statement-breakpoint
COMMIT;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
BEGIN;
