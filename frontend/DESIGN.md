# OptimoLMS Design System

OptimoLMS follows Apple's **Human Interface Guidelines (HIG)**, adapted for a web admin app. The HIG is the reference for every visual and interaction decision. This file records how we apply it. Every token lives in `src/styles.css` under `:root`, and component CSS uses those tokens only.

---

## 1. Principles

The HIG's three themes, and what each means here:

| HIG theme     | What it means in OptimoLMS                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Clarity**   | Text is legible at every size, icons are precise, and decoration is minimal. Content such as courses, rooms and permissions is the hero, not the chrome around it. |
| **Deference** | The interface steps back. Translucent sidebar and top bar, quiet greys, no heavy borders. Colour is reserved for meaning and action.                               |
| **Depth**     | Layering shows hierarchy: frosted bars sit above content, cards rest on the canvas, and motion confirms where things come from.                                    |

Supporting rules:

- **Consistency.** Use the platform conventions people already know (macOS source-list sidebar, pill buttons, inset tables).
- **Feedback.** Every press, hover, load and error has a visible response.
- **Restraint.** If a style doesn't help someone understand or act, remove it.

---

## 2. Colour

### System colours

These are the HIG's dynamic system colours. Light and dark values switch automatically.

| Token                         | Light                 | Dark      | Use                          |
| ----------------------------- | --------------------- | --------- | ---------------------------- |
| `--system-blue` / `--primary` | `#007AFF` / `#0071E3` | `#0A84FF` | Actions, links, selection    |
| `--system-green`              | `#34C759`             | `#30D158` | Success, active              |
| `--system-orange`             | `#FF9500`             | `#FF9F0A` | Warning                      |
| `--system-red`                | `#FF3B30`             | `#FF453A` | Errors, destructive actions  |
| `--system-indigo`             | `#5856D6`             | `#5E5CE6` | Accent in the brand gradient |
| `--system-teal`               | `#30B0C7`             | `#40C8E0` | Secondary data               |

### Semantic colours

Use the semantic name, never a hex value:

- **Backgrounds:** `--bg-canvas` (system grouped background, `#F5F5F7` / `#000`), `--bg-surface` (secondary grouped, `#FFF` / `#1C1C1E`), `--bg-subtle`.
- **Labels:** `--text-primary` (label), `--text-secondary` (secondary label), `--text-muted` (tertiary).
- **Fills:** `--fill`, `--secondary-fill`, `--tertiary-fill` for control backgrounds.
- **Separators:** `--divider`, `--divider-strong`, `--separator`.

### Rules

- Never use colour as the only signal. Pair it with an icon or text (a badge reads "Active", not just green).
- The tint colour (blue) means "this is interactive". Don't use it for decoration.
- Body text contrast is at least 4.5:1, and large text and UI elements at least 3:1.

---

## 3. Typography

The font is **SF Pro** through the system stack (`-apple-system`), falling back to Inter and Helvetica Neue. SF Pro **Display** is used at 20px and up, SF Pro **Text** below that. Tracking tightens as size grows (−0.01em for body, −0.03em for display).

| HIG style            | Token         | Size | Weight   | Use                         |
| -------------------- | ------------- | ---- | -------- | --------------------------- |
| Large Title          | `--fs-xl`     | 34   | Bold     | Page header                 |
| Title 1              | `--fs-title1` | 28   | Bold     | Login, empty pages, metrics |
| Title 2              | `--fs-lg`     | 22   | Semibold | Section headers             |
| Title 3              | `--fs-title3` | 20   | Semibold | Sub-sections                |
| Headline             | `--fs-md`     | 15   | Semibold | Card titles                 |
| Body                 | `--fs-base`   | 14   | Regular  | Default text                |
| Footnote / Caption 1 | `--fs-sm`     | 12   | Regular  | Hints, metadata             |
| Caption 2            | `--fs-xs`     | 11   | Medium   | Badges, table headers       |

Body sizes are about 3pt smaller than iOS defaults, matching the denser macOS scale.

- Numbers use `tabular-nums` (`.num`) so columns line up.
- Use weight and colour for hierarchy before reaching for a new size.
- Lines of text are capped at about 68 characters.

---

## 4. Layout & spacing

