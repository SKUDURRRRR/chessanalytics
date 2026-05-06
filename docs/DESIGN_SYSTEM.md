# ChessData Design System — Cool Silver Premium

> **Status**: Active — all new UI work MUST follow these rules.
> **Last updated**: 2026-03-12
> **Mockup reference**: `docs/cool-silver-full-mockup.html`

This document defines the visual language for ChessData. It is the single source of truth for colors, typography, spacing, components, and patterns. Every frontend change — new feature, bug fix, or refactor — must conform to these rules.

---

## 1. Design Tokens

### 1.1 Colors — Surfaces

Only these background colors are allowed. No other `bg-` values, no custom hex backgrounds.

| Token          | Value     | Tailwind             | Usage                        |
|----------------|-----------|----------------------|------------------------------|
| `bg-base`      | `#0c0d0f` | `bg-[#0c0d0f]`      | Page background              |
| `bg-surface-1` | `#151618` | `bg-[#151618]`      | Cards, nav, panels           |
| `bg-surface-2` | `#1c1d20` | `bg-[#1c1d20]`      | Nested containers, inputs    |
| `bg-surface-3` | `#232428` | `bg-[#232428]`      | Hover states, avatars, wells |

> These are cool-tinted grays (slight blue shift), never pure neutral gray.

### 1.2 Colors — Semantic

| Token      | Value                   | Usage                                |
|------------|-------------------------|--------------------------------------|
| CTA        | `#e4e8ed`               | Primary buttons, logo mark, accents  |
| CTA hover  | `#f0f2f5`               | Primary button hover                 |
| Success    | `emerald-400` (opacity) | Win indicators, good moves, positive |
| Warning    | `amber-400` (opacity)   | Inaccuracies, caution states         |
| Danger     | `rose-400` (opacity)    | Losses, blunders, destructive        |

**Opacity rules for semantic colors:**
- Backgrounds: `/10` to `/15` (e.g., `bg-emerald-500/15`)
- Text: `/80` (e.g., `text-emerald-400/80`)
- Progress bars: `/40` to `/50`
- Dots/indicators: `/60`

### 1.3 Colors — Text

| Token          | Value       | Tailwind          | Usage                    |
|----------------|-------------|-------------------|--------------------------|
| `text-primary` | `#f0f0f0`   | `text-[#f0f0f0]`  | Headings, emphasis       |
| `text-body`    | —           | `text-gray-300`    | Body text, names         |
| `text-secondary`| —          | `text-gray-400`    | Secondary info           |
| `text-muted`   | —           | `text-gray-500`    | Labels, captions         |
| `text-faint`   | —           | `text-gray-600`    | Timestamps, metadata     |
| `text-ghost`   | —           | `text-gray-700`    | Move numbers, dividers   |

### 1.4 Colors — Borders

| Usage           | Value                             |
|-----------------|-----------------------------------|
| Default border  | `rgba(255,255,255,0.04)` via ring shadow |
| Hover border    | `rgba(255,255,255,0.08)`          |
| Divider         | `rgba(255,255,255,0.03)`          |
| Highlighted     | `rgba(228,232,237,0.15)` (CTA-tinted) |

> **Never use Tailwind `border` classes for cards.** Use `box-shadow: 0 0 0 1px` ring shadows instead. This gives crisper 1px lines at any DPI.

### 1.5 Colors — Move Classifications

Use 3 semantic color groups (good / neutral / bad), not 7 rainbow colors:

| Classification | Text color              | Background              |
|---------------|-------------------------|-------------------------|
| Brilliant     | `text-emerald-300`      | `bg-emerald-500/15`     |
| Best          | `text-emerald-300/80`   | `bg-emerald-500/10`     |
| Great         | `text-emerald-300/60`   | `bg-emerald-500/5`      |
| Good          | `text-gray-400`         | `bg-white/[0.04]`       |
| Acceptable    | `text-gray-400`         | `bg-white/[0.04]`       |
| Inaccuracy    | `text-amber-300/80`     | `bg-amber-500/10`       |
| Mistake       | `text-rose-300/80`      | `bg-rose-500/10`        |
| Blunder       | `text-rose-300`         | `bg-rose-500/15`        |

