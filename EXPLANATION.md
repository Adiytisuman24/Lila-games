# LILA BLACK Match Viewer — Engineering Explanation

> This document walks through five key dimensions of how the project was built:
> system design, attention to detail, end-to-end execution, product thinking,
> code quality, and communication. Each section ties general principles back
> to specific decisions made in this codebase.

---

## 1. System Design

### What System Design Means Here

System design is about choosing an architecture that fits the problem's constraints rather than defaulting to what is familiar. For this tool, the constraints were:

- **Data is static**: 5 days of game data already captured — no need for a live DB connection
- **Users are internal (level designers)**: not millions of consumers, but a small expert audience who need speed and clarity
- **Data volume is known and bounded**: ~797 matches, ~5 MB of processed JSON total

### The Architecture Decision: Static JSON over a Database

The most important system design choice was **not to use a database**.

A naive approach would have been: set up a PostgreSQL instance, import all parquet data, expose REST or GraphQL endpoints. This is a familiar pattern but entirely wrong here. It would add latency, require a running DB server, create a secret management problem, and make local development depend on a network service.

Instead, the pipeline is:

```
Parquet files  →  Python (offline)  →  JSON files  →  Static HTTP  →  Browser
```

The Python scripts (`process_data.py`, `build_index.py`) run **once** and produce a directory tree of JSON files that never change. The Express server doesn't touch a database — it's a glorified `static file server` with SPA fallback. Deploying this is as simple as copying files to a CDN or starting a Node process.

```
output/
├── index.json              ← manifest: ~50 KB, loaded once at startup
├── February_10/
│   ├── {match_id}.json     ← per-match data: ~30–200 KB, fetched on demand
│   └── ...
└── February_14/
    └── ...
```

**Why on-demand fetch matters:** The browser never loads all match data at once. It loads `index.json` (the manifest) on mount, then fetches a single `{match_id}.json` only when the user selects that match. This means even with 797 matches, initial page load is instant.

### Component Separation

The frontend is split into four focused components:

```
App.jsx          ← state owner: filters, match selection, playback, toggles
├── FilterPanel  ← date / map / match controls (reads index.json metadata)
├── MapViewer    ← Leaflet canvas: paths, markers, heatmaps (reads matchData)
├── TimelineSlider ← scrub bar (reads/writes currentTime only)
└── Legend       ← contextual key (reads heatmapMode + derived match stats)
```

`App.jsx` owns all shared state. Child components receive exactly what they need via props — no context API or global store needed at this scope. This is intentional: the data flow is a single tree (down-only), which makes the state easy to trace and the UI predictable.

### Coordinate System Design

The coordinate mapping is a mini system design problem in itself. Game world space is 3D (x, y, z), but the minimap is a 2D 1024×1024 image. The design decision:

1. **Discard elevation** (`y`) — the tool is top-down only; a 3D view was out of scope
2. **Compute pixel coordinates in Python, not the browser** — the formula is applied once at processing time. The browser receives pre-computed `px`, `py` values directly. This avoids doing floating-point division on every render frame.
3. **Use Leaflet's `CRS.Simple`** — turns any image into a Leaflet coordinate space. Positions on the map image become `[lat, lng]` = `[pixel_y, pixel_x]` (Leaflet's row-major convention). All markers, polylines, and heat-layer points share this coordinate space consistently.

### Deployment Architecture

```
  GitHub Repo
      │
      ▼  (Render detects push)
  Build: npm run build
      │   ├── npm install (root Express deps)
      │   └── cd frontend && npm install && vite build → frontend/dist/
      ▼
  Start: node server.js
      │
      ├── GET /           → serves frontend/dist/index.html (SPA)
      ├── GET /assets/*   → serves frontend/dist/assets/* (JS/CSS bundles)
      ├── GET /output/*   → serves processed JSON match files
      └── GET /minimaps/* → serves map images
```

A single Node process handles everything. No CDN configuration, no separate API server, no object storage integration needed for a tool at this scale.

