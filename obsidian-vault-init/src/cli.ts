#!/usr/bin/env node
/**
 * CLI entrypoint. Parses arguments (subcommand + options) using node:util's
 * parseArgs, then dispatches to the matching command. MVP ships `init` only,
 * but the dispatch is subcommand-shaped so `add-client` etc. can be added.
 */
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { runInit } from './commands/init.js';
import type { InitOptions } from './types.js';

const HELP_TEXT = `obsidian-vault-init — Obsidian 業務メモリ Vault 初期化ツール

使い方:
  npx obsidian-vault-init init [target-dir] [options]

引数:
  target-dir            Vault を生成するディレクトリ（省略時: カレントディレクトリ）

オプション:
  --name <name>         Vault 名（既定: ディレクトリ名）
  --force               既存ファイルを上書きする（既定: 既存はスキップ）
  --dry-run             書き込まず、生成予定の一覧のみ表示する
  --no-claude-md        CLAUDE.md を生成しない
  --no-setup-guide      SETUP_MCP.md を生成しない
  --quiet               進捗ログを抑制し、結果サマリのみ表示する
  -h, --help            このヘルプを表示する
  -v, --version         バージョンを表示する

例:
  npx obsidian-vault-init init ./my-vault
  npx obsidian-vault-init init ./my-vault --dry-run
  npx obsidian-vault-init init . --force
`;

function getVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = resolve(here, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function main(argv: string[]): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        name: { type: 'string' },
        force: { type: 'boolean', default: false },
        'dry-run': { type: 'boolean', default: false },
        // node:util parseArgs has no built-in --no-* negation, so model the
        // opt-out flags explicitly and invert them below.
        'no-claude-md': { type: 'boolean', default: false },
        'no-setup-guide': { type: 'boolean', default: false },
        quiet: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    });
  } catch (err) {
    process.stderr.write(`エラー: ${err instanceof Error ? err.message : String(err)}\n`);
    process.stderr.write('`--help` でオプション一覧を確認できます。\n');
    return 1;
  }

  const { values, positionals } = parsed;

  if (values.help) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  if (values.version) {
    process.stdout.write(`${getVersion()}\n`);
    return 0;
  }

  const command = positionals[0] ?? 'init';
  const commandArgs = positionals.slice(1);

  if (command !== 'init') {
    process.stderr.write(`エラー: 未知のコマンド「${command}」。MVP では init のみ対応しています。\n`);
    process.stderr.write('`--help` でオプション一覧を確認できます。\n');
    return 1;
  }

  if (commandArgs.length > 1) {
    process.stderr.write('エラー: target-dir は1つだけ指定できます。\n');
    return 1;
  }

  const targetDir = commandArgs[0] ?? '.';
  const name =
    (values.name as string | undefined) ??
    deriveName(targetDir);

  const options: InitOptions = {
    targetDir,
    name,
    force: values.force as boolean,
    dryRun: values['dry-run'] as boolean,
    claudeMd: !(values['no-claude-md'] as boolean),
    setupGuide: !(values['no-setup-guide'] as boolean),
    quiet: values.quiet as boolean,
  };

  return runInit(options);
}

function deriveName(targetDir: string): string {
  const resolved = resolve(targetDir);
  const base = basename(resolved);
  return base || 'vault';
}

// Entry: run main, map unexpected throws to exit code 2.
try {
  const code = main(process.argv.slice(2));
  process.exit(code);
} catch (err) {
  process.stderr.write(
    `予期しないエラー: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(2);
}
