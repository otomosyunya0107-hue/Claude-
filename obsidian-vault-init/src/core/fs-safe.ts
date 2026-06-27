/**
 * Safe filesystem primitives: path-traversal-guarded resolution and
 * idempotent writes that never clobber existing files unless forced.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import type { WriteStatus } from '../types.js';

/**
 * Resolve `relativePath` against `rootDir` and guarantee the result stays
 * inside `rootDir`. Throws on path-traversal attempts (e.g. "../escape").
 */
export function resolveInside(rootDir: string, relativePath: string): string {
  const root = resolve(rootDir);
  const target = resolve(root, relativePath);
  const rel = relative(root, target);
  if (rel === '' || rel === '.') {
    return target;
  }
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(
      `パスがターゲットディレクトリの外を指しています（書き込みを拒否）: ${relativePath}`,
    );
  }
  return target;
}

/** Ensure a directory exists (recursive). No-op if already present. */
export function ensureDir(absoluteDir: string): void {
  mkdirSync(absoluteDir, { recursive: true });
}

/**
 * Write a file idempotently.
 *
 * - If the file does not exist: create it -> "created".
 * - If it exists and `force` is false: leave it untouched -> "skipped".
 * - If it exists and `force` is true:
 *     - identical content -> "skipped" (avoids needless churn / keeps 2nd run clean)
 *     - different content  -> overwrite -> "overwritten".
 *
 * Content is always written as UTF-8 with LF line endings.
 */
export function writeFileSafe(
  absolutePath: string,
  content: string,
  force: boolean,
): WriteStatus {
  const normalized = normalizeContent(content);
  if (existsSync(absolutePath)) {
    if (!force) {
      return 'skipped';
    }
    const current = safeRead(absolutePath);
    if (current === normalized) {
      return 'skipped';
    }
    ensureDir(dirname(absolutePath));
    writeFileSync(absolutePath, normalized, 'utf8');
    return 'overwritten';
  }
  ensureDir(dirname(absolutePath));
  writeFileSync(absolutePath, normalized, 'utf8');
  return 'created';
}

/** Normalize line endings to LF and strip a leading UTF-8 BOM if present. */
export function normalizeContent(content: string): string {
  return content.replace(/^﻿/, '').replace(/\r\n/g, '\n');
}

function safeRead(absolutePath: string): string | null {
  try {
    return normalizeContent(readFileSync(absolutePath, 'utf8'));
  } catch {
    return null;
  }
}

/** Convert an OS path separator string to POSIX for stable log output. */
export function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}
