CREATE TABLE `writer_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`invited_by` text NOT NULL,
	`email` text,
	`wallet` text,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_writer_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accepted_writer_id`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `writer_invites_post_id_idx` ON `writer_invites` (`post_id`);--> statement-breakpoint
CREATE INDEX `writer_invites_status_idx` ON `writer_invites` (`status`);--> statement-breakpoint
CREATE TABLE `post_writers` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`writer_id` text,
	`invite_id` text,
	`role` text NOT NULL,
	`share_bps` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`writer_id`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invite_id`) REFERENCES `writer_invites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_writers_post_writer_unique` ON `post_writers` (`post_id`,`writer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `post_writers_post_invite_unique` ON `post_writers` (`post_id`,`invite_id`);--> statement-breakpoint
CREATE INDEX `post_writers_post_id_idx` ON `post_writers` (`post_id`);--> statement-breakpoint
CREATE INDEX `post_writers_writer_id_idx` ON `post_writers` (`writer_id`);--> statement-breakpoint
CREATE TABLE `writer_group_splits` (
	`group_key` text PRIMARY KEY NOT NULL,
	`split_address` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `writer_group_splits_status_idx` ON `writer_group_splits` (`status`);--> statement-breakpoint
ALTER TABLE `posts` ADD `split_address_override` text;--> statement-breakpoint
INSERT INTO `post_writers` (`id`, `post_id`, `writer_id`, `invite_id`, `role`, `share_bps`, `status`, `created_at`)
SELECT
	'author:' || `id`,
	`id`,
	`author_id`,
	NULL,
	'author',
	10000,
	'accepted',
	COALESCE(`created_at`, (unixepoch() * 1000))
FROM `posts`;
