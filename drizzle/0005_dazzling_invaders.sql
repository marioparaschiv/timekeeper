ALTER TABLE `billing_cycles` ADD `reminders_paused_until` integer;--> statement-breakpoint
ALTER TABLE `billing_cycles` ADD `reminder_interval_ms` integer;--> statement-breakpoint
ALTER TABLE `billing_cycles` ADD `next_reminder_at` integer;