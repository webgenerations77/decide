---
name: Decide
description: We'll decide. You just go.
colors:
  cobalt-stamp: "#2563C9"
  cobalt-deep: "#1B3F86"
  go-orange: "#FF8A3D"
  go-orange-deep: "#E0662A"
  go-orange-soft: "#FFD9B8"
  ticket-gold: "#F4B63A"
  ochre-ink: "#8C6010"
  beta-violet: "#7C3AED"
  desk-paper: "#F6EEDF"
  card-white: "#FFFFFF"
  cream-alt: "#ECE3D1"
  warm-hairline: "#E4D9C4"
  cool-hairline: "#E6EDFB"
  sky-100: "#E6EDFB"
  sky-200: "#C9D8F4"
  sky-300: "#9DB8E8"
  harbour-navy: "#102A4C"
  ink: "#16243B"
  slate: "#2C3E5C"
  muted: "#7E8BA3"
  success-green: "#2E9E7B"
  alert-red: "#D6453C"
  alert-red-deep: "#A8362E"
typography:
  display:
    fontFamily: "BricolageGrotesque_800ExtraBold"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.5px"
  headline:
    fontFamily: "BricolageGrotesque_700Bold"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "BricolageGrotesque_800ExtraBold"
    fontSize: "17px"
    fontWeight: 800
    letterSpacing: "0.2px"
  body:
    fontFamily: "HankenGrotesk_400Regular"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  body-compact:
    fontFamily: "HankenGrotesk_500Medium"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "SpaceMono_700Bold"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "1.6px"
rounded:
  sm: "6px"
  md: "10px"
  lg: "24px"
  pill: "999px"
  icon: "42px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-cobalt:
    backgroundColor: "{colors.cobalt-stamp}"
    textColor: "{colors.card-white}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    height: "56px"
  button-go:
    backgroundColor: "{colors.go-orange}"
    textColor: "{colors.card-white}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    height: "56px"
  button-secondary:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.cobalt-stamp}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    height: "56px"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  chip:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.slate}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.lg}"
    padding: "8px 14px"
  chip-selected:
    backgroundColor: "{colors.cobalt-stamp}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.lg}"
    padding: "8px 14px"
  input:
    backgroundColor: "{colors.cream-alt}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "10px 14px"
  section-label:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
---

# Design System: Decide

## 1. Overview: The Travel Desk

**Creative North Star: "The Travel Desk"**

Warm paper stock, a typeset plan, and one confident stamp of ink. Decide does not present a search; it presents a document — a day already worked out, laid on the desk, ready to be picked up and acted on. The paper ground is the desk blotter. Cobalt is the stamp that says this is settled. Orange is the single "go" moment, and Space Mono carries times and codes the way a timetable does.

The system is warm but not soft. Density is moderate and deliberately unequal: the plan itself gets air, while the controls that produce it compress into pills and chips that stay out of the way. Type does the structural work — an extra-bold grotesque for the things that matter and a quiet humanist sans for everything else — so colour can stay scarce enough to mean something when it appears.

This explicitly rejects the four things Decide must never be. It is not **a search results page**: no ranked lists, no ten options with no opinion. It is not **a booking or OTA site**: no star-rating clutter, no badges, no sponsored placements, no upsell furniture. It is not **a generic AI chat product**: no chat bubbles, no sparkle iconography, no "powered by AI" badging. It is not **an enterprise dashboard**: no chart grids, no toolbars, no dense operational panels.

**Key Characteristics:**
- Warm paper ground with white cards lifted just off it
- Cobalt leads every action; orange appears once per screen at most
- Mono used only for structural labels and times, never for prose
- Flat by default, with exactly one shadow in the entire system
- Full-width pill CTAs that look pressable and commit to the action
- Light and dark are peers, not an inversion — dark is a warm brown-black, not grey

## 2. Colors: The Travel Desk Palette

A warm neutral ground carrying one confident cool lead, one hot accent used sparingly, and gold for warmth that is never allowed to become a control.

### Primary
- **Cobalt Stamp** (`#2563C9`): The confident lead. Every CTA, every active state, every current selection, every focused control. If something can be acted on or is currently chosen, it is cobalt. **Cobalt Deep** (`#1B3F86`) is the gradient end stop on filled buttons and the pressed state.

### Secondary
- **Go Orange** (`#FF8A3D`): The decisive action — the moment of "go". Reserved for the brand mark's dot, the food category, and at most one action per screen. **Go Orange Deep** (`#E0662A`) closes its gradient; **Go Orange Soft** (`#FFD9B8`) tints backgrounds behind it.

