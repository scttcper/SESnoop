-- Denormalize source_id onto events (backfilled from the parent message).
-- SQLite can't ADD a NOT NULL column without a default, nor a REFERENCES column
-- with a non-NULL default, so we add it nullable, backfill, then index. The
-- schema models it as NOT NULL; ingestion always writes it and the backfill
-- below leaves no NULLs (messages.source_id is NOT NULL and FK-enforced).
ALTER TABLE `events` ADD `source_id` integer REFERENCES sources(id) ON DELETE cascade;--> statement-breakpoint
UPDATE `events` SET `source_id` = (SELECT `source_id` FROM `messages` WHERE `messages`.`id` = `events`.`message_id`);--> statement-breakpoint
CREATE INDEX `events_source_id_event_at_index` ON `events` (`source_id`,`event_at`);
