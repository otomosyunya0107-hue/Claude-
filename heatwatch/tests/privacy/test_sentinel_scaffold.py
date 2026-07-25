"""センチネル試験の骨組み（§15.2 / NFR-106）。

フル解析パイプラインは M1 以降で実装する。ここでは、リポジトリの git 管理下の
ファイルにセンチネル文字列が混入していないこと（＝将来のパイプライン実装が
この不変条件を破っていないこと）を検査する。パイプライン全体を流す本試験は
M2 で追加する。
"""

from __future__ import annotations

import subprocess
from pathlib import Path

from heatwatch.constants import SENTINEL_PREFIX

# センチネル値そのものを本ファイルに直接書かないため、実行時に組み立てる。
_SENTINEL = SENTINEL_PREFIX + "7c21"

_REPO_ROOT = Path(__file__).resolve().parents[2]


def test_sentinel_absent_from_tracked_files() -> None:
    tracked = subprocess.run(
        ["git", "-C", str(_REPO_ROOT), "ls-files"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.splitlines()

    offenders: list[str] = []
    for rel in tracked:
        path = _REPO_ROOT / rel
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if _SENTINEL in content and path != Path(__file__):
            offenders.append(rel)

    assert not offenders, f"センチネル文字列が git 管理下に出現: {offenders}"
