ALTER TABLE `authors` ADD `tagline` text;--> statement-breakpoint
UPDATE `authors` SET `tagline` = 'Music producer and builder helping creators own their work and their audience.' WHERE `id` = 'g2';
