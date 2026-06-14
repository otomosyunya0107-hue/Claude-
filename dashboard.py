#!/usr/bin/env python3
"""
CYBERDECK :: サイバーパンク風リアルタイム監視ダッシュボード

- Python標準ライブラリのみ (curses不要 / 追加インストール不要)
- 画面を3セクションに分割し ~80ms 周期で更新
    上段: 16進ダンプ & システムログ風テキストが高速スクロール (マトリックス風)
    中段: 伸縮するテキストバー型インジケーター [###....] 42%
    下段: デジタル時計 + ランダム変動するステータス
- ANSI 256色で緑/ネオンブルー基調
- iPhoneの狭い画面でも崩れないよう表示幅を最大48桁に制限
- リサイズ追従 (SIGWINCH) / Ctrl+C で復元して終了
"""

import os
import random
import shutil
import signal
import sys
import time

MAX_W = 48          # iPhone想定: 1行あたり最大48桁に制限
MIN_W = 30
FRAME_DT = 0.08     # 約 80ms 周期 (>12.5 FPS)

# --- 256色パレット (緑 / ネオンブルー / シアン基調) ---
C = {
    "dimg":  "\x1b[38;5;22m",   # 暗い緑
    "green": "\x1b[38;5;40m",   # 緑
    "bgrn":  "\x1b[38;5;46m",   # 明るい緑
    "neon":  "\x1b[38;5;82m",   # ネオングリーン
    "cyan":  "\x1b[38;5;51m",   # シアン
    "blue":  "\x1b[38;5;39m",   # ネオンブルー
    "dblue": "\x1b[38;5;24m",   # 暗い青
    "white": "\x1b[38;5;231m",
    "amber": "\x1b[38;5;220m",
    "red":   "\x1b[38;5;196m",
    "mag":   "\x1b[38;5;201m",
}
RESET = "\x1b[0m"
BOLD = "\x1b[1m"

HEXCH = "0123456789ABCDEF"
LOG_TAGS = ["SYS", "NET", "AUTH", "KERN", "DAEMON", "CORE", "I/O", "MEM", "GPU", "SEC"]
LOG_VERBS = ["init", "sync", "scan", "link", "exec", "purge", "trace", "bind", "flush", "ping"]
LOG_STATE = [("OK", "neon"), ("ACK", "cyan"), ("BUSY", "amber"), ("WARN", "amber"), ("FAIL", "red")]

_resized = True


def _on_resize(signum, frame):
    global _resized
    _resized = True


def term_size():
    cols, rows = shutil.get_terminal_size(fallback=(40, 24))
    w = max(MIN_W, min(cols, MAX_W))
    return w, rows


def clip(text, w):
    """可視文字を w 桁に切り詰め / 空白で右埋め (色コードは含めない素の文字列)。"""
    if len(text) > w:
        return text[:w]
    return text + " " * (w - len(text))


