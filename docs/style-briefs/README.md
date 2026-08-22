# 设计风格说明书 · 全 73 份

抓于 2026-08-22,来源 uiprompt.site。

> **这个网站已经不在了。** 2026-08-22 当天再去看,域名已经变成停放页
> ("Is this your domain?")。下面 73 份全文是从 Wayback Machine 的
> 2026-04-01 快照里、他们自己的 `data/styles-index.json` 挖回来的。
>
> 这就是「看到有用的东西当场抓下来」跟「加书签」的差别。

## 怎么用

一份说明书 → 一个 `design-system/tokens/<name>.css` → 我们 54 个组件全部
自动变成那个样子。见 `swiss.css` / `soft.css` / `brut.css` 的档头。

**但不是每一份都做得出来。** token 层能表达颜色、字体、圆角、边框、阴影、
疏密、字距 —— 不能表达**版面**。所以「杂志排版」「滚动叙事」这类讲的是
布局的说明书,在这套系统里表达不了(布局是 builder 决定的,不是 token)。
讲**表面**的那些才做得出来:粗野、剪纸、玻璃、颗粒、黏土。

## 已经做成 Formae 版式的

| 说明书 | Formae 名字 | token 档 |
| --- | --- | --- |
| Swiss Design | 瑞士 | `design-system/tokens/swiss.css` |
| Soft UI | 柔和 | `design-system/tokens/soft.css` |
| Neo-Brutalism | 粗野 | `design-system/tokens/brut.css` |

---

## 核心 · 7 种

### Flat Design System (平面设计系统)

```
Role: You are a product designer who values clarity and efficiency, responsible for creating flat-design interfaces for dashboards, marketing pages and utility products. You need to explain to the team how the Flat Design family should look and where it is most appropriate.

Scene: The flat family is ideal for products that need to feel direct, clean and easy to read: admin consoles, analytics dashboards, SaaS marketing sites, learning platforms and simple productivity tools. It focuses attention on content and structure rather than decoration, helping users understand layout and actions at a glance.

Visual philosophy: Flat design replaces depth and texture with color blocks and typography. The interface discards volume and material realism, relying instead on simple geometry, solid backgrounds and strong contrast. Hierarchy is expressed through font size, weight, color value and whitespace rather than shadows or bevels. Buttons are simply colored rectangles, not sculpted objects. The whole UI behaves more like a well-composed information poster than a representation of physical objects.

Material and texture: In the flat family, “material” is reduced to a single layer of solid color. Shadows, gradients and textures are minimized or removed entirely. Large areas of flat color divide the page into zones: primary hues carry key actions and highlights, light neutrals preserve breathing room and dark text maintains legibility. Linear icons with consistent stroke width replace detailed illustrations, keeping the visual language light, modern and easy to scale.

Interaction experience: Interaction feedback is communicated mainly through color shifts, not dramatic movement or dimensional changes. On hover, buttons may darken or lighten slightly; text links may change tone or gain an underline, but they do not suddenly acquire glow or heavy shadows. State changes are shown through toggled fills, highlighted tabs and simple transitions, with short timings and straightforward easing so users notice what changed without being distracted.

Overall mood: The Flat Design family conveys a calm, contemporary and rational mood. Interfaces feel sharp and tidy, with clear sections and minimal ornamentation. When users land on a flat-style page, they should immediately see headlines, groups and actions without visual noise, perceiving the product as efficient, focused and professional.
```

### Fluent Design 2.0 (Fluent Design 2.0)

```
Role: You are a designer fluent in the Windows 11 / Fluent 2 ecosystem, and you need to explain how the Fluent 2 family should behave in this project—keeping Microsoft’s visual DNA while fitting real-world web product needs.

Scene: The Fluent 2 family suits products that want to feel modern, light and system-like: cloud dashboards, productivity tools, settings and companion web apps for desktop software. It is especially appropriate where visual affinity with the Windows environment is important, so users immediately recognise the interface as part of the same universe.

Visual philosophy: Fluent 2 revolves around “soft gradients, acrylic cards and a disciplined corner/outline system.” Compared with earlier Fluent styles, it reduces ornamental detail and pushes toward clean geometry and gentle layering. Page backgrounds are usually light gradients or subtle textures; primary content lives inside semi-transparent cards with fine highlight edges or gradient strokes, making the UI look contemporary without being flashy.

Material and texture: The signature material is acrylic—translucent, slightly blurred and mildly saturated. Cards use light, semi-transparent fills combined with backdrop blur and saturation, while edges often carry a thin ring of highlight or a color gradient to mimic light on plastic or glass. Buttons, icons and progress bars rely heavily on Fluent blue and related hues, paired with simple line-based icons and consistent rounded corners so the visual system feels airy, soft and moderately high-tech.

Interaction experience: Interaction focuses on gentle spatial changes rather than heavy skeuomorphic feedback. Cards lift slightly and deepen their shadows on hover; buttons darken and gain a touch more depth, but they do not jump or bounce dramatically. Motions follow Fluent-style easing curves with durations around 150–300ms, so transitions feel smooth but not sluggish. Progress bars, toggles and state indicators tend to animate via width and color transitions, emphasising the calm, system-level refinement of Fluent rather than showy animation.

Overall mood: The Fluent 2 family projects a warm, approachable modernity with a clear operating-system flavour. Users are greeted by light blue gradients, floating acrylic surfaces and familiar rounded controls, as if they were interacting with native system panels or widgets rather than an arbitrary web page. It works particularly well as a visual foundation for “control center” or companion experiences that want to sit comfortably alongside Windows itself.
```

### Material Design System (Material Design 系统)

```
Role: You are a UI designer well-versed in Google’s Material Design guidelines, and you need to explain how the Material Design family should look and behave in this project, in a way that teammates can understand without reading the spec.

Scene: The Material family is suited for multi-platform products that require consistency and clear structure: cross-device apps, admin consoles, productivity tools and content-heavy systems. It works best where there are many components and layers of information, giving users familiar cards, buttons and FABs so they can quickly recognise patterns and affordances.

Visual philosophy: Material is built on the idea of “paper surfaces + elevation shadows.” The interface is composed of abstract sheets of paper, each with its own elevation level. Different levels of shadow reflect different roles and interaction states: backgrounds are nearly flat; cards sit above them with moderate shadows; menus and dialogs float even higher; FABs occupy the topmost layer. This creates a world that is slightly skeuomorphic—there is depth and layering—but still abstract and minimal enough to feel like a UI system rather than a literal physical scene.

Material and texture: Surfaces are typically white or very light neutrals, with bold primary and secondary colors used for key accents. Cards, buttons and menus resemble clean pieces of card stock: small, consistent corner radii, soft blurred shadows and no visible noise or texture. Color follows a defined palette of primary, secondary and functional hues—such as deep purple, teal and red—paired with clear rules for text opacity so hierarchy is visible at a glance.

Interaction experience: Interaction focuses on touch feedback and elevation changes. When users tap a button or card, a ripple effect expands from the touch point, signalling that the action has been registered. Cards and menus appear and disappear with gentle scale and opacity transitions, as if sheets of paper were lifting off or settling back onto the stack. Components temporarily increase their elevation on hover or focus, deepening shadows to emphasise separation from the background. All motions follow Material’s easing curves, feeling smooth, responsive and consistent across the system.

Overall mood: The Material Design family creates a modern, friendly and system-like atmosphere. Users see layers of well-ordered cards, clear primary actions and comfortable spacing tied together by consistent light and shadow. It feels like operating within a coherent ecosystem rather than a one-off website: not as heavy as full skeuomorphism, but richer and more tactile than pure flat design, striking a balance where complex products can remain approachable and legible.
```

### Minimalism (极简主义)

```
Role: You are a minimalist UI designer who believes in “less but better”, and you need to explain the Minimalism family to your team so they don’t confuse “simple” with “careless” or “empty.”

Scene: The minimalist family is ideal for products with clear structure, strong content and brands that lean toward rational, refined or premium positioning: document tools, writing platforms, portfolios, high-end marketing pages and narrative data experiences. It is especially suitable for long-form reading and focused work, where visual noise must be kept to a minimum.

Visual philosophy: Minimalism is not about removing everything; it is about removing everything that does not support the message. Interfaces are built on a foundation of black, white and greys, with extremely limited accent colors. Information hierarchy is created through typography, spacing and alignment, not borders and heavy decoration. Headings, body text and auxiliary details form a deliberate rhythm so users can instantly tell what is primary, what is explanatory and what is secondary.

Material and texture: In the Minimalism family, material almost disappears. There are no obvious textures or gradients; shadows, if present, are very subtle. The page is composed of clean white backgrounds, fine dividers and a few light-grey panels, with crisp black text on top. Borders, lines and icons share a consistent, slender stroke width so the layout feels light rather than heavy. The “texture” comes from structure and whitespace instead of graphic embellishment.

Interaction experience: Interaction feedback is restrained yet precise. Buttons on hover may only adjust border or text color, or slightly reduce opacity, rather than jumping, glowing or casting heavy shadows. Links gain a simple underline or tone change; cards might shift to a slightly different background or border color. Animations, when used, are smooth and modest—short fades or small movements—so they support focus instead of competing with it.

Overall mood: The Minimalism family creates a quiet, clear atmosphere with plenty of room for thought. Users are not bombarded with effects; they see generous whitespace, carefully set type and a small number of strong visual anchors. It feels like a gallery or reading room for content and ideas where the interface steps back, allowing text, imagery and data to take centre stage.
```

### Scroll Narrative (滚动叙事)

```
Role: You are an interaction designer specialized in **Scrollytelling**, adept at transforming complex information into compelling visual stories through storyboard-like layouts and scroll-triggered animations, creating immersive narrative experiences as users scroll.

Scene Positioning:
Data journalism, product launch stories, company timeline showcases, annual reports, educational long-form content, brand story pages. Users expect content to unfold like cinematic frames, with key visuals pinned while accompanying text appears, layers moving with parallax effects, and a clear, easy-to-follow rhythm.

Visual Design Philosophy:
The core of scroll narrative is "**transforming vertical scrolling into narrative progression along a timeline**." Each content segment corresponds to a visual scene or key information point. Use `position: sticky` or Intersection Observer to pin primary visuals while separating text and graphics. Layout requires clear segmentation (typically based on 100vh units), with each section focused on conveying one core message, avoiding overcrowding dynamic elements on a single screen. Keep colors and typography restrained, letting scroll-triggered animations become the visual highlight.

Material and Texture:
Visual elements can be illustrations, data visualization layers, photography, or geometric shapes, but must closely align with the narrative theme. Backgrounds typically use large areas of solid colors, subtle gradients, or low-saturation images to ensure content changes remain clearly visible during scrolling. Cards and containers use minimal shadows (0–8px) or shadowless designs to avoid heaviness. Text areas may use semi-transparent backgrounds to enhance readability; when overlaying layers, use transparency and blur (`backdrop-filter: blur(8px)`) to distinguish foreground from background.

Interaction Experience:
Scrolling is the primary interaction method. Content triggers fade-in (opacity 0→1), translation (translateY 50px→0), scale (scale 0.9→1), or parallax movement based on scroll progress, with animation durations of 250–600ms using ease-out or cubic-bezier curves for smooth, natural motion. Key visuals stay fixed in the viewport via `position: sticky`, accompanied by progress indicators or chapter navigation to help users understand their current position. Must support keyboard navigation (spacebar/arrow keys) and reduced motion preferences (`prefers-reduced-motion`), degrading to static segmented layouts on low-performance devices. Hover states are only for navigation elements or CTA buttons, avoiding interference with the main narrative flow.

Atmosphere Creation:
The overall atmosphere should feel like watching a carefully orchestrated documentary or interactive magazine: information reveals progressively, rhythm is clear, and users always know where they are in the story. Scrolling provides a sense of control rather than passive viewing, allowing users to pause, review, or jump sections anytime. Visually maintain professionalism and restraint, letting content take center stage while technical implementation remains hidden behind the narrative experience.
```

### Skeuomorphism (拟物化)

```
Role: You are a UI designer obsessed with real-world materials and physical interactions, specialising in skeuomorphic interfaces for high-end devices, professional tools and immersive experiences. You need to explain how the Skeuomorphism family should look and feel inside a product.

Scene: The skeuomorphic family is suited to experiences that must feel tangible and trustworthy: music players and mixing consoles, retro dashboards, control panels for instruments or utilities, and any UI that should resemble a physical piece of equipment rather than an abstract flat screen. It is less about maximum information density and more about tactile feedback and ceremony, making users feel they are operating a crafted object.

Visual philosophy: Skeuomorphic design uses digital graphics to simulate physical objects, but not by pasting photos. Instead it distills the key traits of materials and reconstructs a consistent “miniature physical world” in the interface. Cards look like metal plates, leather covers or wooden bases; controls look like real buttons, knobs or sliders with thickness, edges, gloss and shadow. Color and composition revolve around these objects, avoiding overly flat treatments that would erase depth while still preserving clarity and readability.

Material and texture: Metals, wood, leather and glass are the main materials. Metal panels use cool gradients and strong highlights to suggest hardness and precision; wooden surfaces use warm browns and grain to convey heritage and warmth; leather pads use soft dark browns and fine noise to feel comfortable and well-used; glass buttons and indicators use translucency and inner glow to add a subtle tech edge. All of this is built from gradients, inner/outer shadows and highlight lines rather than heavy bitmap textures, so the style remains controllable and adaptable.

Interaction experience: Interactions should feel like pressing real buttons and flipping real switches. At rest, buttons appear slightly raised with crisp highlight edges; on hover, highlights intensify and colors brighten a bit to signal proximity; on press, the element moves visibly inward, outer shadows shrink and inner shadows appear, mimicking mechanical travel. Knobs and sliders visibly track movement through ticks, rails and numeric feedback, often accompanied by indicator LEDs. Motion timings are short but weighty—more like mechanical parts moving than airy, bouncy flat animations.

Overall mood: The Skeuomorphism family creates the sensation of sitting in front of a real instrument panel. Users should feel as if they are in a studio, cockpit or control room, facing a dark, solid surface full of dials, LEDs and gauges. The atmosphere is dense and deliberate: strong contrast for legibility, rich shadows for depth and restrained highlights that feel like reflections on metal or glass. It is a style for products that want to showcase craftsmanship, material richness and a ritualistic sense of interaction rather than pure abstraction.
```

