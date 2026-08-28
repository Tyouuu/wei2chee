/**
 * 图库交回来的那几个字，能拿来做什么。
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 *
 * The founder, 2026-08-28: 「客户要换照片的话 然后他点击进去照片 我们是不是提供足够
 * 类似的照片 我们需不需要加脚本来挡掉一些客户不想要的图片啊」.
 *
 * Both halves of that question are answered with the same material: every
 * photograph arrives carrying words. Pixabay sends `tags` (a comma list the
 * uploader wrote), Pexels sends `alt` (a sentence describing the picture). They
 * are the only handle we have on what a photograph IS, and they are enough for
 * exactly one of the two things he asked about.
 *
 * ── WHAT WAS MEASURED, 2026-08-28 ─────────────────────────────────────────
 *
 * 1,278 results across the eight trades' 32 query words were pulled and looked
 * at as contact sheets.
 *
 *   A BLOCKLIST OF TAGS CANNOT WORK, and this is not an opinion:
 *
 *   · The worst photograph in the whole set -- a fluorescent green mosaic
 *     SWATCH filling the frame, four of them in the renovation contractor's
 *     first twelve -- is tagged 「floor, ceramic, tile, flooring, interior,
 *     home, design」. Every one of those words is true, and every one of them
 *     also describes the photograph a renovator would actually want.
 *   · The second worst -- a crew of plastic figurines in hard hats -- is tagged
 *     「handyman, construction site, workers」.
 *   · Widening the list to catch them (background / wallpaper / pattern /
 *     texture) removes 52 more photographs, and roughly HALF of those are real:
 *     a mechanic lifting an engine, two women in a coffee shop, a painter with
 *     a scraper. Pixabay uploaders write those words for search traffic, not
 *     for truth.
 *
 *   So the rule below is deliberately NOT a blocklist of subjects. It rejects
 *   only what a photograph IS, never what is in it: a render, a swatch, a toy,
 *   a product cut out on white, or an image the uploader themselves declared
 *   was generated. 27 of 1,278 -- 2.1% -- and of those 27, 25 were correct on
 *   inspection.
 *
 *   IT IS HYGIENE, NOT THE FIX. The fix was the query words and 「像这张」.
 */

/**
 * Words that describe the KIND of image rather than its subject.
 *
 * Every entry has to survive one test: could this word appear on a real
 * photograph of a real Malaysian business? 「texture」 can (a photograph of a
 * shopfront tagged for search traffic). 「figurine」 cannot.
 *
 * `ai generated` is here on a different footing from the rest: it is a
 * SELF-DECLARATION. Pixabay requires uploaders to label generated content, so
 * unlike every other word here it cannot be a false positive — and the seven
 * that carried it looked completely real, which is exactly why the label is
 * the only way to catch them. A generated photograph of a salon that does not
 * exist is the one thing a page selling 「this is your business」 must not
 * carry.
 */
const NOT_A_PHOTOGRAPH_OF_A_BUSINESS = [
  "ai generated",
  "ai-generated",
  "illustration",
  /* 「3d render」 and not 「render」. Bare 「render」 was tried and pulled back
     out on 2026-08-28: in this trade RENDERING IS A REAL JOB — cement
     rendering, wall rendering — so the word appears on exactly the plasterer's
     photographs we most want a renovation contractor to find. It cost two
     computer-generated pallets out of 1,186 results to give it up, and it
     would have cost a plasterer his whole search. */
  "3d render",
  "3d rendering",
  "seamless",
  "template",
  "mockup",
  "figurine",
  "miniature",
  "toy",
  "isolated",
];

/* Whole words only. A substring match would take 「Toyota」 for 「toy」 and
   「surrender」 for 「render」, and a filter that quietly eats a car workshop's
   photograph is worse than no filter at all. */
const REJECT = new RegExp(
  `(?:^|[^a-z])(?:${NOT_A_PHOTOGRAPH_OF_A_BUSINESS.map((w) => w.replace(/[- ]/g, "[- ]")).join("|")})(?:$|[^a-z])`,
  "i",
);

/** True when the words say this is a render, a swatch, a toy or a generated
 *  image — not a photograph of somebody's business. */
export function isNotAPhotographOfABusiness(tags: string | undefined): boolean {
  return REJECT.test(` ${(tags ?? "").toLowerCase()} `);
}

