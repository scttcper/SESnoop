DROP INDEX `events_event_type_index`;--> statement-breakpoint
DROP INDEX `events_recipient_email_index`;--> statement-breakpoint
DROP INDEX `events_event_at_index`;--> statement-breakpoint
DROP INDEX `events_bounce_type_index`;--> statement-breakpoint
CREATE INDEX `events_message_id_event_at_index` ON `events` (`message_id`,`event_at`);--> statement-breakpoint
DROP INDEX `messages_sent_at_index`;--> statement-breakpoint
DROP INDEX `messages_source_email_index`;--> statement-breakpoint
CREATE INDEX `messages_source_id_sent_at_index` ON `messages` (`source_id`,`sent_at`);--> statement-breakpoint
DROP INDEX `webhooks_processed_at_index`;