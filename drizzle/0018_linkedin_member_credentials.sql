CREATE TABLE `linkedin_member_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`member_sub` text NOT NULL,
	`author_urn` text NOT NULL,
	`access_token_enc` text NOT NULL,
	`refresh_token_enc` text,
	`expires_at` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