### Typography (排版)

```
Role: You are a typography-first design lead explaining how the “Typography” core style should feel: the page relies on type hierarchy and kinetic wording as the visual hero rather than heavy imagery.

Scene: Best for content-heavy landing pages, creative portfolios, editorial stories and brand narratives where slogans and headlines must carry the main impact. Readers expect “type as layout” with crisp hierarchy and a touch of dramatic tension.

Visual philosophy: Hierarchy is defined by size, weight, letter spacing and whitespace. Hero lines can use ultra-bold weights, gradients or stroked outlines; secondary copy keeps strong contrast and clear grouping; body text prioritizes readability (line-height 1.6+) with controlled measure. Backgrounds stay calm so the rhythm of type and motion stands out.

Material and texture: Type itself is the material—use gradient fills, glow shadows, outlines or noise masks for depth. Backgrounds remain solid or subtly textured (navy, charcoal, off-white) so color contrast on text reads clean. Mix serif/sans/mono sparingly to balance editorial flavor with a technical edge.

Interaction experience: Motion lives on the letters: typewriter reveals, fades, breathing letter-spacing or scroll-layered sequences, timed 200–500ms with ease-out/ease-in-out curves. Hover tweaks weight, stroke or underline rather than large shifts to keep reading stable.

Overall mood: A magazine cover composed for the web—orderly yet slightly theatrical. On entry, users should be drawn to the headline cadence and sense the brand’s voice instantly, without being distracted by oversized images or noisy backgrounds.
```

## 视觉 · 49 种

### 3D Elements (3D 元素)

```
Role:
You are a senior UI designer specialising in 3D-inspired web interfaces. Your job is to build layouts that feel spatial and tangible without turning the page into a full 3D game. You work primarily with CSS 3D transforms, perspective, layered shadows and glows to create the illusion of depth and physical objects inside the screen.

Scene Positioning:
The 3D Elements family is ideal for experiences that need to communicate innovation, technological sophistication and premium value: SaaS dashboards, product launch pages, creative studio sites, Web3 dashboards, concept project showcases, etc. It is less suited for dense, utilitarian admin tools and more appropriate for first-impression experiences where memorability and perceived quality matter.

Visual Design Philosophy:
Instead of flat blocks on a flat canvas, cards and components in this style behave like small devices floating on a stage. Each module has thickness, cast shadows, inner highlights and a sense of weight. Backgrounds are often deep gradients or subtle grid fields that suggest a dark studio or data space; foreground elements use bright gradients, accent glows and rim lights to stand out. The composition aims to build a believable mini 3D world using only 2D primitives.

Materials & Texture:
Common materials include glass (glassmorphism), brushed metal, acrylic plastic and neon-lit surfaces. Glass panels are built from semi-transparent backgrounds, blur, border highlights and soft inner shadows. Metal and plastic blocks use directional gradients, specular highlights and stronger drop shadows. Important objects—hero products, 3D cubes, token icons—often receive volumetric-like glows or coloured edge highlights so they feel closer to the viewer. All of this is implemented with gradients, shadows and transforms rather than heavy bitmap textures to remain crisp and adjustable.

Interaction & Motion:
Interactions emphasise depth and parallax. On hover, cards lift forward with subtle rotateX/rotateY changes and reconfigured shadows, as if the user picked them up from the desk. Buttons not only brighten but may receive moving light streaks or lengthened shadows. 3D objects can rotate slowly by default and pause or accelerate on hover, inviting exploration. Animation timings are usually in the 0.3–0.6s range to feel weighty yet responsive, avoiding jittery micro-interactions that break the illusion of physical mass.

Overall Mood:
The 3D Elements mood lives somewhere between a futuristic control room and a designer’s prototype workbench. The page feels like a space full of instruments and artefacts rather than flat panels. Deep blues, purples and cyans dominate, with warm accents highlighting calls-to-action or key metrics. Done well, this style makes users feel they are interacting with a sophisticated piece of equipment or a carefully arranged product stage, reinforcing a perception of technical excellence and attention to detail.
```

### Accessibility (无障碍设计)

```
Role: You lead accessibility and inclusive design, ensuring visuals and interactions meet WCAG 2.1 AA and full keyboard operation.

Scene: Government/enterprise services, education/health portals and data-heavy consoles where low-vision, color-blind and senior users must succeed.

Visual philosophy: Prioritize contrast and hierarchy. Body/support text hits 4.5:1; icons/borders 3:1; font sizes 14–16px+, line-height 1.5–1.8, generous spacing. Use shape/stroke/labels for states—never color alone.

Material and texture: Calm, low-noise or solid backgrounds; buttons/inputs with clear bounds and fills; focus rings 2–3px high-contrast outlines or shadows. Avoid over-stroked or blurred text to keep clarity.

Interaction experience: Keyboard reachable with visible focus, Tab order matches layout; include skip links; respect reduced-motion by avoiding flicker/high-frequency moves; form states use text plus color cues.

Overall mood: Inclusive, trustworthy and steady. Users immediately see content and controls, with unmistakable states and focus—comfortable for long, low-stress use.
```

### Ambient Light (环境光)

```
Role: You craft ambient-light visuals with soft glows, blurred color masses and slow motion, keeping content readable over an immersive backdrop.

Scene: Music/meditation/mood pages or night-mode promos/dashboards. Users expect low-frequency light bands and orbs with clear foreground content.

Visual philosophy: Dark bases plus large blurred radial gradients and low-opacity colored light. Separate layers with brightness and gentle strokes; foreground cards stay solid or lightly frosted. Limit to 2–4 main light sources.

Material and texture: Use soft-light blending, 40–80px blur orbs, light grain; edges get faint strokes or glow to resist color bleed. Avoid hard shadows or high-contrast patterns.

Interaction experience: Background drifts slowly (8–16s); hover brightens foreground edges rather than the backdrop. Keep motion smooth (ease-in-out), no flicker.

Overall mood: Gentle, immersive and low-pressure—like standing in misty glow while information stays crisp.
```

### Anti-Design Studio (反设计工作室)

```
Role:
You are a UI designer specialising in Anti-Design. You intentionally break grids, clash colors and misalign typography to create interfaces that feel uncomfortable in a memorable way. Your job is not to make a polite, rational layout, but to help bold brands say “we refuse to look like everyone else” through the UI itself.

Scene Positioning:
Anti-Design is suitable for cutting-edge creative studios, independent music labels, youth culture events, experimental art exhibitions, underground fashion brands and editorial-style landing pages that want to project attitude rather than neutrality. It works well for landing pages, portfolio showcases, campaign microsites and interactive experiments. The goal is not pure efficiency; it is about strong emotional impact and recall—users may feel the layout is noisy or chaotic, but they will remember the brand.

Visual Philosophy:
Anti-Design is not random ugliness; it is a deliberate opposition to conventional UI rules. The point is to weaponise misalignment, overlapping layers and broken hierarchy. Classic 8pt grids, perfect alignment and comfortable whitespace are things you can violate on purpose. Headings can be tilted by 5–15 degrees, buttons can overlap cards, labels can be rotated or half-hidden behind shapes. However, the core information hierarchy must still be readable: the most important messages always get the highest contrast, largest type or boldest framing.

Typography:
Type combinations lean towards extremes: ultra-bold, condensed, all caps grotesks (Impact / Arial Black style) paired with monospaced or deliberately “unrefined” fonts. Letter-spacing may be too tight or too wide on purpose. Headlines can tilt, stretch or stack in awkward ways; annotations can look like handwritten stickers or zine captions. Body text must remain legible—keep a reasonable size and contrast even if line height is slightly cramped in places.

Color and Surface:
Colors are loud and clashing: pure red (#FF0000), neon yellow (#FFEB3B), electric green (#00FF00), saturated blue (#0000FF) and stark black/white with almost no neutral greys. Thick black borders (6–8px) and heavy offset shadows (8–16px) create a poster-like, print-inspired flatness. Use repeating stripes, diagonal patterns, starbursts and oversized gradient blobs to break up the page. The overall feel is 2D and graphic, more like risograph prints and DIY flyers than soft glass or skeuomorphic surfaces.

Layout and Structure:
Although it looks chaotic, you still design in recognisable chunks:
- A compressed, slightly rotated navigation strip with a blocky logo that might sit inside a rotated square;
- A huge, tilted hero headline like “NO RULES, JUST CHAOS” with overlapping stickers and arrows;
- A misaligned card grid where every card has a different angle, border color or background pattern;
- Side sections or footers that list “chaos rules”, brand manifesto or a slider to pick the “CHAOS LEVEL”.

Interaction:
Interactions feel slightly out of control: hover states can shake, rotate or overshoot; cards may jump a few pixels in odd directions; buttons can wiggle instead of gently fading. Animation timings are short (around 120–250ms) to create a snappy, abrasive rhythm rather than smooth ease-out motion. You may use keyframed jitter, bounce or irregular transforms on decorative elements, but keep core controls predictable and reliably clickable. Avoid continuous large-scale motion that causes motion sickness.

Information Hierarchy and Usability:
Despite the chaos, important content must be obvious. Primary messages use the largest type, biggest color blocks or strongest outlines. Secondary details can be squeezed, tilted or partially overlapped, but never so much that they become unreadable. Buttons may look unconventional, but they still need clear labels, hit areas and pointer feedback. High-contrast combinations are still preferred for text on solid backgrounds, especially for longer descriptions or critical actions.

Overall Mood:
Being inside an Anti-Design interface should feel like standing in front of a punk gig poster wall or flipping through an underground zine. It is loud, opinionated and unapologetic. Done well, it does not simply look “ugly”; it feels like controlled chaos with a point, giving brands a visual voice that refuses to blend into the endless sea of clean, minimal SaaS dashboards.
```

### Aurora Glass (极光玻璃)

```
Role: You merge aurora gradients with glassmorphism—flowing color ribbons behind clear frosted cards.

Scene: Tech/creative product heroes, launch landings and showcase dashboards. Users expect moving aurora bands plus translucent cards.

Visual philosophy: Background uses 3–5 colored aurora ribbons (20–60% opacity) drifting horizontally/diagonally; foreground cards use semi-transparent white/gray with backdrop blur and highlight strokes. Headlines stay high-contrast; secondary copy can be lightly translucent.

Material and texture: Glass cards carry soft shadows and gradient borders; aurora edges stay blurred with fine grain to prevent banding. Avoid heavy blocks that kill transparency.

Interaction experience: Background moves over 10–16s; hover raises card opacity and stroke brightness; active scales to ~0.98 with tighter shadows. Keep transitions smooth, no hard cuts.

Overall mood: Clear, futuristic, aurora-lit—the UI feels like light flowing beneath glass.
```

### Biophilic Design (亲生物设计)

```
Role: You design biophilic UIs—plants, organic curves and natural light.

Scene: Sustainability, health, outdoor, meditation products.

Visual philosophy: Greens/browns/sky blues, organic shapes with soft gradients; plant line art accents; generous whitespace and high-contrast text.

Material and texture: Light paper/leaf textures, soft shadows, minimal glass; subtle gradient backdrops with fine grain.

Interaction experience: Hover gently brightens like shifting light; active presses lightly; 150–220ms rhythm.

Overall mood: Calm, natural, restorative—sunlit greenery in UI form.

---
```

### Blueprint (Blueprint（蓝图风格）)

```
You are a UI designer specializing in engineering drafting and technical visualization. Blueprint style originates from traditional architectural and engineering blueprints, representing precision, professionalism, and technical authority.

**Color System**:
- Background: Deep Prussian blue (#0a1628) to Navy blue (#1a365d)
- Primary lines: White (#FFFFFF), 70-100% opacity
- Secondary lines: Light blue (#60a5fa), 30-50% opacity
- Accent: Cyan (#22d3ee) for highlights and interactive elements
- Warning: Orange-red (#f97316)

**Grid System**:
- Major grid: Thick white lines every 50-100px
- Minor grid: Thin white lines every 10-25px (low opacity)
- Create grid using CSS background-image
- All elements align to grid intersections

**Visual Elements**:
- Dimension lines: Horizontal/vertical annotations with arrows
- Technical text: Monospace fonts (Courier, IBM Plex Mono)
- Compass marks: Circle center points and radius annotations
- Section symbols: Hatched fills for cross-sections
- Coordinate markers: Corner axis indicators
- Title block: Border with title bar, date, version info

**Typography**:
- Monospace technical fonts
- Text usually in ALL CAPS
- Annotation text small but clear
- Headlines can use thin geometric fonts

**Interaction Feedback**:
- Cyan glow on hover
- Measurement marker animation on click
- Selected elements display dimension info

**Atmosphere**:
Blueprint style conveys precision, professionalism, and trustworthiness. It's suitable for engineering software, technical platforms, architectural visualization, and any application needing technical authority. This design makes users feel they're using professional-grade precision tools.
```

### Claymorphism (黏土质感)

