PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_billing_cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`total_usdc` integer NOT NULL,
	`closed_at` integer NOT NULL,
	`settled_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_billing_cycles`("id", "guild_id", "total_usdc", "closed_at", "settled_at") SELECT "id", "guild_id", "total_usdc", "closed_at", "settled_at" FROM `billing_cycles`;--> statement-breakpoint
DROP TABLE `billing_cycles`;--> statement-breakpoint
ALTER TABLE `__new_billing_cycles` RENAME TO `billing_cycles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`billing_cycle_id` text,
	`started_at` integer NOT NULL,
	`stopped_at` integer,
	`start_message_url` text NOT NULL,
	`stop_message_url` text,
	FOREIGN KEY (`billing_cycle_id`) REFERENCES `billing_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "guild_id", "user_id", "billing_cycle_id", "started_at", "stopped_at", "start_message_url", "stop_message_url") SELECT "id", "guild_id", "user_id", "billing_cycle_id", "started_at", "stopped_at", "start_message_url", "stop_message_url" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;