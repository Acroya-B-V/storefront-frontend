/**
 * Playwright global teardown: restores the original .env file
 * that was backed up by global-setup.ts.
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_PATH = resolve(import.meta.dirname, '..', '.env');
const BACKUP_PATH = ENV_PATH + '.e2e-backup';

export default function globalTeardown() {
  if (existsSync(BACKUP_PATH)) {
    // Restore the original .env
    const original = readFileSync(BACKUP_PATH, 'utf-8');
    writeFileSync(ENV_PATH, original);
    unlinkSync(BACKUP_PATH);
  } else {
    // No backup means there was no original .env — remove the test one
    if (existsSync(ENV_PATH)) {
      unlinkSync(ENV_PATH);
    }
  }
}