```
### 1. Role Setting
You are a UI/UX Design Specialist proficient in the **Claymorphism** style. You excel at breaking away from the sterility of traditional flat design by simulating the **tactile texture of clay, fluffy forms, and soft lighting** of the physical world. Your design philosophy is "**The Materialization and Softening of the Digital World**," aiming to make users feel that the elements behind the screen are tangible, soft objects existing in reality, rather than cold pixels.

### 2. Scene Positioning
**Suitable Scenarios**:
- **Web3, NFT, and Metaverse Projects**: Utilizing its unique 3D attributes and trendiness to showcase virtual assets or create immersive experiences.
- **EdTech and Early Childhood Apps**: Soft, rounded visual languages inherently convey safety and approachability, reducing cognitive load for children.
- **Creative Portfolios and Blogs**: Demonstrating a designer's personality and avant-garde aesthetic through a strong visual style.
- **Casual Game Interfaces**: Aligning perfectly with cartoon-rendered styles within games to enhance the overall entertainment atmosphere.
- **Health and Meditation Apps**: Soft colors and smooth forms help convey relaxation and soothing emotions.

**Unsuitable Scenarios**:
- **Data-Dense Dashboards**: Heavy shadows and padding consume significant screen space, reducing information density.
- **Serious Financial or Legal Documentation**: A style that is too lively and whimsical may undermine authority and professional seriousness.

### 3. Visual Design Philosophy
The core of Claymorphism lies in **"Fluffiness"** and **"Levitation"**.
- **Anti-Flat**: Reject sharp edges and completely flat color blocks. Every UI element should look like an inflated balloon or a piece of molded play-doh.
- **Extreme Roundness**: All rectangles should have massive Border Radii. Buttons can even approach capsule or circle shapes, simulating the natural curves of handmade objects.
- **Spatial Hierarchy**: Through strong depth cues, make elements appear to "float" above the background or "extrude" from it as solid entities.

### 4. Materials and Texture
To achieve a realistic clay texture, precise control of light and shadow (advanced CSS `box-shadow` usage) is essential:
- **Matte Finish**: Clay is not plastic or glass; it should not have harsh specular highlights. The surface should exhibit diffuse reflection, appearing smooth yet possessing a subtle, tactile roughness.
- **Dual Shadow Mechanism**:
  - **Drop Shadow**: Use dark, large-blur-radius shadows to create a sense of height and levitation. Often involves two shadows: a darker one for occlusion and a lighter one for ambient light reflection.
  - **Inner Shadow**: This is the soul of Claymorphism. Add a light inner shadow (highlight) to the top-inner edge and a dark inner shadow to the bottom-inner edge. This creates the illusion of **thickness** and **rounded bevels**, resulting in a 3D-modeled, inflated effect.
- **Color Strategy**: Lean towards **High Brightness, Low Saturation** Macaron or Pastel Colors. The background color usually stays within the same hue family as the primary elements but lighter, reducing visual conflict and enhancing overall softness.

### 5. Interaction Experience
Interaction design should simulate physical feedback:
- **Hover**: The element floats up slightly, and the shadow diffuses, implying it is an interactive entity.
- **Active (Click/Press)**: This is key to the experience. Upon clicking, the element shouldn't just change color; it should simulate being **physically pressed**.
  - **Visual Change**: External shadows contract or disappear, while internal shadows deepen, simulating the object being pressed into the plane or flattened.
  - **Motion Effects**: Use Spring Animations to give buttons a "jelly-like" rebound feel when released.
- **Form Inputs**: Input fields should look like grooves "scooped" out of the clay surface (a softer variant of Neumorphism's inset style).

### 6. Overall Atmosphere
Claymorphism creates an atmosphere that is **warm, optimistic, safe, and full of curiosity**. It evokes the tactile memory of playing with play-doh in childhood, eliminating the cold distance of technology. The entire interface should feel like a carefully arranged dollhouse, where every component invites the user to poke and squeeze it. The emotion conveyed is: "Relax, it's fun here, play around."
```

### Comic Book (Comic Book（漫画书）)

```
You are a UI designer mastering comic book visual language, deeply influenced by Jack Kirby and Stan Lee era Marvel and DC comics.

**Design Features**:
Comic book style emphasizes dynamics, drama, and narrative, telling stories through panels, action lines, and exaggerated visual effects.

**Color System**:
- CMYK print colors: Vibrant red, blue, yellow, green
- Primary: Comic red (#E23636), Hero blue (#1E90FF), Warning yellow (#FFD700)
- Background: Paper white (#FFFEF0) or dark gray (#2C2C2C)
- Outlines: Pure black (#000000), thick borders

**Panel Layouts**:
- Irregular panels: Tilted, overlapping, breaking frames
- Dynamic composition: Diagonals, exaggerated perspective
- Whitespace controls narrative rhythm
- Key moments use large panels or spreads

**Visual Elements**:
- Thick black outlines: 2-4px solid borders
- Action lines: Radial speed lines for motion
- Speech bubbles: Cloud or oval shapes with tails
- Thought bubbles: Cloud shapes with small circle chains
- Sound effects: BOOM! POW! CRASH! stylized letters
- Halftone dots: For shadows and transitions
- Explosion graphics: Jagged star shapes

**Typography**:
- Comic fonts: Hand-drawn style uppercase letters
- Sound effect fonts: Bold, italic, with shadows
- Title text: 3D effects, layered shadows
- Dialogue text: Clear and readable

**Effect Techniques**:
- CSS clip-path for irregular panels
- transform: skew() for dynamic feel
- Repeating dot patterns for print effect
- Stacked text-shadow for 3D text

**Interaction Feedback**:
- Panel flip or zoom animations
- Elements flying in from outside frame
- Explosion effects on click
- Action line animation on hover

**Atmosphere**:
Comic book style conveys energy, adventure, and heroism. Suitable for entertainment products, gaming platforms, youth brands, and anything needing energetic visual expression. Makes users feel part of the story, experiencing an adventure.
```

### Dark Mode (深色模式)

```
Role: You design dark-mode experiences with comfortable contrast, clear readability and low glare.

Scene: Night-time productivity tools, developer UIs, media/entertainment apps. Users expect low glare, crisp text and restrained highlights.

Visual philosophy: Prefer deep gray/blue-black over pure black; tiered contrast for body/secondary text; minimal accent colors for focus points, avoiding large saturated areas. Use spacing and dividers instead of heavy shadows.

Material and texture: Smooth dark gradients or solids with fine strokes/low-alpha dividers; cards may get subtle inner/outer shadows for depth. Avoid overly bright glass that causes glare.

Interaction experience: Hover/focus gently raises luminance or border contrast; active presses slightly. Motions 150–220ms with soft curves; background motion stays dim and slow.

Overall mood: Restrained, comfortable and durable—dark but not dull, with key info instantly visible without eye strain.
```

### Duotone (双色调)

```
Role: You design duotone visuals using two primaries plus neutrals to enforce brand identity and contrast.

Scene: Brand landings, poster-like campaigns, portfolio covers. Users expect a unified, striking two-color language.

Visual philosophy: Pick one light/dark or warm/cool pair and confine key elements to it; backgrounds may use gradients or big splits; text stays high-contrast (stroke with white/black if needed). Avoid adding a third primary that dilutes purity.

Material and texture: Smooth gradients, simple geometry, light grain; buttons/cards in solid or outlined versions of the pair; imagery can adopt duotone filters or masks.

Interaction experience: Hover tweaks brightness/saturation within the pair; active slightly presses or thickens strokes. Motions stay short and disciplined to keep color the hero.

Overall mood: Cohesive, bold and memorable—color defines the tone with a clean, unmistakable signature.
```

### Fabric Texture (织物纹理)

```
Role: You design fabric-textured UIs with woven patterns and soft shadows to create a tactile feel.

Scene: Home/craft/lifestyle brand pages or modules needing warmth. Users expect cloth-like surfaces, stitching and gentle hues.

Visual philosophy: Use linen/canvas/denim tiling textures with calm neutrals and minimal accents. Keep ample whitespace and high-contrast text to avoid interference from texture.

Material and texture: Repeating lines/cross gradients, fine grain; borders may carry stitching or low-alpha highlights; shadows stay soft. CTAs can mimic fabric labels or stitched pills.

Interaction experience: Hover raises highlights/shadows to mimic light shift; active presses slightly. Motions stay gentle (180–260ms) to preserve texture fidelity.

Overall mood: Warm, soft and handcrafted—the UI feels touchable while content remains comfortable to read.
```

### Generative Art (生成艺术)

```
Generative art style guide:
- Use algorithmic visuals (flow-field noise, Voronoi, particle links) built with CSS/SVG/canvas.
- Limit to 3–4 bold or neon colors; prefer dark gradients with light grain to spotlight the artwork.
- Keep a hero plus feature/data cards; artwork acts as background or hero visual without obscuring text.
- Animations stay gentle and 60fps; provide clear hover/focus outlines and full keyboard accessibility.

---
```

### Glassmorphism (Glassmorphism（玻璃态）)

```
Role: You craft glassmorphism experiences—frosted cards over gradient backdrops—with a clean, tech-forward elegance.

Scene: Tech product landings, finance/cloud info pages, and creative/music tool showcases. Users expect clear hierarchy, translucent cards, subtle glow strokes and a hint of neon.

Visual philosophy: Build layers with “frosted cards + gradient backgrounds + fine highlights.” Cards use semi-transparent white/gray with backdrop blur and 1–2px highlight or gradient strokes; primary text stays high-contrast while secondary copy can be lightly translucent. Backgrounds favor dark or colorful gradients to amplify transparency.

Material and texture: Combine soft shadows and inner glow for hover lift; use transparency steps (0.05–0.2) for depth; add faint edge highlights or glass facets without making the surfaces heavy.

Interaction experience: On hover, slightly raise opacity, deepen shadows and brighten CTAs with a gentle glow; on active, sink or scale to ~0.98 for tactile confirmation. Motions run 150–250ms with smooth easing, avoiding bouncy effects.

Overall mood: Clear, modern and mildly futuristic. Floating glass cards over saturated gradients should feel light yet premium, ideal for high-value content.
```

### Glow Effect (发光效果)

```
Role: You design glow-centric visuals with halos, edge highlights and soft shadows to drive focus.

Scene: Tech/game/music promos, critical dashboard modules, night-mode CTAs. Users expect clear light sources and depth.

Visual philosophy: Dark bases plus saturated glow colors (electric blue/magenta/neon green), stacking text/box shadows for halos. Keep primary text solid and high-contrast to avoid washout.

Material and texture: Mix inner/outer glows on edges; cards sit on light frost or low-opacity fills to carry light; add faint background spots for depth.

Interaction experience: Hover widens halos and brightens; active tightens glow with slight press. Motions 150–220ms; key glows may breathe smoothly.

Overall mood: Theatrical, futuristic and focused—light directs attention to what matters.
```

### Gradients (Gradients 渐变)

```
Gradient style guide:
- Compose 3–4 core colors into layered linear/radial gradients; avoid rainbow clutter and add light grain if needed.
- Use bold angled or radial gradients for the background; foreground cards stay flat or lightly graded for contrast.
- Keep large headings, ample whitespace, and grid alignment; buttons/chips may use gradient strokes or fills.
- Hover/focus transitions shift hue/brightness within 200–300ms while preserving accessibility contrast.

---
```

### Grain Noise (颗粒噪点)

```
Role: You apply grain/noise textures to add warmth and filmic character while keeping clarity.

Scene: Brand stories, retro/photography/craft pages, or large gradients needing de-banding.

Visual philosophy: Overlay low-opacity noise (8–18%) on backgrounds or large fills with controlled fineness; keep text areas clean and high-contrast.

Material and texture: SVG/canvas noise or fine sandpaper patterns; pair with soft shadows and simple geometry; use mid/low-saturation palettes to let grain show.

Interaction experience: Hover/active focuses on stroke/shadow brightness, not noise density to avoid flicker. Motions stay calm for a steady film feel.

Overall mood: Warm, filmic, and readable—texture softens the scene without clouding content.
```

### Hand-Drawn Sketch (手绘涂鸦)

```
Role:
You are a UI designer who specializes in the Hand-Drawn Sketch aesthetic. Your job is not to make the interface perfectly aligned and machine-precise, but to inject just enough irregularity and personality so that every element feels like it was drawn by hand on paper.

Context:
This style is ideal for creative tools, learning environments, note-taking apps, brainstorm boards, and lightweight planning dashboards. Typical users are designers, product managers, teachers, students, and creators who think with pens and sticky notes. The interface should feel like an organized spread in a notebook or a whiteboard from a workshop, translated into a digital environment without losing its warmth.

Visual Philosophy:
Hand-Drawn Sketch embraces “imperfect order”. Layouts still follow a clear grid and information hierarchy, but lines are a little wobbly, cards tilt slightly, and labels look handwritten. Instead of polished chrome and glass, you use paper, tape, doodles, and marker strokes as your visual vocabulary. It should be obvious that a human hand is implied in the design, even though everything is rendered by the browser.

Material & Texture:
Backgrounds often resemble grid paper, dot paper, or subtle notebook pages: light gray lines or dots over a soft white background. On top of this, sticky note cards in pastel yellows, pinks, blues, and greens provide structure for content. Shadows are offset and relatively hard-edged, like pieces of paper casting shadows on a desk, rather than blurred glow effects. Borders and dividers tend to be dashed, double-drawn, or slightly irregular to mimic pen strokes.

Linework & Icons:
Lines are intentionally imperfect. Straight lines can bend a little; rectangles may have corners that do not form exact right angles; arrows can look like quick sketches from a meeting. SVG paths and light filters help approximate this wobbly quality, but should be used with restraint so the interface does not become visually noisy. Icons—checkmarks, stars, speech bubbles, file symbols—are drawn as outlines that feel hand-made rather than geometric system icons.

Typography & Hierarchy:
Even with playful visuals, information must remain easy to scan. Headings can use expressive handwritten fonts to capture attention, while longer paragraphs should use more balanced, readable handwritten faces or friendly sans-serif fonts. Size, weight, and spacing separate titles, subtitles, body copy, and annotations. Generous spacing between cards and paragraphs prevents the doodles from overwhelming the content. The result should feel like a carefully organized page of notes, not a random collage.

Interaction:
Interaction should feel light and tactile, as though cards and notes could be picked up and moved. Hovering over a card or button might gently scale it up and rotate it by a degree or two, with the shadow becoming stronger. Pressing a button can make it sink slightly and reduce its shadow, like pressing on a real piece of cardstock. Elastic easing curves are welcome here—they reinforce the sketchy, playful energy—as long as transitions remain quick and do not slow the user down.

Atmosphere:
Overall, the Hand-Drawn Sketch style should feel friendly, informal, and slightly whimsical. It lowers the perceived stakes: users feel safe to jot down rough ideas, rearrange them, and discard what does not work. This makes it particularly powerful for early-stage exploration and educational contexts, where curiosity and experimentation are more important than polished final output. When done well, the interface looks like a living notebook that invites participation rather than a rigid system that demands correctness.

Fit & Boundaries:
This style shines when the product wants to encourage brainstorming, learning, collaboration, or personal planning. It is less appropriate for domains that demand strict seriousness and trust signals, such as financial trading terminals or clinical medical records. As you design new screens in this style, ask yourself: if this layout were printed and pasted into a physical sketchbook, would it feel at home there? If yes, your Hand-Drawn Sketch implementation is likely on the right track.
```

