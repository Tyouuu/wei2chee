# 设计风格说明书 · 抓自 uiprompt.site

73 种 UI 设计风格,每一种都有 uiprompt.site 公开发布、附复制按钮的 AI prompt。
抓于 2026-08-22。**这是他们主动公开给人拿的东西** —— 不是代码,是写给设计师看的
说明书,所以拿来用没有问题。

用法:一份说明书 → 一个 `design-system/tokens/<name>.css` → 我们 54 个组件全部
自动变成那个样子。见 `swiss.css` / `soft.css` 的档头,它们就是这样做出来的。

## 已经做成 Formae 风格的

| 说明书 | Formae 名字 | token 档 |
| --- | --- | --- |
| Swiss Design | 瑞士 | `design-system/tokens/swiss.css` |
| Soft UI | 柔和 | `design-system/tokens/soft.css` |

## 全部 73 种(抓下来的名字与分类)

| # | 名字 | 分类 |
| --- | --- | --- |
| 0 | Flat Design System |  |
| 1 | Minimalism |  |
| 2 | Typography |  |
| 3 | Ambient Light |  |
| 4 | Biophilic Design |  |
| 5 | Comic Book |  |
| 6 | Fabric Texture |  |
| 7 | Glow Effect |  |
| 8 | Hand-Drawn Sketch |  |
| 9 | Industrial Design |  |
| 10 | Leather Texture |  |
| 11 | Memphis |  |
| 12 | Nature Elements |  |
| 13 | Neon Cyberpunk |  |
| 14 | Outline Style |  |
| 15 | Pop Art |  |
| 16 | Smoke Effect |  |
| 17 | Spotlight |  |
| 18 | Wabi-Sabi |  |
| 19 | Art Deco |  |
| 20 | Digital Retro |  |
| 21 | Mid-Century Modern |  |
| 22 | Retro OS |  |
| 23 | Synthwave |  |
| 24 | Magazine Layout |  |
| 25 | Fluent Design 2.0 |  |
| 26 | Scroll Narrative |  |
| 27 | 3D Elements |  |
| 28 | Anti-Design Studio |  |
| 29 | Blueprint |  |
| 30 | Dark Mode |  |
| 31 | Generative Art |  |
| 32 | Gradients |  |
| 33 | Holographic Gradient |  |
| 34 | Ink Wash |  |
| 35 | Light Effects |  |
| 36 | Monochrome |  |
| 37 | Neo-Brutalism |  |
| 38 | Neon Noir |  |
| 39 | Paper Cutout |  |
| 40 | Scandinavian |  |
| 41 | Soft UI |  |
| 42 | Utility First |  |
| 43 | Y2K Era |  |
| 44 | Bauhaus |  |
| 45 | Film Noir |  |
| 46 | Newspaper Typography |  |
| 47 | Steampunk |  |
| 48 | VHS Aesthetic |  |
| 49 | Material Design System |  |
| 50 | Skeuomorphism |  |
| 51 | Accessibility |  |
| 52 | Aurora Glass |  |
| 53 | Claymorphism |  |
| 54 | Duotone |  |
| 55 | Glassmorphism |  |
| 56 | Grain Noise |  |
| 57 | Holographic Foil |  |
| 58 | Kawaii Minimal |  |
| 59 | Liminal Space |  |
| 60 | Natural |  |
| 61 | Neon Glow |  |
| 62 | Modern Organic |  |
| 63 | Particle System |  |
| 64 | Sci-Fi HUD |  |
| 65 | Solarpunk |  |
| 66 | Vaporwave |  |
| 67 | Arcade CRT Scanlines |  |
| 68 | Dark Academia |  |
| 69 | Frutiger Aero |  |
| 70 | Retro Futurism |  |
| 71 | Swiss Design |  |
| 72 | Mouse Tracking |  |

## 抓到全文的十份

下面十份是连 prompt 全文一起抓下来的。其余 63 份只有名字与分类 —— 全文随时可以
再抓一次(网站是公开的,一次约五分钟)。

### Swiss Design

