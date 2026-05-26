CREATE TABLE `billing_cycles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`closed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`billing_cycle_id` integer,
	`started_at` integer NOT NULL,
	`stopped_at` integer,
	`start_message_url` text NOT NULL,
	`stop_message_url` text,
	FOREIGN KEY (`billing_cycle_id`) REFERENCES `billing_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
