# SuccessCode Calculator — Architecture

## File Map

```
SuccessCode/
├── zwds.html          Public calculator  → successcode.net/zwds
├── zwds-alena.html    Alena's chart      → successcode.net/zwds-alena (embedded in admin)
├── zwds-demo.html     LOCKED demo        → successcode.net/zwds-demo  (DO NOT EDIT)
├── tz.js              Offline IANA timezone lookup (73 KB, self-hosted)
├── index.html         LOCKED home page
├── speedrun.html      LOCKED investor page
└── admin/
    └── alena-zwds.html  Alena's analysis report page
```

---

## Core Engine (obfuscated)

Both `zwds.html` and `zwds-alena.html` contain an inline obfuscated `<script>` (~80 KB) that:
- Derives the lunar calendar from Gregorian birth date (via `lunar-javascript` CDN)
- Places 18 main stars + helper/evil stars into 12 palaces
- Fires the four Si Hua enhancers (Lu/Quan/Ke/Ji) from year/decade/annual/monthly stems
- Renders the 4×4 palace grid with empty center into `#chart-output`
- Renders a decades strip below the grid
- Renders a layer-controls bar (natal / decade / annual selectors)

### Exposed global hooks

| Function | Called by | Purpose |
|---|---|---|
| `loadTrump()` | obfuscated code on `window.load` | First-run initialisation hook — override to pre-fill defaults |
| `buildChart()` | button click / custom code | Reads form fields, computes chart, renders everything |
| `selectCity(i)` | dropdown click | Sets longitude from city list entry `i` |
| `updateSolarPreview()` | UTC offset input | Recomputes solar-time correction preview |
| `onCityInput()` | city text input | Triggers city autocomplete search |

---

## Solar Time Correction Pipeline

Added in `<head>` of both `zwds.html` and `zwds-alena.html`.

### `__computeUtcOffset(lat, lon, dateStr, timeStr)` → number | null

Resolves the historically-correct UTC offset for a given birth location and date.

```
lat, lon
  └─► tzlookup(lat, lon)          tz.js: coordinate → IANA zone name
        └─► 'Europe/Amsterdam'
              └─► Intl.DateTimeFormat({timeZone, timeZoneName:'shortOffset'})
                    .formatToParts(birthDate)
                      └─► 'GMT+2' → parse → 2
                            └─► return numeric offset (e.g. 2, 3.5, -5)
```

