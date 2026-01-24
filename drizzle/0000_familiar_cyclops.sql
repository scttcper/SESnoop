CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`webhook_id` integer,
	`event_type` text NOT NULL,
	`recipient_email` text NOT NULL,
	`event_at` integer NOT NULL,
	`ses_message_id` text NOT NULL,
	`event_data` text DEFAULT '{}' NOT NULL,
	`raw_payload` text DEFAULT '{}' NOT NULL,
	`bounce_type` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_dedupe_unique` ON `events` (`ses_message_id`,`event_type`,`recipient_email`,`event_at`);--> statement-breakpoint
CREATE INDEX `events_event_type_index` ON `events` (`event_type`);--> statement-breakpoint
CREATE INDEX `events_recipient_email_index` ON `events` (`recipient_email`);--> statement-breakpoint
CREATE INDEX `events_event_at_index` ON `events` (`event_at`);--> statement-breakpoint
CREATE INDEX `events_bounce_type_index` ON `events` (`bounce_type`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`ses_message_id` text NOT NULL,
	`source_email` text,
	`subject` text,
	`sent_at` integer,
	`mail_metadata` text DEFAULT '{}' NOT NULL,
	`events_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_ses_message_id_unique` ON `messages` (`ses_message_id`);--> statement-breakpoint
CREATE INDEX `messages_sent_at_index` ON `messages` (`sent_at`);--> statement-breakpoint
CREATE INDEX `messages_source_email_index` ON `messages` (`source_email`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`token` text NOT NULL,
	`color` text NOT NULL,
	`retention_days` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_token_unique` ON `sources` (`token`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`done` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sns_message_id` text NOT NULL,
	`sns_type` text NOT NULL,
	`sns_timestamp` integer NOT NULL,
	`raw_payload` text DEFAULT '{}' NOT NULL,
	`processed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhooks_sns_message_id_unique` ON `webhooks` (`sns_message_id`);--> statement-breakpoint
CREATE INDEX `webhooks_processed_at_index` ON `webhooks` (`processed_at`);