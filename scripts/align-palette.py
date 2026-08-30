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


def dominant(im, top, height, n=6):
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

    # 照片铺满的那几段，align-site.mjs 会把编号传进来 —— 那一段的底色是那张
    # 照片的，不是这一页设计的。比两张不同的照片，答不了「配色一不一样」。
    photo_led = set()
    for arg in sys.argv[2:]:
        if arg.startswith("--photo="):
            photo_led = {int(x) for x in arg[len("--photo="):].split(",") if x.strip()}

    print(f"{reg}  逐段底色（一段对一段）")
    bad = 0
    for (i, j) in pairs:
        t = dominant(ref, T[i]["top"], T[i]["h"]) if 0 <= i < len(T) else []
        o = dominant(ours, O[j]["top"], O[j]["h"]) if 0 <= j < len(O) else []
        tag = f"第{i+1}段" if i == j else f"第{i+1}段(配我们第{j+1}段)"
        if i in photo_led:
            print(f"  --  {tag}  照片铺满这一段 —— 底色是那张照片的，不判")
            continue
        if not t or not o:
            print(f"  --  {tag}  " + ("模版没有这一段" if not t else "我们没有这一段"))
            bad += 1
            continue
        th, tp = t[0]
        oh, op = o[0]
        same = near(th, oh)
        close = same and abs(tp - op) <= SHARE_TOL

        # ── 这一段用了几个颜色 ──────────────────────────────────────────────
        # 以前只判「面积最大的那一个」。一段铺三个颜色跟一段铺一个颜色，只要
        # 最大的那个对上就算过 —— 而「用几个颜色」正是设计本身：招牌 的那一段
        # 是酒红配奶白配粉，我们画成一整片酒红，最大的那个一模一样。
        # 只数铺得够多的（≥6%），JPEG 的杂讯跟一条细线不是「一个颜色」。
        nt = len([1 for _, sh in t if sh >= 6.0])
        no = len([1 for _, sh in o if sh >= 6.0])
        same_count = abs(nt - no) <= 1
        close = close and same_count

        flag = "OK" if close else "XX"
        if not close:
            bad += 1
        why = "" if same else "  ← 底色不是同一个"
        if same and not same_count:
            why = f"  ← 用的颜色数不同（模版 {nt} 个 · 我们 {no} 个）"
        print(f"  {flag}  {tag}  模版 {th} {tp}%   我们 {oh} {op}%{why}")
    print(f"  逐段对不上 {bad} 段")

    # ── 深浅分布：整页最暗到最亮跨多少，有颜色的面积占多少 ──────────────────
    # 任务 28 量过一次，那把尺是散的，从来没有接进 align。而「我们的模版很丑」
    # 那一次量出来的根因就是它：整页最暗的一个像素是 L* 0.69 —— 页面上根本没有
    # 「暗」这个东西，别人要嘛压到 0.15 以下，要嘛把颜色开到 27–37%。
    # 两个数字都不改变段数、段高、张数、字级，所以每一根轴都看不到它们。
    def spread(im):
        w, h = im.size
        px = im.load()
        ls, coloured, total = [], 0, 0
        for y in range(0, h, 9):
            for x in range(0, w, 9):
                r, g, b = px[x, y]
                # 近似明度：sRGB 的相对亮度开三次方，够分辨「暗不暗」
                lin = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
                ls.append(lin ** (1 / 3))
                mx, mn = max(r, g, b), min(r, g, b)
                if mx and (mx - mn) / mx > 0.18:
                    coloured += 1
                total += 1
        ls.sort()
        lo = ls[int(len(ls) * 0.02)]
        hi = ls[int(len(ls) * 0.98)]
        return round(lo, 2), round(hi, 2), round(hi - lo, 2), round(100 * coloured / max(1, total))

    tl, th_, tsp, tc = spread(ref)
    ol, oh, osp, oc = spread(ours)
    ok_span = abs(tsp - osp) <= 0.18
    ok_col = abs(tc - oc) <= 14
    print(f"  {'OK' if ok_span else 'XX'}  对比跨度  模版 {tsp}（{tl}→{th_}）   我们 {osp}（{ol}→{oh}）")
    print(f"  {'OK' if ok_col else 'XX'}  有颜色的面积  模版 {tc}%   我们 {oc}%")


# 旗标不是风格名。以前这里是 `for reg in sys.argv[1:]` —— 於是每一次跑完，
# 尺子最后两行都在讲 「还没有 .screenshots/align/--photo=0.json」。
# 一把每次都对自己叫一次狼的尺没有人看（upstream 那把犯过同一个错）。
regs = [a for a in sys.argv[1:] if not a.startswith("--")]
if not regs:
    sys.exit("用法: python scripts/align-palette.py <风格> [--pairs=..] [--photo=..]")
for reg in regs:
    run(reg)
    print()
