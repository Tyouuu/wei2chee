/**
 * 在浏览器里跑的那一份 —— **一个地方写，几支尺一起用**。
 *
 * ── 为什么抽出来（2026-09-08）─────────────────────────────────────────────
 *
 * 这两支探针是 `walk:stranger` 一路学出来的，而它们**每一条都有一次学费**：
 * 颜色的算术交给 canvas（正则解析 rgba 会被 Tailwind v4 的 oklab 骗，
 * 对九十二个好好的元素报错）· 往上叠着找真正的地 · 2.5.8 的例外是**圆心距**
 * 不是缝（`walk:eyesight` 第一版把门槛拉高了一倍）· 只数**看得见**的字。
 *
 * `audit:product` 要问的是同一批问题，只是换一批页面。抄第二份就是让
 * 那五次学费只留在其中一份上 —— 这个仓库栽在「第二份手写拷贝」上至少八次。
 *
 * ⚠️ 这两支**必须自己站得住**：`page.evaluate` 把函式序列化送进浏览器，
 * 抓不到模组作用域里的任何东西。所以里面不准引用这个档案的其他东西。
 */

/* ═══════════════════════════════════════════════════════════════════════
   在浏览器里跑的那一份。

   🔴 颜色的算术让浏览器自己做 —— `check-contrast.mjs` 的档头写着为什么：
   第一版用正则解析 rgba(...)，而 Tailwind v4 的透明度会算成 oklab(...)，
   於是它对九十二个好好的元素报错。canvas 认得每一种写法。
   ═══════════════════════════════════════════════════════════════════════ */
