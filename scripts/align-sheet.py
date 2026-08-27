# -*- coding: utf-8 -*-
"""对照图 —— the two pages side by side with a rule at every section boundary.

Second half of `npm run align`. The numbers align-site.mjs prints say WHICH
section is wrong; this says what it looks like, and 重点 3 says the picture is
the one that decides.
"""
import json, io, sys, os
from PIL import Image, ImageDraw, ImageFont

reg = sys.argv[1] if len(sys.argv) > 1 else "hearth"
D = ".screenshots/align"
d = json.load(io.open(f"{D}/{reg}.json", encoding="utf-8"))
a = Image.open(f"{D}/{reg}-ref.jpg").convert("RGB")
b = Image.open(f"{D}/{reg}-ours.jpg").convert("RGB")
S = 0.30

def strip(im, secs, tint):
    im = im.resize((int(im.width * S), int(im.height * S)), Image.LANCZOS)
    dr = ImageDraw.Draw(im)
    for s in secs:
        y = int(s["top"] * S)
        dr.line([(0, y), (im.width, y)], fill=tint, width=2)
    return im

A = strip(a, d["theirs"]["secs"], (255, 60, 60))
B = strip(b, d["ours"]["secs"], (60, 220, 255))
c = Image.new("RGB", (A.width + B.width + 30, max(A.height, B.height) + 30), (12, 12, 12))
c.paste(A, (0, 30)); c.paste(B, (A.width + 30, 30))
dr = ImageDraw.Draw(c)
try:
    f = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 13)
except Exception:
    f = ImageFont.load_default()
tot = lambda l: sum(s["h"] for s in l)
dr.text((4, 8), f"参考  {len(d['theirs']['secs'])}段 {tot(d['theirs']['secs'])}px", fill=(255, 120, 120), font=f)
dr.text((A.width + 34, 8), f"我们 {reg}  {len(d['ours']['secs'])}段 {tot(d['ours']['secs'])}px", fill=(120, 225, 255), font=f)
for i, s in enumerate(d["theirs"]["secs"]):
    dr.text((3, 30 + int(s["top"] * S) + 2), f"{i+1} {s['h']}", fill=(255, 120, 120), font=f)
for i, s in enumerate(d["ours"]["secs"]):
    dr.text((A.width + 33, 30 + int(s["top"] * S) + 2), f"{i+1} {s['h']}", fill=(120, 225, 255), font=f)
c.save(f"{D}/{reg}.jpg", quality=88)
print(f"{D}/{reg}.jpg  {c.size[0]}x{c.size[1]}")
