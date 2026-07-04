CREATE TABLE `message_payloads` (
	`message_id` integer PRIMARY KEY NOT NULL,
	`mail_metadata` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `message_recipients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`message_id` integer NOT NULL,
	`email` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_recipients_message_id_email_unique` ON `message_recipients` (`message_id`,`email`);--> statement-breakpoint
CREATE INDEX `message_recipients_source_id_email_index` ON `message_recipients` (`source_id`,`email`,`message_id`);--> statement-breakpoint
ALTER TABLE `webhooks` ADD `source_id` integer REFERENCES sources(id);--> statement-breakpoint
ALTER TABLE `webhooks` ADD `message_id` integer REFERENCES messages(id);--> statement-breakpoint
CREATE INDEX `webhooks_source_id_index` ON `webhooks` (`source_id`);--> statement-breakpoint
CREATE INDEX `webhooks_message_id_index` ON `webhooks` (`message_id`);
