CREATE TABLE `message_tags` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `source_id` integer NOT NULL,
  `message_id` integer NOT NULL,
  `key` text NOT NULL,
  `value` text NOT NULL,
  FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `message_tags_message_id_key_value_unique` ON `message_tags` (`message_id`,`key`,`value`);--> statement-breakpoint
INSERT OR IGNORE INTO `message_tags` (`source_id`, `message_id`, `key`, `value`)
SELECT
  normalized_tags.`source_id`,
  normalized_tags.`message_id`,
  normalized_tags.`key`,
  normalized_tags.`value`
FROM (
  SELECT
    `messages`.`source_id`,
    `messages`.`id` AS `message_id`,
    trim(mail_tag.`key`) AS `key`,
    trim(array_value.`value`) AS `value`
  FROM `messages`
  JOIN json_each(`messages`.`mail_metadata`, '$.tags') AS mail_tag
  JOIN json_each(mail_tag.`value`) AS array_value
  WHERE mail_tag.`type` = 'array'
    AND typeof(array_value.`value`) = 'text'
  UNION ALL
  SELECT
    `messages`.`source_id`,
    `messages`.`id` AS `message_id`,
    trim(mail_tag.`key`) AS `key`,
    trim(mail_tag.`value`) AS `value`
  FROM `messages`
  JOIN json_each(`messages`.`mail_metadata`, '$.tags') AS mail_tag
  WHERE mail_tag.`type` = 'text'
) AS normalized_tags
WHERE normalized_tags.`key` != ''
  AND normalized_tags.`value` != ''
  AND lower(normalized_tags.`key`) NOT LIKE 'ses:%';--> statement-breakpoint
CREATE INDEX `message_tags_source_id_key_value_index` ON `message_tags` (`source_id`,`key`,`value`,`message_id`);
