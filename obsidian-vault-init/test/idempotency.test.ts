import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scaffold } from '../src/core/scaffold.js';
import { buildTemplates } from '../src/templates/index.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ovi-idem-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const entries = () =>
  buildTemplates({ vaultName: 'idem-vault', claudeMd: true, setupGuide: true });

function snapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of entries()) {
    out[e.relativePath] = readFileSync(join(root, e.relativePath), 'utf8');
  }
  return out;
}

describe('idempotency (A5)', () => {
  it('second run is all skipped with no content diff', () => {
    const first = scaffold(entries(), { targetDir: root, force: false, dryRun: false });
    expect(first.files.every((f) => f.status === 'created')).toBe(true);
    const after1 = snapshot();

    const second = scaffold(entries(), { targetDir: root, force: false, dryRun: false });
    expect(second.files.every((f) => f.status === 'skipped')).toBe(true);
    const after2 = snapshot();

    expect(after2).toEqual(after1);
  });

  it('re-running with --force on unmodified files still skips (no churn)', () => {
    scaffold(entries(), { targetDir: root, force: false, dryRun: false });
    const before = snapshot();

    const forced = scaffold(entries(), { targetDir: root, force: true, dryRun: false });
    // Identical content => skipped even under --force.
    expect(forced.files.every((f) => f.status === 'skipped')).toBe(true);
    expect(snapshot()).toEqual(before);
  });

  it('generated files use LF line endings only', () => {
    scaffold(entries(), { targetDir: root, force: false, dryRun: false });
    for (const e of entries()) {
      const content = readFileSync(join(root, e.relativePath), 'utf8');
      expect(content.includes('\r'), `${e.relativePath} should not contain CR`).toBe(false);
    }
  });
});
