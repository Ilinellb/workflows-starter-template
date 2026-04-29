# RSBC Workflow Pro — Design Guidelines (2026-04-29)

## Visual direction
**Reference:** Linear / Notion / Vercel — minimal operations dashboard.

## Type stack
- **Headings:** Chivo (Google Fonts), bold/semibold, `tracking-tight`
- **Body:** IBM Plex Sans (Google Fonts), 400/500
- **Numbers:** `tabular-nums` everywhere counters/timestamps appear

## Color tokens (CSS vars, see `index.css`)
- Background: `hsl(240 5% 98%)` (zinc-50)
- Foreground: `hsl(240 10% 3.9%)` (near-black)
- Primary CTA: foreground (black), `text-primary-foreground` on top
- Border: `hsl(240 5.9% 90%)`
- Muted: `hsl(240 4.8% 95.9%)`
- **Status colors (only for room status, badges):**
  - Open & Clean: `emerald-500`
  - Occupied: `amber-500`
  - Guest Out: `orange-500`
  - Needs Cleaning: `red-500`

## Reusable patterns

### Page heading
```jsx
<h2 className="font-heading text-3xl font-bold tracking-tight">{title}</h2>
```
Optional kicker below: `<p className="text-sm text-muted-foreground mt-1">…</p>`

### Card
Default `<Card>` from shadcn — neutral white, 1px border, no heavy shadow.

### Status dot
```jsx
<span className={`status-dot ${color}`} />  // 8px pulsing
```

### Stat block (inside cards)
```jsx
<div className="p-4 bg-zinc-50 rounded-md border border-border">
  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
  <p className="font-heading text-2xl font-semibold tabular-nums">{value}</p>
</div>
```

### Tab nav (top)
- Sticky, white/75 + `backdrop-blur-xl`
- Active = `border-b-2 border-primary text-foreground`
- Inactive = `text-muted-foreground hover:text-foreground`
- Lucide icons at `h-4 w-4 strokeWidth={1.75}` to the left of label
- `hide-scrollbar overflow-x-auto` so 11 OPS tabs scroll cleanly on tighter widths

### Room card (4px left-border style)
```jsx
<div className={`p-3 rounded-md bg-card border border-border border-l-4 ${borderColor}`}>
  …
</div>
```
Status communicated by left border + dot, NOT by full background flood.

## Iconography
**Tab icons:** stored as string identifiers in `getTabsForRole()`, rendered via `TAB_ICON_MAP` to lucide components.

| Tab | Lucide icon |
|---|---|
| Time Clock | `Clock` |
| Room Management | `LayoutGrid` |
| My Schedule / Schedule | `Calendar` (aliased `CalendarIcon`) |
| Team Overview | `Users` |
| Team Time Cards | `Timer` |
| Room Reports | `BarChart3` |
| Team Scheduling | `CalendarDays` |
| Team Reports | `LineChart` |
| Employee Management | `UserCog` |
| System Admin | `Settings2` |
| Profile | `User` (aliased `UserIcon`) |

**Inline emoji removed across the app** — page headings, card titles, button labels.

## What is intentionally NOT changing
- Tab structure, role-based visibility, all behavior, all data-testids, all API calls.