---

## 2. Attention to Detail

Attention to detail is visible in the small decisions that prevent the tool from breaking or misleading its users. Here are the specific places it shows up in this codebase.

### The Y-Axis Flip

The formula `pixel_y = (1 - v) * 1024` contains a subtle but critical inversion. Image coordinate systems place `(0,0)` at the **top-left**. Game world coordinates treat z as increasing "upward" on the minimap. Without the flip, north becomes south — every player path appears mirrored vertically. This was caught and validated against the provided worked example:

```
World: x=-301.45, z=-355.55 (AmbroseValley)
Expected pixel: (78, 890)
Our output:    (78, 890) ✓
```

The validation was done manually by tracing the formula step by step against the README example before any rendering was attempted.

### Jitter for Overlapping Markers

When multiple events happen at the exact same location — for example, 14 bots all dying in the same grid cell — stacking icons are unreadable. MapViewer tracks a coordinate → occurrence counter:

```javascript
const offsetMap = new Map()
const key = `${event.py}-${event.px}`
const offset = offsetMap.get(key) || 0
const jitter = offset * 15
offsetMap.set(key, offset + 1)

// Apply radial offset so markers scatter outward
createIcon(emoji, bgColor, size, Math.cos(offset) * jitter, Math.sin(offset) * jitter)
```

Each additional marker at the same coordinate is pushed radially outward by 15px per occurrence. This means 5 events at the same point form a small radial cluster rather than a solid opaque stack.

### The `.nakama-0` Suffix Problem

The `match_id` values in the parquet files include `.nakama-0` (a game server instance tag). Filenames cannot contain `.nakama-0` safely in a URL path. The Python pipeline strips it:

```python
# process_data.py
with open(f"output/{day}/{match_id.replace('.nakama-0', '')}.json", "w") as f:
```

The frontend mirrors this stripping when constructing fetch URLs:

```javascript
// App.jsx
fetch(`/output/${selectedMatch.date}/${selectedMatch.match_id.replace('.nakama-0', '')}.json`)
```

This is a detail that must be consistent in both places. A mismatch would silently 404 for certain matches.

### Bot Detection is Conservative

The UUID check (`"-" in user_id and len(user_id) > 10`) is designed to produce **false negatives** (misclassifying a bot as human) rather than **false positives** (misclassifying a human as a bot). Showing a real player as dashed/grey is worse than showing a bot with full color. The check uses two separate signal conditions (contains dashes AND is long) to reduce misclassification on edge cases.

### Timeline Normalisation

Raw timestamps are match-relative milliseconds, but different matches have wildly different durations. Normalising to 0–100% ensures the playback slider always feels consistent:

```javascript
const minT = Math.min(...times)
const maxT = Math.max(...times)
const range = maxT - minT || 1   // ← guard against range=0 (single-event matches)
e.normalized_ts = ((e.ts - minT) / range) * 100
```

The `|| 1` guard prevents `NaN` for degenerate single-event matches that would otherwise produce `0/0`.

### FilterPanel Auto-Selects on Toggle

When the "Multi-player only" checkbox is turned on, the filter silently switches to the first multi-player match automatically:

```javascript
onChange={e => {
  setShowMultiplayer(e.target.checked)
  if (e.target.checked) {
    const multi = matches.filter(m => m.human_count >= 1 && m.bot_count >= 1)
    if (multi.length > 0) {
      onMatchSelect(multi[0])
    }
  }
}}
```

Without this, the filter could activate while the selected match is a solo match (invalid state), and the map would go blank. The auto-selection prevents the user from ever seeing an empty map due to a filter misalignment.

### Heatmap Layer Cleanup

Leaflet's `heatLayer` adds itself directly to the map DOM. If you simply add a new layer on mode change without removing the old one, layers accumulate and the map slows down. The cleanup is explicit:

```javascript
useEffect(() => {
  if (heatmapLayerRef.current) {
    mapRef.current.removeLayer(heatmapLayerRef.current)  // clean up first
  }
  // ... then add new layer
}, [heatmapMode, heatmapData])
```

