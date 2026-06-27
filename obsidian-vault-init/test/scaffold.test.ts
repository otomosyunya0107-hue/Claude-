import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scaffold } from '../src/core/scaffold.js';
import { resolveInside } from '../src/core/fs-safe.js';
import { buildTemplates } from '../src/templates/index.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ovi-test-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function fullEntries() {
  return buildTemplates({ vaultName: 'test-vault', claudeMd: true, setupGuide: true });
}

describe('scaffold generates the article-compliant structure (A1, A4)', () => {
  it('creates all expected files and numbered folders', () => {
    const result = scaffold(fullEntries(), { targetDir: root, force: false, dryRun: false });

    const expected = [
      '00_Memory.md',
      '10_Clients/_template.md',
      '20_Actions.md',
      '30_Library/_index.md',
      '30_Library/frameworks.md',
      '30_Library/pricing.md',
      '30_Library/faq.md',
      '40_Templates/meeting-minutes.md',
      '40_Templates/proposal.md',
      '40_Templates/followup-email.md',
      '50_Transcripts/_template.md',
      'CLAUDE.md',
      'SETUP_MCP.md',
    ];
    for (const rel of expected) {
      expect(existsSync(join(root, rel)), `${rel} should exist`).toBe(true);
    }
    expect(result.files.every((f) => f.status === 'created')).toBe(true);

    // A4: numbered folder prefixes
    for (const prefix of ['00_', '10_', '20_', '30_', '40_', '50_']) {
      const hit = result.files.some((f) => f.relativePath.startsWith(prefix));
      expect(hit, `a path with prefix ${prefix} should exist`).toBe(true);
    }
  });
});

describe('00_Memory.md content (A2, A3)', () => {
  it('has 7 headings in order and the required wikilinks', () => {
    scaffold(fullEntries(), { targetDir: root, force: false, dryRun: false });
    const memory = readFileSync(join(root, '00_Memory.md'), 'utf8');

    const headings = [
      '## 1. 事業概要',
      '## 2. 体制',
      '## 3. 顧客一覧',
      '## 4. 進行中プロジェクト',
      '## 5. 主要プロセス',
      '## 6. コミュニケーション様式',
      '## 7. 判断基準',
    ];
    let lastIndex = -1;
    for (const h of headings) {
      const idx = memory.indexOf(h);
      expect(idx, `${h} should exist`).toBeGreaterThan(-1);
      expect(idx, `${h} should come after the previous heading`).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }

    expect(memory).toContain('[[20_Actions]]');
    expect(memory).toContain('[[30_Library/_index]]');
    expect(memory).toContain('[[10_Clients/_template]]');
  });
});

describe('generated CLAUDE.md and SETUP_MCP.md (A11, A12)', () => {
  it('CLAUDE.md contains the search-first instruction', () => {
    scaffold(fullEntries(), { targetDir: root, force: false, dryRun: false });
    const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
    expect(claude).toContain('回答の前に、必ず Obsidian vault の関連ノートを検索');
  });

  it('SETUP_MCP.md contains the mcp add command and the sync-conflict caveat', () => {
    scaffold(fullEntries(), { targetDir: root, force: false, dryRun: false });
    const setup = readFileSync(join(root, 'SETUP_MCP.md'), 'utf8');
    expect(setup).toContain('claude mcp add --transport http');
    expect(setup).toContain('2つ以上のクラウドサービスに同時に同期させない');
  });
});

describe('toggles (A9)', () => {
  it('omits CLAUDE.md and SETUP_MCP.md when disabled', () => {
    const entries = buildTemplates({ vaultName: 'x', claudeMd: false, setupGuide: false });
    scaffold(entries, { targetDir: root, force: false, dryRun: false });
    expect(existsSync(join(root, 'CLAUDE.md'))).toBe(false);
    expect(existsSync(join(root, 'SETUP_MCP.md'))).toBe(false);
    expect(existsSync(join(root, '00_Memory.md'))).toBe(true);
  });
});

describe('--force behavior (A6, A7)', () => {
  it('skips existing files without --force and overwrites with --force', () => {
    const memPath = join(root, '00_Memory.md');
    writeFileSync(memPath, 'USER EDITED CONTENT', 'utf8');

    const noForce = scaffold(fullEntries(), { targetDir: root, force: false, dryRun: false });
    const memResultNoForce = noForce.files.find((f) => f.relativePath === '00_Memory.md');
    expect(memResultNoForce?.status).toBe('skipped');
    expect(readFileSync(memPath, 'utf8')).toBe('USER EDITED CONTENT');

    const forced = scaffold(fullEntries(), { targetDir: root, force: true, dryRun: false });
    const memResultForced = forced.files.find((f) => f.relativePath === '00_Memory.md');
    expect(memResultForced?.status).toBe('overwritten');
    expect(readFileSync(memPath, 'utf8')).not.toBe('USER EDITED CONTENT');
  });
});

describe('--dry-run (A8)', () => {
  it('writes nothing and reports planned files', () => {
    const result = scaffold(fullEntries(), { targetDir: root, force: false, dryRun: true });
    expect(result.files.every((f) => f.status === 'planned')).toBe(true);
    for (const f of result.files) {
      expect(existsSync(join(root, f.relativePath)), `${f.relativePath} must not be written`).toBe(false);
    }
  });
});

describe('path traversal guard (A10)', () => {
  it('throws when an entry escapes the target dir', () => {
    expect(() => resolveInside(root, '../escape.md')).toThrow();
    expect(() =>
      scaffold([{ relativePath: '../escape.md', content: 'x' }], {
        targetDir: root,
        force: false,
        dryRun: false,
      }),
    ).toThrow();
    expect(existsSync(join(root, '..', 'escape.md'))).toBe(false);
  });
});
