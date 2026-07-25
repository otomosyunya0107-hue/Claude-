"""HeatWatch CLI エントリポイント。

サブコマンドは実装マイルストーン（§16）に対応する。現時点ではスケルトンであり、
各サブコマンドは対応マイルストーンで実装する。相手向け出力・自動送信の
サブコマンドは恒久的に存在しない（P0-ETH-02）。
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence

from . import __version__

# 各サブコマンドの実装マイルストーン（§16）。
_PENDING: dict[str, str] = {
    "ingest": "M1: エクスポート解析・正規化",
    "label": "M3: ラベリング支援（EVA-101）",
    "features": "M4: 特徴量算出・ベースライン",
    "evaluate": "M5: Lead Time 評価・校正レポート（EVA-104）",
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="heatwatch",
        description="会話ヒート自己検知システム（ローカル実行）",
    )
    parser.add_argument("--version", action="version", version=f"heatwatch {__version__}")
    sub = parser.add_subparsers(dest="command", metavar="COMMAND")
    for name, summary in _PENDING.items():
        sub.add_parser(name, help=summary)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command is None:
        parser.print_help()
        return 0
    milestone = _PENDING.get(args.command)
    print(f"'{args.command}' は未実装です（{milestone}）。docs/requirements.md §16 を参照。")
    return 1


if __name__ == "__main__":
    sys.exit(main())