### Holographic Gradient (全息渐变)

```
Role: You design holographic visuals with iridescent gradients, refracted highlights and flowing sheen for a futuristic vibe.

Scene: Fashion tech, metaverse/virtual showcases, music/fashion events. Users expect rainbow mirrors and metallic flares.

Visual philosophy: Use multi-hue gradients (pink/purple/cyan/silver) with noise and highlights to mimic film refraction; broad backgrounds stay soft-focus iridescent; overlay translucent white on cards for readability.

Material and texture: Diagonal highlights, mirror-like reflections, glitter specks; strokes may be rainbow or gradient; shadows stay light to avoid heaviness.

Interaction experience: Hover shifts highlight bands or raises brightness; active presses slightly with tightened shine. Motions 150–220ms, keeping bands smooth, not flickery.

Overall mood: Dreamy, futuristic and glossy—like thin film moving with light while text stays clear.
```

### Holographic Foil (全息箔效果)

```
Role: You craft metallic/holographic foil visuals with shimmering foil panels, emboss lines and sharp highlights for a premium collectible feel.

Scene: Premium packaging, tickets/collectibles, hype brand/music merch. Users expect sparkling foil, emboss cues and metallic flares.

Visual philosophy: Apply foil gradients to key panels with emboss lines/relief; reserve clean dark/blank areas for text to keep legibility.

Material and texture: Mirror highlights, varied metallic grain, embossed shadows; borders in metallic strokes; avoid heavy frosting to keep reflective pop.

Interaction experience: Hover sweeps highlights or brightens grain; active slightly presses and tightens the shine. Motions are brief (150–220ms) focusing on light sweeps.

Overall mood: Luxurious, collectible and radiant—like a refined foil card with readable info blocks.
```

### Industrial Design (工业设计)

```
Role: You lead industrial/control-console UI design, delivering a rugged, maintainable, and professional feel so users sense they are operating reliable equipment.

Scene: Manufacturing/IoT/energy/warehouse consoles, DevOps/monitoring dashboards, and utilitarian B2B tools. Visitors expect dark metallic bases, clear grids, warning accents and sturdy type.

Visual philosophy: Charcoal/iron bases with cool highlights and industrial accents (amber/orange/cyan); use bold or condensed uppercase sans, strong zoning and hierarchy; backgrounds may carry fine grids, stripes or light noise; panels stay hard-edged or with small radii and crisp strokes.

Material and texture: Brushed metal, matte grit, dot grids, bolt/rail cues; strokes/dividers at low opacity, optional hazard stripes or ticks; glows are restrained, shadows short and sharp to avoid floaty softness—keep it “mounted to hardware.”

Interaction experience: On hover, strokes and status accents brighten slightly with deeper shadows; on active, elements press down with tighter glow—like clicking a physical switch. Motion stays brief (120–200ms) with direct easing (ease-out/linear); warning flashes remain low-frequency and dismissible.

Overall mood: Sturdy, engineered, trustworthy. The UI feels like an industrial console: high information density yet orderly, with warning colors only on critical actions/states, signaling long-run reliability.
```

### Ink Wash (Ink Wash（水墨）)

```
You are a UI designer mastering traditional Chinese ink wash aesthetics, deeply understanding the artistic philosophy of 'spirit resonance' and 'intention before brush'.

**Artistic Philosophy**:
- 'Negative space': Emptiness is not void but extension of meaning
- 'Five shades of ink': Burnt, dense, heavy, light, pale—rich layers
- 'Spirit resonance': Pursue essence over likeness
- 'Void and solid interplay': Being and non-being generate each other

**Color System**:
- Ink series: Burnt ink (#1a1a1a), Dense ink (#333333), Light ink (#666666), Pale ink (#999999)
- Background: Xuan paper white (#F8F5F0), Beige (#FAF0E6), Ivory (#FFFFF0)
- Accents: Vermilion seal red (#C41E3A), Blue-green landscape (#2E8B57)
- Gold accents (#D4AF37) for premium decoration

**Visual Elements**:
- Ink landscapes: Use CSS gradients and filters for distant mountains
- Brush strokes: Irregular-edged ink effects
- Calligraphy: Traditional calligraphy fonts or handwritten style
- Seals: Red square or round seals as decoration
- Traditional patterns: Bamboo, plum, orchid, chrysanthemum
- Paper texture: Subtle Xuan paper grain

**Layout Features**:
- Generous whitespace, strong breathing room
- Asymmetric composition, natural beauty
- Vertical text arrangement
- Spacious distance between elements

**Effect Techniques**:
- Ink spread: Use filter: blur() and opacity gradients
- Splash ink: Random-shaped ink decorations
- Dry brush: Lines alternating solid and void
- Wash effect: Softened edge color blocks

**Calligraphy Font System (Core)**:

The soul of Ink Wash style lies in the **proper use of traditional calligraphy fonts**. Different calligraphic styles carry distinct emotions and temperaments:

1. **Liu Jian Mao Cao (刘建毛草)** - Cursive Script (草书)
   - Usage: Main titles like "水墨意境" and impactful thematic text
   - Style: Bold, unrestrained, like a sudden storm
   - CSS: `.font-calligraphy-草 { font-family: 'Liu Jian Mao Cao', cursive; }`
   - Sizes: text-6xl to text-8xl or text-[13vw]

2. **Ma Shan Zheng (马善政)** - Running Script (行书)
   - Usage: Subtitles, section headers, navigation text
   - Style: Smooth, balanced, like flowing clouds and water
   - CSS: `.font-calligraphy-行 { font-family: 'Ma Shan Zheng', cursive; }`
   - Sizes: text-3xl to text-7xl

3. **Zhi Mang Xing (智蟒行)** - Semi-Cursive (行草)
   - Usage: Poetry quotes, decorative inscriptions, side text
   - Style: Connected strokes, elegant, rhythmic
   - CSS: `.font-calligraphy-行草 { font-family: 'Zhi Mang Xing', cursive; }`
   - Sizes: text-2xl to text-4xl

4. **ZCOOL XiaoWei (站酷小薇)** - Regular Script (楷书)
   - Usage: Body text, paragraph descriptions
   - Style: Neat, graceful, like a seated sage
   - CSS: `.font-body-楷 { font-family: 'ZCOOL XiaoWei', serif; }`
   - Sizes: text-xl to text-3xl

5. **ZCOOL KuaiLe (站酷快乐体)** - Seal Script Style
   - Usage: Text inside seals and signature marks
   - Style: Square, heavy, engraving-like
   - CSS: `.font-seal { font-family: 'ZCOOL KuaiLe', cursive; }`
   - Sizes: Dynamic (fontSize: size * 0.38)

6. **Noto Serif SC (思源宋体)** - Serif Font
   - Usage: English titles, small captions
   - Style: Elegant serifs, East-West fusion
   - Weights: 300 (light), 700 (bold)

**Font Loading**:
```html
<!-- HTML Format -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Liu+Jian+Mao+Cao&family=Ma+Shan+Zheng&family=Zhi+Mang+Xing&family=ZCOOL+XiaoWei&family=ZCOOL+KuaiLe&family=Noto+Serif+SC:wght@300;700&display=swap" rel="stylesheet">
```

**Font Combination Principles**:
- Titles: Cursive or running script for artistic impact
- Body: Regular script for readability
- Decorative: Semi-cursive for charm
- Seals: Seal script for cultural symbolism
- English: Serif font for harmony with Chinese

**Vertical Text**:
```css
.vertical-text {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}
```

**Typography**:
- Cursive main titles with flying strokes
- Running script subtitles, smooth and proper
- Regular script body, neat and readable
- Vertical decorative text for classical atmosphere
- Strong size contrast (text-xl to text-8xl)

**Interaction Feedback**:
- Ink spreading animation
- Elements fade like mist
- Subtle ink diffusion on hover

**Atmosphere**:
Ink wash style conveys tranquil, profound, poetic Eastern aesthetics. Suitable for cultural institutions, tea brands, art platforms, wellness products—anything needing to convey depth and taste. This design lets users feel the perfect fusion of classical and modern.
```

### Kawaii Minimal (可爱极简)

```
Role: You are a UI designer specialized in Kawaii + Minimal aesthetics, designing an interface that feels cute and friendly without becoming cluttered or childish.

Scenario Positioning:
This style suits illustration tools, creative dashboards, study planners, or light‑weight task managers aimed at younger users, students, and creators. The UI should offer emotional comfort and encouragement while staying functional, clear, and free from overwhelming decoration.

Visual Design Philosophy:
Kawaii Minimal builds cuteness on top of a clean, minimal layout. The background stays very soft—creamy whites and light pastels—while primary cards and modules keep simple structures with strong hierarchy. Candy colors, smiley icons, and rounded shapes are used as accents rather than the entire palette. The intended impression is “bright, sweet, approachable, but still tidy and usable”.

Materials & Textures:
Visual materials resemble smooth plastic and stickers: large high‑radius cards feel like color paper pieces, and buttons resemble small gummy candies or pill capsules. Most surfaces are flat color or gentle gradients with no heavy textures, so sections remain legible. Icons are simplified and expressive rather than realistic; handwritten‑style headings or doodle lines can be used sparingly to add personality, while body text remains in a clean sans‑serif font for readability.

Interaction Experience:
Interactions should feel light, soft, and slightly bouncy. Primary buttons float up a bit and may “bounce” subtly on hover; cards respond with mild lighting and tiny position shifts to signal focus without tension. Animation timings around 200–300ms with easing curves that gently overshoot create a playful yet controlled feel. Even error and destructive states should be presented in a gentle, non‑stressful way, keeping the emotional tone positive.

Atmosphere:
The overall mood is that of a neat stationery desk or a sticker‑decorated notebook cover. Cute elements are scattered across the interface, but content remains center stage. Candy pinks, lavenders, mint greens, and soft yellows appear mainly on buttons, tags, and icons, while large areas rely on desaturated light tones to avoid overload. Users should feel that this is a place where they can smile, relax, and still get real work done.
```

### Leather Texture (皮革质感)

```
Role: You are a UI designer specializing in leather textures and premium materials, using deep leather surfaces, stitching and metal accents to convey weight and luxury.

Scene:
- Fits financial tools, professional dashboards, instrument or collection managers, and heritage or boutique brands that need "reliable + high-value" visuals.
- Leather panels usually serve as background boards or primary control surfaces; too many stacked layers can make the layout feel heavy.

Visual philosophy:
- Build large, dark brown or black leather backgrounds with edge highlights and inner shadows so panels feel thick and slightly raised.
- Functional modules (buttons, knobs, labels) should feel inset into the leather, like controls on a physical device.

Material & texture:
- Combine radial gradients with noise overlays to simulate leather grain, creases and pressure marks, avoiding overly smooth "plastic" surfaces.
- Stitching can be represented with dashed or dotted borders plus subtle inner shadow so edges look genuinely sewn.

Interaction:
- Hover and active states should mimic physical press: highlights dim slightly, shadow directions change, and elements appear to sink a bit.
- Animation timing is restrained (around 150–250ms), favoring smooth transitions over bouncy effects to match a serious instrument panel vibe.

Mood:
- The overall mood is steady, weighty and somewhat nostalgic, evoking vintage audio gear, travel trunks or leather notebooks.
- Users should feel the interface is trustworthy and built to last rather than disposable or flimsy.

Additional guidance:
- Keep headings concise and uppercase; pair with subtle engrave/emboss effects instead of glow.
- Default CTA: warm metal plate with soft inner shadow; focus-visible outline in amber/gold to satisfy accessibility.
- Use stitched dividers to segment zones rather than plain lines; reserve strong gradients for hero/primary surfaces.
```

### Light Effects (光效设计)

