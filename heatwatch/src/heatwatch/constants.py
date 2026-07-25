"""プロジェクト全体で共有する定数。

本文・実名などの機微情報は含めない（NFR-106）。
"""

from __future__ import annotations

from zoneinfo import ZoneInfo

# DEC-107 / §8.1: タイムゾーンは Asia/Tokyo に固定する。
TOKYO = ZoneInfo("Asia/Tokyo")

# §15.2 センチネル試験で用いる既知文字列のプレフィックス。
# この文字列はプロセスメモリ以外の永続層に出現してはならない。
SENTINEL_PREFIX = "HEATWATCH_SENTINEL_"

# DET-105 / §8.2: バージョン識別子。config・辞書・ベースラインの更新で更新する。
FEATURE_VERSION = "0.0.0-dev"
THRESHOLD_VERSION = "0.0.0-dev"
BASELINE_VERSION = "0.0.0-dev"
