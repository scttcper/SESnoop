-- Local seed data for SESnoop (idempotent)

BEGIN TRANSACTION;

INSERT OR IGNORE INTO sources (name, token, color)
VALUES ('BetaList', 'seed-betalist', 'blue');

INSERT OR IGNORE INTO messages (
  source_id,
  ses_message_id,
  source_email,
  subject,
  sent_at
)
SELECT
  id,
  '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a1',
  'hello@example.com',
  'Welcome to BetaList',
  unixepoch('now', '-5 minutes') * 1000
FROM sources
WHERE token = 'seed-betalist';

INSERT OR IGNORE INTO messages (
  source_id,
  ses_message_id,
  source_email,
  subject,
  sent_at
)
SELECT
  id,
  '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a2',
  'hello@example.com',
  'Your weekly product updates',
  unixepoch('now', '-1 hour') * 1000
FROM sources
WHERE token = 'seed-betalist';

INSERT OR IGNORE INTO messages (
  source_id,
  ses_message_id,
  source_email,
  subject,
  sent_at
)
SELECT
  id,
  '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a3',
  'hello@example.com',
  'Confirm your email to stay on BetaList',
  unixepoch('now', '-3 hours') * 1000
FROM sources
WHERE token = 'seed-betalist';

INSERT OR IGNORE INTO messages (
  source_id,
  ses_message_id,
  source_email,
  subject,
  sent_at
)
SELECT
  id,
  '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a4',
  'hello@example.com',
  'You are invited: early access',
  unixepoch('now', '-1 day') * 1000
FROM sources
WHERE token = 'seed-betalist';

INSERT OR IGNORE INTO messages (
  source_id,
  ses_message_id,
  source_email,
  subject,
  sent_at
)
SELECT
  id,
  '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a5',
  'hello@example.com',
  'We shipped new features',
  unixepoch('now', '-2 days') * 1000
FROM sources
WHERE token = 'seed-betalist';

INSERT OR IGNORE INTO messages (
  source_id,
  ses_message_id,
  source_email,
  subject,
  sent_at
)
SELECT
  id,
  '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a6',
  'hello@example.com',
  'Thanks for the feedback',
  unixepoch('now', '-7 days') * 1000
FROM sources
WHERE token = 'seed-betalist';

INSERT OR IGNORE INTO messages (
  source_id,
  ses_message_id,
  source_email,
  subject,
  sent_at
)
SELECT
  id,
  '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a7',
  'hello@example.com',
  'Last chance to claim your invite',
  unixepoch('now', '-14 days') * 1000
FROM sources
WHERE token = 'seed-betalist';

INSERT OR IGNORE INTO message_payloads (message_id, mail_metadata)
SELECT id,
  CASE ses_message_id
    WHEN '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a1' THEN '{"destination":["alex@example.com"],"tags":{"environment":"demo","campaign":"seed-data"}}'
    WHEN '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a2' THEN '{"destination":["priya@example.com"],"tags":{"environment":"demo","campaign":"seed-data"}}'
    WHEN '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a3' THEN '{"destination":["sam@example.com"],"tags":{"environment":"demo","campaign":"seed-data"}}'
    WHEN '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a4' THEN '{"destination":["taylor@example.com"],"tags":{"environment":"demo","campaign":"seed-data"}}'
    WHEN '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a5' THEN '{"destination":["jordan@example.com"],"tags":{"environment":"demo","campaign":"seed-data"}}'
    WHEN '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a6' THEN '{"destination":["alex@example.com"],"tags":{"environment":"demo","campaign":"seed-data"}}'
    WHEN '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a7' THEN '{"destination":["priya@example.com"],"tags":{"environment":"demo","campaign":"seed-data"}}'
  END
FROM messages
WHERE ses_message_id LIKE '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a%';

INSERT OR IGNORE INTO message_recipients (source_id, message_id, email)
SELECT source_id,
  id,
  CASE ses_message_id
    WHEN '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a1' THEN 'alex@example.com'
    WHEN '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a2' THEN 'priya@example.com'
    WHEN '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a3' THEN 'sam@example.com'
    WHEN '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a4' THEN 'taylor@example.com'
    WHEN '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a5' THEN 'jordan@example.com'
    WHEN '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a6' THEN 'alex@example.com'
    WHEN '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a7' THEN 'priya@example.com'
  END
FROM messages
WHERE ses_message_id LIKE '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a%';

INSERT OR IGNORE INTO message_tags (source_id, message_id, key, value)
SELECT source_id, id, tag_key, tag_value
FROM messages
CROSS JOIN (
  SELECT 'environment' AS tag_key, 'demo' AS tag_value
  UNION ALL
  SELECT 'campaign', 'seed-data'
) base_tags
WHERE ses_message_id LIKE '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a%';