```
Swiss Design (International Typographic Style) emphasizes clarity, order, and restraint. Use a strict grid system, generous white space, and clean sans-serif typography. Palette is primarily black and white with limited Swiss-red accent for emphasis on labels or dividers. Asymmetry is welcome as long as the underlying grid remains disciplined. Surfaces stay flat—no heavy shadows, gradients, or textures. Hierarchy is driven by type scale, weight, and spacing rather than decoration. Section labels often use uppercase with tight tracking; body text remains highly readable with comfortable line length and line height. Images should be monochrome or muted and framed by thin strokes and concise captions; avoid busy overlays. Buttons and chips are minimal outlines or simple fills; focus states must be obvious. Motion, if any, is subtle and fast. The layout should feel objective, factual, and confident—lead with information, not ornament—while maintaining accessibility: strong contrast, clear focus rings, semantic structure, and keyboard-friendly navigation across breakpoints.
```

### Soft UI

```
Role: You design Soft UI (neumorphic) visuals with inner/outer shadows and gentle gradients for cushioned depth.

Scene: Settings panels, widgets, control boards, personal productivity tools. Users expect soft cards, pill buttons and delicate shadows.

Visual philosophy: Light or low-saturation gradients as base; large-radius cards/buttons with paired light/dark shadows for relief; icons stay linear and clean.

Material and texture: Shadows 8–24px with low alpha; subtle edge highlights; matte surfaces without strong texture. Use limited solid accents for primary actions.

Interaction experience: Hover deepens shadows and lifts; active inverts/tightens shadows to press. Motions 150–220ms with soft curves.

Overall mood: Soft, refined and friendly—like touching fine rubber/suede, comfortable for long use.
```

### Neo-Brutalism

```
Role: You design Neo-Brutalism—hard strokes with candy-saturated blocks, bold outlines and offset shadows.

Scene: Startup/creative products, marketing landings, portfolios.

Visual philosophy: Thick strokes, large rounded or hard blocks in bright pink/yellow/blue/green; bold/mono type; clearly offset shadows. Sticker/doodle accents welcome; keep layout separation clear.

Material and texture: Solid fills, grain/stripe backdrops, sticker/graffiti symbols; short but offset shadows, 2–4px strokes. Avoid heavy glass/gradients.

Interaction experience: Hover tilts/lifts with thicker shadow; active sinks/tightens; 120–200ms direct transitions.

Overall mood: Loud, playful yet structured—like colorful blocks assembling the UI.
```

### Monochrome

```
Role:
You are a UI designer who specializes in monochrome visual language. Instead of relying on rich colors, you use black, white, and gray—together with contrast, whitespace, and typography—to build interfaces that feel strong, ordered, and deliberate.

Context:
Monochrome is well-suited for enterprise SaaS dashboards, design system documentation, minimalist portfolios, and any product that wants to communicate rationality, professionalism, and calm confidence. It also works as a baseline exploration tool for branding: by removing color noise, you reveal the underlying structure and information hierarchy.

Visual Philosophy:
The core of monochrome design is not the absence of color, but the use of value and contrast in place of hue. Large areas of white or very light gray create breathing space, while deep gray and black carry visual weight. Hierarchy is built through font size, weight, spacing, and layout rather than through colored accents. A good monochrome interface should remain legible and expressive even if viewed as a black-and-white printout.

Material & Texture:
Monochrome interfaces tend to be flat and clean. Most elements are simple shapes, thin borders, and carefully tuned shadows. Backgrounds may use subtle gradients or barely-there texture, but these should never overpower the content. The "material" is the precision of lines, the clarity of card edges, and the way shadows separate layers. You avoid heavy noise or pronounced patterns that would conflict with the minimalist aesthetic.

Typography & Grid:
In monochrome design, typography is effectively the main character. Strong headings paired with measured body text, clear hierarchy between titles, subtitles, and meta information, and thoughtful line spacing all contribute to a sense of control. A strict spacing grid—often 4px or 8px—keeps margins, paddings, and gaps coherent across the entire layout. Used this way, black, white, and gray become like musical notes on a staff, and text becomes the melody.

Interaction:
Without colorful states to rely on, interaction feedback is expressed through value and form. Hovering over a button may slightly darken its background and sharpen its shadow; pressing it may make it sink just enough to feel tangible. Focused fields may gain a darker border or a subtle inner shadow. Animations are short, smooth, and restrained. The goal is to support flow, not to show off motion design.

Atmosphere:
The overall mood of a monochrome interface is quiet confidence. It feels serious without being harsh, minimal without being empty. Because color is not competing for attention, users naturally focus on content: numbers, relationships, and hierarchy. A well-executed monochrome design feels like a carefully typeset black-and-white magazine spread or an annual report from a company that takes details seriously.

When extending or applying this style to new screens, keep asking:
- If all color were stripped away, would the layout still be clear and navigable?
- Is there enough whitespace to keep the information from feeling cramped?
- Do the contrasts between headings, body text, and secondary labels feel intentional and readable?
If the answer is yes, your monochrome design will remain strong and elegant, even in the absence of color.
```

