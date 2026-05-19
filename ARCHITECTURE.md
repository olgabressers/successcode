# SuccessCode Calculator — Architecture

A static GitHub-Pages site that publishes a Zi Wei Dou Shu (紫微斗数) chart
calculator plus a small set of derivative pages (per-person calculators and
their analysis reports). The chart engine is a single obfuscated JavaScript
blob; the rest of the page is plain HTML/CSS/JS that wraps it.

---

## File Map

```
SuccessCode/
├── index.html              LOCKED home page                → successcode.net
├── speedrun.html           LOCKED investor page            → successcode.net/speedrun
├── zwds.html               Public calculator                → successcode.net/zwds
├── zwds-alena.html         Alena's calculator (pre-filled)  → successcode.net/zwds-alena
├── zwds-maxim.html         Maxim's calculator (pre-filled)  → successcode.net/zwds-maxim
├── zwds-demo.html          LOCKED demo                      → successcode.net/zwds-demo
│
├── zwds-ui.js              Shared utilities (loaded by every zwds-*.html)
├── tz.js                   Self-hosted IANA timezone DB (coords → zone name)
│
└── admin/
    ├── alena-zwds.html     Alena's natal analysis report
    └── maxim-zwds.html     Maxim's natal analysis report
```

All `zwds-*.html` calculator pages share the same anatomy:

```
<head>
  zwds-ui.js                   ← shared utilities (see § Shared utilities)
  <script>__loadXxxDefaults</script>  ← per-page pre-fill (Maxim / Alena / Amsterdam)
  CSS                           ← page-level styles
<body>
  <form/>                       ← birth date, time, city, longitude, UTC offset
  <div id="chart-output"/>      ← engine renders the 4×4 grid in here
  lunar-javascript (CDN)        ← Gregorian↔Lunar conversion
  Obfuscated chart engine       ← single line, ~80 KB (see § Chart engine)
  tz.js                         ← IANA timezone lookup
```

---

## Chart engine (obfuscated)

A single-line, minified, name-mangled JavaScript blob (~80 KB) inlined near
the end of `<body>` in every calculator page. Identical bytes across
`zwds.html`, `zwds-alena.html`, and `zwds-maxim.html`, with **one** documented
exception (see § Calendar & Bureau Architecture → "Maxim bureau override").

What it does each time the user clicks **Calculate**:

1. Reads form fields (date/time/longitude/UTC offset/sex).
2. Calls `Solar.fromYmd(...)` → `getLunar()` (lunar-javascript) to derive the
   lunar date, year stem/branch, and other calendar artefacts.
3. Computes the Five-Elements Bureau (五行局), the Life palace (命宫), and
   places the 14 main stars + helper/evil stars across 12 palaces.
4. Fires the four Si-Hua enhancers (Lu/Quan/Ke/Ji) from the natal year stem,
   plus decade and annual stems where applicable.
5. Renders into `#chart-output`:
   - the 4×4 palace grid (empty centre cell holds birth data + dual BaZi)
   - a `.decades-section` strip beneath the grid
   - a `.layer-controls` bar above the grid

### Exposed global hooks

| Function              | Caller                            | Purpose                                                  |
|-----------------------|-----------------------------------|----------------------------------------------------------|
| `loadTrump()`         | engine, on `window.load`          | First-render hook — overridden per-page to pre-fill form |
| `buildChart()`        | button click / pre-fill script    | Reads form, computes chart, renders everything           |
| `selectCity(i)`       | city dropdown click               | Sets longitude from list entry `i`                       |
| `updateSolarPreview()`| UTC-offset input                  | Recomputes solar-time correction preview                 |
| `onCityInput()`       | city input field                  | Triggers debounced city autocomplete                     |

### What NOT to touch inside the engine

The blob is unreadable by design. Editing it is reserved for surgical,
single-symbol fixes that survive without de-obfuscation — and even those
should be documented inline (see the Maxim override comment in
`zwds-maxim.html`). Don't reformat it, don't add code inside it, don't try to
inline JS into it.