**Inline dots** for move list: `w-1.5 h-1.5 rounded-full` with corresponding color at `/60` opacity.

---

## 2. Typography

### 2.1 Font

**Inter** via Google Fonts (400, 500, 600 weights). Replace the system font stack in `index.css`.

```css
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

**Monospace** (move lists, evaluations): `'SF Mono', 'Fira Code', 'Consolas', monospace`

### 2.2 Scale — Only These Sizes

| Role          | Size    | Weight       | Tracking        | Usage                        |
|---------------|---------|--------------|-----------------|------------------------------|
| Page title    | `24px`  | `semibold`   | `-0.03em`       | One per page                 |
| Section head  | `15px`  | `semibold`   | `-0.01em`       | Card titles, panel headers   |
| Body          | `13px`  | `regular`    | normal          | Primary content text         |
| Small         | `12px`  | `regular`    | normal          | Descriptions, secondary text |
| Caption       | `11px`  | `medium`     | normal          | Timestamps, metadata, hints  |
| Label         | `11px`  | `medium`     | `0.06em`        | All-small-caps labels        |
| Stat number   | `28px`  | `semibold`   | `-0.03em`       | Dashboard KPI numbers        |

### 2.3 Rules

- **Labels** use `font-variant: all-small-caps` + wide tracking (`0.06em`)
- **Stat numbers** use tight tracking (`-0.03em`)
- **Never use `font-bold` (700)**. Maximum weight is `font-semibold` (600)
- **Never use `text-base` (16px)** in UI components — it's too large. Use 13px body
- **Headings** are semantic HTML (`<h1>`, `<h2>`, `<h3>`), not styled `<div>`s

---

## 3. Spacing

### 3.1 Scale

Use only these Tailwind spacing values:

| Purpose              | Values allowed                  |
|----------------------|---------------------------------|
| Internal card padding| `p-4`, `p-5`, `p-6`            |
| Gaps between cards   | `gap-3`                         |
| Page-level padding   | `px-6` (nav), `px-8 py-10` (content) |
| Section spacing      | `mb-8`, `mb-10`                 |
| Text gaps            | `mb-1`, `mb-1.5`, `mb-2`, `mb-3` |
| List item spacing    | `space-y-2`, `space-y-3`, `space-y-3.5` |

### 3.2 Max Width

- Page content: `max-w-5xl` (1024px)
- Modals: `max-w-sm` (384px)
- Auth pages: `max-w-sm`
- Landing hero text: `max-w-2xl`

### 3.3 Rules

- **No arbitrary spacing** (`p-[13px]`, `mt-[7px]`). Use the Tailwind scale
- **Cards always use the same internal padding** within a view (pick `p-5` or `p-6`, not both)
- **More whitespace at the page level, tighter inside cards**

---

## 4. Components

### 4.1 Buttons — 4 Variants Only

**Primary** (CTA):
```
px-6 py-2 rounded-md text-[13px] font-medium tracking-[-0.01em]
background: #e4e8ed; color: #111;
box-shadow: 0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3);
```
- Hover: background `#f0f2f5`
- The inner highlight shadow (`inset 0 1px 0`) is what makes it feel premium

**Secondary** (outline):
```
px-5 py-2 rounded-md text-[13px] font-medium text-gray-400
border: 1px solid rgba(255,255,255,0.06);
```
- Hover: `text-gray-300`, `border-color: rgba(255,255,255,0.1)`

**Ghost** (text only):
```
px-4 py-2 rounded-md text-[13px] font-medium text-gray-500
```
- Hover: `text-gray-400`, `background: rgba(255,255,255,0.03)`

**Danger** (destructive):
```
px-5 py-2 rounded-md text-[13px] font-medium
background: rgba(251,113,133,0.1); color: text-rose-300;
```
- Only for destructive actions (sign out, delete, cancel subscription)

### 4.2 Cards