### Scandinavian

```
Role: You are a UI designer focusing on Scandinavian minimalism, crafting a calm, bright and straightforward interface for everyday tools.

Scene:
- Suitable for personal dashboards, habit trackers, scheduling tools or lightweight SaaS products.
- Users expect the UI to “look simple, work directly, and never get in the way”.

Visual philosophy:
- Rely on large areas of white and very light gray, with small touches of muted color (greens, soft blues, warm yellows) to mark status or categories.
- Layout is about order and rhythm: clear grouping, generous spacing and strict alignment, with no unnecessary adornments.

Material & texture:
- Surfaces should feel like paper and thin wood: pale backgrounds, subtle shadows, modest corner radius; avoid heavy glows or loud gradients.
- Icons are simple outlines or minimal filled shapes—more like clear signage than detailed illustration.

Interaction:
- Hover feedback is gentle: slight background lift, border tinting towards the primary color, short and clean transitions.
- Primary buttons may use solid fills but remain modest—no oversized shadows or aggressive gradients.

Mood:
- The interface should feel like a tidy Scandinavian apartment: bright, quiet and comfortable without shouting for attention.
- Users should feel that the UI respects their pace and simply gives them a clear, uncluttered surface to work on.
```

### Magazine Layout

```
You are a UI designer mastering editorial design and typography art, deeply influenced by top magazines like Vogue, Kinfolk, and Monocle.

**Design Philosophy**:
Magazine layout is content-first. Every design decision should serve reading experience and content presentation, creating engaging visual narratives.

**Grid System**:
- Multi-column layouts: 2-4 columns, flexible combinations
- Baseline grid: Ensure vertical text alignment
- Modular grid: Precise placement of images and text blocks
- Bleed design: Images extending to edges
- Whitespace control: Elegant margins and spacing

**Font Pairing**:
- Headlines: Serif fonts (Playfair Display, Cormorant)
- Body: Readable sans-serif or serif (Source Serif, Lora)
- Quotes: Italic serif or decorative fonts
- Captions: Small sans-serif
- Clear size hierarchy: 56/32/24/18/14/12px

**Text-Image Relationship**:
- Text wrapping around images
- Full-width spanning images
- Text overlay on images (with masks)
- Whitespace framing images
- Cropping and bleed handling

**Decorative Elements**:
- Drop caps
- Dividers and decorative rules
- Page numbers and headers
- Pull quote styles
- Footnotes and margin notes

**Color Usage**:
- Primarily black, white, gray
- Single accent color for highlights
- Images can be color or black-white
- Background usually white or light cream

**Typography Details**:
- Proper punctuation placement
- Hyphenation for long words
- Kerning adjustments for headlines
- Line length control: 45-75 characters optimal
- First-line indent or paragraph spacing

**Interaction Considerations**:
- Smooth scroll reading
- Lazy loading images
- Responsive column adjustment
- Reading progress indicator

**Atmosphere**:
Magazine layout conveys elegance, professionalism, and respect for content. Suitable for blogs, online magazines, portfolios, long-form content, and anything emphasizing reading experience. Makes users feel they're reading a beautifully designed publication.
```

### Material Design System

