PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_billing_cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`total_usdc` integer NOT NULL,
	`closed_at` integer NOT NULL,
	`settled_at` integer,
	`invoice_message_url` text NOT NULL,
	`last_reminder_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_billing_cycles`("id", "guild_id", "total_usdc", "closed_at", "settled_at", "invoice_message_url", "last_reminder_at") SELECT "id", "guild_id", "total_usdc", "closed_at", "settled_at", "invoice_message_url", "last_reminder_at" FROM `billing_cycles`;--> statement-breakpoint
DROP TABLE `billing_cycles`;--> statement-breakpoint
ALTER TABLE `__new_billing_cycles` RENAME TO `billing_cycles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;