def gen_hex_line(w):
    """16進ダンプ風の1行を生成。"""
    addr = "".join(random.choice(HEXCH) for _ in range(4))
    nbytes = max(2, (w - 9) // 3)
    body = " ".join("".join(random.choice(HEXCH) for _ in range(2)) for _ in range(nbytes))
    return f"0x{addr} {body}"


def gen_log_line(w):
    """システムログ風の1行を生成 (タグ/動詞/状態)。"""
    tag = random.choice(LOG_TAGS)
    verb = random.choice(LOG_VERBS)
    state, scol = random.choice(LOG_STATE)
    pid = random.randint(100, 9999)
    line = f"[{tag}] {verb}.pid={pid} -> {state}"
    return line, scol


def make_bar(label, pct, w):
    """[####....] NN% 形式のバーを (素テキスト, 色付きテキスト) で返す。"""
    label = label[:6].ljust(6)
    # 構成: "LABEL [........] NNN%"
    fixed = len(label) + 1 + 2 + 1 + 4  # ラベル+空白+括弧+空白+パーセント表記
    barlen = max(4, w - fixed)
    filled = int(round(pct / 100 * barlen))
    filled = max(0, min(barlen, filled))
    bar_fill = "#" * filled
    bar_empty = "." * (barlen - filled)

    # 使用率で色を変える
    if pct >= 85:
        col = C["red"]
    elif pct >= 60:
        col = C["amber"]
    else:
        col = C["neon"]

    colored = (
        f"{C['cyan']}{label}{RESET} "
        f"{C['dblue']}[{RESET}{col}{bar_fill}{C['dimg']}{bar_empty}{RESET}{C['dblue']}]{RESET} "
        f"{C['white']}{pct:3d}%{RESET}"
    )
    return colored


def hline(w, color):
    return f"{color}{'-' * w}{RESET}"


def title_bar(w, blink):
    label = " CYBERDECK//MONITOR "
    dot = "*" if blink else " "
    text = clip(f"{dot}{label}", w)
    return f"{C['blue']}{BOLD}{text}{RESET}"


def main():
    global _resized
    signal.signal(signal.SIGWINCH, _on_resize)
    sys.stdout.write("\x1b[?25l\x1b[2J")
    sys.stdout.flush()

    w, h = term_size()
    matrix = []           # 上段スクロール用の行バッファ [(text, kind, color)]
    bars = {              # 中段バーの現在値
        "CPU": 40.0, "MEM": 55.0, "NET": 20.0,
        "GPU": 33.0, "DISK": 48.0,
    }
    nodes = ["NODE-A", "NODE-B", "GRID-X", "RELAY"]
    threat_levels = [("LOW", "neon"), ("MOD", "amber"), ("HIGH", "red"), ("CRIT", "mag")]
    threat = (0, "LOW", "neon")
    frame = 0

    try:
        while True:
            t0 = time.perf_counter()
            if _resized:
                w, h = term_size()
                sys.stdout.write("\x1b[2J")
                _resized = False
                matrix = []

            # --- レイアウト計算 (高さに応じて配分) ---
            usable = max(8, h - 1)
            bottom_h = 4
            mid_h = len(bars) + 1            # バー + 見出し
            top_h = max(3, usable - bottom_h - mid_h - 4)  # 残り (区切り線4本分を控除)

            # --- 上段: スクロール更新 (毎フレーム1〜2行投入) ---
            for _ in range(random.randint(1, 2)):
                if random.random() < 0.55:
                    matrix.append(("hex", gen_hex_line(w), None))
                else:
                    txt, scol = gen_log_line(w)
                    matrix.append(("log", txt, scol))
            matrix = matrix[-top_h:]

            # --- 中段: バー値をランダムウォーク ---
            for k in bars:
                bars[k] += random.uniform(-9, 9)
                bars[k] = max(2.0, min(99.0, bars[k]))

            # --- 下段: ステータス変動 ---
            if frame % 9 == 0:
                lv = random.choices(range(4), weights=[6, 3, 2, 1])[0]
                threat = (lv, *threat_levels[lv])
            node = nodes[(frame // 7) % len(nodes)]

            # ================= 描画バッファ構築 =================
            out = ["\x1b[H"]

            def put(colored_line):
                out.append(colored_line + "\x1b[K\n")

            blink = (frame // 6) % 2 == 0
            put(title_bar(w, blink))
            put(hline(w, C["dblue"]))

            # 上段 (マトリックス風スクロール): 新しい行ほど明るく
            n = len(matrix)
            shown = matrix[-top_h:]
            for i, (kind, text, scol) in enumerate(shown):
                age = len(shown) - 1 - i      # 0 が最新
                line = clip(text, w)
                if kind == "hex":
                    if age == 0:
                        col = C["white"]
                    elif age <= 2:
                        col = C["bgrn"]
                    elif age <= 5:
                        col = C["green"]
                    else:
                        col = C["dimg"]
                    put(f"{col}{line}{RESET}")
                else:
                    col = C[scol] if age <= 1 else C["green"] if age <= 4 else C["dimg"]
                    put(f"{col}{line}{RESET}")
            # 上段の空き行を埋める
            for _ in range(top_h - len(shown)):
                put("")

            put(hline(w, C["dblue"]))

            # 中段: バー
            put(f"{C['blue']}{BOLD}{clip('  RESOURCE TELEMETRY', w)}{RESET}")
            for k, v in bars.items():
                put(make_bar(k, int(round(v)), w))

            put(hline(w, C["dblue"]))

            # 下段: 時計 + ステータス
            now = time.strftime("%H:%M:%S")
            ms = int((time.time() % 1) * 100)
            clock = f"{now}.{ms:02d}"
            put(f"{C['cyan']}{BOLD}{clip('  ' + clock + '  ::SYS-LINK', w)}{RESET}")

            _, tname, tcol = threat
            st_glyph = "".join(random.choice("01<>|/\\=+") for _ in range(min(8, w - 2)))
            put(f"{C['dblue']}  THREAT:{RESET}{C[tcol]}{BOLD} {tname:<4}{RESET}"
                f" {C['dblue']}NODE:{RESET}{C['neon']} {node}{RESET}")
            put(f"{C['dimg']}  {clip(st_glyph + '  [Ctrl+C: EXIT]', w - 2)}{RESET}")

            sys.stdout.write("".join(out))
            sys.stdout.flush()

            frame += 1
            dt = time.perf_counter() - t0
            if dt < FRAME_DT:
                time.sleep(FRAME_DT - dt)

    except KeyboardInterrupt:
        pass
    finally:
        sys.stdout.write(RESET + "\x1b[2J\x1b[H\x1b[?25h")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
