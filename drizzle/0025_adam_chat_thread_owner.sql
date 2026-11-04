ALTER TABLE `adam_chat_threads` ADD `owner_user_id` text;
--> statement-breakpoint
CREATE INDEX `adam_chat_threads_owner_user_id_idx` ON `adam_chat_threads` (`owner_user_id`);
