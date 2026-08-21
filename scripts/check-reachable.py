"""
CAN A PERSON ACTUALLY PRESS EVERY CONTROL ON EVERY SCREEN?

Not a measurement, and not a screenshot. For every visible interactive element
on every reachable page, at two viewport sizes, this asks the browser what is
at that element's centre point. If the answer is not that element, something is
sitting on top of it and a real finger or cursor cannot reach it.

WHY IT EXISTS. On 2026-08-22 the product looked correct in screenshots and was
broken in three places that only a hit test finds:

  * The portal rail was a fixed 236px column with no breakpoint. At 390px it
    took 60% of the screen and pushed 「Read the specification」, 「Message on
    WhatsApp」 and every 「Open and edit →」 off the right edge — present in the
    DOM, unreachable with a thumb, and not scrollable to because the shell is
    a flex row.
  * The assistant's message list had no `min-h-0`, so it refused to shrink
    below its content and the composer underneath ended up ON TOP of the
    suggestion buttons.
  * The component library's grid tracks are `minmax(auto, 1fr)`, which read the
    deliberately-oversized scaled preview inside as a 490px minimum and pushed
    every tile off a phone screen.

None of those are visible in a desktop screenshot and all three are fatal on a
phone. Hence a test rather than another look.

    python scripts/check-reachable.py                 # against localhost:3000
    python scripts/check-reachable.py http://host     # somewhere else

Requires a running server and `pip install playwright && playwright install
chromium`. Exits non-zero if anything is unreachable.
"""

import os
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("playwright is not installed: pip install playwright && playwright install chromium")
    raise SystemExit(2)

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000").rstrip("/")
EMAIL = os.environ.get("CHECK_EMAIL", "tianyou.demo@formae.test")
PASSWORD = os.environ.get("CHECK_PASSWORD", "FormaeDemo2026!")

CHECK = r"""
() => {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const sel = 'a[href], button, input, textarea, select, [role=button], [tabindex]:not([tabindex="-1"])';
  const out = { covered: [], offscreen: [], zero: [], total: 0 };

  // Is this element inside something the user can scroll to reach it?
  // A swipeable chip row and a clipped control look identical to a rectangle
  // test and are opposites to a person.
  const inScroller = (el, axis) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      const o = axis === 'x' ? cs.overflowX : cs.overflowY;
      if (o !== 'auto' && o !== 'scroll') continue;
      const over = axis === 'x' ? p.scrollWidth > p.clientWidth + 2 : p.scrollHeight > p.clientHeight + 2;
      if (over) return true;
    }
    return false;
  };

  for (const el of document.querySelectorAll(sel)) {
    // checkVisibility walks ancestors, which a computed-style read on the
    // element alone does not: a `lg:hidden` wrapper leaves its children
    // reporting display:block while rendering nothing.
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const cs = getComputedStyle(el);
    if (el.hasAttribute('inert') || el.closest('[inert]')) continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    if (cs.pointerEvents === 'none' || el.closest('.pointer-events-none')) continue;
    // A closed <dialog> keeps its children in the DOM at 0x0.
    const dlg = el.closest('dialog');
    if (dlg && !dlg.open) continue;

    const r = el.getBoundingClientRect();
    const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName)
      .trim().slice(0, 44).replace(/\s+/g, ' ');
    out.total++;

    if (r.width < 2 || r.height < 2) { out.zero.push(label); continue; }

    // Entirely off the left edge is a closed drawer, which is the point of
    // `-translate-x-full`. Off to the right INSIDE a horizontal scroller is a
    // swipeable row. Everything else that leaves the viewport is clipped.
    if (r.right <= 0) continue;
    if (r.right > vw + 2 || r.left < -2) {
      if (!inScroller(el, 'x')) {
        out.offscreen.push(label + ' [left=' + Math.round(r.left) + ' right=' + Math.round(r.right) + ' vw=' + vw + ']');
      }
      continue;
    }
    if (r.bottom < 0 || r.top > vh) continue;

    const x = Math.min(vw - 1, Math.max(1, r.left + r.width / 2));
    const y = Math.min(vh - 1, Math.max(1, r.top + r.height / 2));
    const hit = document.elementFromPoint(x, y);
    if (!hit || hit === el || el.contains(hit) || hit.contains(el)) continue;
    out.covered.push(label + '  <-- covered by ' + hit.tagName + '[' + (hit.className || '').toString().slice(0, 44) + ']');
  }
  return out;
}
"""

PAGES = [
    ("landing", "/en"),
    ("login", "/en/login"),
    ("portal home", "/en/portal"),
    ("templates", "/en/portal/templates"),
    ("styles", "/en/portal/styles"),
    ("library", "/en/portal/library"),
    ("account", "/en/portal/account"),
    ("specification", "/en/portal/spec"),
    ("editor", "/en/portal/dashboard"),
    ("legal", "/en/legal/terms"),
]

VIEWPORTS = [("desktop 1440", 1440, 950, False), ("phone 390", 390, 844, True)]

failures = 0
out = []


def emit(line):
    out.append(line)
    try:
        print(line)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"))


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for vname, w, h, mobile in VIEWPORTS:
        ctx = browser.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile)
        page = ctx.new_page()
        page.goto(BASE + "/en/login", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(3000)
        page.fill('input[type="email"]', EMAIL)
        page.fill('input[type="password"]', PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_timeout(7000)

        emit("")
        emit("== %s ==" % vname)
        for name, url in PAGES:
            try:
                page.goto(BASE + url, wait_until="domcontentloaded", timeout=60000)
                page.wait_for_timeout(6500 if "portal/dashboard" in url else 3500)
                try:
                    page.get_by_role("button", name="Got it").click(timeout=1200)
                    page.wait_for_timeout(400)
                except Exception:
                    pass
                r = page.evaluate(CHECK)
            except Exception as e:
                emit("  %-16s ERROR %s" % (name, type(e).__name__))
                failures += 1
                continue

            bad = r["covered"] + r["offscreen"] + r["zero"]
            failures += len(bad)
            emit("  %-16s %3d controls  %s" % (name, r["total"], "ok" if not bad else "%d UNREACHABLE" % len(bad)))
            for kind in ("covered", "offscreen", "zero"):
                for item in r[kind]:
                    emit("      %-9s %s" % (kind, item))
        ctx.close()
    browser.close()

emit("")
emit("%d unreachable control(s)" % failures)
raise SystemExit(1 if failures else 0)
