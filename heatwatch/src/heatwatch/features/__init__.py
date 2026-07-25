"""M4: 特徴量層（F-01〜F-13）。

辞書は config/lexicons/*.yaml から読み込み（FEA-103）、形態素解析は
SudachiPy 等のローカル推論のみ（FEA-101/102）。全特徴量を [0,1] に正規化し
baseline を参照する（FEA-106）。ネットワーク依存を追加しない（§15.1）。
"""

from __future__ import annotations

from .baseline import Stats, compute_baseline, normalize
from .extractors import FEATURE_SPECS, extract_raw
from .lexicon import Lexicons, load_lexicons
from .windowing import Window, build_windows

__all__ = [
    "FEATURE_SPECS",
    "Lexicons",
    "Stats",
    "Window",
    "build_windows",
    "compute_baseline",
    "extract_raw",
    "load_lexicons",
    "normalize",
]
