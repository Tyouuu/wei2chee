/**
 * 这个市场今天真的长什么样 -- 实拍 + 实量。
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * The customer's 官网 was being judged against two screenshots of Malaysian
 * trade sites that were years old. The founder caught it:
 *
 *   「你看看能不能找到近期马来西亚SME的 因为你上次找的那两张 你自己都承认已经是很久远了
 *     几年前的 我想要更准确的判断 不然很容易误判」 (2026-08-27)
 *
 * He is right and the risk is specific: we are about to build a website style
 * library off "what this market does", and a stale sample would bake a 2019
 * habit into every customer's site. So the sample is rebuilt from businesses
 * that are trading TODAY -- the list in docs/market-references.json carries the
 * newest year each page prints on itself -- and every claim below is measured
 * off the running page with getComputedStyle rather than read off a picture.
 *
 * ── WHY 390px IS THE PRIMARY SHOT ─────────────────────────────────────────
 *
 * A stranger looking for an aircond man is holding a phone. The desktop pass
 * exists only for the two numbers a phone cannot show: the content container
 * and the section rhythm.
 *
 *   npm run shoot:market            # all of them
 *   npm run shoot:market -- 装修    # one trade
 */
import { chromium } from "playwright"
import { mkdirSync, writeFileSync, readFileSync } from "node:fs"

const REFS = JSON.parse(readFileSync("docs/market-references.json", "utf8")).sites
const only = process.argv[2]
const list = only ? REFS.filter((s) => s.trade === only || s.name.toLowerCase().includes(only.toLowerCase())) : REFS
mkdirSync(".screenshots/market", { recursive: true })

const slug = (s) => s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

/* Everything below runs INSIDE the page. It is deliberately written against
   what a visitor can see rather than against markup conventions -- a WordPress
   theme, a Wix export and a hand-built page agree on none of the latter. */
