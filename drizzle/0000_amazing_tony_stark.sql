CREATE TABLE `billing_cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`total_usdc` integer NOT NULL,
	`closed_at` integer NOT NULL,
	`settled_at` integer
);
--> statement-breakpoint
CREATE TABLE `charges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`billing_cycle_id` text,
	`amount_cents` integer NOT NULL,
	`description` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`billing_cycle_id`) REFERENCES `billing_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
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
