"""校正レポート生成。requirements.md EVA-105 に対応。

Lead Time 分布・特徴量重要度（重み）・誤報事例の時刻一覧を Markdown で出力する。
**本文・引用を含めない**（時刻のみ / NOT-101 の趣旨, NFR-106）。
"""

from __future__ import annotations

from ..detector.config import DetectorConfig
from .labels import Interval, in_conflict
from .metrics import Metrics
from .pipeline import EvaluationOutput

_GATES = {
    "G-B AUC": (0.75, "auc"),
    "G-C LeadTime p50 (min)": (10.0, "lead_p50"),
    "G-C LeadTime p25 (min)": (0.0, "lead_p25"),
}


def _fmt(v: float | None) -> str:
    return "n/a" if v is None else f"{v:.4f}"


def _gate_line(label: str, threshold: float, value: float | None) -> str:
    if value is None:
        return f"- {label}: n/a (>= {threshold})"
    ok = "PASS" if value >= threshold else "FAIL"
    return f"- {label}: {value:.4f} (>= {threshold}) [{ok}]"


def render_markdown(out: EvaluationOutput, cfg: DetectorConfig, intervals: list[Interval]) -> str:
    m: Metrics = out.metrics
    lines: list[str] = [
        "# HeatWatch 校正レポート",
        "",
        f"- config_hash: `{out.config_hash}`",
        f"- threshold_version: `{cfg.threshold_version}` / weights: `{cfg.weights_version}`",
        f"- windows: {m.n_windows} / conflict intervals: {m.n_conflict}",
        f"- alerts: {m.n_alerts} / safety events: {m.n_safety}",
        f"- suppressed (cooldown/daily): {m.suppressed_cooldown}/{m.suppressed_daily}",
        "",
        "## Gate 判定（§4.3）",
        _gate_line("G-B AUC", 0.75, m.auc),
        _gate_line("G-C LeadTime 中央値(min)", 10.0, m.lead_p50),
        _gate_line("G-C LeadTime 25%(min)", 0.0, m.lead_p25),
        "",
        "## Lead Time 分布（分, North Star §12.3）",
        f"- p25: {_fmt(m.lead_p25)}  p50: {_fmt(m.lead_p50)}  p75: {_fmt(m.lead_p75)}",
        f"- detection_rate: {_fmt(m.detection_rate)}  false_alert_rate: {_fmt(m.false_alert_rate)}",
        "",
        "## 特徴量重要度（重み / §12.4）",
    ]
    for name, w in sorted(cfg.weights.items(), key=lambda kv: -kv[1]):
        lines.append(f"- {name}: {w:.3f}")
    lines.append(f"- repair_attempt (減点): -{cfg.w_repair:.3f}")

    lines += ["", "## 誤報事例の時刻一覧（本文なし / EVA-105）"]
    fa = [a for a in out.result.alerts if not in_conflict(a.ts, intervals)]
    if not fa:
        lines.append("- なし")
    else:
        for a in fa:
            lines.append(f"- {a.ts.isoformat()} (level {a.level})")
    lines.append("")
    return "\n".join(lines)