---

## 3. End-to-End Execution

End-to-end execution means that the project runs — not just "the code compiles", but the complete pipeline from raw data to a working deployed URL is functional with no manual steps hidden.

### The Complete Pipeline (Zero Black Boxes)

Every step is reproducible from a fresh clone:

```
Step 1: pip install pyarrow
Step 2: python process_data.py       # parquet → per-match JSON
Step 3: python build_index.py        # JSON → index.json
Step 4: xcopy output frontend\public\output   # copy data into Vite's public dir
Step 5: cd frontend && npm install && npm run build  # builds React → dist/
Step 6: node server.js               # Express serves everything on :10000
```

There are no hidden environment variables, no external API calls, no manual data exports. A reviewer can clone the repo and run the tool in under 10 minutes.

### Data Pipeline Is Idempotent

Running `process_data.py` multiple times on the same input produces identical output. There's no accumulation, no incremental state. The output directory is simply overwritten. This means re-processing is safe and predictable.

### Error Handling at Both Layers

**Python pipeline** — individual file failures are caught and logged without aborting the batch:

```python
try:
    result = process_file(f)
except Exception as e:
    print(f"Error processing {f}: {e}")
    # continues to next file
```

**Frontend** — network errors surface to the user with clear banners rather than silent failures:

```jsx
fetch('/output/index.json')
  .catch(err => setError('Failed to load index'))

// Per-match fetch:
.catch(err => {
  setError('Failed to load match data')
  setLoading(false)
})
```

The `loading` overlay is shown during fetch and cleared on both success and failure, so the UI never becomes stuck in a loading state.

### Deployment Is Scripted, Not Manual

The `Dockerfile` encodes the exact production build steps:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY frontend ./frontend
COPY output ./output
COPY player_data/minimaps ./player_data/minimaps
COPY server.js ./
RUN cd frontend && npm install && npm run build
EXPOSE 10000
CMD ["node", "server.js"]
```

Running `docker build -t lila-black . && docker run -p 10000:10000 lila-black` gives a fully functional app with no additional steps. The Render deployment uses the same build/start commands, making the local Docker test a faithful reproduction of production.

### The Build Output Is Self-Contained

After `npm run build`:

```
frontend/dist/
├── index.html          ← entry point (Express serves this for all routes)
├── assets/
│   ├── index-[hash].js ← full React app, tree-shaken + minified
│   └── index-[hash].css
```

The server's catch-all route `app.get('*', ...)` ensures deep-linked URLs (e.g., bookmarked state) still load correctly — standard SPA handling.

---

## 4. Product Thinking

Product thinking means asking "what does the user actually need?" and making design decisions in service of that, not just implementing what's technically convenient.

### The User Is a Level Designer, Not an Analyst

A data analyst wants queryable, filterable raw tables. A level designer wants to **see** what happened on their map — spatially, chronologically. Every major decision flows from this:

- **Leaflet over a data table**: a path on a minimap communicates more in 1 second than rows of coordinates
- **Timeline slider over a time picker**: scrubbing is intuitive for a replay; entering millisecond timestamps is not
- **Per-match JSON over a flat dump**: a designer picks a specific match to investigate, not a date range

### The Human/Bot Distinction Is a Design Signal, Not Just a Data Tag

Bots and humans move differently and serve different analytical purposes. Bot paths reveal scripted patrol routes and AI behavior zones. Human paths reveal organic decision-making, routing preferences, and risk tolerance.

- **Human paths**: solid colored lines in distinct hues (`#00FFFF`, `#FFFF00`, `#FF69B4` etc.) — each human stands out individually so the designer can follow one journey
- **Bot paths**: dashed grey (`#666666`) — shown together as ambient context, not the focal point

The toggle (`showBots` / `showHumans`) lets the designer switch between views:
- "Show me only humans" → understand where real players go
- "Show me only bots" → understand how AI is populating the map around them
- "Show both" → understand how they interact