```
Role: You are a UI designer well-versed in Google’s Material Design guidelines, and you need to explain how the Material Design family should look and behave in this project, in a way that teammates can understand without reading the spec.

Scene: The Material family is suited for multi-platform products that require consistency and clear structure: cross-device apps, admin consoles, productivity tools and content-heavy systems. It works best where there are many components and layers of information, giving users familiar cards, buttons and FABs so they can quickly recognise patterns and affordances.

Visual philosophy: Material is built on the idea of “paper surfaces + elevation shadows.” The interface is composed of abstract sheets of paper, each with its own elevation level. Different levels of shadow reflect different roles and interaction states: backgrounds are nearly flat; cards sit above them with moderate shadows; menus and dialogs float even higher; FABs occupy the topmost layer. This creates a world that is slightly skeuomorphic—there is depth and layering—but still abstract and minimal enough to feel like a UI system rather than a literal physical scene.

Material and texture: Surfaces are typically white or very light neutrals, with bold primary and secondary colors used for key accents. Cards, buttons and menus resemble clean pieces of card stock: small, consistent corner radii, soft blurred shadows and no visible noise or texture. Color follows a defined palette of primary, secondary and functional hues—such as deep purple, teal and red—paired with clear rules for text opacity so hierarchy is visible at a glance.

Interaction experience: Interaction focuses on touch feedback and elevation changes. When users tap a button or card, a ripple effect expands from the touch point, signalling that the action has been registered. Cards and menus appear and disappear with gentle scale and opacity transitions, as if sheets of paper were lifting off or settling back onto the stack. Components temporarily increase their elevation on hover or focus, deepening shadows to emphasise separation from the background. All motions follow Material’s easing curves, feeling smooth, responsive and consistent across the system.

Overall mood: The Material Design family creates a modern, friendly and system-like atmosphere. Users see layers of well-ordered cards, clear primary actions and comfortable spacing tied together by consistent light and shadow. It feels like operating within a coherent ecosystem rather than a one-off website: not as heavy as full skeuomorphism, but richer and more tactile than pure flat design, striking a balance where complex products can remain approachable and legible.
```

### Flat Design System

```
Role: You are a product designer who values clarity and efficiency, responsible for creating flat-design interfaces for dashboards, marketing pages and utility products. You need to explain to the team how the Flat Design family should look and where it is most appropriate.

Scene: The flat family is ideal for products that need to feel direct, clean and easy to read: admin consoles, analytics dashboards, SaaS marketing sites, learning platforms and simple productivity tools. It focuses attention on content and structure rather than decoration, helping users understand layout and actions at a glance.

Visual philosophy: Flat design replaces depth and texture with color blocks and typography. The interface discards volume and material realism, relying instead on simple geometry, solid backgrounds and strong contrast. Hierarchy is expressed through font size, weight, color value and whitespace rather than shadows or bevels. Buttons are simply colored rectangles, not sculpted objects. The whole UI behaves more like a well-composed information poster than a representation of physical objects.

Material and texture: In the flat family, “material” is reduced to a single layer of solid color. Shadows, gradients and textures are minimized or removed entirely. Large areas of flat color divide the page into zones: primary hues carry key actions and highlights, light neutrals preserve breathing room and dark text maintains legibility. Linear icons with consistent stroke width replace detailed illustrations, keeping the visual language light, modern and easy to scale.

Interaction experience: Interaction feedback is communicated mainly through color shifts, not dramatic movement or dimensional changes. On hover, buttons may darken or lighten slightly; text links may change tone or gain an underline, but they do not suddenly acquire glow or heavy shadows. State changes are shown through toggled fills, highlighted tabs and simple transitions, with short timings and straightforward easing so users notice what changed without being distracted.

Overall mood: The Flat Design family conveys a calm, contemporary and rational mood. Interfaces feel sharp and tidy, with clear sections and minimal ornamentation. When users land on a flat-style page, they should immediately see headlines, groups and actions without visual noise, perceiving the product as efficient, focused and professional.
```

### Bauhaus

```
You are a UI designer deeply influenced by the Bauhaus school, understanding the design philosophy of masters like Walter Gropius, Wassily Kandinsky, and Josef Albers.

**Design Philosophy**:
- 'Form follows function': Every visual element must have purpose
- 'Less is more': Reject ornamentation, pursue essence
- Unity of art and craft: Beauty and utility combined

**Color System**:
- Primary colors: Red (#E53935), Yellow (#FDD835), Blue (#1E88E5)
- Neutrals: Black (#212121), White (#FAFAFA), Gray (#9E9E9E)
- Pure colors without gradients
- Large whitespace with color block accents

**Geometric Shapes**:
- Circle: Represents universe, infinity, motion
- Triangle: Represents direction, tension, dynamics
- Square/Rectangle: Represents stability, order, static
- Shape combinations create visual tension and balance
- Use CSS clip-path or SVG for precise geometry

**Grid & Composition**:
- Strict grid system
- Asymmetric but balanced layouts
- Diagonal and dynamic compositions
- Golden ratio applications

**Typography**:
- Sans-serif geometric fonts (like Futura, Bauhaus 93 style)
- Text as design element in composition
- Vertical, horizontal, angled text arrangements
- Emphasis on weight and size contrast

**Material & Effects**:
- Flat pure colors, no shadows or minimal shadows
- Crisp, sharp edges
- Subtle paper texture can hint at craftsmanship

**Atmosphere**:
Bauhaus design conveys rationality, order, and modernity. It's both historical homage and timelessly modern. This style suits art galleries, design studios, educational institutions, and any brand needing to demonstrate design literacy.
```

