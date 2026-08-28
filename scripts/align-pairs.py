# -*- coding: utf-8 -*-
"""逐段并排，原尺寸。

Founder, 2026-08-28: 「还是不一样啊 还是有不同啊 你都没发现跟修好吗」. He is
right, and the reason is that the whole-page sheet is drawn at 30% — at that
size a card's fill, a rule above a claim, the weight of a label are all
invisible, so every round I fixed only what happened to survive the downscale.

This crops section N of theirs beside section N of ours AT FULL SIZE, one image
per pair, which is the only way the small differences are lookable at all.

  python scripts/align-pairs.py hearth
"""
import json, io, sys, os
from PIL import Image, ImageDraw, ImageFont

reg = sys.argv[1] if len(sys.argv) > 1 else "hearth"
D = ".screenshots/align"
OUT = f"{D}/pairs-{reg}"
os.makedirs(OUT, exist_ok=True)
d = json.load(io.open(f"{D}/{reg}.json", encoding="utf-8"))
a = Image.open(f"{D}/{reg}-ref.jpg").convert("RGB")
b = Image.open(f"{D}/{reg}-ours.jpg").convert("RGB")
try:
    F = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 20)
except Exception:
    F = ImageFont.load_default()

T, O = d["theirs"]["secs"], d["ours"]["secs"]
# Ours often carries a chrome bar their section list folds into the hero, so the
# pairing is by ORDER OF ARGUMENT, not by index. Skip our top bar if it is tiny.
ours = [s for s in O if s["h"] > 120]
CAP = 900   # a section taller than this is cropped; the top is where the design is

for i in range(max(len(T), len(ours))):
    t = T[i] if i < len(T) else None
    o = ours[i] if i < len(ours) else None
    hs = [min(x["h"], CAP) for x in (t, o) if x]
    H = max(hs) + 42
    W = (a.width if t else 0) + (b.width if o else 0) + 24
    c = Image.new("RGB", (W, H), (16, 16, 16))
    dr = ImageDraw.Draw(c)
    x = 0
    if t:
        c.paste(a.crop((0, t["top"], a.width, t["top"] + min(t["h"], CAP))), (x, 38))
        dr.rectangle([x, 0, x + a.width, 34], fill=(214, 74, 74))
        dr.text((x + 8, 6), f"模版 第{i+1}段  {t['h']}px", fill=(255, 255, 255), font=F)
        x += a.width + 24
    if o:
        c.paste(b.crop((0, o["top"], b.width, o["top"] + min(o["h"], CAP))), (x, 38))
        dr.rectangle([x, 0, x + b.width, 34], fill=(58, 168, 122))
        dr.text((x + 8, 6), f"我们 第{i+1}段  {o['h']}px", fill=(255, 255, 255), font=F)
    c.save(f"{OUT}/{i+1:02d}.jpg", quality=86)
print(OUT, max(len(T), len(ours)), "pairs")
