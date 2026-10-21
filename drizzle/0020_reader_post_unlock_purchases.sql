CREATE TABLE `reader_post_unlock_purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`privy_user_id` text NOT NULL,
	`wallet_address` text NOT NULL,
	`writer_id` text NOT NULL,
	`post_id` text NOT NULL,
	`tx_hash` text NOT NULL,
	`chain_id` integer NOT NULL,
	`token_address` text NOT NULL,
	`amount_raw` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`writer_id`) REFERENCES `writers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reader_post_unlock_tx_hash_unique` ON `reader_post_unlock_purchases` (`tx_hash`);--> statement-breakpoint
CREATE INDEX `reader_post_unlock_post_wallet_idx` ON `reader_post_unlock_purchases` (`post_id`,`wallet_address`);--> statement-breakpoint
CREATE INDEX `reader_post_unlock_privy_writer_idx` ON `reader_post_unlock_purchases` (`privy_user_id`,`writer_id`);