### Newspaper Typography

```
Role: You are a UI designer specializing in Newspaper Typography, focusing on traditional print layout techniques applied to web design.

Scene Positioning: Create newspaper-textured interfaces for news websites, editorial platforms and long-form reading applications, conveying authority, professionalism and serious reading experience through classic typography.

Core Design Language:

1. **Newspaper Masthead**:
   - Wide letter-spacing, uppercase, bold serif fonts
   - Double-line separator (3-4px solid black)
   - Center-aligned, font-size 48-72px
   - Example:
   \`\`\`css
   .masthead {
     font-size: 48px;
     font-weight: 900;
     letter-spacing: 0.2em;
     border-top: 3px solid #000;
     border-bottom: 3px solid #000;
     padding: 1rem 0;
     text-align: center;
   }
   \`\`\`

2. **Drop Cap**:
   - First letter 3-5x larger (4.5rem)
   - float: left + margin-right
   - Color can use deep blue (#1E3A8A) for emphasis
   - Example:
   \`\`\`css
   .drop-cap {
     float: left;
     font-size: 4.5rem;
     line-height: 0.85;
     font-weight: 900;
     color: #1E3A8A;
     margin-right: 0.15rem;
   }
   \`\`\`

3. **Multi-column Layout**:
   - column-count: 2-3
   - column-gap: 2rem (32px)
   - column-rule: 1px solid #e5e7eb
   - text-align: justify
   - Example:
   \`\`\`css
   .newspaper-columns {
     column-count: 2;
     column-gap: 2rem;
     column-rule: 1px solid #e5e7eb;
     text-align: justify;
   }
   \`\`\`

4. **Classic Dividers**:
   - Double-line: border-top: 3px double #000
   - Dotted line: border-bottom: 1px dotted #d1d5db
   - Example:
   \`\`\`css
   .section-divider {
     border-top: 3px double #1E3A8A;
     margin: 2rem 0;
   }
   \`\`\`

Color Scheme:

Classic newspaper colors:
- Primary accent: #1E3A8A (deep blue) - headlines, drop caps
- Heading black: #1F2937, #111827
- Body gray: #374151, #4B5563
- Caption gray: #6B7280, #9CA3AF

Backgrounds:
- Cream: #FAF8F5, #F9FAFB (newspaper texture)
- Pure white: #FFFFFF (modern digital newspaper)

Font Selection:

Core principle: Use Serif fonts for traditional authority

Recommended stack:
\`\`\`css
font-family: 'Georgia', 'Times New Roman', 'Merriweather', serif;
\`\`\`

TailwindCSS:
\`\`\`html
<div class="font-serif">...</div>
\`\`\`

Typography Hierarchy:

\`\`\`css
/* Masthead */
.masthead {
  font-size: 3-5rem;
  font-weight: 900;
  letter-spacing: 0.2em;
}

/* Main headline */
.main-headline {
  font-size: 2-3rem;
  font-weight: 900;
  line-height: 1.2;
}

/* Body text */
.body-text {
  font-size: 0.9375rem;  /* 15px */
  line-height: 1.6;
  text-align: justify;
}
\`\`\`

Spacing System:

Use strict vertical rhythm:

\`\`\`css
/* Paragraph spacing */
p { margin-bottom: 1rem; }

/* Heading spacing */
h2 {
  margin-top: 2rem;
  margin-bottom: 1rem;
}

/* Column gap */
.columns {
  column-gap: 2rem;
}
\`\`\`

Accessibility:

1. Semantic HTML: Use <article>, <section>, <aside>
2. Contrast: Body vs background > 7:1
3. Reading width: Max line length 600-800px

Use Cases:
- News website homepages
- Online magazine content
- Long-form reading pages
- Academic articles
- Professional blogs
```

