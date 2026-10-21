CREATE TABLE `earn_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_privy_user_id` text NOT NULL,
	`admin_wallet_id` text NOT NULL,
	`action` text NOT NULL,
	`vault_id` text NOT NULL,
	`asset` text NOT NULL,
	`amount` text NOT NULL,
	`tx_hash` text,
	`status` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `earn_audit_log_created_at_idx` ON `earn_audit_log` (`created_at`);
--> statement-breakpoint
CREATE INDEX `earn_audit_log_vault_id_idx` ON `earn_audit_log` (`vault_id`);