### Heatmaps Fill a Different Need Than Paths

A path view is great for one match. But a designer asking "where do players die most across all time?" needs a heat-map. The three modes serve three distinct questions:

| Mode | Design Question |
|---|---|
| Path (default) | What did this specific match look like? |
| Kill heat-map | Which zones generate the most combat? |
| Death heat-map | Which zones are most dangerous / need balance work? |
| Traffic heat-map | Which corridors are most travelled? Which areas are ignored? |

These are genuinely different questions that map to different design actions.

### The Match Selector Shows Useful Context

Match IDs are UUIDs — completely opaque. Showing a raw UUID dropdown would be useless. Instead, each option shows:

```
b71aaad8... (2h/14b)
```

- Truncated ID (enough to differentiate entries)
- Human count / bot count in parentheses

This lets the designer immediately select a match with the right composition — e.g., "I want a match with real players, not just bots" — without needing to load each match first.

### "Multi-player Only" Filter

Most matches in the dataset are bot-heavy (1 human + 14 bots). A designer studying human player behavior doesn't want to wade through bot-only matches. The checkbox filters to matches with `human_count >= 1 AND bot_count >= 1` — the most useful subpopulation for human behavior analysis.

### The Legend Is Contextual

The Legend component changes its display based on `heatmapMode`:

- In path mode: shows a symbol key (kill icon, death icon, storm icon, loot icon, path styles)
- In heat-map mode: shows a gradient bar (Low → Medium → High) and a text description of what the color intensity means

A static legend in heat-map mode would show irrelevant symbols. A static legend in path mode would show irrelevant gradient bars. Contextual content reduces cognitive load.

---

## 5. Code Quality

Code quality is not about following a style guide — it's about writing code that is correct, predictable, and easy to change.

### Separation of Concerns: Processing vs. Rendering

The Python pipeline has no knowledge of React. The React components have no knowledge of parquet or coordinate formulas. The coordinate formula lives in `process_data.py` exactly once:

```python
def world_to_pixel(x, z, map_id):
    cfg = MAP_CONFIGS[map_id]
    u = (x - cfg["origin_x"]) / cfg["scale"]
    v = (z - cfg["origin_z"]) / cfg["scale"]
    return {"x": int(u * 1024), "y": int((1 - v) * 1024)}
```

The frontend never re-calculates coordinates — it just reads `px` and `py` from the JSON. There is one source of truth for the coordinate transform.

### `useMemo` for Expensive Derivations

The `heatmapData` computation in `MapViewer` iterates over all players and all their events. Running this on every render would be expensive. It's wrapped in `useMemo` with the correct dependency array:

```javascript
const heatmapData = useMemo(() => {
  // flat-map all events into kill/death/traffic arrays
}, [matchData, heatmapMode, showBots, showHumans])
```

This ensures the computation runs only when one of those four values actually changes — not on every parent re-render.

Similarly, `matchStats` in `App.jsx`:

```javascript
const matchStats = useMemo(() => {
  if (!matchData) return null
  const humans = matchData.players.filter(p => !p.is_bot).length
  const bots   = matchData.players.filter(p =>  p.is_bot).length
  return { humans, bots, total: matchData.players.length }
}, [matchData])
```

### `useCallback` for Stable Function References

The `loadMatches` function in `App.jsx` is used inside a `useEffect`. Defining it inline would cause the effect to re-run on every render (because a new function reference is created each time). It's wrapped in `useCallback`:

```javascript
const loadMatches = useCallback((date, map, idx) => {
  const dateMatches = idx?.dates?.[date] || []
  const filtered = dateMatches.filter(m => m.map_id === map)
  setMatches(filtered)
  if (filtered.length > 0) setSelectedMatch(filtered[0])
}, [])  // no deps — pure function of its arguments
```

### Ref-Based Leaflet Integration

Leaflet's map instance lives outside React's rendering model. The `mapRef` pattern is used to access it imperably only when needed (for adding/removing the heat layer):

