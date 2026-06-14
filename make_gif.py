#!/usr/bin/env python3
"""donut.py のレンダラを使って回転アニメをGIF化する。"""
import donut
from PIL import Image, ImageDraw, ImageFont

W, H = 80, 40          # 文字グリッド
FRAMES = 90            # フレーム数
CELL_W, CELL_H = 9, 16 # 1文字のピクセルサイズ

# 等幅フォントを探す
font = None
for path in [
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
]:
    try:
        font = ImageFont.truetype(path, 14)
        break
    except Exception:
        continue
if font is None:
    font = ImageFont.load_default()

palette = [(20,40,60),(0,95,135),(0,135,175),(0,175,215),(0,215,255),
           (0,255,215),(0,255,135),(175,255,95),(255,255,0),
           (255,215,0),(255,255,255),(255,255,255)]

def color(ch):
    if ch == " ":
        return (10, 10, 15)
    return palette[min(donut.LUMINANCE.index(ch), len(palette)-1)]

images = []
A, B = 0.0, 0.0
for _ in range(FRAMES):
    frame = donut.render(A, B, W, H)
    img = Image.new("RGB", (W*CELL_W, H*CELL_H), (10, 10, 15))
    d = ImageDraw.Draw(img)
    for r in range(H):
        for c in range(W):
            ch = frame[r*W + c]
            if ch != " ":
                d.text((c*CELL_W, r*CELL_H), ch, fill=color(ch), font=font)
    images.append(img)
    A += 0.08
    B += 0.04

images[0].save("/home/user/Claude-/donut.gif", save_all=True,
               append_images=images[1:], duration=50, loop=0, optimize=True)
print("saved donut.gif", images[0].size, "frames:", len(images))
