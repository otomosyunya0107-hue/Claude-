#!/usr/bin/env python3
"""
回転する3D ASCIIドーナツ (トーラス) をターミナル全体に滑らかに描画する。

- 標準ライブラリのみ使用 (追加インストール不要)
- ANSIエスケープシーケンスによる高FPS・低ちらつき描画
- ターミナルのリサイズ (SIGWINCH) に追従
- Ctrl+C で画面を復元して終了

参考: Andy Sloane の "donut.c" のレンダリング原理を Python へ移植・拡張。
"""

import math
import os
import shutil
import signal
import sys
import time

# 輝度に対応した文字 (暗い -> 明るい)
LUMINANCE = ".,-~:;=!*#$@"

# トーラスの形状パラメータ
R1 = 1.0          # チューブ半径
R2 = 2.0          # 中心からチューブ中心までの距離
K2 = 5.0          # 観測者からドーナツ中心までの距離

# 角度のサンプリング刻み (小さいほど密で滑らか)
THETA_STEP = 0.07
PHI_STEP = 0.02

_resized = True   # 起動直後に一度サイズを取得させる


def _on_resize(signum, frame):
    global _resized
    _resized = True


def get_size():
    cols, rows = shutil.get_terminal_size(fallback=(80, 24))
    return cols, rows


def render(A, B, width, height):
    """1フレーム分の画面文字列を生成して返す。"""
    # 視野に合わせた投影スケール (画面サイズに自動追従)
    K1 = width * K2 * 3 / (8 * (R1 + R2))

    output = [" "] * (width * height)
    zbuffer = [0.0] * (width * height)

    cosA, sinA = math.cos(A), math.sin(A)
    cosB, sinB = math.cos(B), math.sin(B)

    theta = 0.0
    while theta < 2 * math.pi:
        costheta, sintheta = math.cos(theta), math.sin(theta)
        theta += THETA_STEP

        phi = 0.0
        while phi < 2 * math.pi:
            cosphi, sinphi = math.cos(phi), math.sin(phi)
            phi += PHI_STEP

            # トーラス表面の円の座標
            circlex = R2 + R1 * costheta
            circley = R1 * sintheta

            # 3D空間での回転後の座標
            x = (circlex * (cosB * cosphi + sinA * sinB * sinphi)
                 - circley * cosA * sinB)
            y = (circlex * (sinB * cosphi - sinA * cosB * sinphi)
                 + circley * cosA * cosB)
            z = K2 + cosA * circlex * sinphi + circley * sinA
            ooz = 1.0 / z  # 1/z

            # スクリーン座標へ投影
            xp = int(width / 2 + K1 * ooz * x)
            yp = int(height / 2 - K1 * 0.5 * ooz * y)

            if not (0 <= xp < width and 0 <= yp < height):
                continue

            # 法線と光源の内積で輝度を算出
            L = (cosphi * costheta * sinB
                 - cosA * costheta * sinphi
                 - sinA * sintheta
                 + cosB * (cosA * sintheta - costheta * sinA * sinphi))

            idx = xp + width * yp
            if ooz > zbuffer[idx]:
                zbuffer[idx] = ooz
                lum = int(L * 8) if L > 0 else 0
                lum = max(0, min(len(LUMINANCE) - 1, lum))
                output[idx] = LUMINANCE[lum]

    return output


def colorize(ch):
    """輝度に応じて色を付ける (256色: 青緑 -> 黄 -> 白)。"""
    if ch == " ":
        return " "
    level = LUMINANCE.index(ch)
    palette = [23, 30, 37, 44, 51, 50, 49, 190, 226, 220, 231, 231]
    color = palette[min(level, len(palette) - 1)]
    return f"\x1b[38;5;{color}m{ch}"


def main():
    global _resized
    signal.signal(signal.SIGWINCH, _on_resize)

    sys.stdout.write("\x1b[?25l")   # カーソル非表示
    sys.stdout.write("\x1b[2J")     # 画面クリア
    sys.stdout.flush()

    A, B = 0.0, 0.0
    width, height = get_size()
    target_dt = 1.0 / 60.0          # 目標 60 FPS

    try:
        while True:
            frame_start = time.perf_counter()

            if _resized:
                width, height = get_size()
                sys.stdout.write("\x1b[2J")
                _resized = False

            frame = render(A, B, width, height)

            # ホームへ戻して1フレームを一括出力 (ちらつき防止)
            buf = ["\x1b[H"]
            for row in range(height):
                line = frame[row * width:(row + 1) * width]
                buf.append("".join(colorize(c) for c in line))
                if row != height - 1:
                    buf.append("\x1b[0m\n")
            buf.append("\x1b[0m")
            sys.stdout.write("".join(buf))
            sys.stdout.flush()

            # 回転を進める
            A += 0.04
            B += 0.02

            # フレームレート調整
            elapsed = time.perf_counter() - frame_start
            if elapsed < target_dt:
                time.sleep(target_dt - elapsed)

    except KeyboardInterrupt:
        pass
    finally:
        sys.stdout.write("\x1b[0m\x1b[2J\x1b[H\x1b[?25h")  # 復元
        sys.stdout.flush()


if __name__ == "__main__":
    main()
