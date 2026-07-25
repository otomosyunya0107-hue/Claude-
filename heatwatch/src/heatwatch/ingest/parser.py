"""Instagram エクスポート解析。requirements.md §7 / M1 に対応。

``message_*.json`` を全件読み、mojibake 復元（PIT-01）・昇順ソート（PIT-02/06）・
分割結合と重複除去（PIT-03）・種別判定（PIT-04）・システム文除外（PIT-05）を経て
``model.Message`` の昇順列へ正規化する。ネットワーク依存を持たない（P0-ETH-06）。

本文はメモリ上のみで扱い、``IngestReport`` は件数・比率など本文を含まない指標のみを
公開する（DAT-104 / NFR-106）。
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from hashlib import sha256
from pathlib import Path

from ..constants import TOKYO
from ..model import Message, MessageType, Speaker
from .mojibake import recover

# PIT-05: 自動生成されるシステム文の判定パターン（復元後の文字列に対して照合）。
_SYSTEM_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p)
    for p in (
        r"さんがいいねしました$",
        r"さんがいいね！しました$",
        r"リアクションしました",
        r"がグループに参加",
        r"がグループを退出",
        r"の名前を変更",
        r"がチャットの写真を変更",
        r"Liked a message",
        r"reacted .* to your message",
        r"You are now connected",
        r"^\s*$",
    )
)

# PIT-04: 通話メッセージの判定パターン。
_CALL_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p)
    for p in (
        r"通話時間",
        r"ビデオチャットが開始",
        r"音声通話",
        r"missed (a )?(video )?call",
        r"の通話",
    )
)

# PIT-04: 取消（unsent）メッセージの判定パターン。
_UNSENT_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p)
    for p in (
        r"メッセージの送信を取り消しました",
        r"unsent a message",
    )
)


def _match_any(patterns: tuple[re.Pattern[str], ...], text: str) -> bool:
    return any(p.search(text) for p in patterns)


@dataclass
class IngestReport:
    """解析結果のサマリ（本文を含まない / NFR-106）。G-A の説明責任を果たす。"""

    files_read: int = 0
    total_raw: int = 0
    kept: int = 0
    duplicates_removed: int = 0
    mojibake_recovered: int = 0
    mojibake_failed: int = 0
    time_reversals: int = 0
    type_counts: dict[str, int] = field(default_factory=dict)
    speaker_counts: dict[str, int] = field(default_factory=dict)
    unknown_speaker: int = 0
    start_ts: datetime | None = None
    end_ts: datetime | None = None

    @property
    def mojibake_failure_rate(self) -> float:
        total = self.mojibake_recovered + self.mojibake_failed
        return self.mojibake_failed / total if total else 0.0

    def render(self) -> str:
        """人間可読なサマリ（本文なし）。"""
        span = "-"
        if self.start_ts and self.end_ts:
            span = f"{self.start_ts.date()} 〜 {self.end_ts.date()}"
        lines = [
            "== Ingest Report (G-A) ==",
            f"files_read           : {self.files_read}",
            f"total_raw            : {self.total_raw}",
            f"kept                 : {self.kept}",
            f"duplicates_removed   : {self.duplicates_removed}",
            f"mojibake_recovered   : {self.mojibake_recovered}",
            f"mojibake_failed      : {self.mojibake_failed} "
            f"(rate={self.mojibake_failure_rate:.4f})",
            f"time_reversals(input): {self.time_reversals}",
            f"unknown_speaker      : {self.unknown_speaker}",
            f"span                 : {span}",
            f"type_counts          : {self.type_counts}",
            f"speaker_counts       : {self.speaker_counts}",
        ]
        return "\n".join(lines)


def _classify(
    content: str | None,
    raw: dict[str, object],
) -> tuple[MessageType, str | None]:
    """種別を判定し、テキスト特徴量対象なら本文を返す（PIT-04/05）。"""
    if content is not None:
        if _match_any(_SYSTEM_PATTERNS, content):
            return MessageType.SYSTEM, None
        if _match_any(_CALL_PATTERNS, content):
            return MessageType.CALL, None
        if _match_any(_UNSENT_PATTERNS, content):
            return MessageType.UNSENT, None
        return MessageType.TEXT, content
    # content 欠損: メディア種別を導出する。
    if raw.get("sticker"):
        return MessageType.STICKER, None
    if raw.get("photos") or raw.get("videos") or raw.get("audio_files"):
        return MessageType.PHOTO, None
    if raw.get("share"):
        return MessageType.SHARE, None
    if raw.get("call_duration") is not None:
        return MessageType.CALL, None
    return MessageType.UNSENT, None


@dataclass
class _Raw:
    ts_ms: int
    read_index: int
    speaker: Speaker
    unknown: bool
    msg_type: MessageType
    text: str | None
    reaction_count: int
    dedup_key: str


def _iter_message_files(export_dir: Path) -> list[Path]:
    """スレッド配下の ``message_*.json`` を昇順で返す（PIT-03）。"""
    files = sorted(
        export_dir.rglob("message_*.json"),
        key=lambda p: (str(p.parent), _file_sort_key(p.name)),
    )
    return files


def _file_sort_key(name: str) -> int:
    m = re.search(r"message_(\d+)\.json$", name)
    return int(m.group(1)) if m else 0


def parse_export(
    export_dir: str | Path,
    self_name: str,
) -> tuple[list[Message], IngestReport]:
    """エクスポートディレクトリを解析して正規化済みメッセージ列を返す。

    Args:
        export_dir: ``inbox/<thread>/`` を含むディレクトリ、またはスレッド直下。
        self_name: 自分の表示名（復元後の実名）。これのみ SELF、他は PARTNER に
            写像する（実名は永続化しない / §8.1）。
    """
    export_dir = Path(export_dir)
    report = IngestReport()
    raws: list[_Raw] = []
    read_index = 0

    for path in _iter_message_files(export_dir):
        report.files_read += 1
        data = json.loads(path.read_text(encoding="utf-8"))
        for m in data.get("messages", []):
            report.total_raw += 1
            ts_ms = int(m["timestamp_ms"])

            sender_raw = str(m.get("sender_name", ""))
            sender, sender_recovered = recover(sender_raw)
            _tally_mojibake(report, sender_recovered, sender_raw, sender)

            content: str | None
            if "content" in m and m["content"] is not None:
                content_raw = str(m["content"])
                content, content_recovered = recover(content_raw)
                _tally_mojibake(report, content_recovered, content_raw, content)
            else:
                content = None

            msg_type, text = _classify(content, m)

            speaker: Speaker = "SELF" if sender == self_name else "PARTNER"
            unknown = sender != self_name and _looks_like_self_variant(sender, self_name)

            dedup_src = f"{ts_ms}\x1f{sender}\x1f{content or ''}"
            dedup_key = sha256(dedup_src.encode("utf-8")).hexdigest()

            raws.append(
                _Raw(
                    ts_ms=ts_ms,
                    read_index=read_index,
                    speaker=speaker,
                    unknown=unknown,
                    msg_type=msg_type,
                    text=text,
                    reaction_count=len(m.get("reactions", []) or []),
                    dedup_key=dedup_key,
                )
            )
            read_index += 1

    # PIT-02: 入力時点の時刻逆転量を記録（G-A の説明責任）。
    report.time_reversals = _count_reversals([r.ts_ms for r in raws])

    # PIT-03: 重複除去（最初の出現を保持）。
    seen: set[str] = set()
    deduped: list[_Raw] = []
    for r in raws:
        if r.dedup_key in seen:
            report.duplicates_removed += 1
            continue
        seen.add(r.dedup_key)
        deduped.append(r)

    # PIT-02/06: 昇順ソート。同一 ms は読み込み順（read_index）を安定副キーに。
    deduped.sort(key=lambda r: (r.ts_ms, r.read_index))

    messages: list[Message] = []
    for idx, r in enumerate(deduped):
        ts = datetime.fromtimestamp(r.ts_ms / 1000, tz=TOKYO)
        char_count = len(r.text) if r.text is not None else 0
        messages.append(
            Message(
                idx=idx,
                ts=ts,
                speaker=r.speaker,
                text=r.text,
                msg_type=r.msg_type,
                char_count=char_count,
                reaction_count=r.reaction_count,
            )
        )
        report.type_counts[r.msg_type.value] = report.type_counts.get(r.msg_type.value, 0) + 1
        report.speaker_counts[r.speaker] = report.speaker_counts.get(r.speaker, 0) + 1
        if r.unknown:
            report.unknown_speaker += 1

    report.kept = len(messages)
    if messages:
        report.start_ts = messages[0].ts
        report.end_ts = messages[-1].ts
    return messages, report


def _looks_like_self_variant(sender: str, self_name: str) -> bool:
    """SELF 判定に失敗したが自分の可能性がある場合を粗く検出する（診断用）。"""
    return bool(sender) and sender.strip().casefold() == self_name.strip().casefold()


def _count_reversals(ts_seq: list[int]) -> int:
    return sum(1 for a, b in zip(ts_seq, ts_seq[1:], strict=False) if b < a)


def _tally_mojibake(report: IngestReport, recovered: bool, raw: str, result: str) -> None:
    if recovered:
        report.mojibake_recovered += 1
    elif _has_mojibake_signature(raw):
        # 復元を試みるべきだが失敗した（残存する文字化けの疑い）。
        report.mojibake_failed += 1


# Latin-1 誤読の痕跡（UTF-8 先頭バイトが Latin-1 化した典型レンジ）。
_MOJIBAKE_SIGNATURE = re.compile(r"[Â-ô][-¿]")


def _has_mojibake_signature(text: str) -> bool:
    return bool(_MOJIBAKE_SIGNATURE.search(text))
