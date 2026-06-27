/**
 * Idempotent scaffolding engine.
 *
 * Takes a list of template entries (relative path -> content) and materializes
 * them under a target directory, classifying each result as created / skipped /
 * overwritten / planned (dry-run). Directories are derived from file paths.
 */
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

import type {
  DirResult,
  FileResult,
  ScaffoldResult,
  TemplateEntry,
} from '../types.js';
import { ensureDir, resolveInside, toPosix, writeFileSafe } from './fs-safe.js';

export interface ScaffoldOptions {
  targetDir: string;
  force: boolean;
  dryRun: boolean;
}

/**
 * Generate all entries under `targetDir`.
 *
 * In dry-run mode nothing is written; every not-yet-existing file is reported
 * as "planned" and existing files as "skipped".
 */
export function scaffold(
  entries: TemplateEntry[],
  options: ScaffoldOptions,
): ScaffoldResult {
  const { targetDir, force, dryRun } = options;

  // Resolve everything inside the target dir first so a traversal attempt
  // aborts before any side effects.
  const resolved = entries.map((entry) => ({
    relativePath: toPosix(entry.relativePath),
    absolutePath: resolveInside(targetDir, entry.relativePath),
    content: entry.content,
  }));

  const dirRelSet = new Set<string>();
  for (const entry of resolved) {
    collectParentDirs(entry.relativePath, dirRelSet);
  }

  const directories: DirResult[] = [...dirRelSet]
    .sort()
    .map((rel) => ({
      relativePath: rel,
      absolutePath: resolveInside(targetDir, rel),
    }));

  if (!dryRun) {
    ensureDir(resolveInside(targetDir, '.'));
    for (const dir of directories) {
      ensureDir(dir.absolutePath);
    }
  }

  const files: FileResult[] = resolved.map((entry) => {
    if (dryRun) {
      // Report what the real run would do without touching disk.
      const status = existsOnDisk(entry.absolutePath) && !force ? 'skipped' : 'planned';
      return {
        relativePath: entry.relativePath,
        absolutePath: entry.absolutePath,
        status,
      };
    }
    const status = writeFileSafe(entry.absolutePath, entry.content, force);
    return {
      relativePath: entry.relativePath,
      absolutePath: entry.absolutePath,
      status,
    };
  });

  return { files, directories };
}

function collectParentDirs(relativePath: string, into: Set<string>): void {
  let dir = dirname(relativePath);
  while (dir && dir !== '.' && dir !== '/') {
    into.add(toPosix(dir));
    dir = dirname(dir);
  }
}

function existsOnDisk(absolutePath: string): boolean {
  return existsSync(absolutePath);
}