/**
 * Words that carry a subject in one library and only noise in the other.
 *
 * Pixabay hands back a comma list of nouns, which is already a query. Pexels
 * hands back a written sentence — 「A detailed view of a gloved hand aligning
 * tiles with levelers during an indoor renovation」 — and feeding that back as
 * a search returns nothing, because the search engine weighs 「detailed」 and
 * 「during」 as heavily as 「tiles」. These are the words to drop first.
 */
const NOT_A_SUBJECT = new Set(
  ("a an the of on in at with and or to for from by as while is are being this that these those" +
    /* COUNTING WORDS. 「Two men renovating a room, ONE on a ladder」 seeded
       「men renovating room one」 on the first run — and 「one」 dragged the grid
       to children running on a beach and a dancer in a field. A number is
       never the subject of the photograph. */
    " one ones two three four five six seven eight nine ten several some many other another few" +
    " detailed view close closeup up shot photo image picture" +
    /* WHO, not WHAT. 「men」 and 「women」 were missing while 「man」 and 「woman」
       were there, which is exactly the sort of half-list this repo keeps
       finding. A photograph of a tiler is about the tiling. */
    " person persons people man men woman women male female guy guys lady ladies boy boys girl girls" +
    " kid kids child children adult adults young old anonymous unrecognizable crop cropped" +
    " beautiful modern stylish elegant vibrant colorful bright warm cozy busy" +
    " during near into over under inside outside").split(" "),
);

/**
 * 「找像这张的」 —— turn the photograph he pointed at into the next search.
 *
 * ── WHY THIS AND NOT A BLOCKLIST ──────────────────────────────────────────
 *
 * He asked whether we offer enough SIMILAR photographs. A blocklist answers a
 * different question: it takes things away, one word at a time, forever, and
 * the measurements above say it takes the wrong ones. This adds, costs nothing
 * to maintain, and is steered by the owner rather than by us — he is the only
 * person who knows which of the twenty is his business.
 *
 * Measured 2026-08-28. Seeding from a photograph of a worker laying tiles
 * returned four more tilers; from an aircond technician, four more technicians
 * on rooftops; from a plate of Malay curry, a Singapore hawker centre and
 * Malaysian curry puffs — the most local results anything in this picker has
 * ever produced. Seeding from the green mosaic swatch returns more swatches,
 * which is correct: it is faithful to what he pointed at.
 *
 * ── THE TWO LIBRARIES WRITE DIFFERENTLY, SO THEY ARE READ DIFFERENTLY ─────
 *
 * PIXABAY hands back a list its uploader wrote, most important first:
 * 「curry, malay, asian, food, plate, restaurant」. The front of that list is
 * the subject, so the front is what is taken.
 *
 * PEXELS hands back a written sentence, and English puts the head noun at the
 * END of a phrase. Taking the front of 「Two men renovating a room, one on a
 * ladder applying plaster」 gave 「renovating room ladder applying」 — and that
 * was photographed returning apple trees, an olive grove and a makeup artist,
 * because 「applying」 belongs to as many makeup photographs as building ones.
 * So a caption is cut at its first comma or preposition and read from the
 * BACK: 「A technician skillfully repairing an outdoor air conditioner unit」
 * yields 「outdoor air conditioner unit」, which is what the photograph is of.
 *
 * The provider is passed in rather than guessed. A guess would be a rule about
 * commas that quietly breaks the day a library changes its captions, and this
 * repo has enough of those.
 */
export function similarQuery(
  tags: string | undefined,
  provider?: "pixabay" | "pexels",
): string {
  const raw = (tags ?? "").toLowerCase();
  const isList = provider === "pixabay";
  /* Everything after the first comma or preposition is where the caption stops
     describing the subject and starts describing the circumstances. */
  const head = isList ? raw : raw.split(/,| with | while | during | in | on | at | for | near /)[0];
  const words = head
    .replace(/[^a-z\s,]/g, " ")
    .split(/[\s,]+/)
    .filter((w) => w.length > 2 && !NOT_A_SUBJECT.has(w));
  const distinct = [...new Set(words)];
  return (isList ? distinct.slice(0, 4) : distinct.slice(-4)).join(" ");
}