### Tertiary
- **Ticket Gold** (`#F4B63A`): Retro-travel warmth. Badges, edges, the shopping category, warning states. Too light to carry text on paper, so **Ochre Ink** (`#8C6010`) is its text counterpart at roughly 4.9:1 on paper.
- **Beta Violet** (`#7C3AED`): Beta-tester banners and badges only. Deliberately outside the travel palette so it reads as scaffolding, not product.

### Neutral
- **Desk Paper** (`#F6EEDF`): The ground everything sits on. Warm, slightly darker than a naive off-white so that white cards read as lifted.
- **Card White** (`#FFFFFF`): Card and surface fill. The paper/white step is the primary depth cue in this system.
- **Cream Alt** (`#ECE3D1`): Grouped sections and input fills — a recessed step below paper.
- **Warm Hairline** (`#E4D9C4`) and **Cool Hairline** (`#E6EDFB`): Dividers and borders. Warm on paper, cool where content is cobalt-adjacent.
- **Harbour Navy** (`#102A4C`): Reversed lockups, dark headers, and the shadow tint.
- **Ink** (`#16243B`), **Slate** (`#2C3E5C`), **Muted** (`#7E8BA3`): The three-step text ramp — primary, secondary, and de-emphasised.
- **Sky 100/200/300** (`#E6EDFB` / `#C9D8F4` / `#9DB8E8`): Cool tints for cobalt-adjacent fills and inactive rails.

### Status
- **Success Green** (`#2E9E7B`), **Alert Red** (`#D6453C` / deep `#A8362E`). Warning reuses Ticket Gold.

### Dark appearance
Dark is a warm brown-black (`#15120E` ground, `#211D17` surface, `#2B2620` alt), never a grey or blue-black inversion. Cobalt lifts to `#4A82E0` and orange to `#FF9A52` so they hold against the darker ground. The full dark map lives in `constants/theme.js` as `DARK`.

### Named Rules

**The One Orange Rule.** Go Orange appears at most once per screen, and never as a button fill outside the primary "go" action. Cobalt leads all other CTAs. Orange everywhere is orange nowhere.

**The Gold Is Not A Control Rule.** Ticket Gold fills badges, edges and category marks. It is never a button, never a link, and never carries text at its own value — use Ochre Ink for that.

**The Token Rule.** No hardcoded hex in components, ever. Every colour resolves from `constants/theme.js` through `useTheme()`. A raw hex in a component is a defect regardless of how correct the value looks.

**The Both-Appearances Rule.** Contrast is verified in light *and* dark before a control ships. The observed failure mode in this codebase is a control that is legible in one appearance and effectively invisible in the other.

## 3. Typography

**Display Font:** Bricolage Grotesque (700 Bold, 800 ExtraBold)
**Body Font:** Hanken Grotesk (400, 500, 600, 700)
**Label/Mono Font:** Space Mono (400, 700)

**Character:** A wide, slightly eccentric grotesque for anything that asserts, paired with a quiet humanist sans that gets out of the way, plus a mono that exists purely to make times and codes look like a schedule. The pairing works on a contrast axis — Bricolage's odd widths against Hanken's evenness — rather than stacking two similar sans faces.

### Hierarchy
- **Display** (800 ExtraBold, 28px, 1.1, -0.5px): Screen titles. The top of the system; nothing goes larger.
- **Headline** (700 Bold, 20px, 1.2): Section and card headings inside a screen.
- **Title** (800 ExtraBold, 17px, +0.2px): Button labels and the strongest inline emphasis.
- **Body** (400 Regular, 15px, 1.45): Reading text — reasons, descriptions, explanatory copy.
- **Body Compact** (500 Medium, 13px, 1.4): The workhorse. Chips, rows, metadata, secondary labels. The single most-used size in the app.
- **Label** (Space Mono 700, 11px, +1.6px, uppercase): Section eyebrows, times, codes.

### Named Rules

**The Baked Weight Rule.** `@expo-google-fonts` bakes weight into the family name. Never set `fontWeight` alongside `fontFamily: FONTS.*` — the weight will not apply. Choose the matching `FONTS.*` variant instead.

**The Mono Is Structural Rule.** Space Mono carries labels, times and codes. It never carries prose, never a sentence, never a description. Mono in a paragraph reads as a terminal, which is the dashboard anti-reference.

**The 28 Ceiling Rule.** 28px is the largest type in the product. The brand wordmark scales independently via `BrandLogo`; nothing else may exceed the ceiling.

## 4. Elevation

The system is flat by default with exactly one lift. Depth comes primarily from the tonal step between Desk Paper and Card White, not from shadow. `SHADOWS.card` is the only shadow token in the codebase, and it is navy-tinted rather than black so it reads as warm shade on paper rather than a grey drop.

In dark mode the shadow is dropped entirely and replaced with a hairline border, because a soft navy shadow is invisible against a `#15120E` ground. This substitution is the correct pattern, not a workaround.

