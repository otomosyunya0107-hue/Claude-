/**
 * CLI logger. Japanese, user-facing output with optional color and a quiet
 * mode that suppresses per-file lines while keeping the final summary.
 */

const useColor =
  process.stdout.isTTY === true &&
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== 'dumb';

const C = {
  reset: '[0m',
  green: '[32m',
  yellow: '[33m',
  cyan: '[36m',
  red: '[31m',
  dim: '[2m',
  bold: '[1m',
};

function paint(color: keyof typeof C, text: string): string {
  return useColor ? `${C[color]}${text}${C.reset}` : text;
}

export class Logger {
  constructor(private readonly quiet: boolean) {}

  /** Per-file progress line. Suppressed in quiet mode. */
  step(message: string): void {
    if (this.quiet) return;
    process.stdout.write(`${message}\n`);
  }

  /** Always-shown informational line. */
  info(message: string): void {
    process.stdout.write(`${message}\n`);
  }

  /** Error line written to stderr. */
  error(message: string): void {
    process.stderr.write(`${paint('red', 'エラー:')} ${message}\n`);
  }

  created(path: string): void {
    this.step(`${paint('green', '✓ 作成')}: ${path}`);
  }

  skipped(path: string): void {
    this.step(`${paint('dim', '- スキップ（既存）')}: ${path}`);
  }

  overwritten(path: string): void {
    this.step(`${paint('yellow', '↻ 上書き')}: ${path}`);
  }

  planned(path: string): void {
    this.step(`  ${paint('cyan', 'CREATE')}  ${path}`);
  }

  heading(text: string): string {
    return paint('bold', text);
  }

  accent(text: string): string {
    return paint('cyan', text);
  }
}