All cards use this base pattern:
```
background: #151618;
box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.2);
border-radius: 0.5rem (rounded-lg);
overflow: hidden;
```

**Top highlight** (optional, for important cards):
```html
<!-- First child inside the card -->
<div class="h-px" style="background: linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent);"></div>
```

**Elevated card** (for nesting): use `bg-surface-2` (`#1c1d20`) instead.

**Highlighted card** (active/selected): ring shadow `rgba(228,232,237,0.15)` instead of `0.04`.

### 4.3 Modals

```
background: #151618;
box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.4);
border-radius: 0.5rem;
max-width: 384px (max-w-sm);
```

- Overlay: `background: rgba(0,0,0,0.5)`
- Z-index: `z-50` (modals), `z-40` (dropdowns), `z-30` (sticky nav)
- Icon at top: `w-9 h-9 rounded-lg` with `rgba(228,232,237,0.06)` background
- **One shared modal wrapper component** — no per-modal styling

### 4.4 Inputs

```
background: #1c1d20 (surface-2);
box-shadow: 0 0 0 1px rgba(255,255,255,0.04);
border-radius: 0.375rem (rounded-md);
padding: 10px 14px;
font-size: 13px;
color: text-gray-300;
```

- Placeholder: `text-gray-500`
- Focus: ring shadow changes to `rgba(228,232,237,0.12)`

### 4.5 Navigation

```
background: #151618 (surface-1);
border-bottom: 1px solid rgba(255,255,255,0.04);
padding: px-6 py-3;
```

- Logo: `w-7 h-7 rounded-md` with CTA color background, black text
- Nav items: `px-3.5 py-1.5 rounded-md text-[13px] font-medium`
- Active item: `bg-white/[0.06] text-white`
- Inactive: `text-gray-500`
- **No gradients, no glow, no animations on the nav**

### 4.6 Progress Bars

```
Track: h-1 rounded-full bg-white/[0.04]
Fill:  h-1 rounded-full [semantic-color]/40-50
```

### 4.7 Dividers

```html
<div class="h-px" style="background: rgba(255,255,255,0.03);"></div>
```

Never use Tailwind `divide-*` utilities. Place dividers manually between list items.

---

## 5. Patterns

### 5.1 Hover States

- Background shift: `bg-white/[0.03]` to `bg-white/[0.04]` max
- Text shift: one gray step lighter (e.g., `gray-500` → `gray-400`)
- **Never** change to full white on hover
- **Only use `transition-colors`**, never `transition-all`
- Duration: 150ms (default)

### 5.2 Active/Selected States

- Background: `rgba(228,232,237,0.04)` (very subtle CTA tint)
- Or ring shadow at `rgba(228,232,237,0.1)`
- Text: `text-gray-200` or `text-white`

### 5.3 Loading States

- Spinner: `w-8 h-8 border-2 border-gray-700 border-t-gray-300 rounded-full animate-spin`
- Skeleton: `bg-white/[0.04] rounded animate-pulse`
- Progress bar: surface-1 card with centered spinner + text + progress bar
- **One pattern everywhere** — no per-component loading styles

### 5.4 Empty States

- Centered in container
- Icon (9x9, surface-2 bg, gray-500 icon)
- Title: 14px semibold white
- Description: 13px gray-500
- Optional CTA button

---

## 6. Layout

### 6.1 Page Structure

```
<Nav />                          <!-- sticky, surface-1, border-bottom -->
<main class="max-w-5xl mx-auto px-8 py-10">
  <PageHeader />                 <!-- h1 + subtitle -->
  <StatsRow />                   <!-- grid cols-4 gap-3 -->
  <MainContent />                <!-- grid cols-3 gap-3 -->
</main>
```

### 6.2 Analysis View

```
<Nav />                          <!-- compact, breadcrumb style -->
<div class="flex">
  <BoardArea />                  <!-- flex-1, p-8, centered -->
  <SidePanel />                  <!-- w-80, surface-1, border-left -->
</div>
```

### 6.3 Grid Rules

