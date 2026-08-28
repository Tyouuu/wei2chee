# -*- coding: utf-8 -*-
"""对照图 —— the two pages side by side with a rule at every section boundary.

Second half of `npm run align`. The numbers align-site.mjs prints say WHICH
section is wrong; this says what it looks like, and 重点 3 says the picture is
the one that decides.

⚠️ WHICH SIDE IS WHICH HAS TO BE READABLE ON A PHONE.
Founder, 2026-08-28, looking at one of these: 「哪一个模版啊 哪一个是我们的风格啊」.
The labels were 13px Chinese in a corner, on a sheet he opens at a third of its
size on a handset — so the one question the picture exists to answer, which of
these two is ours, could not be answered from it. A comparison nobody can read
the axis of is not a comparison. Now each column carries a banner in its own
colour across the full width, and the whole thing is framed in that colour.
"""
import json, io, sys, os
from PIL import Image, ImageDraw, ImageFont

reg = sys.argv[1] if len(sys.argv) > 1 else "hearth"
D = ".screenshots/align"
d = json.load(io.open(f"{D}/{reg}.json", encoding="utf-8"))
a = Image.open(f"{D}/{reg}-ref.jpg").convert("RGB")
b = Image.open(f"{D}/{reg}-ours.jpg").convert("RGB")
S = 0.30

REF = (214, 74, 74)      # 模版
OURS = (58, 168, 122)    # 我们
BANNER = 62              # tall enough to survive being viewed at a third size
GAP = 26
PAD = 10


def fonts():
    try:
        return (
            ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 34),
            ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 18),
            ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 13),
        )
    except Exception:
        f = ImageFont.load_default()
        return f, f, f


F_BIG, F_MID, F_SMALL = fonts()


def strip(im, secs, tint):
    im = im.resize((int(im.width * S), int(im.height * S)), Image.LANCZOS)
    dr = ImageDraw.Draw(im)
    for s in secs:
        y = int(s["top"] * S)
        dr.line([(0, y), (im.width, y)], fill=tint, width=2)
    return im


A = strip(a, d["theirs"]["secs"], REF)
B = strip(b, d["ours"]["secs"], OURS)

W = A.width + B.width + GAP + PAD * 2
H = max(A.height, B.height) + BANNER + PAD * 2
c = Image.new("RGB", (W, H), (12, 12, 12))
dr = ImageDraw.Draw(c)

tot = lambda l: sum(s["h"] for s in l)


def column(img, x, colour, title, sub, secs):
    """A banner in the column's own colour, then the page under it, then a
    frame in the same colour all the way down — so the pairing survives being
    cropped, screenshotted or shrunk to a thumbnail."""
    dr.rectangle([x - 3, PAD - 3, x + img.width + 2, PAD + BANNER + img.height + 2], outline=colour, width=3)
    dr.rectangle([x, PAD, x + img.width, PAD + BANNER], fill=colour)
    dr.text((x + 12, PAD + 8), title, fill=(255, 255, 255), font=F_BIG)
    dr.text((x + 12, PAD + 42), sub, fill=(255, 255, 255), font=F_SMALL)
    c.paste(img, (x, PAD + BANNER))
    for i, s in enumerate(secs):
        dr.text((x + 3, PAD + BANNER + int(s["top"] * S) + 2), f"{i+1} {s['h']}", fill=colour, font=F_SMALL)


column(A, PAD, REF, "模版（别人的）",
       f"{d['url']}   {len(d['theirs']['secs'])}段 {tot(d['theirs']['secs'])}px", d["theirs"]["secs"])
column(B, PAD + A.width + GAP, OURS, f"我们的风格 · {reg}",
       f"我们照它做的这一套   {len(d['ours']['secs'])}段 {tot(d['ours']['secs'])}px", d["ours"]["secs"])

c.save(f"{D}/{reg}.jpg", quality=88)
print(f"{D}/{reg}.jpg  {c.size[0]}x{c.size[1]}")
