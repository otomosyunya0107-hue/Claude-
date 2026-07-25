"""センチネル試験。requirements.md §15.2 / NFR-106 に対応。

合成メッセージに実行時固有のセンチネルを注入してフル解析を実行し、その文字列が
プロセスメモリ（``Message.text``）以外の永続層に出現しないことを検証する。
出現してはならない場所: SQLite・レポート・通知ペイロード・Ingest サマリ。
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from heatwatch import storage
from heatwatch.constants import SENTINEL_PREFIX
from heatwatch.detector import load_config
from heatwatch.evaluation import render_markdown, run_evaluation
from heatwatch.evaluation.labels import Interval
from heatwatch.features import load_lexicons
from heatwatch.ingest import parse_export
from heatwatch.notify import Notifier, RecordingBackend
from tests.fixtures.synthetic import SELF_NAME, write_export


def test_sentinel_confined_to_memory(tmp_path: Path) -> None:
    sentinel = f"{SENTINEL_PREFIX}{uuid4().hex[:8]}"
    thread = write_export(tmp_path / "export", sentinel=sentinel)

    messages, report = parse_export(thread, self_name=SELF_NAME)

    # (前提) センチネルはメモリ上の本文には存在する（＝実際に流れた）。
    assert any(m.text and sentinel in m.text for m in messages)

    # (1) Ingest サマリに本文が出ない。
    assert sentinel not in report.render()

    lex = load_lexicons()
    cfg = load_config()
    intervals = [
        Interval(start_ts=messages[0].ts, end_ts=messages[-1].ts, kind="normal")
    ]
    out = run_evaluation(messages, intervals, cfg, lex)

    # (2) 校正レポートに本文が出ない。
    md = render_markdown(out, cfg, intervals)
    assert sentinel not in md

    # (3) 通知ペイロードに本文が出ない。
    notifier = Notifier(backend=RecordingBackend())
    for alert in out.result.alerts:
        payload = notifier.build_payload(alert)
        assert sentinel not in payload.text

    # (4) SQLite ファイルに本文が出ない。
    db_path = tmp_path / "derived.sqlite"
    conn = storage.connect(db_path)
    storage.init_schema(conn)
    storage.save_baseline(
        conn,
        {name: s.as_dict() for name, s in out.baseline.items()},
        computed_at=datetime.now(UTC).isoformat(),
    )
    storage.save_evaluation(
        conn, str(uuid4()), out.config_hash, out.metrics.auc,
        out.metrics.lead_p50, out.metrics.false_alert_rate,
        created_at=datetime.now(UTC).isoformat(),
    )
    conn.close()
    raw = db_path.read_bytes()
    assert sentinel.encode("utf-8") not in raw