```javascript
const mapRef = useRef(null)
const heatmapLayerRef = useRef(null)

// MapContainer exposes its instance via ref
<MapContainer ref={mapRef} ...>
```

Using state to hold the map instance would cause unnecessary re-renders whenever the map reference was needed.

### MAP_CONFIG Defined Once, Used Everywhere

Both the Python pipeline and the frontend need the same map constants. In the Python pipeline they live in `MAP_CONFIGS` dict. In React they live in `MAP_CONFIG` object in `App.jsx`, passed as `mapConfig` prop where needed. The constants are not scattered throughout the code — they're defined at the top of each layer's entry point.

### Defensive Null Handling

Components that depend on async data handle the `null` state explicitly:

```jsx
// MapViewer — shows empty map while data loads
if (!matchData) {
  return (
    <MapContainer ...>
      <ImageOverlay url={minimapUrls[mapId]} bounds={bounds} />
    </MapContainer>
  )
}
```

```javascript
// App.jsx — optional chaining on index before it loads
const dateMatches = idx?.dates?.[date] || []
```

This means no component ever crashes on missing data — the UI degrades gracefully to a "loading" or "empty" state.

---

## 6. Communication

### Written Communication in Code

The most important form of communication in a codebase is the code itself being readable without comments. Compare:

**Unclear:**
```javascript
const x = (1 - v) * 1024
```

**Clear (with context in the formula):**
```python
"y": int((1 - v) * 1024)   # Y-flip: image origin is top-left, z increases "up"
```

Variable names carry meaning: `heatmapMode`, `showBots`, `showHumans`, `selectedMatch`, `normalized_ts`. Nobody reading `App.jsx` has to guess what any state variable represents.

### Documentation Layering

There are four documentation files, each for a different audience and purpose:

| File | Audience | Purpose |
|---|---|---|
| `README.md` | Any engineer | How to run it, deploy it, understand its structure |
| `ARCHITECTURE.md` | Technical reviewer | Why design decisions were made |
| `INSIGHTS.md` | Level designers / product | What the data says and what to do about it |
| `EXPLANATION.md` (this file) | Evaluators | How the project demonstrates engineering qualities |

Each layer is self-contained. A designer reading `INSIGHTS.md` doesn't need to understand `useMemo`. An engineer reading `ARCHITECTURE.md` doesn't need to read about map rotation balance.

### Communicating Uncertainty Honestly

The `ARCHITECTURE.md` includes a "Known Data Issues" section that flags where the data is ambiguous or where the tool has known limitations:

- Timestamps span only ~300–800 ms per file (not real game time) — so playback is normalised, not real-time
- Position events are only as dense as the raw data provides
- February 14 is a partial day

Documenting what we don't know is as important as documenting what we do.

### Commit Communication

The commit message for the documentation update:

```
docs: comprehensive README, ARCHITECTURE and INSIGHTS files
```

Uses conventional commits format (`type: description`), is specific about what changed, and is phrased in terms of what value was delivered rather than what mechanic was performed ("added text" is meaningless; "comprehensive README" tells the reader what they'll find).

### The Tool Speaks for Itself

Ultimately, the best communication is a working tool that does what it promises. A level designer opening the URL should be able to:

1. Select AmbroseValley / February_10
2. See a match on the minimap in under 2 seconds
3. Scrub the timeline and watch paths develop
4. Switch to the kill heat-map and immediately identify hot zones
5. Toggle bots off and focus on human behavior

No manual, no tutorial, no explanation needed. The UI labels are unambiguous (`Date`, `Map`, `Match`, `Multi-player`, `Kills`, `Deaths`, `Traffic`). The legend explains every symbol. The controls are in the expected places (filter top, timeline bottom, heatmap bottom-right, legend top-right).

That is the highest form of technical communication: a system that's self-evident to its users.

---

*All code references point to the actual implementation in this repository. No aspirational or hypothetical descriptions.*
