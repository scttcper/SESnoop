DROP INDEX `messages_ses_message_id_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `messages_source_id_ses_message_id_unique` ON `messages` (`source_id`,`ses_message_id`);--> statement-breakpoint
DROP INDEX `events_dedupe_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `events_dedupe_unique` ON `events` (`message_id`,`event_type`,`recipient_email`,`event_at`);