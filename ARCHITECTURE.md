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

### Structural bureau fix — applied 2026-05-25

**Earlier behavior (bug):** the engine derived the Five-Elements Bureau (五行局, 2/3/4/5/6) from the **year ganzhi's NaYin element**. The canonical Northern-school ZWDS rule uses the **Life-palace (P1) ganzhi's NaYin**. For some charts the two agree (Alena: both give Fire 6); for others they diverge. Charts that diverged got wrong bureau → wrong Zi Wei placement → wrong star layout → wrong decade ages.

| Chart | Year ganzhi → bureau (engine, wrong) | P1 ganzhi → bureau (canonical) |
|---|---|---|
| Maxim 1977-02-15 | 丙辰 → 沙中土 → Earth 5 | 辛卯 → 松柏木 → **Wood 3** |
| Julia 1974-08-06 | 甲寅 → 大溪水 → Water 2 | 己巳 → 大林木 → **Wood 3** |
| Alena 1979-04-19 | 己未 → 天上火 → Fire 6 | 甲戌 → 山頭火 → Fire 6 ✓ |

**The structural fix (calculator.html, 2026-05-25):**

The bureau is now derived AFTER P1 stem is computed via Five Tigers (五虎遁元) rather than directly from the year stem/branch. New order:

1. Lunar date + year stem/branch
2. Hour branch
3. **Life palace (soulBI) + body palace** — computed first
4. **P1 stem** — derived from year stem + soulBI via Five Tigers
5. **Bureau** — `getFiveBureau(p1StemIdx, soulBI)` (was `(ySI, yBI)`)
6. Zi Wei placement (uses bureau)
7. All 14 main stars

See `ZWDS Calculator/calculator.html` lines 882-905.

**Maxim per-page override REMOVED** (no longer needed). The structural fix in the engine now handles all charts correctly. Any future pre-filled chart (Julia, Andrey, anyone) deploys with NO per-page bureau override.

**Build process to redeploy after engine changes:**

```bash
cd "ZWDS Calculator/" && node build.js
# Then run the engine-swap node script (extracts new <script> block from
# calculator.obfuscated.html and replaces in all 5 deployed pages):
#   SuccessCode/zwds.html
#   SuccessCode/zwds-alena.html
#   SuccessCode/zwds-julia.html
#   SuccessCode/zwds-maxim.html
#   SuccessCode/zwds-demo.html
```

**Why this wasn't fixed earlier:** a prior session note claimed the fix would require de-obfuscating the engine. That was incorrect — the un-obfuscated source `calculator.html` was always present in the repo. The fix is 3 reordered lines + 1 new computation, then rebuild + redeploy.

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