INSERT OR IGNORE INTO message_tags (source_id, message_id, key, value)
SELECT source_id, id, 'campaign', 'onboarding'
FROM messages
WHERE ses_message_id IN (
  '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a1',
  '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a3'
);

INSERT OR IGNORE INTO message_tags (source_id, message_id, key, value)
SELECT source_id, id, 'campaign', 'newsletter'
FROM messages
WHERE ses_message_id IN (
  '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a2',
  '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a5'
);

INSERT OR IGNORE INTO message_tags (source_id, message_id, key, value)
SELECT source_id, id, 'campaign', 'invite'
FROM messages
WHERE ses_message_id IN (
  '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a4',
  '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a7'
);

INSERT OR IGNORE INTO message_tags (source_id, message_id, key, value)
SELECT source_id, id, 'audience', 'beta'
FROM messages
WHERE ses_message_id LIKE '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a%';

-- Events for message 1
INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Send',
  'alex@example.com',
  unixepoch('now', '-5 minutes', '+45 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a1';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Delivery',
  'alex@example.com',
  unixepoch('now', '-5 minutes', '+120 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a1';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Open',
  'alex@example.com',
  unixepoch('now', '-5 minutes', '+300 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a1';

-- Events for message 2
INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Send',
  'priya@example.com',
  unixepoch('now', '-1 hour', '+45 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a2';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Delivery',
  'priya@example.com',
  unixepoch('now', '-1 hour', '+120 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a2';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Open',
  'priya@example.com',
  unixepoch('now', '-1 hour', '+300 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a2';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Click',
  'priya@example.com',
  unixepoch('now', '-1 hour', '+540 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a2';

-- Events for message 3
INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Send',
  'sam@example.com',
  unixepoch('now', '-3 hours', '+45 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a3';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Delivery',
  'sam@example.com',
  unixepoch('now', '-3 hours', '+120 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a3';

-- Events for message 4
INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at, bounce_type)
SELECT id,
  'Send',
  'taylor@example.com',
  unixepoch('now', '-1 day', '+45 seconds') * 1000,
  NULL
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a4';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at, bounce_type)
SELECT id,
  'Bounce',
  'taylor@example.com',
  unixepoch('now', '-1 day', '+120 seconds') * 1000,
  'Permanent'
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a4';

-- Events for message 5
INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Send',
  'jordan@example.com',
  unixepoch('now', '-2 days', '+45 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a5';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Delivery',
  'jordan@example.com',
  unixepoch('now', '-2 days', '+120 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a5';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Open',
  'jordan@example.com',
  unixepoch('now', '-2 days', '+300 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a5';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Open',
  'jordan@example.com',
  unixepoch('now', '-2 days', '+540 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a5';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Click',
  'jordan@example.com',
  unixepoch('now', '-2 days', '+900 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a5';

-- Events for message 6
INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Send',
  'alex@example.com',
  unixepoch('now', '-7 days', '+45 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a6';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Delivery',
  'alex@example.com',
  unixepoch('now', '-7 days', '+120 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a6';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Complaint',
  'alex@example.com',
  unixepoch('now', '-7 days', '+300 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a6';

-- Events for message 7
INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Send',
  'priya@example.com',
  unixepoch('now', '-14 days', '+45 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a7';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Delivery',
  'priya@example.com',
  unixepoch('now', '-14 days', '+120 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a7';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Open',
  'priya@example.com',
  unixepoch('now', '-14 days', '+300 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a7';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Click',
  'priya@example.com',
  unixepoch('now', '-14 days', '+540 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a7';

INSERT OR IGNORE INTO events (message_id, event_type, recipient_email, event_at)
SELECT id,
  'Click',
  'priya@example.com',
  unixepoch('now', '-14 days', '+900 seconds') * 1000
FROM messages
WHERE ses_message_id = '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a7';

UPDATE events
SET source_id = (SELECT source_id FROM messages WHERE messages.id = events.message_id)
WHERE source_id IS NULL;

COMMIT;

-- Quick summary for local verification
SELECT id, name, token, color FROM sources WHERE token = 'seed-betalist';
SELECT ses_message_id, subject FROM messages
WHERE ses_message_id LIKE '9b10b4cc-0f03-4d4d-9d8b-8f24a0b0a0a%'
ORDER BY sent_at DESC;
SELECT key, value, count(*) AS messages
FROM message_tags
WHERE source_id = (SELECT id FROM sources WHERE token = 'seed-betalist')
GROUP BY key, value
ORDER BY key, value;
