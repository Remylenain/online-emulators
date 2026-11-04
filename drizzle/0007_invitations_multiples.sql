-- Un lien d'inscription peut servir à plusieurs comptes et être révoqué ;
-- chaque compte garde le lien qui l'a fait naître.
ALTER TABLE `invites` ADD `max_uses` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `invites` ADD `uses_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invites` ADD `revoked_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `invite_id` text;--> statement-breakpoint
-- Les liens déjà consommés comptent un usage, et le compte né d'eux les référence.
UPDATE `invites` SET `uses_count` = 1 WHERE `used_at` IS NOT NULL;--> statement-breakpoint
UPDATE `users` SET `invite_id` = (SELECT `id` FROM `invites` WHERE `invites`.`used_by` = `users`.`id`) WHERE `invite_id` IS NULL;
