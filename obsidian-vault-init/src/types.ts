/**
 * Shared type definitions for the obsidian-vault-init CLI.
 */

/** Options that control how a vault is initialized. */
export interface InitOptions {
  /** Absolute or relative directory in which the vault is generated. */
  targetDir: string;
  /** Display name for the vault. Defaults to the target directory's basename. */
  name: string;
  /** Overwrite existing files instead of skipping them. */
  force: boolean;
  /** Compute the plan without writing anything to disk. */
  dryRun: boolean;
  /** Whether to generate the Vault-facing CLAUDE.md. */
  claudeMd: boolean;
  /** Whether to generate SETUP_MCP.md. */
  setupGuide: boolean;
  /** Suppress per-file progress logs and print only the summary. */
  quiet: boolean;
}

/** Outcome classification for a single generated file. */
export type WriteStatus = 'created' | 'skipped' | 'overwritten' | 'planned';

/** Result of attempting to write one file. */
export interface FileResult {
  /** Path relative to the target directory (always uses POSIX separators in logs). */
  relativePath: string;
  /** Absolute path on disk. */
  absolutePath: string;
  status: WriteStatus;
}

/** A directory entry that was (or will be) ensured to exist. */
export interface DirResult {
  relativePath: string;
  absolutePath: string;
}

/** Aggregate result of a scaffold run. */
export interface ScaffoldResult {
  files: FileResult[];
  directories: DirResult[];
}

/** One unit of template content keyed by a vault-relative path. */
export interface TemplateEntry {
  /** Path relative to the vault root, using POSIX separators. */
  relativePath: string;
  /** UTF-8 file content. */
  content: string;
}
