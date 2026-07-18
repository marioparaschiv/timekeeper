CREATE TABLE `guild_clients` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`updated_at` integer NOT NULL
);
