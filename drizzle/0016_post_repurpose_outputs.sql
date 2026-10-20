CREATE TABLE `post_repurpose_outputs` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`output_type` text NOT NULL,
	`status` text NOT NULL,
	`payload_json` text,
	`media_url` text,
	`media_mime_type` text,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_repurpose_outputs_post_type_unique` ON `post_repurpose_outputs` (`post_id`,`output_type`);