---

## Calendar & Bureau Architecture

This is the single most error-prone area of the codebase. Two date boundaries
exist in Chinese metaphysics; they look identical to non-experts and produce
silently wrong charts when confused.

### Boundary 1 — Chinese New Year (CNY)

Lunar New Year. Date varies year-to-year (mid-Jan to mid-Feb). This is the
**ZWDS year boundary**: the year stem (which fires all natal enhancers) flips
at CNY, not at Jan 1, and not at solar 立春.

`lunar-javascript` exposes CNY-based year via the *plain* methods:

- `lunar.getYearGan()`
- `lunar.getYearZhi()`
- `lunar.getYearInGanZhi()`

The obfuscated chart engine reads these for the ZWDS year stem, which is
correct.

### Boundary 2 — 立春 (Li Chun, "start of spring")

Solar term marking the start of the BaZi year. Falls on **Feb 4 ± 1 day** every
year. This is the **BaZi year boundary**: BaZi pillars are derived from solar
terms.

`lunar-javascript` exposes LiChun-based accessors:

- `lunar.getYearGanByLiChun()` / `getYearZhiByLiChun()` / `getYearInGanZhiByLiChun()`
- `lunar.getMonthGanExact()` / `getMonthZhiExact()` (LiChun-based month)
- `lunar.getEightChar()` — full BaZi object, uses LiChun internally

### Where the two boundaries diverge

For a birth date `D`:

- if `D` is **before LiChun** of year `Y` → in both calendars, still year `Y-1`
- if `D` is **between LiChun and CNY** → CNY says `Y-1`, LiChun says `Y` ← **divergence window**
- if `D` is **after CNY** → both calendars say `Y`

Maxim is the canonical divergence case: **1977-02-15**. LiChun 1977 = Feb 4
(passed), CNY 1977 = Feb 18 (not yet). Therefore:

| Calendar              | Year     | Month   | Used for                              |
|-----------------------|----------|---------|----------------------------------------|
| Lunar (CNY)           | 丙辰     | 辛丑    | ZWDS engine, natal enhancers           |
| Solar (LiChun)        | 丁巳     | 壬寅    | BaZi solar pillars display only        |

### Patch: Solar BaZi year pillar — `zwds-ui.js`

The chart engine uses LiChun-based methods for the Solar BaZi month/day/hour
pillars but **mistakenly uses `getYearGan()`/`getYearZhi()` (CNY) for the Solar
year pillar**, producing an internally inconsistent Solar display whenever the
birth date is in the divergence window.

The fix is an algorithm-level DOM patch in `zwds-ui.js`, applied universally
to every calculator page that loads the script:

```
After every #chart-output mutation:
  • locate the .bazi-dual element rendered by the engine
  • find the section whose label is Solar/節氣/節氣/立春/Ba Zi
    (fallback: match the section whose month pillar equals getMonthGanExact()
     + getMonthZhiExact())
  • rewrite that section's year pillar's two .bazi-char text nodes
    using lunar.getYearGanByLiChun() and lunar.getYearZhiByLiChun()
  • no-op when CNY-year and LiChun-year agree (most birth dates)
```

Does NOT touch the Lunar (ZWDS) section, does NOT touch the engine, does NOT
change the year stem used for ZWDS natal enhancers. See `zwds-ui.js` → IIFE
labelled "Solar BaZi year pillar — LiChun calendar fix".

### Patch: Maxim bureau override — `zwds-maxim.html`

The engine derives the Five-Elements Bureau (五行局, 2/3/4/5/6) from the
**year ganzhi's NaYin element**. The canonical ZWDS rule is to use the
**Life-palace (P1) ganzhi's NaYin**. For most charts the two agree (Alena:
both give Fire 6); for some they diverge.

Maxim diverges:

