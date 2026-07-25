"""M1: エクスポート解析層。

Meta 公式エクスポート JSON を読み込み、mojibake 復元（PIT-01）・昇順ソート
（PIT-02）・分割結合と重複除去（PIT-03）・種別判定（PIT-04/05）を経て
``model.Message`` の昇順列へ正規化する。ネットワーク依存を持たない
（P0-ETH-06）。
"""

from __future__ import annotations

from .mojibake import recover
from .parser import IngestReport, parse_export

__all__ = ["IngestReport", "parse_export", "recover"]
