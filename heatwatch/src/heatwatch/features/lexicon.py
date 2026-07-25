"""辞書ローダ。requirements.md FEA-103 に対応。

辞書はコードから分離した YAML（``config/lexicons/``）で管理し、バージョンを付す。
辞書更新で ``feature_version`` が変わる（§9.3）。ネットワーク依存を持たない。
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

# features/lexicon.py -> features -> heatwatch -> src -> <repo root>
_DEFAULT_CONFIG_DIR = Path(__file__).resolve().parents[3] / "config" / "lexicons"


@dataclass(frozen=True)
class Lexicons:
    """読み込み済み辞書一式（不変）。"""

    version: str
    generalization: tuple[str, ...]
    blame_second_person: tuple[str, ...]
    blame_predicates: tuple[str, ...]
    contempt: tuple[str, ...]
    counter_blame: tuple[str, ...]
    terse: tuple[str, ...]
    terse_max_chars: int
    repair: tuple[str, ...]
    sentiment_negative: tuple[str, ...]
    sentiment_positive: tuple[str, ...]
    safety: tuple[str, ...]


def _load_yaml(path: Path) -> dict[str, Any]:
    data: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return data


def _words(path: Path, key: str = "words") -> tuple[str, ...]:
    data = _load_yaml(path)
    return tuple(str(w) for w in (data.get(key) or []))


@lru_cache(maxsize=4)
def load_lexicons(config_dir: str | Path | None = None) -> Lexicons:
    d = Path(config_dir) if config_dir is not None else _DEFAULT_CONFIG_DIR
    contempt = _load_yaml(d / "contempt.yaml")
    blame = _load_yaml(d / "blame.yaml")
    terse = _load_yaml(d / "terse.yaml")
    return Lexicons(
        version=str(_load_yaml(d / "version.yaml").get("lexicon_version", "unknown")),
        generalization=_words(d / "generalization.yaml"),
        blame_second_person=tuple(str(w) for w in (blame.get("second_person") or [])),
        blame_predicates=tuple(str(w) for w in (blame.get("predicates") or [])),
        contempt=tuple(str(w) for w in (contempt.get("markers") or []))
        + tuple(str(w) for w in (contempt.get("sarcasm") or [])),
        counter_blame=_words(d / "counter_blame.yaml"),
        terse=tuple(str(w) for w in (terse.get("words") or [])),
        terse_max_chars=int(terse.get("max_chars", 4)),
        repair=_words(d / "repair.yaml"),
        sentiment_negative=_words(d / "sentiment.yaml", "negative"),
        sentiment_positive=_words(d / "sentiment.yaml", "positive"),
        safety=_words(d / "safety.yaml"),
    )
