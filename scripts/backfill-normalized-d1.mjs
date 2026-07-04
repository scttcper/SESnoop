import { spawnSync } from 'node:child_process';
import path from 'node:path';

const DEFAULT_CHUNK_SIZE = 500;

const options = {
  database: 'DB',
  remote: true,
  chunkSize: DEFAULT_CHUNK_SIZE,
};

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (arg === '--local') {
    options.remote = false;
    continue;
  }
  if (arg === '--remote') {
    options.remote = true;
    continue;
  }
  if (arg === '--database') {
    options.database = process.argv[++index] ?? options.database;
    continue;
  }
  if (arg === '--chunk-size') {
    const chunkSize = Number(process.argv[++index]);
    if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 1000) {
      throw new Error('--chunk-size must be an integer between 1 and 1000');
    }
    options.chunkSize = chunkSize;
  }
}

const wranglerBin = path.join(process.cwd(), 'node_modules', '.bin', 'wrangler');
const targetFlag = options.remote ? '--remote' : '--local';

function parseWranglerJson(stdout) {
  const jsonStart = stdout.indexOf('[');
  if (jsonStart === -1) {
    throw new Error(`Wrangler did not return JSON:\n${stdout}`);
  }

  const parsed = JSON.parse(stdout.slice(jsonStart));
  const result = Array.isArray(parsed) ? parsed[0] : parsed;
  return {
    rows: result.results ?? [],
    changes: result.meta?.changes ?? 0,
  };
}

function execute(sql) {
  const result = spawnSync(
    wranglerBin,
    ['d1', 'execute', options.database, targetFlag, '--json', '--command', sql],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `wrangler exited with ${result.status}`);
  }

  return parseWranglerJson(result.stdout);
}

function selectIdChunk(table, lastId, where = '') {
  const filter = where ? `AND ${where}` : '';
  return execute(`
    SELECT id
    FROM ${table}
    WHERE id > ${lastId}
      ${filter}
    ORDER BY id
    LIMIT ${options.chunkSize}
  `).rows.map((row) => Number(row.id));
}

function backfillMessages() {
  let lastId = 0;
  let payloads = 0;
  let recipients = 0;

  for (;;) {
    const ids = selectIdChunk('messages', lastId);
    if (ids.length === 0) {
      break;
    }

    const highId = ids.at(-1);
    payloads += execute(`
      INSERT OR IGNORE INTO message_payloads (message_id, mail_metadata)
      SELECT id, mail_metadata
      FROM messages
      WHERE id > ${lastId}
        AND id <= ${highId}
    `).changes;

    recipients += execute(`
      INSERT OR IGNORE INTO message_recipients (source_id, message_id, email)
      SELECT messages.source_id, messages.id, trim(destination.value)
      FROM messages
      JOIN json_each(messages.mail_metadata, '$.destination') AS destination
      WHERE messages.id > ${lastId}
        AND messages.id <= ${highId}
        AND destination.type = 'text'
        AND trim(destination.value) != ''
    `).changes;

    lastId = highId;
    console.log(`messages <= ${lastId}: payloads ${payloads}, recipients ${recipients}`);
  }
}

function backfillWebhooks() {
  let lastId = 0;
  let updated = 0;
  const sesMessageIdExpression = `
    CASE
      WHEN json_valid(json_extract(webhooks.raw_payload, '$.Message'))
      THEN json_extract(json_extract(webhooks.raw_payload, '$.Message'), '$.mail.messageId')
    END
  `;

  for (;;) {
    const ids = selectIdChunk('webhooks', lastId, '(source_id IS NULL OR message_id IS NULL)');
    if (ids.length === 0) {
      break;
    }

    const highId = ids.at(-1);
    updated += execute(`
      UPDATE webhooks
      SET
        source_id = COALESCE(
          source_id,
          (
            SELECT messages.source_id
            FROM messages
            WHERE messages.ses_message_id = ${sesMessageIdExpression}
            LIMIT 1
          )
        ),
        message_id = COALESCE(
          message_id,
          (
            SELECT messages.id
            FROM messages
            WHERE messages.ses_message_id = ${sesMessageIdExpression}
            LIMIT 1
          )
        )
      WHERE id > ${lastId}
        AND id <= ${highId}
        AND (source_id IS NULL OR message_id IS NULL)
    `).changes;

    lastId = highId;
    console.log(`webhooks <= ${lastId}: updated ${updated}`);
  }
}

console.log(
  `Backfilling ${options.remote ? 'remote' : 'local'} D1 database ${options.database} in ${options.chunkSize}-row chunks`,
);
backfillMessages();
backfillWebhooks();
console.log('Backfill complete');
