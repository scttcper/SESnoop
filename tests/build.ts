import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export default async function setup() {
  // Build once before test files start so HTTP tests exercise the deployable app.
  await promisify(execFile)(process.execPath, ['--run', 'build'], {
    maxBuffer: 10 * 1024 * 1024,
  });
}
