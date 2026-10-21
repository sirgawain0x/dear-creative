CREATE TABLE `reader_checkout_records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`privy_user_id` text NOT NULL,
	`wallet_address` text NOT NULL,
	`writer_id` text NOT NULL,
	`post_id` text,
	`plan` text,
	`tx_hash` text NOT NULL,
	`chain_id` integer NOT NULL,
	`token_address` text NOT NULL,
	`amount_raw` text NOT NULL,
	`period_start` integer,
	`period_end` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`writer_id`) REFERENCES `writers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reader_checkout_tx_hash_unique` ON `reader_checkout_records` (`tx_hash`);--> statement-breakpoint
CREATE INDEX `reader_checkout_privy_writer_idx` ON `reader_checkout_records` (`privy_user_id`,`writer_id`);--> statement-breakpoint
CREATE INDEX `reader_checkout_post_wallet_idx` ON `reader_checkout_records` (`post_id`,`wallet_address`);--> statement-breakpoint
CREATE INDEX `reader_checkout_subscription_period_idx` ON `reader_checkout_records` (`kind`,`privy_user_id`,`writer_id`,`period_end`);
