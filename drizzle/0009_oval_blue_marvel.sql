PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_webhooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`message_id` integer NOT NULL,
	`sns_message_id` text NOT NULL,
	`sns_type` text NOT NULL,
	`sns_timestamp` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_webhooks`("id", "source_id", "message_id", "sns_message_id", "sns_type", "sns_timestamp")
SELECT "id", "source_id", "message_id", "sns_message_id", "sns_type", "sns_timestamp"
FROM `webhooks`
WHERE "source_id" IS NOT NULL
  AND "message_id" IS NOT NULL;--> statement-breakpoint
DROP TABLE `webhooks`;--> statement-breakpoint
ALTER TABLE `__new_webhooks` RENAME TO `webhooks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `webhooks_sns_message_id_unique` ON `webhooks` (`sns_message_id`);--> statement-breakpoint
CREATE INDEX `webhooks_source_id_index` ON `webhooks` (`source_id`);--> statement-breakpoint
CREATE INDEX `webhooks_message_id_index` ON `webhooks` (`message_id`);--> statement-breakpoint
ALTER TABLE `messages` DROP COLUMN `mail_metadata`;