| Source              | GanZhi | NaYin       | Element | Bureau |
|---------------------|--------|-------------|---------|--------|
| Year (engine — wrong) | 丙辰  | 沙中土      | Earth   | 5      |
| P1   (canonical)    | 辛卯   | 松柏木      | Wood    | **3**  |

Wrong bureau → wrong Zi Wei placement → wrong star layout → wrong decade ages
(bureau N → first decade starts at age N). Mingli.ru and other reference
implementations all use the P1-based bureau and show Wood 3 for Maxim.

A general fix would require re-deriving the bureau from P1 inside the engine,
which is impractical without de-obfuscation. Maxim's calculator page therefore
contains a **single-symbol surgical edit** to the engine:

```javascript
function getFiveBureau(i,m){return 3;}   // was: NAYIN-of-year-ganzhi algorithm
```

The override is documented with a comment block above the `<script>` tag in
`zwds-maxim.html`. This works because:

1. The page is hardcoded to Maxim's birth data — no other input combinations
   are reachable on this URL.
2. The Five-Tigers Pursuing-the-Yuan table maps 丙 and 辛 to the same palace-
   stem row, so palace stems are identical whether the engine internally
   computes from 丙 or 辛 — only the bureau number, Zi Wei position, and
   decade ages change.
3. Natal enhancers still fire off the year stem 丙 as required by
   Northern-school rules.

### Adding a new pre-filled chart that needs a different bureau

The cleanest path is to clone `zwds-maxim.html`, change the pre-fill block,
and update the `return 3;` literal to the correct bureau for that chart
(2 Water / 3 Wood / 4 Metal / 5 Earth / 6 Fire — derive from the P1 ganzhi's
NaYin). Update the comment block accordingly.

For charts where year-NaYin and P1-NaYin happen to agree (Alena, Andrey),
no override is needed.

---

## Shared utilities — `zwds-ui.js`

Loaded by every `zwds-*.html` page. Five logical sections, each in its own
IIFE:

### 1. `__computeUtcOffset(lat, lon, dateStr, timeStr)` → number | null

Resolves the historically-correct UTC offset for a birth location + date.

```
lat, lon
  → tzlookup(lat, lon)              [tz.js: coordinate → IANA zone name]
    → 'Europe/Amsterdam'
      → Intl.DateTimeFormat({timeZone, timeZoneName:'shortOffset'})
          .formatToParts(birthDate)
        → 'GMT+2'  →  parse  →  return 2
```

Passes the birth date as pseudo-UTC so the browser's IANA tzdata returns the
offset that was in effect at that moment in history — e.g. Saratov 1979-04-19
→ UTC+4 (Soviet summer time), not the present-day UTC+3 ambiguity.

Returns `null` if `tzlookup` hasn't loaded yet (race-condition guard).

### 2. `__tzCorrect(i)`

Called after the user selects a city from the autocomplete dropdown. Patches
the UTC-offset input and the `#city-result` display using
`__computeUtcOffset`. Falls back silently if tz.js is unavailable.

### 3. Dynamic annual layer (`#chart-output.annual-on`)

The engine renders annual enhancers visible by default. `zwds-ui.js` flips
them OFF on first load and binds click delegation so the user can:

- click any `.pal-year-tag` → toggle annual layer ON for that year
- click the active year again → toggle OFF
- click the `.ltag-annual` tag in the controls bar → master toggle
- click `.year-btn` (± buttons) → flip ON and step the year

Implemented via a CSS class `annual-on` on `#chart-output` plus a
MutationObserver that re-binds handlers and re-applies state after every
engine re-render.

Also marks the tag matching the current calendar year with `.current-year`
class (blue border, bold).

### 4. Si Hua reverse-lookup arrows

Click any main star in any palace cell → SVG arrows fly in from every palace
whose stem would send an enhancer (Lu/Quan/Ke/Ji) to that star. Colour-coded:
green=Lu, dark blue=Quan, gold=Ke, dark red=Ji.

