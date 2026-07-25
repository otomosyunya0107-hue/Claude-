"""M4 features の検証（§9, FEA-104/105/106）。"""

from __future__ import annotations

from heatwatch.features import (
    FEATURE_SPECS,
    build_windows,
    compute_baseline,
    extract_raw,
    load_lexicons,
    normalize,
)
from heatwatch.features.extractors import Direction
from tests.fixtures.conversations import calm_conversation, conflict_conversation

LEX = load_lexicons()


def _raw_rows(messages: list) -> list[dict[str, float]]:
    return [extract_raw(w, LEX) for w in build_windows(messages)]


def test_all_13_features_present() -> None:
    assert len(FEATURE_SPECS) == 13
    w = build_windows(conflict_conversation())[-1]
    raw = extract_raw(w, LEX)
    assert set(raw) == {s.name for s in FEATURE_SPECS}


def test_lexicon_loaded() -> None:
    assert LEX.generalization
    assert LEX.repair
    assert LEX.safety
    assert LEX.version != "unknown"


def test_normalized_range() -> None:
    baseline = compute_baseline(_raw_rows(calm_conversation(40)))
    for w in build_windows(conflict_conversation()):
        norm = normalize(extract_raw(w, LEX), baseline)
        assert all(0.0 <= v <= 1.0 for v in norm.values())


def test_conflict_hotter_than_calm() -> None:
    """対立ウィンドウは複数の hot 特徴量で穏やか区間を上回る（H-1 の下地）。"""
    baseline = compute_baseline(_raw_rows(calm_conversation(60)))

    calm_w = build_windows(calm_conversation(30))[-1]
    conflict_w = build_windows(conflict_conversation())[-1]
    calm_last = normalize(extract_raw(calm_w, LEX), baseline)
    conflict_last = normalize(extract_raw(conflict_w, LEX), baseline)

    def hot_sum(norm: dict[str, float]) -> float:
        # repair(F-07) は hot ではないため除外。
        return sum(v for s in FEATURE_SPECS if not s.is_repair for v in [norm[s.name]])

    assert hot_sum(conflict_last) > hot_sum(calm_last)


def test_reaction_drop_direction() -> None:
    spec = {s.name: s for s in FEATURE_SPECS}["reaction_drop"]
    assert spec.direction is Direction.DOWN