export const AUDIT = () => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const parse = (s) => {
    if (!s || s === "transparent" || s === "none") return { r: 0, g: 0, b: 0, a: 0 };
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = s;
    ctx.globalCompositeOperation = "copy";
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const over = (fg, bg) =>
    fg.a >= 1
      ? fg
      : {
          r: fg.r * fg.a + bg.r * (1 - fg.a),
          g: fg.g * fg.a + bg.g * (1 - fg.a),
          b: fg.b * fg.a + bg.b * (1 - fg.a),
          a: 1,
        };

  /* 往上找到第一个真的有底色的祖先。一个透明的框叠在一个透明的卡上，
     真正的地在更上面 —— 只问它自己，会把每一样东西都当成压在白纸上。 */
  const groundOf = (el) => {
    let n = el;
    let acc = null;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.a > 0) acc = acc ? over(acc, c) : c;
      if (acc && acc.a >= 1) return acc;
      n = n.parentElement;
    }
    const body = parse(getComputedStyle(document.body).backgroundColor);
    if (body.a > 0) return acc ? over(acc, body) : body;
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const seen = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
  };

  const out = { text: [], boxes: [], taps: [], unnamed: [], dead: [], cjk: [], sideways: 0, controls: 0, words: 0 };

  /* ── ① 字 4.5:1（WCAG 1.4.3）。只看真的自己带字的那一层 ——
        不然一个包着整页的容器会被当成一段字。 */
  for (const el of document.querySelectorAll("body *")) {
    if (!seen(el)) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) continue;
    const s = getComputedStyle(el);
    const g = groundOf(el);
    const rt = ratio(over(parse(s.color), g), g);
    const px = parseFloat(s.fontSize) || 16;
    const big = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
    const need = big ? 3 : 4.5;
    if (rt < need) out.text.push({ t: el.textContent.trim().slice(0, 46), rt: +rt.toFixed(2), need, px: Math.round(px) });
  }

  /* ── ② 他要打字／要挑的框，边 3:1（WCAG 1.4.11）
        老花眼看不见的第一样是边框，那跟字是两条。 */
  for (const el of document.querySelectorAll("input, textarea, select")) {
    if (!seen(el)) continue;
    if (["hidden", "submit", "button"].includes(el.type)) continue;
    const s = getComputedStyle(el);
    /* 🔴 一个原生的勾选框是**浏览器自己画的** —— 它的 `border-width` 是 0、
       `background` 是透明，所以量出来永远是 0:1，而画面上那个方框好好的。
       2026-09-08 它就这样把 `/today` 那两个判成红的，而实拍上两个都看得见。
       **一把冤枉人的尺没有人看。**
       ⚠️ 只放过 `appearance: auto` 那一种 —— 一旦有人写 `appearance: none`，
       那个框就是**我们画的**，照样要过 3:1。 */
    if (
      ["checkbox", "radio"].includes(el.type) &&
      (s.appearance === "auto" || s.webkitAppearance === "auto")
    ) {
      out.uaDrawn = (out.uaDrawn ?? 0) + 1;
      continue;
    }
    const g = groundOf(el.parentElement || el);
    /* 🔴 那个框看得见的边，常常**不画在它自己身上**。
       2026-09-08 实测：表格上那个筛选框的边画在包着它的 `<label>` 上，
       而这个框自己是 `bg-transparent` 没有 border —— 於是它报 0:1，
       **十六页一起冤枉**，而画面上那个框边框好好的。
       所以往上找三层：第一个自己带边或者带底的祖先，就是人看到的那个框。
       ⚠️ 三层就停 —— 再往上会找到整张卡，那不是这个框的边。

       🔴 而「三层」不够 —— 2026-09-08 它照样找过头了：
       `/today` 那两个勾选框（16×16）被判 **1.48:1**，而那条边是
       **整段上面那条分隔线**（`border-t` 那一条，画在几百像素外）。
       一个原生勾选框自己的 border-width 是 **0**，所以它一定会往上找。

       → 加一条：**那个祖先不可以比这个控件高一倍以上**。
       一个框看得见的边是**贴着它**的（表格那个搜寻框：输入框 22px，外面那层 `<label>` 44px），
       而一条横过整段的线不是任何一个控件的边。
       ⚠️ 代价：一个真的把边画在「标签在上、框在下」那种外层的设计，
       它会看不到 —— 那种今天这个仓库没有，有的时候要回来改这一条。 */
    const boxOf = (start) => {
      const h0 = start.getBoundingClientRect().height;
      let n = start;
      for (let i = 0; n && i < 4; i++, n = n.parentElement) {
        const cs = getComputedStyle(n);
        const hasBorder = ["Top", "Right", "Bottom", "Left"].some(
          (k) => parseFloat(cs["border" + k + "Width"]) >= 0.5,
        );
        const hasOutline = parseFloat(cs.outlineWidth) >= 0.5 && cs.outlineStyle !== "none";
        const hasOwnBg = parse(cs.backgroundColor).a > 0;
        if (!hasBorder && !hasOutline && !hasOwnBg) continue;
        if (n !== start && n.getBoundingClientRect().height > h0 * 2 + 24) break;
        return n;
      }
      return start;
    };
    const box = boxOf(el);
    const bs = getComputedStyle(box);
    const bg = groundOf(box.parentElement || box);
    let best = 0;
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      if (parseFloat(bs["border" + side + "Width"]) < 0.5) continue;
      best = Math.max(best, ratio(over(parse(bs["border" + side + "Color"]), bg), bg));
    }
    if (parseFloat(bs.outlineWidth) >= 0.5 && bs.outlineStyle !== "none") {
      best = Math.max(best, ratio(over(parse(bs.outlineColor), bg), bg));
    }
    /* 没有边的时候，它自己的底跟外面的地也算 —— 一个填色的框照样看得出边界。 */
    const own = parse(bs.backgroundColor);
    if (own.a > 0) best = Math.max(best, ratio(over(own, bg), bg));
    const label =
      el.labels?.[0]?.textContent?.trim() ||
      el.getAttribute("aria-label") ||
      el.getAttribute("name") ||
      el.getAttribute("placeholder") ||
      el.type;
    if (best < 3) out.boxes.push({ label: String(label).slice(0, 34), rt: +best.toFixed(2) });

    /* ── ③ 每一个框有没有名字。只有提示字不算：一打字它就不见了。 */
    const named =
      (el.labels && el.labels.length > 0) ||
      !!el.getAttribute("aria-label") ||
      !!el.getAttribute("aria-labelledby") ||
      !!el.closest("label");
    if (!named) out.unnamed.push({ ph: String(el.getAttribute("placeholder") || el.type).slice(0, 34) });
  }

  /* ── ④ 按得准（WCAG 2.5.8 是 24×24，Apple 要 44）。
        ⚠️ 2.5.8 的例外是**圆心距**不是缝：一颗 20×20 的按钮
        旁边只要 2px 的空地就够。`walk:eyesight` 第一版写成
        「缝 < 24 就没过」，那把门槛拉高了一倍。 */
  const clickable = [...document.querySelectorAll("a[href], button, input, textarea, select, [role=button]")].filter(seen);
  out.controls = clickable.length;
  const rects = clickable.map((el) => el.getBoundingClientRect());
  clickable.forEach((el, i) => {
    const r = rects[i];
    if (r.width >= 24 && r.height >= 24) return;
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    let near = Infinity;
    rects.forEach((o, j) => {
      if (i === j) return;
      near = Math.min(near, Math.hypot(o.x + o.width / 2 - cx, o.y + o.height / 2 - cy));
    });
    if (near < 24) {
      out.taps.push({
        t: String(el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30),
        w: Math.round(r.width),
        h: Math.round(r.height),
        near: Math.round(near),
      });
    }
  });

  /* ── ⑤ 指不到的连结。一颗按下去什么都不会发生的东西，
        是这个仓库禁的第一条。 */
  for (const a of document.querySelectorAll("a[href]")) {
    if (!seen(a)) continue;
    const h = a.getAttribute("href");
    if (h === "#" || h === "" || h === "javascript:void(0)") {
      out.dead.push({ t: a.innerText.trim().slice(0, 34), h });
      continue;
    }
    if (h.startsWith("#")) {
      const id = h.slice(1);
      if (!document.getElementById(id) && !document.querySelector('[name="' + id + '"]')) {
        out.dead.push({ t: a.innerText.trim().slice(0, 34), h });
      }
    }
  }

  /* ── ⑥ 一个讲英文的系统上印中文。[重点 22d]：
        做展示用的资料要跟着那个系统自己的语言走。 */
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.trim();
    if (!t) continue;
    const p = n.parentElement;
    /* ⚠️ 只数**看得见**的字。第一版把藏起来的一起数，於是一张
       390 宽的页报「29425 个字」—— 一个没有人读得完的数字，
       而它读起来像那一页塞满了东西。 */
    if (!p || !seen(p)) continue;
    out.words += t.length;
    if (!/[一-鿿]/.test(t)) continue;
    out.cjk.push(t.slice(0, 40));
  }

  out.sideways = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  return out;
};

/** 往每一个可按的东西正中央打一枪 —— 回来的不是它自己，就是被盖住了。 */
export const HITTEST = () => {
  const seen = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width >= 1 && r.height >= 1 && s.visibility !== "hidden" && Number(s.opacity) > 0.05;
  };
  const out = [];
  for (const el of document.querySelectorAll("a[href], button, [role=button], input[type=submit]")) {
    if (!seen(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.y + r.height < 0 || r.y > innerHeight) continue; /* 卷出画面的不算 */
    const cy = Math.max(1, Math.min(innerHeight - 1, r.y + r.height / 2));
    const hit = document.elementFromPoint(r.x + r.width / 2, cy);
    if (!hit) continue;
    if (hit === el || el.contains(hit) || hit.contains(el)) continue;
    const cls = hit.className && typeof hit.className === "string" ? "." + hit.className.split(" ")[0] : "";
    out.push({
      t: String(el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 34),
      by: (hit.tagName + cls).slice(0, 40),
    });
  }
  return out;
};

