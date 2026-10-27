CREATE TABLE `post_preview_links` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_preview_links_token_hash_unique` ON `post_preview_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `post_preview_links_post_id_idx` ON `post_preview_links` (`post_id`);