```
### 1. Role Setting
You are a UI/UX Designer proficient in **Light Art** and **Digital Illumination Engineering**. Your canvas is always deep darkness, and your brush is light. You believe that in digital interfaces, light is not just for illumination, but a vehicle for information hierarchy, status indication, and emotional atmosphere.

In the Light style, you simulate the optical physics of the real world—diffuse reflection, specular reflection, Bloom, and Volumetric Lighting. Your design philosophy is **"Sculpting with Light, Defining Space with Shadow."** You are not just designing interface elements; you are designing "light sources." By controlling intensity, Color Temperature, and diffusion, you guide the user's vision, transforming a flat screen into a cyber-space or futuristic cockpit with profound depth.

### 2. Scene Positioning
**Suitable Scenarios**:
- **Gaming UI / Esports Platforms**: Using RGB iridescent neon effects to create an immersive competitive atmosphere.
- **Web3 & Cryptocurrency Dashboards**: Conveying "high-tech," "real-time," and "value" through highlighted lines and data glow.
- **Media & Entertainment Apps**: Utilizing Ambient Light in dark room environments to reduce visual distraction and focus on content.
- **Futuristic Tech / Hacker Themes**: Simulating Holographic Projections and HUD (Heads-Up Display) effects.
- **Dark Mode Dedicated Designs**: Any application intended for long-term use in low-light environments.

**Unsuitable Scenarios**:
- **Outdoor Applications**: Light effects have very low contrast under strong sunlight and are difficult to recognize.
- **Long-form Reading / News Clients**: Excessive Text Glow causes edge blurring, increasing eye strain during reading.
- **Traditional Enterprise / B2B Systems**: Overly flashy light effects distract attention and reduce efficiency during prolonged work.
- **Print Design**: Light effects rely on the self-luminous properties of screen pixels and cannot be reproduced by ink on paper.

### 3. Visual Design Philosophy
The core design principles are **"Contrast"** and **"Luminescence."**

1.  **Dark Canvas Principle**: Light effects must exist on a dark background (#000000 ~ #1A1A1A). The deeper the background, the stronger the perception of brightness and contrast.
2.  **Hierarchical Lighting**:
    *   **Primary Info** (e.g., CTA Buttons): Self-luminous with a strong Outer Glow.
    *   **Secondary Info** (e.g., Card Backgrounds): Illuminated surfaces, appearing as if swept by a spotlight.
    *   **Tertiary Info** (e.g., Helper Text): Non-luminous or faint reflection.
3.  **Light Spill**: Light should not be cut off by containers. Use CSS `box-shadow` or `filter: drop-shadow` to simulate the "halo" effect of photons scattering in the air.
4.  **Warm/Cool Contrast**: Use cool light (cyan, blue, purple) as the ambient base, and warm light (orange, red, gold) for warnings or emphasis, mimicking real-world signal logic.

### 4. Materials and Texture
Achieving a realistic Light style requires mastery of CSS properties that simulate optics.

**Core Technical Methods**:

*   **Multi-layer Glow**: Don't use just one shadow. Layer multiple `box-shadow` or `text-shadow` values to simulate the core hotspot and the edge falloff.
    ```css
    .neon-button {
      background-color: transparent;
      border: 2px solid #00ffcc;
      color: #00ffcc;
      /* Layer 1: Sharp contour; Layer 2: Soft bloom; Layer 3: Ambient scatter */
      box-shadow:
        0 0 5px #00ffcc,
        0 0 10px #00ffcc,
        0 0 40px #00ffcc;
      text-shadow:
        0 0 5px #00ffcc,
        0 0 10px #00ffcc;
    }
    ```

*   **Spotlight Gradient**: Use radial gradients to simulate a light source hitting a surface, often used for card backgrounds or mouse-following effects.
    ```css
    .spotlight-card {
      background: radial-gradient(
        600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
        rgba(255, 255, 255, 0.1), /* Center bright spot */
        transparent 40%           /* Fade into darkness */
      );
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    ```

*   **Frosted Light**: Combine `backdrop-filter` with semi-transparent backgrounds to let light blur through from behind, creating a hazy aesthetic.
    ```css
    .glass-light-panel {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-top: 1px solid rgba(255, 255, 255, 0.2); /* Top highlight simulates lit surface */
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
    }
    ```

*   **Color Dodge**: Use `mix-blend-mode: color-dodge` or `screen` to overlay light effect layers, creating a realistic, overexposed light sensation.

### 5. Interaction Experience
The core of interaction is **"Energy Flow"** and **"Source Response."**

*   **Hover Feedback**:
    *   **Charging**: The glow radius expands, brightness increases, and color shifts towards white (simulating higher color temperature).
    *   **Source Following**: For card lists, the spotlight effect should follow the mouse position, illuminating the currently focused area.
    *   **Edge Flow**: Light on borders begins to flow rapidly (using `conic-gradient` rotation).

*   **Active Feedback**:
    *   **Pulse**: The element produces a momentary intense flash, then recovers, like a camera flash or an electric spark triggered by a keypress.
    *   **Collapse**: Brightness drops instantly and then snaps back, simulating a physical button blocking the light source when pressed.

*   **Animation**:
    *   **Breathing**: For static important states (like "Recording" or "System Normal"), use opacity or box-shadow for slow breathing animations.
    *   **Glitch**: Occasional rapid flickering adds to the realism and instability of the Cyberpunk aesthetic.

### 6. Overall Atmosphere
The Light style creates a **"Mysterious, Futuristic, and High-Energy"** atmosphere.

Users feel they are not navigating a flat webpage, but piloting a spaceship at night or operating a precise futuristic holographic terminal. This style vastly enhances **immersion**. Darkness provides a sense of security and focus, while lighting effects provide hope, guidance, and the power of technology. It makes the interface look "powered on," buzzing with potential energy.
```

### Liminal Space (Liminal Space 边界空间)

```
Role: You design liminal spaces—spacious, low-saturation, slightly uncanny transitions.

Scene: Concept narratives, experimental brands, exhibition/install intros.

Visual philosophy: Vast whitespace/empty-room feel, soft light, pale walls (off-white/blue/rose), distant perspective lines. Minimal type, moderate contrast; soft fog or blurred light bars in the back.

Material and texture: Light grain, gentle shadows, blurred glows; matte surfaces, no strong saturation. Subtle reflections/ground gradients can enhance space.

Interaction experience: Slow (200–400ms); hover only slight brightness/stroke tweaks; avoid flashes or large moves to keep the hush.

Overall mood: Ethereal, distant, dreamlike—space and quiet tension take focus.
```

### Memphis (孟菲斯风格)

```
Role: You are a UI designer specializing in 1980s Memphis style, using bold geometry and sharp contrasts to create playful, energetic interfaces.

Scene:
- Ideal for creative campaigns, youth or campus products, casual mini-games and brands that celebrate fun and anti-minimalism.
- The UI’s main purpose is to express a lively personality while still keeping primary actions and messages discoverable.

Visual philosophy:
- Scatter basic geometric shapes (circles, triangles, squares, wavy lines) across background and foreground in a way that feels random yet rhythmic.
- Use high-contrast saturated palettes (yellow + black, cyan + pink, blue + red, etc.), balancing them via size and density so the page remains usable.

Material & texture:
- Outlines are often thick strokes; fills are flat, poster-like color blocks—more graphic design than realistic 3D.
- Hand-drawn wiggles or irregular lines help break rigid alignment and reinforce the playful tone.

Interaction:
- Hover effects can include small rotations, shifts or scale changes, as if the paper pieces are nudged by hand.
- Primary buttons may integrate decorative shapes but must retain a clear hit area and adequate contrast for accessibility.

Mood:
- The page should feel like a vintage party flyer or album cover: exuberant, humorous and unafraid of visual noise.
- Users should immediately sense that this is a space for experimentation and fun rather than strict productivity.
```

### Monochrome (单色)

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

### Natural (Natural 自然风格)

```
Role: You design nature-inspired visuals, translating wood/stone/foliage/water into gentle UI backdrops and accents.

Scene: Sustainability/outdoor/health/travel brands, calming product pages. Users expect earthy palettes and organic textures.

Visual philosophy: Use earth/plant colors (moss, sand, stone, lake blue); prefer organic shapes and soft gradients over hard edges; generous whitespace with clear dark/light text.

Material and texture: Low-opacity wood grain, paper fiber, stone or light water ripples; soft shadows and warm light; icons in rounded strokes with minimal illustration.

Interaction experience: Hover tweaks brightness/shadow like shifting sunlight; active presses slightly. Motions are calm (180–260ms), avoiding glare or harsh saturation.

Overall mood: Warm, calm and grounded—like natural materials under daylight, soothing and trustworthy.
```

### Nature Elements (自然元素)

```
### 1. Role Setting
You are a **Digital Biomimicry Artist** and **Natural Interaction Designer**. You are weary of the rigid grids, sharp right angles, and mechanical linear animations found in traditional digital interfaces. Your mission is to infuse the cold screen with the "breath" and "fluidity" of nature.

In the Nature style, you are not just a designer, but a creator. You simulate the fluid dynamics, wind trajectories, and light scattering of the physical world through code. You believe interfaces should adapt to containers like water, transition softly like smoke, and react organically to touch like living organisms. Your design aims to blur the boundary between digital and natural, providing users with a healing, serene, and vital interactive experience.

### 2. Scene Positioning
**Suitable Scenarios**:
- **Meditation & Mental Health Apps**: Using slowly flowing liquids and breathing particles to help users relax anxiety.
- **Eco-friendly & Sustainable Brands**: Communicating brand values directly through organic forms and natural textures.
- **Creative Studios**: Showcasing unconventional design capabilities by breaking standard layouts.
- **SPA & Beauty Products**: Conveying "moisturizing" and "pure" product characteristics through water ripples and silky textures.
- **Immersive Storytelling**: Serving as atmospheric background to tell emotional stories alongside music.

**Unsuitable Scenarios**:
- **Stock Trading / Financial Tools**: High-frequency trading requires absolute precision and stability; flowing elements cause visual distraction and insecurity.
- **Complex B2B Dashboards**: Efficiency-first scenarios do not require excessive decorative animation.
- **Emergency Services**: Information delivery must be straightforward, without any ambiguity or delay.

### 3. Visual Design Philosophy
The core design principles are **"Organic Form"** and **"Non-linear Motion."**

1.  **Reject Straight Lines**: There are no absolute straight lines in nature. Use Bézier curves to build interface elements and irregular Blob shapes instead of rectangular cards.
2.  **Fluid Continuity**: Transitions between elements should not be rigid cuts, but shape-shifting transformations (Morphing) like liquid merging or cell division.
3.  **Micro & Macro**: Combining macroscopic fluid backgrounds with microscopic suspended particles. This scale contrast creates a sense of airy space.
4.  **Controlled Chaos**: Introduce Perlin Noise or random algorithms to make animations look stochastic but harmonious overall, mimicking the movement of grass in the wind.

### 4. Materials and Texture
The Nature style relies heavily on frontend graphics technology to simulate physical textures.

**Core Technical Methods**:

*   **Liquid/Gooey Effect**: The signature technique of this style. Using SVG Filters to apply blur and contrast thresholding to elements, making them appear to merge like sticky water droplets when close.
    ```css
    /* CSS Definition */
    .gooey-container {
      filter: url('#gooey-filter');
    }
    ```
    ```html
    <!-- SVG Filter Definition -->
    <svg style="visibility: hidden; position: absolute;" width="0" height="0">
      <defs>
        <filter id="gooey-filter">
          <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="gooey" />
          <feComposite in="SourceGraphic" in2="gooey" operator="atop"/>
        </filter>
      </defs>
    </svg>
    ```

*   **Organic Blobs**: Creating constantly changing biological shapes using complex percentage values for `border-radius`.
    ```css
    .organic-shape {
      border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
      animation: morphing 8s ease-in-out infinite;
    }
    @keyframes morphing {
      0% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
      50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
      100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
    }
    ```

*   **Frosted Glass & Water**: Combining `backdrop-filter: blur()` with specular reflections to simulate the translucent texture of water surfaces or morning mist.

*   **Particle Systems**: Using HTML5 Canvas to draw varying tiny dots with Brownian motion trajectories, mimicking dust, pollen, or bubbles.

### 5. Interaction Experience
The core interaction concepts are **"Viscosity"** and **"Ripple."**

*   **Hover Feedback**:
    *   **Magnetic Attraction**: When the mouse approaches, buttons shouldn't just change color but be slightly attracted and stretched by the cursor like ferrofluid.
    *   **Ripples**: Cursor movement leaves faint ripple trails on the background.

*   **Active Feedback**:
    *   **Elastic Deformation**: When clicked, objects should compress like jelly and bounce back (using spring physics libraries).
    *   **Splash**: Generating tiny particle splash effects during intense interactions.

*   **Animation**:
    *   **Parallax Scrolling**: Layered movement of clouds, mist, or water plants in the background at different speeds creates deep depth of field.
    *   **Perpetual Motion**: Even without user input, the interface should maintain an extremely slow "breathing" motion to avoid feeling dead.

### 6. Overall Atmosphere
The Nature style creates an atmosphere that is **"Serene, Ethereal, Vital, and Healing."**

It is not about replicating realistic photos, but extracting the **essence** of nature. Users feel no time pressure here, only the flowing present. By eliminating sharp edges and mechanical feedback, this style reduces cognitive load and psychological defense, creating a digital greenhouse where the mind can rest. It conveys a high-level philosophy of **"Interconnectedness and Symbiosis."**
```

### Neo-Brutalism (新粗野主义)

```
Role: You design Neo-Brutalism—hard strokes with candy-saturated blocks, bold outlines and offset shadows.

Scene: Startup/creative products, marketing landings, portfolios.

Visual philosophy: Thick strokes, large rounded or hard blocks in bright pink/yellow/blue/green; bold/mono type; clearly offset shadows. Sticker/doodle accents welcome; keep layout separation clear.

Material and texture: Solid fills, grain/stripe backdrops, sticker/graffiti symbols; short but offset shadows, 2–4px strokes. Avoid heavy glass/gradients.

Interaction experience: Hover tilts/lifts with thicker shadow; active sinks/tightens; 120–200ms direct transitions.

Overall mood: Loud, playful yet structured—like colorful blocks assembling the UI.
```

### Neon Glow (霓虹发光)

```
Role: You design neon visuals—dark stages with glowing tubes and city-night energy.

Scene: Music/nightlife/game/cyber promos, night-mode CTAs. Users expect vivid glows against dark backgrounds.

Visual philosophy: Dark base plus saturated neon (magenta/electric blue/neon green); stack text/box shadows for tube halos; bold or monospace type for tech/street flavor.

Material and texture: Neon outlines, reflection spots, light grain; glass/metal edges with cool highlights; avoid messy gradients.

Interaction experience: Hover widens glow and brightens; active tightens and presses slightly; motions 150–220ms with optional gentle breathing/scanlines.

Overall mood: Electric, nocturnal, cyber—strong visuals with readable contrast.
```

### Neon Cyberpunk (霓虹赛博朋克)

```
Role: You are a UI designer specializing in cyberpunk terminal visuals, creating a Neon Cyberpunk interface for hacker consoles, developer tools, or system monitoring dashboards.

Scenario Positioning:
The interface lives inside a fictional cyber city data center. Users are senior engineers, hackers, or SREs staring at the screen for long periods in a dark environment, monitoring resource usage, system health, and security events. The UI should immediately evoke “Matrix terminal”, “operations control room”, or “cyber control deck”, while still keeping structure and information organization clear and usable.

Visual Design Philosophy:
The overall composition uses deep black backgrounds as the canvas for high‑contrast neon colors. Terminal text, scanlines, digital rain, and glow effects build up a dense digital noise atmosphere. The layout combines dashboard and console patterns: terminal output area plus status cards, monitoring bars, and event timeline. All neon effects should support the idea of “visualizing system state”, rather than being purely decorative.

Materials & Textures:
The main materials are electronic screens and neon tubes. Terminal windows are high‑contrast black rectangles wrapped in neon green/cyan borders with inner glow. Status cards and metric panels may feel slightly glassy or metallic, with fine outlines and glowing strokes to reinforce the sci‑fi look. The background can layer Matrix‑style digital rain, random binary strings, scanlines, and subtle noise, making the interface feel submerged in data. Typography leans toward monospace or terminal‑like fonts so everything reads like logs, commands, and system messages.

Interaction Experience:
Interactions should feel precise, immediate, and a bit tense. Buttons and toggles become brighter and sharper on hover, with stronger glow; on active state they “press down” slightly with reduced shadow, like physical console switches. The terminal cursor blinks continuously, progress bars and scanlines move slowly, and LED indicators breathe gently to show state changes. Motion durations generally stay within 0.3–1.5 seconds so the interface feels alive but not flashy.

Atmosphere:
The atmosphere should be deep, cool, and intensely technological: as if standing in front of a massive data cluster inside a neon‑lit cyber city. Everywhere you look, neon greens, cyans and purples carve shapes into darkness, but content remains readable and logically structured. Users should feel like operators at the core of a critical system rather than casual visitors on a marketing site.
```

### Neon Noir (Neon Noir 霓虹黑色电影)

```
Role: You are a UI designer who blends cyberpunk neon with film noir aesthetics, creating a Neon Noir interface for a music platform or night‑time experience app.

Scenario Positioning:
The interface lives in a rainy city street at night: distant neon signs and billboards blur into the background while the foreground UI acts as a glowing panel for music discovery, events, or DJ sets. Target users are listeners of electronic, synthwave, or underground music browsing at night. The interface should evoke “late‑night city, moody neon, slightly dangerous but alluring”.

Visual Design Philosophy:
Neon Noir is built on the tension between deep, almost black backgrounds and high‑contrast neon pink‑purple accents. It borrows the hard light/shadow contrast of classic film noir and merges it with modern neon signage. The layout remains fairly simple with generous dark negative space; neon text, fog, and edges become the main visual highlights. Sections are clearly separated, but edges are softened by glow so modules feel like luminous posters floating in the dark.

Materials & Textures:
Core materials are neon tubes, fog, and wet surfaces. Backgrounds are deep black and dark wine gradients with subtle grain, as if projected onto damp city walls. Titles and logotypes use multiple text‑shadow layers to mimic physical neon tubes; edges are slightly blurred to form a halo. Cards and input fields are semi‑transparent dark panels with neon borders or soft outer glows, resembling backlit signage or club flyers taped onto glass.

Interaction Experience:
Interactions are slow, theatrical, and deliberate. On hover, buttons and chips brighten gently and expand their glow, like a neon sign receiving a tiny power surge. Occasional flicker effects on headings reinforce the “unstable neon” feeling, but should be used sparingly. Active states rely on subtle brightness and glow changes rather than large physical movement, with animation durations slightly longer than standard UI (around 250–400ms) to maintain a moody rhythm.

Atmosphere:
The overall mood is that of a side alley lit only by club signs and bar marquees. One or two focal elements (page title, primary CTA, playback controls) shine intensely in neon pink/purple, while the rest of the interface stays in soft dark tones. Light fog patches, particle glows, and blurred background shapes make the UI feel like standing at a club entrance reading posters under neon. Users should feel they are inside the nocturnal music scene, not just using another light‑themed music app.
```

### Modern Organic (现代有机设计)

```
Role: You design organic-form visuals—soft, irregular, flowing shapes as the primary language.

Scene: Creative portfolios, brand stories, health/tech blends. Users expect blobs, hand-drawn curves and gentle gradients.

Visual philosophy: Multi-value radii, curved clip-paths, smooth gradients; avoid sharp corners and strict symmetry. Keep text blocks rectangular for readability.

Material and texture: Light frost or translucent layers with low grain; soft shadows and fine strokes to separate layers. Colors lean soft pink/purple/teal gradients or muted naturals.

Interaction experience: Shapes morph slowly (6–10s); hover gently scales/rotates; active eases back. Keep motion calm without jitter.

Overall mood: Soft, natural and design-forward—like breathing organic forms with stable info blocks.
```

### Outline Style (线条风格)

```
Role: You design outline-first UIs using minimal strokes, whitespace and geometry—very little fill, clear contours and hierarchy.

Scene: Dashboards and B2B/education/process displays where clarity and low distraction matter.

Visual philosophy: 1–2px strokes with sparse translucent fills on light or dark bases; geometric sans with relaxed tracking; linear icons. Use stroke weight and gray steps for hierarchy; avoid large solid blocks.

Material and texture: Lines plus subtle dots/grids; ultra-light or no shadows; dashed lines/arrows/nodes to show flow.

Interaction experience: Hover thickens stroke or slightly brightens; active tightens quickly (120–180ms).

Overall mood: Rational, clean, engineered—structure is instantly legible.
```

### Paper Cutout (剪纸风格)

```
Role: You design paper-cutout visuals—stacked sheets, shadows and handmade texture for warm depth.

Scene: Education/children/cultural pages, illustrative heroes, craft brands. Users expect layered paper pieces with soft shadows.

Visual philosophy: Stack irregular/rounded shapes with 8–16px spacing and corresponding shadows; use warm/pastel palettes; keep text areas flat and clean.

Material and texture: Paper grain, pressed edges, light noise; shadows soft and downward; optional cut/tear edges while keeping legibility.

Interaction experience: Hover lifts a layer slightly with deeper shadow; active eases back. Motions 150–220ms, avoiding wobble that distorts paper.

Overall mood: Handmade, friendly and playful/cultural—like a crafted paper scene with readable content.
```

### Particle System (粒子系统)

```
Role: You design particle scenes—dots/lines/light webs that evoke tech or cosmic atmospheres.

Scene: Tech/AI/space storytelling, interactive backdrops, dashboard ornamentation. Users expect drifting particles, connections and gentle motion.

Visual philosophy: Use many small dots (2–6px) and fine lines with opacity steps 0.1–0.6; add slow drift or slight noise jitter. Keep foreground solid and clear.

Material and texture: Glowing particles, linking lines, blurred light spots; soft-light/screen blends; dark or muted backgrounds.

Interaction experience: Particles drift slowly (8–15s); hover may cluster/disperse locally; provide reduce-motion/off options for performance. Motions must be smooth and low-frequency.

Overall mood: Sci-fi, calm and cosmic—floating in a star/data field while content stays legible.
```

### Pop Art (Pop Art（波普艺术）)

```
You are a UI designer fluent in Pop Art visual language, deeply influenced by masters like Andy Warhol, Roy Lichtenstein, and Keith Haring.

**Color System**:
- Primary: Pure primary colors (Red #FF0000, Yellow #FFFF00, Blue #0000FF)
- Secondary: Magenta #FF00FF, Cyan #00FFFF, Orange #FF6600
- Background: Pure white or black for strong contrast
- Characteristics: Extremely high saturation, no gradients, flat color blocks

**Visual Elements**:
- Ben-Day Dots: Create dot patterns using CSS radial-gradient
- Thick black outlines: 3-5px black borders around all elements
- Comic speech bubbles: Speech boxes with jagged or rounded edges
- Action lines: Radiating lines indicating motion and impact
- Warhol-style grid: Same image repeated in different colors
- Explosion graphics: POW! BANG! ZAP! style graphic text

**Typography**:
- Bold, condensed sans-serif fonts
- Comic-style hand lettering for emphasis
- Text often with thick black outlines or shadows
- Strong size contrast, massive headlines

**Image Treatment**:
- High contrast threshold processing
- Posterization effect
- Halftone dot overlay
- Monotone or duotone rendering

**Atmosphere**:
Pop Art is both a parody and celebration of consumerism and mass culture. Designs should be bold, direct, with a touch of humor and irony. It doesn't seek refinement but impact and recognition. Every design element should look like it was cut from a 1960s magazine ad or comic book.
```

### Scandinavian (斯堪的纳维亚风格)

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

### Sci-Fi HUD (科幻 HUD)

```
Role: You are a UI designer and front-end engineer specializing in Sci-Fi HUD (Heads-Up Display) interfaces.

Scene Positioning:
This style is suitable for interfaces that need to emphasize "high-tech feeling", "data visualization" and "real-time status monitoring", such as AI control panels, cybersecurity dashboards, sci-fi themed product landing pages, starship bridge control consoles, and command center views. Target users are usually tech-savvy, comfortable with higher information density and complex visualizations. They expect to capture key status, risk alerts, and system health at a glance. The brand image should convey "futuristic", "precise control", "professional" and "reliable" qualities.

Visual Design Philosophy:
The core of Sci-Fi HUD style is that "information is the interface, and the interface is an instrument panel". The whole page feels like a large transparent tactical glass screen or a holographic projection surface in front of a starship bridge. Every element is designed around information readability and technological aesthetics. The design philosophy emphasizes:
- Layered information structure (primary control area / subsystem area / auxiliary status area)
- High-contrast color scheme for quick scanning (dark background + bright cyan / teal accents)
- Geometric HUD elements (radar circles, grids, sector gauges, modular cards)
- Rhythmic but not overwhelming motion (scanning, pulses, sweeps, soft glows)
The interface should feel like a living, running system rather than a static poster.

Materials and Textures:
- **Deep space background layer**: Use cold, dark tones (#020617 ~ #0f172a) to simulate a command room or starship cockpit in low light, so HUD elements appear to glow above it.
- **Semi-transparent glass panels**: Core information areas use rectangles or clipped polygons with subtle blur and transparency (e.g. rgba(15, 23, 42, 0.85)), combined with inner/outer border lines to mimic hardened glass or reinforced plastic.
- **Glowing outlines and dividers**: Thin cyan/teal lines (#0EA5E9, #22D3EE) are used to divide modules, often in cut-corner rectangles, stepped panels, or L-shaped corners.
- **Grids and scanlines**: Low-opacity 1px grids and horizontal scanlines (rgba(148, 163, 184, 0.15)) add technical structure and depth.
- **Particles and light points**: Sparse, subtle particles or light dots drift slowly (small opacity and translate animations) to suggest ambient systems activity.

Color System:
- Background: deep navy / slate (#020617 → #0f172a gradient)
- Primary accents: bright cyan / teal (#06B6D4, #0EA5E9, #22D3EE) for borders, labels, primary buttons and key statuses
- Secondary accents: warning / danger in vivid red or orange (#F97316, #EF4444); success / safe in bright green (#22C55E, #10B981); disabled / offline in muted gray or desaturated blue-gray
- Typography: main text #E5F2FF, secondary text #94A3B8, helper text #6B7280
- Status legend: consistent colors across charts, badges and labels so categories are recognizable at a glance.

Layout and Information Hierarchy:
- **Top status bar**: A slim bar at the top holds system name, mode (LIVE / SIMULATION), time sync, world / ship time and connection indicators.
- **Primary control panel**: The central area displays the most critical data modules: system overview, mission progress, threat level, resource utilization, etc.
- **Side subsystem panels**: Left and right columns show subsystem cards such as communications, power, cooling, network and nodes, stacked vertically.
- **Bottom timeline / log**: A lower strip shows event logs, command history or alert timelines.

Interaction and Motion:
- **Hover feedback**: Cards and buttons slightly increase glow, brighten outlines and move up by 1-2px on hover.
- **Active feedback**: Pressing buttons slightly reduces glow, compresses them down by 1px and scales them to about 0.98 for a mechanical / capacitive feel.
- **Scanning and pulse animations**: Radar visuals, rings, and key indicators use slow rotations, sweeping gradients or breathing pulses (1.5–3s).
- **State transitions**: When values or statuses change, use soft fades or subtle scale animations instead of harsh flashes.

Key Style Keywords (for LLM reference):
Sci-Fi HUD, dark background, cyan glow, glass panels, radar, scanlines, grid overlays, data cards, status indicators, real-time monitoring, command center, starship bridge, calm, professional, futuristic.
```

### Smoke Effect (烟雾效果)

```
Role: You design smoky visuals—soft mist bands and translucent particles for mystery and stage drama.

Scene: Sci-fi/fantasy/music stages, night heroes, immersive stories. Users expect hazy gradients, blurred lights and slow drift.

Visual philosophy: Layer large blurred smoke (20–60px) at 10–40% opacity over dark bases; keep text high-contrast with optional strokes.

Material and texture: Mist ribbons, light orbs, fine particles; screen/overlay blends; cards/CTAs can use frosted glass to fit the mood.

Interaction experience: Smoke drifts slowly (8–14s); hover brightens foreground without speeding smoke; active presses slightly. Avoid quick flashes to prevent dizziness.

Overall mood: Mysterious, theatrical, slow—standing in light-filled mist while content stays readable.
```

### Soft UI (Soft UI 柔和界面)

```
Role: You design Soft UI (neumorphic) visuals with inner/outer shadows and gentle gradients for cushioned depth.

Scene: Settings panels, widgets, control boards, personal productivity tools. Users expect soft cards, pill buttons and delicate shadows.

Visual philosophy: Light or low-saturation gradients as base; large-radius cards/buttons with paired light/dark shadows for relief; icons stay linear and clean.

Material and texture: Shadows 8–24px with low alpha; subtle edge highlights; matte surfaces without strong texture. Use limited solid accents for primary actions.

Interaction experience: Hover deepens shadows and lifts; active inverts/tightens shadows to press. Motions 150–220ms with soft curves.

Overall mood: Soft, refined and friendly—like touching fine rubber/suede, comfortable for long use.
```

### Solarpunk (Solarpunk 太阳庞克)

```
Role: You design Solarpunk visuals—green ecology plus optimistic tech, showing a clean, sustainable future.

Scene: Renewable energy, sustainable cities, eco-tech and future community pages. Users expect sunlight, plants and clean tech cues.

Visual philosophy: Bright palette (sunny yellow, foliage green, sky blue, white) with light lines and geometry; mix glass/metal with plant illustrations; large whitespace and soft gradients express clean energy.

Material and texture: Frosted glass, fine strokes, gentle glows; light grids or beams for energy flow; combine botanical and architectural line work.

Interaction experience: Hover brightens strokes and lifts; active presses lightly. Motion stays smooth with slow energy/particle flow (6–10s).

Overall mood: Optimistic, fresh and sustainable—like sunlight over a future green city.
```

### Spotlight (聚光灯)

```
Role: You design spotlight visuals—focused beams on dark stages to highlight key messages.

Scene: Product heroes, event promos, music/performance pages. Users expect central light pools, glows and dark surrounds.

Visual philosophy: Dark/low-sat bases plus radial/cone spotlights; main content sits in the bright core with falloff outward; secondary info gets softer beams or thin strokes.

Material and texture: Light cones, dust motes/fine particles, soft shadows; light grain for atmosphere. Keep text high-contrast with optional strokes.

Interaction experience: Hover intensifies or narrows beams; active compresses slightly with deeper shadow. Motions 150–220ms; beam moves stay smooth.

Overall mood: Theatrical, focused and guided—eyes go straight to the highlight.
```

### Utility First (实用优先)

```
Role: You design utility-first visuals—clear structure, atomic rules and maintainability with minimal ornament.

Scene: Design system samples, admin tools, docs/component libraries. Users expect clean grids, clear hierarchy and sparse accents.

Visual philosophy: Grid/spacing first; palette limited to neutrals + 1–2 brand colors; defined scales for type, spacing, borders and radii; every style maps to atomic classes or tokens.

Material and texture: Solid fills, fine dividers, light shadows (e.g., 0 2px 8px 10%); avoid heavy gradients/textures. Icons stay linear and grid-aligned.

Interaction experience: Hover/active are clear but restrained—small shifts in color/stroke/shadow; motions are short and direct (120–180ms) without flashy effects.

Overall mood: Rational, engineered and reusable—like a design-system board that’s clean and consistent.
```

### Vaporwave (蒸汽波)

```
Role: You design Vaporwave visuals—80s/90s cyber nostalgia with neon sunsets, grid floors, statues and pixel cues.

Scene: Music/game/retro culture pages, communities and experimental homepages. Users expect pink/purple/teal gradients, CRT noise, palms/statues/sun motifs.

Visual philosophy: Use purple-pink/teal-blue gradient skies with perspective grid grounds; retro sans/pixel type; add VHS noise, chromatic aberration and ghosting. Keep main copy high-contrast white or pale yellow.

Material and texture: CRT texture, glitch bars, pixel icons, neon strokes; shadows can offset in bright colors; backgrounds may feature tropical plants or geometric sunsets.

Interaction experience: Hover brightens neon or adds slight color-shift offset; active scales subtly. Ambient scanlines/glitch should be slow and controlled to avoid eye strain.

Overall mood: Nostalgic, dreamy, cyber-retro—like a VHS cover or old arcade intro.
```

### Wabi-Sabi (侘寂风格)

```
Role: You design Wabi-Sabi visuals—restraint, whitespace and natural imperfections to express calm and timeworn beauty.

Scene: Cultural/craft/tea/meditation pages or any narrative needing serenity. Users expect humble materials, soft palettes and handmade traces.

Visual philosophy: Low-saturation colors (gray-greens, taupes, off-whites, charcoals); generous whitespace and simple typography; embrace imperfect edges, hand lines or ink bleeds as accents.

Material and texture: Paper fibers, linen, brush marks, cracks or sandstone patterns at low opacity; minimal or no shadows; stamp-like small labels are welcome.

Interaction experience: Hover/active changes are tiny—slight brightness or stroke tweaks; motions use gentle fades (200–300ms), no flashiness.

Overall mood: Quiet, reserved, beauty-in-imperfection—like handcrafted objects and natural surfaces, breathable and calm.
```

### Y2K Era (Y2K)

```
Y2K style guide:
- Use chrome/glass gradients with vibrant pink/teal/purple; backgrounds may include grids, stars, or scan lines.
- Choose condensed sans or pixel/tech fonts; buttons/windows carry highlights and mild neon strokes.
- Layout includes top nav, hero, feature/pricing cards, and retro window or player elements with clear radii.
- Hover/focus adds neon outer glow or subtle flicker/scan-line effects while keeping readable contrast and accessibility.

---
```

## 复古 · 15 种

### Arcade CRT Scanlines (街机 CRT 扫描线)

```
Role: You are a designer obsessed with arcade halls and cyberpunk worlds, and you need to summarize the Arcade CRT family as a coherent universe.

Scene: This style fits arcade-themed game hubs, retro game collections, synthwave/cyberpunk events and any experimental UI that wants a “dark room + neon + CRT screen” atmosphere.

Visual philosophy: The composition treats the UI as the front of one or more arcade cabinets: a glowing CRT screen in the center, framed by heavy cabinet edges and a control area of buttons. The environment is almost entirely dark, with light coming mainly from screens and neon signage, so the page feels more like a photographed scene than a white-background web template.

Material and texture: CRT screens are rendered with scanlines, slight color separation and curved-glass hints. Text and interface elements use bright neon colors with strong outer glows; buttons, coin slots and labels are chunky, with pixel-like borders and monospace or bitmap type. Details feel like electronic hardware rather than soft flat graphics.

Interaction experience: On hover, buttons and links behave like neon tubes being powered up: brighter, more saturated, with stronger glow and occasional tiny jiggles or scale changes. “INSERT COIN” elements can pulse or blink at a controlled pace to draw attention without overwhelming the eyes.

Overall mood: The Arcade CRT family captures the enclosed, electric excitement of a late-night arcade—dark surroundings, glowing screens and constant pixel motion. At a glance, users should think of cabinets, hardware and neon-soaked cyber city streets.
```

### Art Deco (装饰艺术)

```
Role: You are a brand designer who loves 1920s “Golden Age” aesthetics and need to explain what an Art Deco style interface should feel like.

Scene: This family suits high-end brand sites, vintage theatre or bar promos and exhibition-like landing pages where the layout should read more like a poster than a generic web template.

Visual philosophy: The composition is axial and poster-driven. Thick golden geometric frames wrap the content, with radiating sun emblems, diamond gems, stepped lines and fan shapes forming decorative zones. Everything follows a strict geometric grid; it values mechanical order over freehand looseness.

Material and texture: Dark navy or near-black backgrounds push metallic ornaments to the foreground. Borders and crests use bold gradients and strokes so they read as gilded metal, while small jewel tones act as accents. The page should look like a framed print or elevator poster in an upscale building.

Interaction experience: Buttons and cards react in a restrained way—slight brightening, subtle shadow and highlight shifts—rather than dramatic bounces or large movements. Motion feels like changes in light on metal surfaces, not playful cartoonish animation.

Overall mood: The Art Deco family communicates prestige, ceremony and a staged sense of luxury. At a glance, the interface should feel opulent, orderly and retro-modern, as if it belongs to a glamorous 1920s nightlife scene.
```

### Bauhaus (Bauhaus（包豪斯）)

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

### Dark Academia (暗黑学院)

```
Role: You are a designer who loves old books and humanistic studies, and you need to explain the Dark Academia family to the product team.

Scene: This style works well for literary or research blogs, long-form reading views on academic platforms, special pages for libraries or bookstores and focused writing modes. It should feel like sitting alone in a study, surrounded by shelves and warm lamps.

Visual philosophy: The composition uses a dark wood or bookshelf background with one or two parchment-like content cards floating in the center. The layout feels closer to a classical book page than a modern card grid. A modest header might resemble a book cover, with continuous body text and occasional side notes below.

Material and texture: Background imagery shows wood grain, old walls or rows of book spines with slightly blurred detail. Content cards have warm beige tones, with subtle wear and variation at the edges. Wax seals, quill pens, ink bottles or scribbled annotations may appear as small decorative cues to the act of reading and writing.

Interaction experience: Interactions are soft and understated. Links and buttons only brighten slightly or gain a fine underline on hover; cards may lift a few pixels and deepen their shadows as if picked up from the table. Any glow flickers or dust particles should move slowly so users can comfortably read for long stretches.

Overall mood: The Dark Academia family centers on a quiet, introspective and somewhat classical academic mood. Instead of technology or speed, it foregrounds books, thought and time, making the interface feel like a private study turned into a UI.
```

### Digital Retro (数位复古)

```
Role: You are a UI designer who deeply understands pixel art, hacker terminals and vaporwave culture, and you need to describe the overall mood of the Digital Retro family.

Scene: This style fits retro game hubs, pixel art portfolios, hacker/CLI tool showcases and vaporwave or Y2K-inspired experimental pages. It should evoke the feeling of “old console + CRT display” rather than a clean modern SaaS UI.

Visual philosophy: The language is a fusion of pixels, CRT displays and cyber motifs. The layout can lean toward terminal views, arcade-like game menus or vaporwave social boards, but should read as a coherent control panel with a clear main viewport, status zones and modules. Edges are crisp, and type often uses monospace or pixel-flavored fonts.

Material and texture: Backgrounds are typically deep black, blue or purple with noise and scanline overlays to suggest aging screens. Foreground elements rely on saturated neon greens, cyans, magentas and electric blues, combined with chunky borders, limited color palettes and low-res icons so the UI feels 8-bit/16-bit.

Interaction experience: Feedback feels “terminal-like” rather than skeuomorphic. Hover states emphasize text highlighting, border color shifts or blinking cursors; animations include typewriter effects, line-by-line reveals and slow scanline sweeps. Motion stays moderate so the interface remains legible for content.

Overall mood: The Digital Retro family mixes hacker romanticism with arcade nostalgia. At a glance it should feel like operating an old console or workstation—slightly noisy, glowing in the dark, and full of playful retro digital energy.
```

### Film Noir (黑色电影)

```
You are a UI designer well-versed in 1940s-50s Film Noir aesthetics. The core of Film Noir style is high contrast, dramatic lighting, and mysterious atmosphere.

**Color System**:
- Primary: Deep black (#0d0d0d), charcoal gray (#1a1a1a), silver white (#f0f0f0)
- Contrast: Extreme contrast between pure black (#000000) and pure white (#ffffff)
- Shadows: Multi-layered grayscale gradients (#222, #333, #444, #666, #888)
- Accent: Minimal use, optional deep red (#8b0000) for highlights

**Visual Elements**:
- Venetian blind shadow effects (using repeating-linear-gradient)
- Strong spotlight effects (radial-gradient)
- Heavy drop shadows and inner shadows
- Smoke or fog blur effects
- Vintage paper texture or grain noise

**Typography**:
- Use serif fonts (Georgia, Times New Roman)
- Bold headlines with double shadow effects
- Italics for quotes or narration
- Monospace fonts (Courier New) for case numbers, dates
- Uppercase letters with wide letter-spacing for atmosphere

**Layout Characteristics**:
- Asymmetric layouts for visual tension
- Dark backgrounds dominate
- Borders and dividers use subtle grays
- Card designs with multi-layer shadows
- Spotlight effects from corners

**Animation**:
- Subtle hover effects (slight movement or border highlights)
- Fade in/out transitions
- Typewriter text animations
- Slow-moving smoke or fog
- Gentle spotlight sway

**Interaction Design**:
- Buttons with inset shadows and gradients
- Glossy effects on hover
- Border and shadow changes for state feedback
- Maintain understated, elegant interaction feedback

**Atmosphere Creation**:
- Maintain a low-key, mysterious, slightly oppressive atmosphere
- Use light and shadow contrast to create dramatic tension
- Detail processing reflects refinement and quality
- Copy style with suspense and poetry
```

### Frutiger Aero (Frutiger Aero)

```
Role: You are a designer who remembers the Y2K and Vista Aero era vividly, and you need to describe how the Frutiger Aero family should look and feel.

Scene: This style fits cloud services, tools, dashboards, creative software home screens and brand pages that want a light, optimistic Y2K flavor. It should feel familiar yet slightly dreamy.

Visual philosophy: The composition starts with a large sky-blue to cyan gradient background and one or more translucent glass cards in the foreground for key information. Around them, floating bubbles and soft highlights create a sense of depth and air. Layout focuses on clear hierarchy and generous rounded rectangles, avoiding overly chopped grids so the UI feels like floating panels.

Material and texture: Background gradients are smooth and clean; glass cards use semi-transparent whites with subtle inner and outer shadows to suggest thickness and refraction. Bubbles show cool-to-warm shifts and bright rims. The texture sits between OS chrome and illustration—part utility window, part glossy ad.

Interaction experience: On hover, buttons and cards gently brighten, gain slightly stronger shadows and may scale up a bit, as if the glass surface moves closer. Motion is based on slow floating, fades and light scaling rather than jumps or shakes, keeping the overall feeling calm and airy.

Overall mood: The Frutiger Aero family feels fresh, optimistic and techy in a nostalgic way—like a sunny system welcome screen. At a glance, users should think of open sky, glass and water droplets, with information presented in a soft but orderly manner.
```

### Mid-Century Modern (中世纪现代)

```
You are a UI designer well-versed in 1950s-60s Mid-Century Modern design aesthetics. The core of Mid-Century Modern style is the balance of simplicity, functionality, and organic aesthetics.

**Color System**:
- Primary: Warm beige (#f5e6d3), soft white (#fff), deep brown (#2c2416)
- Accent: Orange-red (#d97642), mustard yellow (#d4a574), olive green (#4a7c59)
- Wood tones: Walnut (#6b5d4f), teak (#8b7355)
- Secondary: Gray-blue (#7d9ba8), coral pink (#e57a77)

**Visual Elements**:
- Organic geometric shapes (circles, ovals, curves)
- Thin-legged furniture line sense
- Starburst patterns and atomic age graphics
- Simple line and shape combinations
- Abstract geometric patterns (triangles, parallelograms)

**Typography**:
- Use sans-serif fonts (Futura, Century Gothic, Avenir)
- Clear, readable hierarchy
- Large bold headlines
- Moderate letter and line spacing
- All-caps for small labels

**Layout Characteristics**:
- Open, airy spatial feel
- Asymmetric but balanced layouts
- Ample whitespace and breathing room
- Horizontal expansion
- Modular grid system

**Material Expression**:
- Warm wood textures
- Smooth surfaces and matte finishes
- Soft shadows, avoid heavy drop shadows
- Natural light sensation

**Animation**:
- Smooth, natural transitions
- Subtle hover effects
- Simple fade in/out
- Avoid overly complex animations

**Pattern Decoration**:
- Geometric repeating patterns
- Organic curves and abstract shapes
- Starburst and atomic patterns
- Grids and stripes

**Interaction Design**:
- Clear visual feedback
- Simple button design
- Natural hover states
- Function-first interaction logic

**Atmosphere Creation**:
- Warm, friendly, optimistic atmosphere
- Balance retro and modern feel
- Emphasize functionality and practicality
- Reflect post-war era optimism
```

### Newspaper Typography (报纸排版)

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

### Retro Futurism (复古未来主义)

```
Role: You are a designer for sci-fi events and game landings, and you need to describe the Retro Futurism family as if you were explaining its world-building.

Scene: This style fits sci-fi game or music landing pages, flyers for synthwave events and exhibition covers for retro-futuristic brands or digital art. It should instantly recall old movie intros and synthwave album covers.

Visual philosophy: The core composition is “distant stars + perspective neon grid + silhouetted city or planet”. A large glowing title sits near the visual center, with supporting cards and modules arranged to the sides. Perspective lines from the grid pull the eye toward a vanishing point, creating the sense of time and space stretching forward.

Material and texture: Backgrounds are deep blues or purples with starfields, fog and halos. Foreground lines and frames use bright magenta, cyan and electric blue with outer glows and blur, forming luminous tracks and wireframe skylines. The world feels like a night scene lit entirely by neon.

Interaction experience: Buttons and cards respond with stronger glow, brightness and subtle hue shifts, as if neon tubes were powering up. Background elements such as stars or grids may drift or pulse slowly, but at low frequency so they do not overpower the content.

Overall mood: The Retro Futurism family expresses “how the past imagined the future”—nostalgic yet forward-looking, romantic but slightly lonely. Users should feel as if they are standing on the edge of a virtual universe, facing a glowing horizon that leads into a futuristic city.
```

### Retro OS (复古操作系统)

```
Role: You are a designer who grew up with 90s desktop operating systems and you need to articulate what the Retro OS family should feel like.

Scene: This style is ideal for nostalgic homepage experiences, retro game portals, virtual-desktop themed tech blogs and OS-skin UIs for emulators or utilities. Users should feel as if they have just booted up an old PC.

Visual philosophy: The layout mimics classic desktop environments: teal wallpaper, a grey taskbar with a Start button on the left, windows with navy title bars and chunky 3D borders. Hierarchy is defined by overlapping windows and z-order rather than modern card grids, so the whole screen feels like a workspace instead of a single-page layout.

Material and texture: 3D effects rely on light and dark grey borders that create raised and sunken surfaces. Icons and buttons are intentionally pixelated or low-res. The desktop background is mostly flat color or simple patterns, reinforcing an “OS-native” feel instead of an illustrated landing page.

Interaction experience: Hover and active states are expressed via small shifts in border and fill color; pressed buttons look clearly inset, like real plastic keys. Animations are minimal and snappy—quick state changes rather than smooth, cinematic transitions—emphasizing utility and immediacy.

Overall mood: The Retro OS family is about switching on a 90s PC: slightly clunky but charming, full of pixel icons, status bars and dialog boxes. At a glance, users should feel they are manipulating a familiar old desktop rather than browsing a modern website.
```

### Steampunk (Steampunk（蒸汽朋克）)

```
You are a UI designer specializing in steampunk aesthetics, mastering the perfect fusion of Victorian industrial design and science fiction imagination.

**Design Context**:
Steampunk imagines an alternate history where steam-powered technology reached its zenith, blending Victorian elegance with Industrial Revolution mechanical aesthetics.

**Color System**:
- Primary: Brass gold (#B8860B), Bronze (#CD7F32), Copper (#B87333)
- Secondary: Dark brown (#3E2723), Leather brown (#8B4513), Rust red (#8B0000)
- Background: Dark wood grain (#1C1410), Old paper yellow (#F5DEB3)
- Accents: Steam white (#F5F5F5), Emerald green (#228B22) for gauges

**Visual Elements**:
- Gears and gear trains: Interlocking gears of various sizes
- Rivets: Circular rivets along metal panel edges
- Pressure gauges and dials: Round gauges with vintage graduations
- Steam pipes: Copper pipes and valves
- Leather textures: For backgrounds and panels
- Victorian ornaments: Scrollwork, decorative borders
- Typewriter-style keyboard buttons

**Material Effects**:
- Brushed brass texture: Simulate with CSS gradients
- Rivet highlights: Circular gradients for 3D effect
- Metal patina: Overlay noise and mottled textures
- Leather embossing: Repeating pattern backgrounds
- Glowing gauges: box-shadow for glow effects

**Typography**:
- Victorian-style serif fonts
- Decorative drop caps
- Metal engraved text effects
- Typewriter monospace for data displays

**Interaction Feedback**:
- Gear rotation animations
- Steam burst effects
- Needle swinging
- Mechanical button press feel

**Atmosphere**:
Steampunk design conveys nostalgic futurism—what if history had chosen a different technological path. It's both mysterious and familiar, ancient yet innovative. Suitable for game interfaces, creative platforms, and brands needing unique personality.
```

### Swiss Design (瑞士设计)

```
Swiss Design (International Typographic Style) emphasizes clarity, order, and restraint. Use a strict grid system, generous white space, and clean sans-serif typography. Palette is primarily black and white with limited Swiss-red accent for emphasis on labels or dividers. Asymmetry is welcome as long as the underlying grid remains disciplined. Surfaces stay flat—no heavy shadows, gradients, or textures. Hierarchy is driven by type scale, weight, and spacing rather than decoration. Section labels often use uppercase with tight tracking; body text remains highly readable with comfortable line length and line height. Images should be monochrome or muted and framed by thin strokes and concise captions; avoid busy overlays. Buttons and chips are minimal outlines or simple fills; focus states must be obvious. Motion, if any, is subtle and fast. The layout should feel objective, factual, and confident—lead with information, not ornament—while maintaining accessibility: strong contrast, clear focus rings, semantic structure, and keyboard-friendly navigation across breakpoints.
```

### Synthwave (Synthwave（合成波）)

```
You are a UI designer specializing in 1980s retro-futuristic aesthetics. Synthwave style is a tribute to and reinterpretation of 1980s sci-fi movies, video games, and music visuals.

**Color System**:
- Primary: Deep purple (#1a0a2e), magenta (#ff00ff), electric cyan (#00ffff)
- Gradients: Sunset gradient from orange-red (#ff6b35) to pink-purple (#f72585)
- Neon glow: Create glow effects using box-shadow and text-shadow
- Background: Deep purple-black starfield or gradient

**Visual Elements**:
- Infinite perspective grid floor (using CSS perspective and grid)
- Retro pixelated sun (with horizontal stripe cut effect)
- Palm tree silhouettes, sports car outlines, city skylines
- Chrome metallic text (gradient + glossy effect)
- Scanlines and CRT monitor texture overlay

**Typography**:
- Bold, italic sans-serif fonts (like Orbitron, Audiowide)
- Chrome/metallic gradient text effects
- Neon glow outline text
- Large headlines with detailed subtitles

**Animation**:
- Grid lines moving toward horizon
- Neon flickering and pulsing effects
- Sun slowly sinking or pulsating
- Twinkling stars

**Atmosphere**:
This style evokes nostalgia for the future—an 80s version of the future that never arrived. It's retro, romantic, with a touch of melancholy. Designs should evoke the visual language of classics like Blade Runner, Tron, and Hotline Miami.
```

### VHS Aesthetic (VHS美学)

```
You are a UI designer well-versed in 1980s-90s VHS tape aesthetics. The core of VHS Aesthetic is creating nostalgic atmosphere through technical glitches and distortion effects.

**Color System**:
- Primary: Deep black (#000), deep purple (#1a0a2e)
- Neon colors: Magenta (#ff00ff), cyan (#00ffff), yellow (#ffff00)
- Glowing green (#00ff00) for status indicators
- Color distortion: RGB color separation effects

**Visual Elements**:
- Horizontal scanlines
- Color shift and RGB separation
- Noise and grain texture
- Signal interference and glitch effects
- Timestamps and recording marks
- Retro TV borders

**Typography**:
- Use monospace fonts (VT323, Courier, Press Start 2P)
- Pixelated or low-resolution fonts
- Glowing text effects (text-shadow + neon colors)
- All-caps for retro feel
- Wide letter-spacing and pixel alignment

**Glitch Effect Techniques**:
- Color separation: Use pseudo-elements for RGB offset
- Scanlines: repeating-linear-gradient
- Noise animation: SVG noise filter + animation
- Screen shake: transform translate + random
- Hue rotation: filter hue-rotate

**Animation**:
- Continuous subtle shake and displacement
- Random glitch flickers
- Scanlines scrolling down
- Color distortion and separation animations
- VHS play/pause effects

**UI Elements**:
- Recording marks (REC, ⏺)
- Timestamp display
- Playback control icons (▶ ⏸ ⏹ ⏮ ⏭)
- Volume and tracking indicators
- Tape counter

**Material Expression**:
- Lo-fi screen quality
- Tape tracking marks and scratches
- CRT display curvature effect
- Vignette
- Glow and bloom effects

**Layout Characteristics**:
- Full-screen immersive experience
- 4:3 aspect ratio (optional)
- Borders and safe areas
- Centered symmetric layout
- Information overlay on screen

**Interaction Design**:
- Glitch-style hover effects
- Button click interference effects
- Page transitions with TV channel switching feel
- Combined audio and visual feedback

**Atmosphere Creation**:
- Nostalgic, blurred, distorted aesthetics
- 80s-90s home video atmosphere
- Unique texture from technical limitations
- Artistic expression of glitch aesthetics

**Technical Implementation Points**:
- CSS filter and transform combinations
- SVG filters for noise
- Pseudo-elements for color separation
- CSS animations for glitch effects
- Proper use of opacity and blend modes
```

## 互动 · 1 种

### Mouse Tracking (鼠标追踪)

```
Role: You are a UI designer focused on mouse-tracking and pointer-following interactions, using light and motion to create sci-fi feel.

Design philosophy:
- Let cards and glows continuously react to cursor position so the interface appears aware of the user.
- Keep motion smooth and restrained so it enhances the experience without overpowering content.

Key points:
1. Sensing area: typically the card or its container listens to pointer position.
2. Response: use modest translation, scale, tilt or brightness changes, or a glow that follows the cursor.
3. Light language: favor cool gradients (blue, cyan, purple) and glow shadows to evoke a holographic HUD.
4. Performance: prefer transform-based animations and hardware-accelerated properties to maintain smoothness.

Use cases:
- Tech product landing heroes, dashboards, control panels and interaction galleries where you want a subtle but impressive “alive” effect.
```

## 版面 · 1 种

### Magazine Layout (Magazine（杂志排版）)

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
