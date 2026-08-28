# -*- coding: utf-8 -*-
"""整页逐像素取样，按面积排出一套页面真正的颜色。

重点 7j: 「参考页整页的配色，逐像素量出来，原样搬过去」. The DOM-side colour
stack in align-site.mjs cannot do this on a Wix page — those pages paint with
child elements, so counting declarations returns 0% for the ground itself.
The screenshot cannot lie about area.

  python scripts/align-palette.py swiss ledger
"""
import sys, os
from collections import Counter
from PIL import Image

D = ".screenshots/align"
STEP = 3          # every 3rd pixel in both axes — 1/9 of the page
QUANT = 10        # collapse near-identical shades so JPEG noise does not split one colour

def palette(path, top=8):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    c = Counter()
    for y in range(0, h, STEP):
        for x in range(0, w, STEP):
            r, g, b = px[x, y]
            c[(r // QUANT * QUANT, g // QUANT * QUANT, b // QUANT * QUANT)] += 1
    n = sum(c.values())
    return [("#%02x%02x%02x" % k, round(100 * v / n, 1)) for k, v in c.most_common(top)]

for reg in sys.argv[1:]:
    for side, label in (("ref", "模版"), ("ours", "我们")):
        f = f"{D}/{reg}-{side}.jpg"
        if not os.path.exists(f):
            continue
        cols = palette(f)
        print(f"{reg:<10} {label}  " + "  ".join(f"{hx} {pc}%" for hx, pc in cols))
    print()
