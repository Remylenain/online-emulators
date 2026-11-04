DROP INDEX `save_states_slot_unique`;--> statement-breakpoint
ALTER TABLE `save_states` ADD `is_auto` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `save_states_slot_unique` ON `save_states` (`user_id`,`game_id`,`is_auto`,`slot`);