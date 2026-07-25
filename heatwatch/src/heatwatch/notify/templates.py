"""通知テンプレート（静的定義のみ）。requirements.md §11.2 に対応。

会話本文・引用・相手の発言要約を含めない（NOT-101）。各テンプレートは静的定数で
あり、動的に差し込めるのは継続分数（整数）のみとする。禁止語を含まない（NOT-102）。
"""

from __future__ import annotations

from dataclasses import dataclass

# level はスコア帯（scoring.level_for）と対応。Safety は special channel。
TEMPLATES: dict[str, str] = {
    "T-01": "直近の往復が普段より速くなっています。",
    "T-02": "短い返信の応酬が続いています。（{n}分継続）",
    "T-03": "返信間隔が普段の傾向から離れています。",
    "T-04": "通常の通知を停止しました。安全に関する情報はこちら。",
}


@dataclass(frozen=True)
class NotificationPayload:
    """通知の外部表現。本文・引用を持たない（NOT-101）。"""

    template_id: str
    text: str
    level: int


def render(template_id: str, minutes: int | None = None) -> str:
    """テンプレートを描画する。差し込みは継続分数（整数）のみ。"""
    text = TEMPLATES[template_id]
    if "{n}" in text:
        text = text.replace("{n}", str(int(minutes if minutes is not None else 0)))
    return text
