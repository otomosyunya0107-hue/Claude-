"""M1 ingest の検証（PIT-01〜06, §7）。"""

from __future__ import annotations

from pathlib import Path

from heatwatch.ingest import parse_export, recover
from heatwatch.model import MessageType
from tests.fixtures.synthetic import SELF_NAME, write_export


def test_recover_roundtrip() -> None:
    original = "ありがとう😊"
    garbled = original.encode("utf-8").decode("latin-1")
    recovered, applied = recover(garbled)
    assert recovered == original
    assert applied is True


def test_recover_leaves_clean_text() -> None:
    recovered, applied = recover("plain ascii")
    assert recovered == "plain ascii"
    assert applied is False


def test_parse_orders_ascending_and_recovers(tmp_path: Path) -> None:
    thread = write_export(tmp_path)
    messages, report = parse_export(thread, self_name=SELF_NAME)

    # 昇順（PIT-02）。
    assert [m.idx for m in messages] == list(range(len(messages)))
    ts = [m.ts for m in messages]
    assert ts == sorted(ts)

    # mojibake 復元（PIT-01）: 日本語が読める。
    texts = [m.text for m in messages if m.text]
    assert any("おはよう" in t for t in texts)
    assert report.mojibake_recovered > 0
    assert report.mojibake_failed == 0


def test_dedup_removes_cross_file_duplicate(tmp_path: Path) -> None:
    thread = write_export(tmp_path)
    _, report = parse_export(thread, self_name=SELF_NAME)
    assert report.duplicates_removed == 1


def test_type_classification(tmp_path: Path) -> None:
    thread = write_export(tmp_path)
    messages, _ = parse_export(thread, self_name=SELF_NAME)
    kinds = {m.msg_type for m in messages}
    assert MessageType.TEXT in kinds
    assert MessageType.PHOTO in kinds
    assert MessageType.STICKER in kinds
    assert MessageType.SHARE in kinds
    assert MessageType.CALL in kinds
    # システム文はテキストとして扱わない（PIT-05）。
    system = [m for m in messages if m.msg_type is MessageType.SYSTEM]
    assert system and all(m.text is None for m in system)


def test_speaker_mapping_no_realname(tmp_path: Path) -> None:
    thread = write_export(tmp_path)
    messages, report = parse_export(thread, self_name=SELF_NAME)
    speakers = {m.speaker for m in messages}
    assert speakers == {"SELF", "PARTNER"}
    # 実名は Message に残らない（§8.1）。
    assert all(SELF_NAME not in (m.text or "") for m in messages if m.msg_type is MessageType.TEXT)
    assert report.unknown_speaker == 0


def test_reactions_counted(tmp_path: Path) -> None:
    thread = write_export(tmp_path)
    messages, _ = parse_export(thread, self_name=SELF_NAME)
    assert any(m.reaction_count > 0 for m in messages)
