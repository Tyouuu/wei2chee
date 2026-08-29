# -*- coding: utf-8 -*-
"""差异图 —— 只贴不及格的那几段，而且在图上把差异指出来。

老板 2026-08-29: 「你到9都要 因为我要准确性」. 第三件。

## 为什么要这一张

尺子回答得了「一不一样」，永远回答不了「好不好看」（重点 7c），所以眼睛这一步
删不掉。问题是它现在太贵：一套要裁八张原尺寸的图、一张一张看，24 套就是 192
次。做不完的东西等於没做。

这一张图把眼睛该看的范围收窄到尺子判 XX 的那几段：
  · 只贴那几段，其他的不贴
  · 每一段旁边写清楚尺子说它哪里不对
  · 用 readShape 量到的座标，在图上**画框指出那几个盒子**

192 次看图变成 24 × 2–3 次。这才是 24 套做得完的前提。

  npm run align -- <风格>      → 会自己跑这一支
  python scripts/align-diff.py <风格>
"""
import io
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

D = ".screenshots/align"
S = 0.46          # 比对照图大 —— 这一张是拿来找细节的，不是拿来看全貌的
BANNER = 58
GAP = 22
PAD = 10
REF = (214, 74, 74)
OURS = (58, 168, 122)
FLAG = (255, 92, 0)


def fonts():
    try:
        return (
            ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 22),
            ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 15),
        )
    except Exception:
        f = ImageFont.load_default()
        return f, f


F_BIG, F_SMALL = fonts()


def body(lst, secs):
    """顶栏不算一段 —— 跟 align-site.mjs 同一条规则，依据永远是 secs。"""
    return lst[1:] if secs and secs[0]["h"] < 120 else lst


def run(reg):
    jf = f"{D}/{reg}.json"
    if not os.path.exists(jf):
        print(f"{reg}: 还没有 {jf} —— 先跑 npm run align -- {reg}")
        return
    d = json.load(io.open(jf, encoding="utf-8"))
    marks = d.get("marks") or []
    pairs = d.get("pairs") or []
    T = body(d["theirs"]["secs"], d["theirs"]["secs"])
    O = body(d["ours"]["secs"], d["ours"]["secs"])
    TSH = body(d["theirs"].get("shape") or [], d["theirs"]["secs"])
    OSH = body(d["ours"].get("shape") or [], d["ours"]["secs"])

    # 尺子判 XX 的、跟某一段有关的那几条，按「模版第几段」归类。
    why = {}
    for m in marks:
        if m.get("ok") is not False:
            continue
        name = str(m.get("name") or "")
        if not name.startswith("第"):
            continue
        num = ""
        for ch in name[1:]:
            if ch.isdigit():
                num += ch
            else:
                break
        if num:
            why.setdefault(int(num), []).append(name)

    if not why:
        print(f"{reg}: 没有一段判 XX —— 不出差异图。用 {D}/{reg}.jpg 看全貌。")
        return

    ref = Image.open(f"{D}/{reg}-ref.jpg").convert("RGB")
    our = Image.open(f"{D}/{reg}-ours.jpg").convert("RGB")

    rows = []
    for (ti, oj) in pairs:
        if ti is None or oj is None:
            continue
        if (ti + 1) not in why:
            continue
        rows.append((ti, oj, why[ti + 1]))
    if not rows:
        print(f"{reg}: 判 XX 的那几段配不上对 —— 用 {D}/{reg}.jpg 看全貌。")
        return

    def crop(im, sec, boxes, tint):
        h = max(40, int(sec["h"] * S))
        w = int(im.width * S)
        piece = im.crop((0, sec["top"], im.width, sec["top"] + sec["h"])).resize((w, h), Image.LANCZOS)
        dr = ImageDraw.Draw(piece)
        # ── 把这一段里的盒子画出来：图跟按钮才画，字太多会糊成一片 ──────────
        for b in boxes or []:
            if b.get("kind") == "字":
                continue
            x0 = int(b["x0"] / 100 * w)
            x1 = int(b["x1"] / 100 * w)
            y0 = int(b["y0"] / 100 * h)
            y1 = int(b["y1"] / 100 * h)
            if x1 - x0 < 6 or y1 - y0 < 4:
                continue
            dr.rectangle([x0, y0, x1 - 1, y1 - 1], outline=FLAG, width=2)
            tag = b["kind"] + (b.get("rad") or "")
            dr.text((x0 + 4, max(0, y0 + 2)), tag, fill=FLAG, font=F_SMALL)
        dr.rectangle([0, 0, w - 1, h - 1], outline=tint, width=2)
        return piece

    pieces = []
    for (ti, oj, reasons) in rows:
        a = crop(ref, T[ti], TSH[ti] if ti < len(TSH) else [], REF)
        b = crop(our, O[oj], OSH[oj] if oj < len(OSH) else [], OURS)
        pieces.append((ti, oj, reasons, a, b))

    W = max(p[3].width + p[4].width for p in pieces) + GAP + PAD * 2
    H = sum(max(p[3].height, p[4].height) + BANNER + GAP for p in pieces) + PAD * 2
    c = Image.new("RGB", (W, H), (12, 12, 12))
    dr = ImageDraw.Draw(c)

    y = PAD
    for (ti, oj, reasons, a, b) in pieces:
        dr.rectangle([PAD, y, W - PAD, y + BANNER - 8], fill=(38, 38, 38))
        dr.text((PAD + 8, y + 4), f"模版第{ti + 1}段  ·  我们第{oj + 1}段", fill=(255, 255, 255), font=F_BIG)
        dr.text((PAD + 8, y + 32), "  ".join(reasons), fill=FLAG, font=F_SMALL)
        y += BANNER
        c.paste(a, (PAD, y))
        c.paste(b, (PAD + a.width + GAP, y))
        y += max(a.height, b.height) + GAP

    out = f"{D}/{reg}-diff.jpg"
    c.save(out, quality=88)
    print(f"{out}  {c.size[0]}x{c.size[1]}  ·  {len(pieces)} 段判 XX")


for reg in sys.argv[1:]:
    run(reg)
