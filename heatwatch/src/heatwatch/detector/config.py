"""検知設定の読込とハッシュ。requirements.md §10 / EVA-104 に対応。

重みは ``config/weights.yaml``、閾値は ``config/thresholds.yaml``。両者と
feature/lexicon/baseline のバージョンから ``config_hash`` を導出し、評価結果へ
記録して再現性を担保する（NFR-104）。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from hashlib import sha256
from pathlib import Path

import yaml

_DEFAULT_CONFIG_DIR = Path(__file__).resolve().parents[3] / "config"


@dataclass(frozen=True)
class DetectorConfig:
    weights: dict[str, float]
    w_repair: float
    enter: float
    exit: float
    min_slope: float
    sustained_ms: int
    min_msg_count: int
    min_active_features: int
    active_feature_level: float
    level3_score: float
    cooldown_min: int
    daily_max_alerts: int
    quiet_hours_start: str
    quiet_hours_end: str
    threshold_version: str
    weights_version: str
    baseline_version: str = "0.0.0-dev"
    feature_version: str = "0.0.0-dev"
    extra: dict[str, object] = field(default_factory=dict)

    def config_hash(self) -> str:
        payload = {
            "weights": dict(sorted(self.weights.items())),
            "w_repair": self.w_repair,
            "enter": self.enter,
            "exit": self.exit,
            "min_slope": self.min_slope,
            "sustained_ms": self.sustained_ms,
            "min_msg_count": self.min_msg_count,
            "min_active_features": self.min_active_features,
            "active_feature_level": self.active_feature_level,
            "level3_score": self.level3_score,
            "threshold_version": self.threshold_version,
            "weights_version": self.weights_version,
            "baseline_version": self.baseline_version,
            "feature_version": self.feature_version,
        }
        blob = json.dumps(payload, sort_keys=True, ensure_ascii=True)
        return sha256(blob.encode("utf-8")).hexdigest()[:16]


def load_config(config_dir: str | Path | None = None) -> DetectorConfig:
    d = Path(config_dir) if config_dir is not None else _DEFAULT_CONFIG_DIR
    weights_doc = yaml.safe_load((d / "weights.yaml").read_text(encoding="utf-8"))
    th = yaml.safe_load((d / "thresholds.yaml").read_text(encoding="utf-8"))
    return DetectorConfig(
        weights={str(k): float(v) for k, v in (weights_doc.get("weights") or {}).items()},
        w_repair=float(weights_doc.get("w_repair", 0.0)),
        enter=float(th["enter"]),
        exit=float(th["exit"]),
        min_slope=float(th.get("min_slope", 0.0)),
        sustained_ms=int(th.get("sustained_ms", 90_000)),
        min_msg_count=int(th.get("min_msg_count", 6)),
        min_active_features=int(th.get("min_active_features", 2)),
        active_feature_level=float(th.get("active_feature_level", 0.5)),
        level3_score=float(th.get("level3_score", 0.6)),
        cooldown_min=int(th.get("cooldown_min", 90)),
        daily_max_alerts=int(th.get("daily_max_alerts", 3)),
        quiet_hours_start=str(th.get("quiet_hours_start", "23:00")),
        quiet_hours_end=str(th.get("quiet_hours_end", "08:00")),
        threshold_version=str(th.get("threshold_version", "unknown")),
        weights_version=str(weights_doc.get("threshold_version", "unknown")),
    )


def with_weights(
    cfg: DetectorConfig, weights: dict[str, float], w_repair: float | None = None
) -> DetectorConfig:
    """校正で重みだけ差し替えた設定を返す（イミュータブル / §12.4）。"""
    from dataclasses import replace

    return replace(
        cfg, weights=dict(weights), w_repair=cfg.w_repair if w_repair is None else w_repair
    )