- `dateStr` / `timeStr` are used to construct the birth moment so DST rules for the birth year apply (not today's rules).
- Returns `null` if `tzlookup` isn't loaded yet (race condition guard).
- Historical accuracy: passes birth date as pseudo-UTC to `Intl.DateTimeFormat` → browser IANA data returns the offset that was in effect at that exact moment in history (e.g. Saratov April 1979 → UTC+4, not the current UTC+3 ambiguity).

### `__tzCorrect(i)`

Called after `selectCity(i)` to patch the UTC offset field and city-result display once a city is chosen from the dropdown.

Uses `__computeUtcOffset` internally. Falls back silently if latitude or tz.js are unavailable.

### tz.js

Self-hosted offline IANA timezone database.
- No external API — works without network after page load.
- No rate limits.
- Updated by replacing the file with a new build from `tzdata` when political changes occur (e.g. a country eliminates summer time).
- Source: https://github.com/nicktober/tzlookup or equivalent coordinate-to-IANA library.

---

## `zwds.html` — Public Calculator Customisation

### `__loadAmsterdamDefaults()`

Overrides `window.loadTrump` so the first render shows a meaningful chart instead of an empty form.

Pre-fills:
- Date → today's date (dynamic)
- Time → current time (dynamic)
- City → Amsterdam, Netherlands
- Longitude → 4.9041
- UTC offset → computed via `__computeUtcOffset(52.3676, 4.9041, today, now)`, fallback `2`
- Calls `buildChart()` immediately

Pattern:
```js
window.addEventListener('DOMContentLoaded', function() {
  window.loadTrump = __loadAmsterdamDefaults;   // replaces the no-op hook
  // also wraps selectCity to auto-correct UTC offset after city selection
  var _origSC = window.selectCity;
  window.selectCity = function(i) { _origSC(i); __tzCorrect(i); };
});
```

---

## `zwds-alena.html` — Alena's Chart Customisation

### `__loadAlenaDefaults()`

Same pattern. Pre-fills Alena's birth data:
- Date → 1979-04-19
- Time → 13:30
- City → Saratov, Russia
- Longitude → 46.0167
- UTC offset → `__computeUtcOffset(51.5333, 46.0167, '1979-04-19', '13:30')`, fallback `4`

Computes Horse hour (LMT 12:34) correctly via IANA `Europe/Saratov` → UTC+4 for April 1979.

---

## Time Layer UI (built by obfuscated engine)

Rendered inside `#chart-output` when `buildChart()` runs.

### Layer controls bar (`.layer-controls`)

Appears above the palace grid. Contains:
- **Natal** tag (`ltag-natal`, red) — always shown
- **Decade** tag (`ltag-decade`, green) — shows decade enhancer flights on the grid
- **Annual** tag (`ltag-annual`, blue) — shows annual enhancer flights on the grid
- **Year ± buttons** (`.year-btn`) + year display (`.annual-year-val`) — change the active annual year
- Clicking a layer tag toggles that layer on/off in the palace grid

### Clickable decades strip (`.decades-section`)

Rendered below the palace grid. Shows all decades as cards (`.decade-cell`).
- `.is-current` highlight on the active decade
- **Click any decade** → sets that decade as active → updates decade enhancer flights on grid + highlights the decade life palace
- `.is-selected` state on the clicked decade cell

### Clickable year tags in palaces (`.pal-year-tag`)

Each palace cell shows the years that fall within that palace's decade range as small tags.
- **Click a year tag** → sets that year as the active annual year → updates annual enhancer display
- `.is-active` state on the selected year tag
- `.out-decade` styling for years outside the currently selected decade

### Dynamic annual layer (`zwds.html` only)

Annual enhancers are **hidden by default** on first load. They appear only when the user explicitly selects a year.

Implemented via a CSS class `annual-on` on `#chart-output`:

```css
#chart-output:not(.annual-on) .pal-ann-mov { display: none !important; }
#chart-output:not(.annual-on) .ebadge-ann  { display: none !important; }
#chart-output:not(.annual-on) .ltag-annual { opacity: 0.35; }
```

A MutationObserver watches `#chart-output` continuously. After chart renders:
- Removes `annual-on` (starts hidden)
- Marks the tag matching current calendar year with `.current-year` class (blue border, bold) — re-applied after every DOM change via debounced 60 ms timer
- Adds a click delegation handler (added once):
  - `.pal-year-tag` click: if `annual-on` is active **and** the same year was already selected → **toggle OFF** (removes `annual-on`); otherwise → **toggle ON** (adds `annual-on`)
  - `.year-btn` (± buttons) click → adds `annual-on` and updates `_activeYear` after 30 ms
  - `.ltag-annual` click → toggles `annual-on`; clears `_activeYear` when turning off

CSS for current-year marker:
```css
.pal-year-tag.current-year { border-color: var(--annual-col); background: #eef0ff; font-weight: 700; }
```

### Colour coding

| Layer | Colour | CSS variable |
|---|---|---|
| Natal enhancers | Red | `--natal-col: #b02010` |
| Decade enhancers | Green | `--decade-col: #1a6028` |
| Annual enhancers | Blue | `--annual-col: #1828b0` |
| Lu | Dark green | `--lu: #166020` |
| Quan | Dark blue | `--quan: #1020b8` |
| Ke | Gold | `--ke: #c8b000` |
| Ji | Dark red | `--ji: #aa1010` |

---

## Deployment

- Repository: `github.com/olgabressers/successcode`
- Branch: `main`
- Hosting: GitHub Pages → `successcode.net`
- No build step — static HTML/JS/CSS files served directly.
- Push to `main` → live in ~30 seconds.

---

## What NOT to touch

| File | Reason |
|---|---|
| `speedrun.html` | Locked investor page — submitted for review |
| `zwds-demo.html` | Locked demo — submitted for review |
| `index.html` | Locked home page — submitted for review |
| Obfuscated `<script>` in any .html | Core engine — editing breaks chart generation |
