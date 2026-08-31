# -*- coding: utf-8 -*-
"""按**我们的品牌**筛模版：黑底 + 青。
老板 2026-08-31:「订了品牌色 可以开始找模版了」·「去awwwards找啊」。

⚠️ 用量的，不是用眼睛翻。逐张缩图取样：
  · 底色明度（面积最大那个颜色的 L*）—— 越低越黑
  · 青的面积（色相 150–205、够饱和的像素占比）
  · 主色的色相 —— 那一张最跳的颜色是不是青

我们的品牌：地 oklch(0.13) ≈ L* 0.13 · 主色 #00BEB7 色相 178。
"""
import glob, os, sys, colorsys
from collections import Counter
from PIL import Image

def stats(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    c = Counter(); cyan = 0; tot = 0; ls = []
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            r, g, b = px[x, y]
            c[(r//16*16, g//16*16, b//16*16)] += 1
            lin = (0.2126*r + 0.7152*g + 0.0722*b)/255.0
            ls.append(lin ** (1/3))
            mx, mn = max(r, g, b), min(r, g, b)
            if mx:
                hh, ll, ss = colorsys.rgb_to_hls(r/255, g/255, b/255)
                if 150 <= hh*360 <= 205 and ss > 0.25 and 0.18 < ll < 0.80:
                    cyan += 1
            tot += 1
    ls.sort()
    ground = c.most_common(1)[0]
    gr, gg, gb = ground[0]
    gL = ((0.2126*gr + 0.7152*gg + 0.0722*gb)/255.0) ** (1/3)
    return {"ground": "#%02x%02x%02x" % (gr, gg, gb), "gL": gL,
            "cyan": 100*cyan/max(1, tot), "dark": 100*sum(1 for v in ls if v < 0.42)/len(ls)}

rows = []
for f in sorted(glob.glob(".screenshots/gallery/*.jpg")):
    if os.path.basename(f) in ("sheet.jpg", "top15.jpg", "brand.jpg", "accent.jpg", "cyan.jpg"):
        continue
    try:
        s = stats(f)
    except Exception:
        continue
    # 分数：黑底占一半，青占一半。两个都要有才算。
    score = min(s["dark"], 100)/100 * 0.55 + min(s["cyan"]*8, 100)/100 * 0.45
    rows.append((score, os.path.basename(f).replace(".jpg", ""), s))

rows.sort(reverse=True)
print(f"{'分':>5}  {'模版':44} {'底色':9} {'黑的面积':>7} {'青的面积':>7}")
for sc, n, s in rows[:18]:
    print(f"{sc:5.2f}  {n[:44]:44} {s['ground']:9} {s['dark']:6.0f}% {s['cyan']:6.1f}%")
