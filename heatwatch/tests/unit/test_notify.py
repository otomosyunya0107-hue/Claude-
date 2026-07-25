"""M6 notify の検証（NOT-101〜105, P0-ETH-04）。"""

from __future__ import annotations

from datetime import datetime

import pytest

from heatwatch.constants import TOKYO
from heatwatch.detector.engine import Alert
from heatwatch.notify import (
    MAX_LEN,
    TEMPLATES,
    Notifier,
    Outcome,
    RecordingBackend,
    contains_forbidden,
    render,
)


def _alert(level: int) -> Alert:
    return Alert(ts=datetime(2026, 5, 1, 12, 0, tzinfo=TOKYO), level=level, window_index=10)


def test_all_templates_clean_and_short() -> None:
    """NOT-102/103: 全テンプレートが禁止語を含まず 40 字以内。"""
    for tid in TEMPLATES:
        text = render(tid, minutes=25)
        assert contains_forbidden(text) == [], tid
        assert len(text) <= MAX_LEN, tid


def test_forbidden_words_detected() -> None:
    assert contains_forbidden("落ち着いてから返信しましょう")
    assert contains_forbidden("あなたが悪い")


def test_payload_has_no_body() -> None:
    """NOT-101: ペイロードは静的テンプレート文のみ。"""
    n = Notifier(backend=RecordingBackend())
    payload = n.build_payload(_alert(3), sustained_minutes=25)
    assert payload.text in {render("T-02", 25), render("T-01")}
    assert "25" in payload.text or payload.level == 2


def test_kill_switch_suppresses() -> None:
    backend = RecordingBackend()
    n = Notifier(backend=backend, kill_switch=True)
    out = n.notify(n.build_payload(_alert(2)), _alert(2).ts)
    assert out is Outcome.SUPPRESSED_KILL
    assert backend.sent == []


def test_quiet_hours_suppresses_but_records_nothing_external() -> None:
    backend = RecordingBackend()
    n = Notifier(backend=backend)
    midnight = datetime(2026, 5, 1, 23, 30, tzinfo=TOKYO)
    out = n.notify(n.build_payload(_alert(2)), midnight)
    assert out is Outcome.SUPPRESSED_QUIET
    assert backend.sent == []


def test_delivered_daytime() -> None:
    backend = RecordingBackend()
    n = Notifier(backend=backend)
    noon = datetime(2026, 5, 1, 12, 0, tzinfo=TOKYO)
    out = n.notify(n.build_payload(_alert(2)), noon)
    assert out is Outcome.DELIVERED
    assert len(backend.sent) == 1
    title, text = backend.sent[0]
    assert title == "HeatWatch"
    # 配信ペイロードにテンプレート外の文字列（本文）が混ざらない。
    assert text in TEMPLATES["T-01"]


def test_safety_uses_static_notice() -> None:
    n = Notifier(backend=RecordingBackend())
    payload = n.build_payload(_alert(3), safety=True)
    assert payload.template_id == "T-04"


def test_build_payload_rejects_forbidden(monkeypatch: pytest.MonkeyPatch) -> None:
    import heatwatch.notify.templates as t

    monkeypatch.setitem(t.TEMPLATES, "T-01", "落ち着いてください")
    n = Notifier(backend=RecordingBackend())
    with pytest.raises(ValueError):
        n.build_payload(_alert(2))
