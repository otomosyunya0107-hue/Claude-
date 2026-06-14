#!/usr/bin/env python3
"""キャプチャした dashboard の ANSI 出力を解析してアニメGIF化する。"""
import re
from PIL import Image, ImageDraw, ImageFont

CELL_W, CELL_H = 11, 18
BG = (8, 10, 14)

# xterm 256色 -> RGB
def xterm_rgb(n):
    if n < 16:
        base = [(0,0,0),(128,0,0),(0,128,0),(128,128,0),(0,0,128),(128,0,128),
                (0,128,128),(192,192,192),(128,128,128),(255,0,0),(0,255,0),
                (255,255,0),(0,0,255),(255,0,255),(0,255,255),(255,255,255)]
        return base[n]
    if n < 232:
        n -= 16
        r, g, b = n // 36, (n // 6) % 6, n % 6
        conv = lambda x: 0 if x == 0 else 40 * x + 55
        return (conv(r), conv(g), conv(b))
    v = 8 + (n - 232) * 10
    return (v, v, v)

font = None
for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
          "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"]:
    try:
        font = ImageFont.truetype(p, 14); break
    except Exception:
        pass
if font is None:
    font = ImageFont.load_default()

raw = open('/tmp/dash_full.txt', encoding='utf-8', errors='replace').read()
frames_raw = [f for f in raw.split('\x1b[H') if f.strip()]
# 後半の安定したフレームを使用
frames_raw = frames_raw[2:62]

SGR = re.compile(r'\x1b\[([0-9;]*)m')
CTRL = re.compile(r'\x1b\[[0-9;?]*[A-Za-z]')

def parse_frame(text):
    """[(row, col, char, rgb)] を返す。"""
    cells = []
    row = col = 0
    cur = (0, 255, 70)
    i = 0
    while i < len(text):
        m = SGR.match(text, i)
        if m:
            codes = m.group(1).split(';')
            j = 0
            while j < len(codes):
                c = codes[j]
                if c == '' or c == '0':
                    cur = (0, 255, 70)
                elif c == '38' and j + 2 < len(codes) and codes[j+1] == '5':
                    cur = xterm_rgb(int(codes[j+2])); j += 2
                j += 1
            i = m.end(); continue
        m2 = CTRL.match(text, i)
        if m2:
            i = m2.end(); continue
        ch = text[i]; i += 1
        if ch == '\n':
            row += 1; col = 0; continue
        if ch == '\r':
            col = 0; continue
        if ch != ' ':
            cells.append((row, col, ch, cur))
        col += 1
    return cells, row

# 全体サイズ決定
maxrow = maxcol = 0
parsed = []
for fr in frames_raw:
    cells, rows = parse_frame(fr)
    parsed.append(cells)
    for r, c, ch, col in cells:
        maxrow = max(maxrow, r); maxcol = max(maxcol, c)

W = (maxcol + 2) * CELL_W
H = (maxrow + 2) * CELL_H
images = []
for cells in parsed:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    for r, c, ch, col in cells:
        d.text((c * CELL_W + 4, r * CELL_H + 2), ch, fill=col, font=font)
    images.append(img)

images[0].save('/home/user/Claude-/dashboard.gif', save_all=True,
               append_images=images[1:], duration=80, loop=0, optimize=True)
print("saved dashboard.gif", (W, H), "frames:", len(images))