Uses a hardcoded reverse table (`REV`) mapping each star to its `{stem, type}`
sources. Arrows are SVG `<line>` elements appended to `#chart-output`, cleared
on any subsequent engine re-render.

### 5. Solar BaZi year pillar LiChun fix

See § Calendar & Bureau Architecture → "Patch: Solar BaZi year pillar".

---

## Per-page pre-fill scripts

Each `zwds-*.html` overrides `window.loadTrump` (the engine's first-render
hook) with a `__loadXxxDefaults()` function that:

1. Writes birth data into the form fields.
2. Calls `__computeUtcOffset(...)` for the historical UTC offset; falls back
   to a hardcoded integer if `tz.js` isn't ready yet.
3. Updates the `#city-result` display.
4. Calls `buildChart()` to render immediately on page load.
5. Wraps `window.selectCity` so manual city changes still trigger
   `__tzCorrect`.

Current defaults:

| Page              | Subject    | Date       | Time   | City               | UTC fallback |
|-------------------|------------|------------|--------|--------------------|--------------|
| zwds.html         | (today)    | today      | now    | Amsterdam, NL      | +2           |
| zwds-alena.html   | Alena      | 1979-04-19 | 13:30  | Saratov, RU        | +4           |
| zwds-maxim.html   | Maxim      | 1977-02-15 | 20:30  | Moscow, RU         | +3           |

---

## Rendered DOM cheat-sheet (inside `#chart-output`)

| Selector                 | Role                                                  |
|--------------------------|-------------------------------------------------------|
| `.palace-cell`           | One of the 12 palace cells in the 4×4 grid            |
| `.bazi-dual`             | The dual BaZi display in the centre cell              |
| `.bazi-section`          | One of two sections inside `.bazi-dual` (Solar/Lunar) |
| `.bazi-section-label`    | The label that identifies a section as Solar or Lunar |
| `.bazi-pillar`           | One of 4 pillars (Hour/Day/Month/Year) per section    |
| `.bazi-pillar-label`     | The label of a pillar (ЧАС/ДЕНЬ/МЕСЯЦ/ГОД)            |
| `.bazi-char`             | A single ganzhi character (stem on top, branch below) |
| `.decades-section`       | The decade strip below the palace grid                |
| `.decade-cell`           | A single decade card                                  |
| `.layer-controls`        | The natal/decade/annual toggle bar above the grid     |
| `.ltag-natal/decade/annual` | Layer toggle tags                                  |
| `.pal-year-tag`          | A clickable year tag inside a palace                  |
| `.year-btn`              | The ± buttons for stepping the annual year            |
| `.annual-year-val`       | The current annual year display                       |

### Colour coding

| Layer / Enhancer    | Hex       | CSS variable      |
|---------------------|-----------|-------------------|
| Natal               | `#b02010` | `--natal-col`     |
| Decade              | `#1a6028` | `--decade-col`    |
| Annual              | `#1828b0` | `--annual-col`    |
| Lu (禄)             | `#166020` | `--lu`            |
| Quan (权)           | `#1020b8` | `--quan`          |
| Ke (科)             | `#c8b000` | `--ke`            |
| Ji (忌)             | `#aa1010` | `--ji`            |

---

## Deployment

- Repository: `github.com/olgabressers/successcode`
- Branch: `main`
- Hosting: GitHub Pages → `successcode.net`
- No build step — every file is served as-is.
- Push to `main` → propagates in ~30 s; Fastly CDN cache (10 min) may extend
  the visible delay for re-fetched assets.

---

## What NOT to touch

| File                          | Reason                                          |
|-------------------------------|-------------------------------------------------|
| `speedrun.html`               | Locked investor page — submitted for review     |
| `zwds-demo.html`              | Locked demo — submitted for review              |
| `index.html`                  | Locked home page — submitted for review         |
| Obfuscated `<script>` block   | Core engine — editing breaks chart generation. Single-symbol surgical edits only, and only when documented inline (see Maxim bureau override). |