- Dashboard cards: `grid grid-cols-4 gap-3` (stats), `grid grid-cols-3 gap-3` (content)
- Always use CSS Grid, not flexbox for card layouts
- Cards in the same row must be the same height (Grid handles this)

---

## 7. Forbidden Patterns

These are **banned** from the codebase. Remove on sight:

| Banned                          | Use instead                    |
|---------------------------------|--------------------------------|
| Gradients (linear/radial)       | Flat surface colors            |
| Glassmorphism / backdrop-blur   | Surface-2 background           |
| `box-shadow` glow effects      | Ring shadow only               |
| Custom keyframe animations      | `transition-colors` or Tailwind `animate-spin/pulse` |
| `font-bold` (700 weight)       | `font-semibold` (600)          |
| `rounded-2xl` / `rounded-3xl`  | `rounded-md` or `rounded-lg`  |
| `shadow-xl` / `shadow-2xl`     | Ring shadow + subtle drop      |
| Emoji as UI icons              | Lucide React or HTML entities  |
| `border` utility on cards       | Ring shadow (`box-shadow: 0 0 0 1px`) |
| `transition-all`               | `transition-colors` or `transition-opacity` |
| `z-[9999]` or arbitrary z-index | Scale: 30 (nav), 40 (dropdown), 50 (modal) |
| Inline `style={{}}` for colors | Tailwind classes or CSS custom properties |
| `text-base` (16px) in UI       | `text-[13px]` for body         |
| Multiple button patterns        | 4 variants (primary/secondary/ghost/danger) |
| Per-component modal styles      | Shared `<Modal>` wrapper       |

---

## 8. Icon System

- **Primary**: Lucide React (`lucide-react` package)
- **Chess pieces**: HTML entities (`&#9813;` etc.) or dedicated chess icon component
- **No emoji** as UI elements
- Icon containers: `w-9 h-9 rounded-lg` with `rgba(228,232,237,0.06)` background
- Icon color: `text-gray-300` (default), semantic colors for status

---

## 9. Implementation Plan

### Phase 1 — Foundation (do first)
1. Update `tailwind.config.js` with design tokens (colors, remove excess animation)
2. Update `index.css`: add Inter font, remove dead CSS (glassmorphism, unused containers, liquid animations, fluid text)
3. Create reusable components: `<Button>`, `<Card>`, `<Modal>`, `<Input>`
4. Define CSS custom properties for surface colors

### Phase 2 — Navigation & Layout
5. Redesign `Navigation.tsx` — remove gradients, glow, rainbow buttons
6. Redesign `Footer.tsx` — remove animations, simplify
7. Set up consistent page layout wrapper

### Phase 3 — Core Pages
8. Landing page (`HomePage.tsx`)
9. Login/signup pages
10. Main dashboard / analysis page
11. Game analysis view (`UnifiedChessAnalysis.tsx`)

### Phase 4 — Coach & Deep
12. Coach dashboard (`CoachDashboardPage.tsx`)
13. Lesson viewer
14. Game review
15. Deep analysis / personality

### Phase 5 — Modals & Polish
16. Consolidate modals (LimitReachedModal, AnonymousLimitModal, UsageLimitModal → shared `<Modal>`)
17. Loading states
18. Empty states
19. Final audit — remove any remaining banned patterns

---

## 10. Review Checklist

Before merging any frontend PR, verify:

- [ ] Only uses colors from Section 1 (surfaces, semantic, text)
- [ ] No gradients, glassmorphism, or glow shadows
- [ ] Buttons use one of the 4 defined variants
- [ ] Cards use ring shadow, not `border` utility
- [ ] Typography follows the 7-size scale (Section 2.2)
- [ ] No `font-bold`, no `text-base`, no `rounded-2xl+`
- [ ] Spacing uses Tailwind scale (no arbitrary values)
- [ ] Hover states are subtle (max `bg-white/[0.04]`)
- [ ] Uses `transition-colors`, not `transition-all`
- [ ] z-index follows the scale (30/40/50)
- [ ] Icons from Lucide React, no emoji
- [ ] Semantic HTML headings (`<h1>`, `<h2>`, `<h3>`)
