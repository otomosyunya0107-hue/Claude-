/**
 * `init` command: turn parsed options into a scaffolded vault, then print
 * progress, a summary, and the "next steps" guidance.
 */
import { accessSync, constants, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { Logger } from '../core/logger.js';
import { scaffold } from '../core/scaffold.js';
import { buildTemplates } from '../templates/index.js';
import type { FileResult, InitOptions } from '../types.js';

/**
 * Run `init`. Returns a process exit code:
 *   0 success, 1 validation/permission error.
 * Unexpected runtime errors are allowed to throw and are mapped to code 2 by
 * the CLI entrypoint.
 */
export function runInit(options: InitOptions): number {
  const logger = new Logger(options.quiet);
  const absoluteTarget = resolve(options.targetDir);

  // Validation: if the target exists it must be a writable directory; if it
  // does not exist, the nearest existing ancestor must be writable.
  const validationError = validateTarget(absoluteTarget);
  if (validationError) {
    logger.error(validationError);
    return 1;
  }

  const entries = buildTemplates({
    vaultName: options.name,
    claudeMd: options.claudeMd,
    setupGuide: options.setupGuide,
  });

  let result;
  try {
    result = scaffold(entries, {
      targetDir: absoluteTarget,
      force: options.force,
      dryRun: options.dryRun,
    });
  } catch (err) {
    // Path-traversal guard and permission failures land here as expected
    // validation errors.
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  if (options.dryRun) {
    printDryRun(logger, result.files, result.directories.length, absoluteTarget);
    return 0;
  }

  for (const file of result.files) {
    switch (file.status) {
      case 'created':
        logger.created(file.relativePath);
        break;
      case 'skipped':
        logger.skipped(file.relativePath);
        break;
      case 'overwritten':
        logger.overwritten(file.relativePath);
        break;
    }
  }

  printSummary(logger, result.files, absoluteTarget);
  return 0;
}

function validateTarget(absoluteTarget: string): string | null {
  if (existsSync(absoluteTarget)) {
    let st;
    try {
      st = statSync(absoluteTarget);
    } catch {
      return `ターゲットの状態を取得できません: ${absoluteTarget}`;
    }
    if (!st.isDirectory()) {
      return `ターゲットがディレクトリではありません: ${absoluteTarget}`;
    }
    return checkWritable(absoluteTarget);
  }

  // Walk up to the nearest existing ancestor and check it is writable.
  let dir = absoluteTarget;
  while (!existsSync(dir)) {
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return checkWritable(dir);
}

function checkWritable(dir: string): string | null {
  try {
    accessSync(dir, constants.W_OK);
    return null;
  } catch {
    return `書き込み権限がありません: ${dir}`;
  }
}

function printDryRun(
  logger: Logger,
  files: FileResult[],
  dirCount: number,
  absoluteTarget: string,
): void {
  logger.info('[dry-run] 以下を生成します（実際の書き込みは行いません）:');
  for (const file of files) {
    if (file.status === 'skipped') {
      logger.info(`  SKIP    ${file.relativePath}（既存）`);
    } else {
      logger.info(`  CREATE  ${file.relativePath}`);
    }
  }
  logger.info(`合計: ${files.length} ファイル / ${dirCount} ディレクトリ`);
  logger.info(`生成先: ${absoluteTarget}`);
}

function printSummary(
  logger: Logger,
  files: FileResult[],
  absoluteTarget: string,
): void {
  const created = files.filter((f) => f.status === 'created').length;
  const skipped = files.filter((f) => f.status === 'skipped').length;
  const overwritten = files.filter((f) => f.status === 'overwritten').length;

  logger.info('');
  logger.info(logger.heading('完了しました。'));
  logger.info(
    `作成 ${created} / スキップ ${skipped} / 上書き ${overwritten}（全 ${files.length} ファイル）`,
  );
  logger.info(`生成先: ${absoluteTarget}`);
  logger.info('');
  logger.info(logger.heading('次の一手:'));
  logger.info('  1. Obsidian でこのフォルダを Vault として開く');
  logger.info(
    `  2. ${logger.accent('SETUP_MCP.md')} に従って Local REST API プラグインと MCP 接続を設定する`,
  );
  logger.info(
    `  3. ${logger.accent('00_Memory.md')} の 7 項目を自分の情報で埋める`,
  );
}
