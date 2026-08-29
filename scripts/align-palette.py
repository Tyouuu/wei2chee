# -*- coding: utf-8 -*-
"""逐段量颜色 —— 一段对一段，不是整页一个平均。

老板 2026-08-28: 「就是每个颜色 分段去测量」.

整页取样能对上，而每一段的底色还是可以完全不同：一页 40% 白、25% 深色的比例，
可以由「白底＋两条深带」达成，也可以由「深底＋两条白带」达成 —— 两个数字一样，
两个设计相反。他指着中台说「有时候的背景不一样」指的就是这件事。

所以取样的单位是 SECTION：从 align 存下来的那份 JSON 拿两边各自的段界，
把每一段的画面裁出来，量它自己最大面积的那个颜色，然后一段对一段比。

  python scripts/align-palette.py counter
"""
import sys, os, json, io
from collections import Counter
from PIL import Image

D = ".screenshots/align"
STEP = 3      # 每 3 个像素取一次 —— 一段里的九分之一
QUANT = 10    # 相邻的色阶并成一个，JPEG 的杂讯不该把一个纯色拆成三个
TOL = 26      # 每个通道差在这之内算同一个颜色
SHARE_TOL = 18  # 面积差几个百分点之内算对上


def dominant(im, top, height, n=3):
    """一段画面里铺得最多的几个颜色。"""
    w, h = im.size
    y0, y1 = max(0, top), min(h, top + height)
    if y1 - y0 < 8:
        return []
    px = im.load()
    c = Counter()
    for y in range(y0, y1, STEP):
        for x in range(0, w, STEP):
            r, g, b = px[x, y]
            c[(r // QUANT * QUANT, g // QUANT * QUANT, b // QUANT * QUANT)] += 1
    total = sum(c.values()) or 1
    return [("#%02x%02x%02x" % k, round(100 * v / total, 1)) for k, v in c.most_common(n)]


def near(a, b, tol=TOL):
    ai = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    bi = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return all(abs(x - y) <= tol for x, y in zip(ai, bi))


def run(reg):
    jf = f"{D}/{reg}.json"
    if not os.path.exists(jf):
        print(f"{reg}: 还没有 {jf} —— 先跑 npm run align -- {reg}")
        return
    d = json.load(io.open(jf, encoding="utf-8"))
    ref = Image.open(f"{D}/{reg}-ref.jpg").convert("RGB")
    ours = Image.open(f"{D}/{reg}-ours.jpg").convert("RGB")

    # 顶栏不算一段：Wix 把导航折进第一段的盒子里，我们的是兄弟节点。
    body = lambda l: l[1:] if l and l[0]["h"] < 120 else l
    T, O = body(d["theirs"]["secs"]), body(d["ours"]["secs"])

    # ── 配对由 align-site.mjs 给，不再按位置 ────────────────────────────────
    # 以前这里是 `for i in range(max(len(T), len(O)))` —— 硬按位置。招牌 我们
    # 七段他们六段，於是我们的**询价表格**被拿去跟他们的**页脚**比底色，比出
    # 来的每一条都是假的，而真的那一对（页脚对页脚）从来没有比过。
    # 一个假差异比没有差异更糟：它会把人送去修一件本来没坏的东西。
    pairs = []
    for arg in sys.argv[2:]:
        if arg.startswith("--pairs="):
            for bit in arg[len("--pairs="):].split(","):
                a, b = bit.split(":")
                pairs.append((int(a), int(b)))
    if not pairs:
        pairs = [(i, i) for i in range(min(len(T), len(O)))]

    print(f"{reg}  逐段底色（一段对一段）")
    bad = 0
    for (i, j) in pairs:
        t = dominant(ref, T[i]["top"], T[i]["h"]) if 0 <= i < len(T) else []
        o = dominant(ours, O[j]["top"], O[j]["h"]) if 0 <= j < len(O) else []
        tag = f"第{i+1}段" if i == j else f"第{i+1}段(配我们第{j+1}段)"
        if not t or not o:
            print(f"  --  {tag}  " + ("模版没有这一段" if not t else "我们没有这一段"))
            bad += 1
            continue
        th, tp = t[0]
        oh, op = o[0]
        same = near(th, oh)
        close = same and abs(tp - op) <= SHARE_TOL
        flag = "OK" if close else "XX"
        if not close:
            bad += 1
        why = "" if same else "  ← 底色不是同一个"
        print(f"  {flag}  {tag}  模版 {th} {tp}%   我们 {oh} {op}%{why}")
    print(f"  逐段对不上 {bad} 段")


for reg in sys.argv[1:]:
    run(reg)
    print()
