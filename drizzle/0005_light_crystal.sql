PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`recipient_email` text NOT NULL,
	`event_at` integer NOT NULL,
	`event_data` text DEFAULT '{}' NOT NULL,
	`bounce_type` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_events`("id", "message_id", "event_type", "recipient_email", "event_at", "event_data", "bounce_type", "created_at", "updated_at") SELECT "id", "message_id", "event_type", "recipient_email", "event_at", "event_data", "bounce_type", "created_at", "updated_at" FROM `events`;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
ALTER TABLE `__new_events` RENAME TO `events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `events_dedupe_unique` ON `events` (`message_id`,`event_type`,`recipient_email`,`event_at`);--> statement-breakpoint
CREATE INDEX `events_message_id_event_at_index` ON `events` (`message_id`,`event_at`);--> statement-breakpoint
ALTER TABLE `webhooks` DROP COLUMN `processed_at`;