- **4pt grid:** `--s-1`(4) `--s-2`(8) `--s-3`(12) `--s-4`(16) `--s-5`(20) `--s-6`(24) `--s-8`(32) `--s-10`(40).
- **Shell:** a 252px source-list sidebar, a 56px top bar, and content up to 1200px wide.
- **Margins:** 28px on desktop, 16px on mobile (the HIG's standard readable margins).
- **Grouping:** related content sits together in inset cards. Use whitespace instead of separators wherever possible.
- **Responsive:** below 880px the sidebar becomes a horizontal tab strip, and below 560px grids collapse to one column.

---

## 5. Shape, materials & depth

| Token      | Value | Use                      |
| ---------- | ----- | ------------------------ |
| `--r-sm`   | 6     | Inline code, focus ring  |
| `--r-md`   | 10    | Nav items                |
| `--r-lg`   | 14    | Alerts, small containers |
| `--r-xl`   | 20    | Cards                    |
| `--r-pill` | 980   | Buttons, badges, chips   |

Nested corners are **concentric**: inner radius = outer radius − padding.

**Materials.** The sidebar and top bar use a _regular material_: `--bg-glass` plus `backdrop-filter: saturate(180%) blur(20px)`. With **Reduce Transparency** they fall back to a solid surface.

**Elevation.** `--shadow-1` is for resting cards and `--shadow-2` for raised or hovered cards and the login sheet. In dark mode depth comes from lighter surfaces, not shadows.

---

## 6. Components

**Buttons** are pill-shaped and 36px tall (30px for `--sm`).

- _Primary (filled):_ one per view, for the main action.
- _Secondary (gray fill):_ supporting actions.
- _Ghost (plain):_ tertiary actions and toolbars.
- They scale to 0.97 when pressed. When disabled they drop to 55% opacity and keep their label.

**Sidebar (source list):** a tinted selection (blue at 16% with a blue label), a 36px row height, an icon plus label, and section headers in sentence case.

**Cards (inset grouped):** no border, 20px radius, a 16–20px header, and a gray footer for metadata.

**Tables:** small uppercase headers in tertiary label colour, 12px row padding, a hover highlight, and right-aligned tabular numbers.

**Badges and chips** are capsules. Status colour uses a soft fill with a tinted label.

**Text fields:** 44px tall with a filled gray background. On focus they turn white with a blue border and a 4px glow. Invalid fields get a red border and an error line underneath.

**Alerts:** a tinted background, an icon, a bold title, and a secondary explanation. Write what happened and what to do next.

**Loading, empty and error states:** skeletons that pulse, an icon in a rounded tile, a title, and one sentence of help. Never leave a blank screen.

---

## 7. Motion

The HIG asks for motion that is purposeful, brief and realistic.

| Token           | Value                        | Use                      |
| --------------- | ---------------------------- | ------------------------ |
| `--dur-fast`    | 150ms                        | Press, hover             |
| `--dur-base`    | 250ms                        | Colour and state changes |
| `--dur-slow`    | 450ms                        | Page entrance            |
| `--ease`        | `cubic-bezier(.25,.1,.25,1)` | Standard                 |
| `--ease-spring` | `cubic-bezier(.32,.72,0,1)`  | Spring-like settle       |

- Page content rises 8px and fades in. Cards lift 2px on hover.
- Animate only `transform` and `opacity`.
- **Reduce Motion** turns off entrance animations, press scaling and transitions.

---

## 8. Accessibility

- **Hit targets:** 44×44 minimum on touch (`pointer: coarse`), 28px minimum with a pointer.
- **Focus:** always visible, as a 3px system-blue ring offset by 2px.
- **Increase Contrast** (`prefers-contrast: more`) uses stronger separators and darker secondary text.
- **Dark Mode** follows `prefers-color-scheme` and uses true black for the canvas and elevated grays for surfaces.
- Use semantic HTML, provide a skip link, use `aria-invalid` on fields, and give icon-only controls a `visually-hidden` label.

---

## 9. Writing

Follow the HIG voice: **clear, direct, friendly.**

- Use sentence case for titles, buttons and labels ("Add course", not "Add Course").
- Button labels are verbs. Avoid "OK" and "Submit" when a specific verb fits.
- Errors say what happened and how to fix it, and never blame the user.

---

## 10. Contributing checklist

- [ ] Uses tokens only. No raw hex, px radius or ad-hoc shadows.
- [ ] Works in light, dark and Increase Contrast.
- [ ] Hit targets meet the minimum, and focus is visible.
- [ ] Respects Reduce Motion and Reduce Transparency.
- [ ] Has loading, empty and error states.
- [ ] Copy is sentence case and verb-first.