### Shadow Vocabulary
- **Card lift** (`shadowColor: #102A4C, opacity 0.10, radius 20, offset 0/8, elevation 4`): Cards only. Diffuse and low-contrast — it should register as the card floating, never as a visible edge.

### Named Rules

**The One-Shadow Rule.** There is one shadow token and only `Card` may use it. Adding a second elevation tier is prohibited without an explicit decision to extend the system. If a sheet or modal needs separation, it gets a scrim or a border, not a new shadow.

**The 2014 Test.** If the shadow reads as a distinct dark edge rather than ambient shade, the opacity is too high and the blur too small.

## 5. Components

Decisive and tactile. Buttons look pressable and commit to the action; cards contain; chips select. The mixed radius vocabulary is deliberate and load-bearing — **pills command, cards contain, chips select** — and should not be flattened to a single radius.

### Buttons
- **Shape:** Fully rounded pill (`999px`), fixed 56px height, typically full-width.
- **Cobalt (default):** Gradient Cobalt Stamp → Cobalt Deep, diagonal (0,0 → 1,1), white 17px display label. The default for essentially every action.
- **Go:** Gradient Go Orange → Go Orange Deep. Reserved for the single decisive action per screen.
- **Secondary:** White fill, 1.5px cobalt border, cobalt label. No gradient, no shadow.
- **States:** Disabled and loading both drop to 50% opacity; loading swaps the label for a spinner in the label colour. Every variant fires a haptic on press via `CTAButton`.

### Chips
- **Style:** White fill, 1px warm hairline, `24px` radius, 8/14 padding, 13px medium label in Slate.
- **Selected:** Fill becomes the category or cobalt colour, border matches the fill, label goes white.

### Cards / Containers
- **Corner Style:** `10px` — noticeably tighter than chips. Cards are documents, not pills.
- **Background:** Card White on Desk Paper.
- **Shadow Strategy:** The single card lift (see Elevation). Dark mode substitutes a hairline border.
- **Internal Padding:** 16px.

### Inputs / Fields
- **Style:** Cream Alt fill, 1px warm hairline, 14px horizontal padding. Recessed rather than raised — inputs sit *into* the paper.
- **Focus:** Currently undifferentiated. This is the largest gap in the system and the next thing worth designing.

### Navigation
- **Tab bar:** 65px, white (`#1C1813` dark), 1px top hairline, no elevation or shadow. Active tint cobalt, inactive muted. A 20×2px cobalt indicator bar sits above the active icon; icons swap from outline to filled on selection. Labels are 11px Hanken Medium.

### Signature Components
- **BrandLogo** — the compass mark on a 120 viewBox, needle rotated 20°, with the accent-orange upper blade. The wordmark's full stop is Go Orange and is independently tappable.
- **SectionLabel** — a Space Mono uppercase eyebrow with optional trailing hairline rule, so label and divider read as one unit.
- **CollapsibleCard** — the backbone of Settings. Collapsed state shows a one-line summary on the right so the screen reads as a scannable inventory of what is set rather than a stack of closed doors.

## 6. Do's and Don'ts

### Do:
- **Do** resolve every colour from `constants/theme.js` via `useTheme()`. A hardcoded hex in a component is a defect.
- **Do** lead with Cobalt Stamp (`#2563C9`) for actions, active states and selection.
- **Do** verify contrast in both light and dark before shipping a control: 4.5:1 for body text, 3:1 for UI components and large text.
- **Do** keep the radius vocabulary intact — pills (`999px`) command, cards (`10px`) contain, chips (`24px`) select.
- **Do** use Ochre Ink (`#8C6010`) whenever gold needs to carry text.
- **Do** make the whole row the touch target for a labelled control, not just the control itself.
- **Do** pick the matching `FONTS.*` variant instead of setting `fontWeight`.

### Don't:
- **Don't** build **a search results page**. No ranked lists of ten options with no opinion. A plan that reads as a list has already failed.
- **Don't** borrow from **a booking or OTA site**. No star-rating clutter, no badge walls, no sponsored placements, no upsell furniture.
- **Don't** look like **a generic AI chat product**. No chat bubbles, no sparkle icons, no "powered by AI" badging — and never the word "AI" in user-facing copy.
- **Don't** drift toward **an enterprise dashboard**. No chart grids, no dense operational panels, no toolbars.
- **Don't** use Go Orange as a button fill outside the single primary "go" action, and never more than once per screen.
- **Don't** use Ticket Gold as a control, a link, or as text at its own value.
- **Don't** add a second shadow token. Flat by default; only `Card` lifts.
- **Don't** put Space Mono in prose. It carries labels, times and codes only.
- **Don't** exceed 28px type outside the brand wordmark.
- **Don't** rely on a pale track or hairline to carry a control's state — it fails contrast against Desk Paper and disappears entirely.