const MEASURE = () => {
  const vw = innerWidth
  const vh = innerHeight
  const seen = (el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05
  }
  const inFirst = (el) => {
    const r = el.getBoundingClientRect()
    return r.top < vh && r.bottom > 0
  }
  const all = [...document.querySelectorAll("body *")].filter(seen)

  // A Malaysian number as a person writes it: 03-xxxx xxxx, 01x-xxx xxxx, +60...
  const PHONE = /(?:\+?60|0)[\s-]?\d{1,2}[\s-]?\d{3,4}[\s-]?\d{3,4}/
  const PRICE = /RM\s?\d/i
  const HOURS = /(mon|isnin|open|buka|hours|waktu)[^.]{0,30}(sun|ahad|fri|jumaat|\d\s?(am|pm))|24\s?(hours|jam)|\d{1,2}(:\d{2})?\s?(am|pm)\s?[-–]\s?\d{1,2}(:\d{2})?\s?(am|pm)/i

  const textOf = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim()
  const leaves = all.filter((el) => textOf(el).length > 0)

  // The phone number, and how big it is PRINTED. A number inside a button is
  // not the same thing as a number set in 28px -- the reference sites print it.
  let phonePx = 0
  let phoneText = ""
  for (const el of leaves) {
    const t = textOf(el)
    if (!PHONE.test(t) || t.length > 60) continue
    if (!inFirst(el)) continue
    const px = parseFloat(getComputedStyle(el).fontSize)
    if (px > phonePx) {
      phonePx = px
      phoneText = t.slice(0, 40)
    }
  }

  // Anything pinned to the glass in the lower half: the floating
  // WhatsApp/call pills this market puts on every page.
  //
  // FOUND BY LOOKING, NOT BY MEASURING. The first version of this asked each
  // element for its own `position` and reported 0/19 floating buttons -- while
  // the contact sheet showed a green WhatsApp circle on eleven of them. These
  // widgets set `position:fixed` on a WRAPPER, so the anchor itself is static.
  // Walk up from the link instead.
  const kindOf = (href, blob) => {
    if (/wa\.me|whatsapp/i.test(href + blob)) return "whatsapp"
    if (/^tel:/i.test(href)) return "call"
    if (/^mailto:/i.test(href)) return "email"
    if (/top|scroll/i.test(blob)) return "to-top"
    return "other"
  }
  const pinned = (el) => {
    let node = el
    while (node && node !== document.body) {
      const cs = getComputedStyle(node)
      if (cs.position === "fixed" || cs.position === "sticky") return node
      node = node.parentElement
    }
    return null
  }
  const floatKinds = []
  for (const a of document.querySelectorAll("a[href], button")) {
    const r = a.getBoundingClientRect()
    if (r.width < 20 || r.height < 20) continue
    if (!pinned(a)) continue
    // Judge by where the BUTTON sits, not where its wrapper sits. Half these
    // widgets wrap the pill in a full-viewport `inset:0; pointer-events:none`
    // layer, and asking the wrapper where it is answers "the whole screen".
    if (r.top < vh * 0.45) continue           // that is the sticky nav, not a pill
    if (r.height > vh * 0.35) continue
    const k = kindOf(a.getAttribute("href") || "", String(a.className) + a.innerHTML.slice(0, 300))
    if (!floatKinds.includes(k)) floatKinds.push(k)
  }

  // A strip across the very top, whatever it carries. The device is the same
  // one whether the strip says the opening hours, a promo code or a phone
  // number: a line of business fact above everything else on the page.
  const topBar = all.find((el) => {
    const r = el.getBoundingClientRect()
    if (r.top > 8 || r.height < 14 || r.height > 80 || r.width < vw * 0.85) return false
    const t = (el.innerText || "").replace(/\s+/g, " ").trim()
    return t.length > 3 && t.length < 160
  })

  const first = document.body.innerText.slice(0, 4000)
  const firstScreenText = leaves.filter(inFirst).map(textOf).join(" ")

  // Photographs in the first screen, as a share of it -- <img> and CSS
  // backgrounds both, because half this market paints the hero as a background.
  let photoArea = 0
  for (const el of all) {
    if (!inFirst(el)) continue
    const cs = getComputedStyle(el)
    const isImg = el.tagName === "IMG" && el.currentSrc && !/\.svg($|\?)/i.test(el.currentSrc)
    const isBg = /url\(/.test(cs.backgroundImage) && !/\.svg["')]|gradient/i.test(cs.backgroundImage)
    const isVideo = el.tagName === "VIDEO"
    if (!isImg && !isBg && !isVideo) continue
    const r = el.getBoundingClientRect()
    const a = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) * Math.min(r.width, vw)
    if (a > photoArea) photoArea = a
  }

  const h1 = [...document.querySelectorAll("h1")].filter(seen)[0]
  const heads = [...document.querySelectorAll("h2")].filter(seen)

  // Container + rhythm: the two numbers only the desktop pass can give.
  const main = document.querySelector("main") || document.body
  const kids = [...main.children].filter(seen).filter((el) => el.getBoundingClientRect().height > 80)
  const gaps = []
  for (let i = 1; i < kids.length; i++) {
    const a = kids[i - 1].getBoundingClientRect()
    const b = kids[i].getBoundingClientRect()
    if (b.top - a.bottom >= 0) gaps.push(Math.round(b.top - a.bottom))
  }
  // The measure a paragraph is actually set to, which is the container in disguise.
  const paras = [...document.querySelectorAll("p")].filter(seen).filter((p) => (p.innerText || "").length > 120)
  const paraW = paras.map((p) => Math.round(p.getBoundingClientRect().width)).sort((a, b) => a - b)
  const pads = kids.map((el) => Math.round(parseFloat(getComputedStyle(el).paddingTop))).filter((n) => n > 0).sort((a, b) => a - b)

  return {
    vw,
    phonePx: Math.round(phonePx),
    phoneText,
    priceInFirstScreen: PRICE.test(firstScreenText),
    priceOnPage: PRICE.test(first),
    hoursOnPage: HOURS.test(first),
    topBar: !!topBar,
    topBarText: topBar ? (topBar.innerText || "").replace(/\s+/g, " ").trim().slice(0, 70) : "",
    floats: floatKinds,
    photoPct: Math.round((photoArea / (vw * vh)) * 100),
    h1Px: h1 ? Math.round(parseFloat(getComputedStyle(h1).fontSize)) : 0,
    h1Text: h1 ? (h1.innerText || "").replace(/\s+/g, " ").trim().slice(0, 60) : "",
    h2Px: heads[0] ? Math.round(parseFloat(getComputedStyle(heads[0]).fontSize)) : 0,
    sectionPadTop: pads.length ? pads[Math.floor(pads.length / 2)] : 0,
    sectionGap: gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0,
    paraWidth: paraW.length ? paraW[Math.floor(paraW.length / 2)] : 0,
  }
}

const browser = await chromium.launch()
const out = []

for (const site of list) {
  const row = { ...site, phone: null, desktop: null }
  const passes = [
    ["phone", { width: 390, height: 844 }, true],
    ["desktop", { width: 1440, height: 900 }, false],
  ]
  for (const [tag, viewport, isMobile] of passes) {
    const page = await browser.newPage({ viewport, isMobile })
    try {
      await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 45000 })
      await page.waitForTimeout(8000)
      // Cookie/popup overlays hide the first screen this market cares about.
      const closers = ['button:has-text("Accept")', 'button:has-text("Agree")', '[aria-label="Close"]', ".pum-close", "#onesignal-slidedown-cancel-button"]
      for (const sel of closers) {
        try {
          await page.locator(sel).first().click({ timeout: 900 })
        } catch {}
      }
      await page.waitForTimeout(600)
      row[tag] = await page.evaluate(MEASURE)
      await page.screenshot({ path: `.screenshots/market/${slug(site)}-${tag}.png` })
      if (tag === "phone") {
        await page.screenshot({ path: `.screenshots/market/${slug(site)}-full.png`, fullPage: true }).catch(() => {})
      }
      console.log(`ok   ${site.trade} ${site.name} (${tag})`)
    } catch (e) {
      console.log(`FAIL ${site.trade} ${site.name} (${tag}) ${String(e).split("\n")[0].slice(0, 80)}`)
      row[`${tag}Error`] = String(e).split("\n")[0].slice(0, 120)
    }
    await page.close()
  }
  out.push(row)
}
await browser.close()

