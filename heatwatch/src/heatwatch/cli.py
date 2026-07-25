"""HeatWatch CLI エントリポイント。requirements.md §16 / EVA-104 に対応。

サブコマンドは実装マイルストーンに対応する。相手向け出力・自動送信のサブコマンドは
恒久的に存在しない（P0-ETH-02）。本文をログ・標準出力へ出さない（NFR-106）。
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from . import __version__
from .detector import load_config
from .evaluation import build_normal_baseline, load_intervals, render_markdown, run_evaluation
from .features import build_windows, load_lexicons
from .ingest import parse_export


def _cmd_ingest(args: argparse.Namespace) -> int:
    _, report = parse_export(args.export, self_name=args.self_name)
    print(report.render())
    return 0


def _cmd_features(args: argparse.Namespace) -> int:
    messages, report = parse_export(args.export, self_name=args.self_name)
    windows = build_windows(messages)
    print(report.render())
    print(f"windows: {len(windows)}")
    return 0


def _cmd_evaluate(args: argparse.Namespace) -> int:
    lex = load_lexicons()
    cfg = load_config()
    messages, _ = parse_export(args.export, self_name=args.self_name)
    intervals = load_intervals(args.labels)

    baseline = build_normal_baseline(messages, intervals, lex)
    out = run_evaluation(messages, intervals, cfg, lex, baseline=baseline)

    report_md = render_markdown(out, cfg, intervals)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(report_md, encoding="utf-8")

    if args.db:
        _persist(args.db, out, cfg)

    m = out.metrics
    print(f"config_hash={out.config_hash} AUC={m.auc} lead_p50={m.lead_p50} "
          f"detection_rate={m.detection_rate} false_alert_rate={m.false_alert_rate}")
    print(f"report -> {out_path}")
    return 0


def _persist(db_path: str, out: object, cfg: object) -> None:
    from . import storage
    from .detector.config import DetectorConfig
    from .evaluation.pipeline import EvaluationOutput

    assert isinstance(out, EvaluationOutput)
    assert isinstance(cfg, DetectorConfig)
    conn = storage.connect(db_path)
    storage.init_schema(conn)
    storage.save_baseline(
        conn,
        {name: s.as_dict() for name, s in out.baseline.items()},
        computed_at=datetime.now(UTC).isoformat(),
    )
    storage.save_evaluation(
        conn,
        run_id=str(uuid4()),
        config_hash=out.config_hash,
        auc=out.metrics.auc,
        lead_time_p50=out.metrics.lead_p50,
        fp_rate=out.metrics.false_alert_rate,
        created_at=datetime.now(UTC).isoformat(),
    )
    n = storage.holdout_eval_count(conn)
    if n > 3:  # EVA-106: 多重検定による自己欺瞞の防止
        print(f"WARNING: ホールドアウト評価が {n} 回を超えています (EVA-106)")


def _cmd_label(args: argparse.Namespace) -> int:
    print(
        "ラベリングは対話的手順です（EVA-101 / §12.2）。\n"
        "時刻と区間種別のみを JSON へ記録し、evaluate --labels に渡してください:\n"
        '  [{"start": ISO, "end": ISO, "kind": "conflict", "aware": ISO}]'
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="heatwatch",
        description="会話ヒート自己検知システム（ローカル実行）",
    )
    parser.add_argument("--version", action="version", version=f"heatwatch {__version__}")
    sub = parser.add_subparsers(dest="command", metavar="COMMAND")

    p_ingest = sub.add_parser("ingest", help="M1: エクスポート解析・正規化")
    p_ingest.add_argument("--export", required=True, help="エクスポートのスレッドディレクトリ")
    p_ingest.add_argument("--self", dest="self_name", required=True, help="自分の表示名")
    p_ingest.set_defaults(func=_cmd_ingest)

    p_feat = sub.add_parser("features", help="M4: 特徴量・ウィンドウ")
    p_feat.add_argument("--export", required=True)
    p_feat.add_argument("--self", dest="self_name", required=True)
    p_feat.set_defaults(func=_cmd_features)

    p_eval = sub.add_parser("evaluate", help="M5: Lead Time 評価・校正レポート（EVA-104）")
    p_eval.add_argument("--export", required=True)
    p_eval.add_argument("--self", dest="self_name", required=True)
    p_eval.add_argument("--labels", required=True, help="ラベル JSON（本文なし）")
    p_eval.add_argument("--out", default="reports/calibration.md", help="出力レポートパス")
    p_eval.add_argument("--db", default=None, help="派生データ SQLite（任意）")
    p_eval.set_defaults(func=_cmd_evaluate)

    p_label = sub.add_parser("label", help="M3: ラベリング手順の案内")
    p_label.set_defaults(func=_cmd_label)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if getattr(args, "func", None) is None:
        parser.print_help()
        return 0
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