writeFileSync(".screenshots/market/measured.json", JSON.stringify(out, null, 1))

const pct = (n, d) => `${n}/${d} (${Math.round((n / d) * 100)}%)`
const ok = out.filter((r) => r.phone)
console.log("\n── 第一屏，390px ─────────────────────────────────────────")
console.log("trade      site                     phone#   price hours topbar floats            photo% h1")
for (const r of ok) {
  const p = r.phone
  console.log([
    r.trade.padEnd(6),
    r.name.slice(0, 24).padEnd(24),
    (p.phonePx ? `${p.phonePx}px` : "-").padEnd(7),
    (p.priceInFirstScreen ? "价" : p.priceOnPage ? "页" : "-").padEnd(4),
    (p.hoursOnPage ? "时" : "-").padEnd(4),
    (p.topBar ? "条" : "-").padEnd(5),
    (p.floats.join(",") || "-").padEnd(17),
    String(p.photoPct).padEnd(5),
    `${p.h1Px}px`,
  ].join(" "))
}
const n = ok.length
console.log("\n── 有多少家在做这一件 ──────────────────────────────────")
console.log("第一屏印出电话号码 ", pct(ok.filter((r) => r.phone.phonePx > 0).length, n))
console.log("  其中 >=20px 的  ", pct(ok.filter((r) => r.phone.phonePx >= 20).length, n))
console.log("浮动按钮（任何）   ", pct(ok.filter((r) => r.phone.floats.length).length, n))
console.log("  其中是 WhatsApp ", pct(ok.filter((r) => r.phone.floats.includes("whatsapp")).length, n))
console.log("顶上一条           ", pct(ok.filter((r) => r.phone.topBar).length, n))
console.log("价钱在第一屏       ", pct(ok.filter((r) => r.phone.priceInFirstScreen).length, n))
console.log("价钱在页面上       ", pct(ok.filter((r) => r.phone.priceOnPage).length, n))
console.log("营业时间在页面上   ", pct(ok.filter((r) => r.phone.hoursOnPage).length, n))
console.log("第一屏有照片 >=25% ", pct(ok.filter((r) => r.phone.photoPct >= 25).length, n))
const med = (xs) => {
  const s = xs.filter(Boolean).sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}
console.log("\n── 中位数 ──────────────────────────────────────────────")
console.log("h1 (390px)        ", med(ok.map((r) => r.phone.h1Px)) + "px")
console.log("h1 (1440px)       ", med(ok.map((r) => (r.desktop ? r.desktop.h1Px : 0))) + "px")
console.log("区块上留白 (1440) ", med(ok.map((r) => (r.desktop ? r.desktop.sectionPadTop : 0))) + "px")
console.log("正文行宽 (1440)   ", med(ok.map((r) => (r.desktop ? r.desktop.paraWidth : 0))) + "px")
console.log("第一屏照片占比    ", med(ok.map((r) => r.phone.photoPct)) + "%")
