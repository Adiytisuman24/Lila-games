# Lila Games — Engineering Walkthrough

> This document explains the key engineering dimensions of this project: system design, attention to detail, end-to-end execution, product thinking, code quality, and communication. Each section connects general principles to specific decisions made in this codebase.

---

## 1. System Design

### Choosing the Right Architecture for the Problem

Good system design means selecting an architecture that fits the actual constraints rather than defaulting to the most familiar pattern. For this tool, the constraints were clear:

- **Data is static** — five days of captured telemetry with no live DB requirements
- **Users are internal** — level designers, not a mass consumer audience
- **Data volume is bounded** — ~797 matches, ~5 MB of processed JSON total

### The Key Decision: Static JSON Over a Database

The most important architectural choice was **not using a database**.

A conventional approach would have been: stand up a PostgreSQL instance, import all parquet data, expose REST endpoints. Familiar — but entirely wrong here. It would add query latency, require a running server process, introduce secrets management overhead, and make local development depend on a network service.

Instead, the chosen pipeline is:

```
Parquet files  →  Python (offline)  →  JSON files  →  Static HTTP  →  Browser
```

The Python scripts (`process_data.py`, `build_index.py`) run **once** and produce a static directory tree of JSON files. The Express server is essentially a glorified static file server with SPA fallback — it never touches a database.

```
output/
├── index.json              ← Manifest: ~50 KB, loaded once at startup
├── February_10/
│   ├── {match_id}.json     ← Per-match data: ~30–200 KB, loaded on demand
│   └── ...
└── February_14/
    └── ...
```

**Why on-demand fetching matters:** The browser never loads all 797 match files at once. It loads `index.json` once on mount, then fetches a single `{match_id}.json` only when the designer selects that match. Initial page load is instant regardless of total data size.

### Frontend Component Structure

```
App.jsx              ← State owner: filters, match selection, playback, toggles
├── FilterPanel      ← Date / map / match controls (reads index.json metadata)
├── MapViewer        ← Leaflet canvas: paths, markers, heat-maps (reads matchData)
├── TimelineSlider   ← Scrub bar (reads/writes currentTime only)
└── Legend           ← Symbol/gradient key (reads heatmapMode + match stats)
```

`App.jsx` owns all shared state. Child components receive exactly what they need via props. No context API or global store is needed — the data flow is a single downward tree, which makes state easy to trace and the UI entirely predictable.

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
    ├── GET /           → frontend/dist/index.html (SPA entry)
    ├── GET /assets/*   → frontend/dist/assets/    (JS/CSS bundles)
    ├── GET /output/*   → Processed match JSON files
    └── GET /minimaps/* → Minimap images
```

One Node process handles everything. No CDN configuration, no separate API server, no object storage needed at this scale.

---

## 2. Attention to Detail

### The Y-Axis Flip

The formula `pixel_y = (1 - v) * 1024` contains a subtle but critical inversion. Image coordinate systems place `(0,0)` at the top-left. Game world coordinates treat `z` as increasing visually "upward". Without this flip, north becomes south — every player path appears mirrored vertically.

Validated against the spec's worked example:
```
World: x=-301.45, z=-355.55 (AmbroseValley)
Expected pixel: (78, 890)
Result:         (78, 890) ✓
```

### Jitter for Overlapping Markers

When multiple events occur at the same location — for example, 14 bots dying in the same grid cell — stacked icons become an unreadable opaque block. A coordinate-keyed offset map spreads them radially:

```javascript
const offsetMap = new Map()
const key = `${event.py}-${event.px}`
const offset = offsetMap.get(key) || 0
const jitter = offset * 15
offsetMap.set(key, offset + 1)

// Radial scatter using trigonometry
createIcon(emoji, bgColor, size, Math.cos(offset) * jitter, Math.sin(offset) * jitter)
```

Each additional marker at the same coordinate is pushed outward by 15px per occurrence, forming a small radial cluster instead of a solid stack.

### The `.nakama-0` Suffix

Match IDs in the parquet files include a `.nakama-0` server-instance tag. This must be stripped consistently in **both** the Python output pipeline and the frontend fetch URL — a mismatch would silently 404 on certain matches:

```python
# process_data.py
with open(f"output/{day}/{match_id.replace('.nakama-0', '')}.json", "w") as f:
```

```javascript
// App.jsx
fetch(`/output/${match.date}/${match.match_id.replace('.nakama-0', '')}.json`)
```

### Conservative Bot Detection

The UUID check (`"-" in user_id and len(user_id) > 10`) is designed to produce false negatives (a bot shown as human) rather than false positives (a human shown as a bot). Misclassifying a real player as a dashed grey bot path is a worse UX error than the reverse. Two independent signal conditions reduce edge-case misclassification.

### Timeline Normalization Guard

```javascript
const range = maxT - minT || 1   // ← Guards against range=0 for single-event matches
e.normalized_ts = ((e.ts - minT) / range) * 100
```

The `|| 1` prevents `NaN` on degenerate single-event matches that would otherwise produce `0/0`.

### Heatmap Layer Cleanup

Leaflet's `heatLayer` appends itself directly to the map DOM. Without explicit removal on mode change, layers accumulate and the map degrades:

```javascript
useEffect(() => {
  if (heatmapLayerRef.current) {
    mapRef.current.removeLayer(heatmapLayerRef.current)  // Remove old layer first
  }
  // ... then add the new layer
}, [heatmapMode, heatmapData])
```

---

## 3. End-to-End Execution

### The Full Pipeline — No Black Boxes

Every step is reproducible from a fresh clone with no hidden dependencies:

```
Step 1: pip install pyarrow
Step 2: python process_data.py              # Parquet → per-match JSON
Step 3: python build_index.py               # JSON → index.json
Step 4: xcopy output frontend\public\output # Copy data into Vite's public dir
Step 5: cd frontend && npm install && npm run build
Step 6: node server.js                      # Serves everything on :10000
```

No environment secrets, no external API calls, no manual data exports. Any developer can clone and run the full tool in under 10 minutes.

### The Pipeline Is Idempotent

Running `process_data.py` multiple times on the same input produces identical output. No accumulation, no incremental state — the output directory is overwritten cleanly. Re-processing is always safe.

### Error Handling at Both Layers

**Python pipeline** — individual file failures are caught without aborting the batch:
```python
try:
    result = process_file(f)
except Exception as e:
    print(f"Error processing {f}: {e}")
    # continues to next file
```

**Frontend** — network errors surface as visible banners, never silent failures:
```jsx
fetch('/output/index.json')
  .catch(err => setError('Failed to load index'))
```

The `loading` overlay is cleared on both success and failure — the UI never gets stuck in a loading state.

### Docker Encodes Exact Production Steps

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

`docker build && docker run` produces a fully functional app with zero additional steps. The Render deployment uses the same build/start commands, making local Docker testing a faithful reproduction of production.

---

## 4. Product Thinking

### The User Is a Level Designer, Not a Data Analyst

A data analyst wants queryable tables. A level designer wants to **see** what happened on their map — spatially and chronologically. Every major decision flows from this distinction:

- **Leaflet over a data table** — a player path on a minimap communicates more in one second than rows of coordinates
- **Timeline slider over a time picker** — scrubbing is intuitive for replay; entering millisecond timestamps is not
- **Per-match JSON over a flat export** — a designer investigates specific matches, not arbitrary date ranges

### Human/Bot Distinction as a Design Signal

Bots and humans serve different analytical purposes:
- **Human paths**: solid colored lines (`#00FFFF`, `#FFFF00`, `#FF69B4`) — each player distinct so the designer can follow individual journeys
- **Bot paths**: dashed grey (`#666666`) — ambient context, not the focal point

The toggle (`showBots` / `showHumans`) supports three distinct views:
- *Humans only* → understand where real players go
- *Bots only* → understand how AI populates the map
- *Both* → understand how the two populations interact

### Heat-Maps Answer Different Questions Than Paths

| Mode | Design Question Answered |
|---|---|
| Path (default) | What did this specific match look like? |
| Kill heat-map | Which zones generate the most combat? |
| Death heat-map | Which zones are most dangerous or need balance work? |
| Traffic heat-map | Which corridors are most travelled? Which areas are ignored? |

These are genuinely distinct questions that map to distinct design actions.

### Match Selector Shows Useful Context

Match IDs are UUIDs — completely opaque strings. Showing raw UUIDs in a dropdown would be useless. Each option instead shows:

```
b71aaad8... (2h/14b)
```

Truncated ID + human count / bot count. A designer can immediately pick a match with the right composition without loading each one first.

### The Legend Is Contextual

- **Path mode** → shows a symbol key (kill icon, death icon, storm icon, loot icon, path styles)
- **Heat-map mode** → shows a gradient bar (Low → Medium → High) with a text description

A static legend would show irrelevant content in each mode. Contextual display reduces cognitive load for the designer.

---

## 5. Code Quality

### Separation of Concerns: Processing vs. Rendering

The Python pipeline has no knowledge of React. React components have no knowledge of parquet or coordinate formulas. The coordinate transform lives in `process_data.py` exactly once:

```python
def world_to_pixel(x, z, map_id):
    cfg = MAP_CONFIGS[map_id]
    u = (x - cfg["origin_x"]) / cfg["scale"]
    v = (z - cfg["origin_z"]) / cfg["scale"]
    return {"x": int(u * 1024), "y": int((1 - v) * 1024)}
```

The frontend only reads pre-computed `px` and `py` values — one source of truth for the coordinate transform.

### `useMemo` for Expensive Derivations

```javascript
const heatmapData = useMemo(() => {
  // Flat-map all events into kill/death/traffic arrays
}, [matchData, heatmapMode, showBots, showHumans])
```

Runs only when one of those four values actually changes — not on every parent re-render.

### `useCallback` for Stable Function References

```javascript
const loadMatches = useCallback((date, map, idx) => {
  const dateMatches = idx?.dates?.[date] || []
  const filtered = dateMatches.filter(m => m.map_id === map)
  setMatches(filtered)
  if (filtered.length > 0) setSelectedMatch(filtered[0])
}, [])
```

Prevents `useEffect` from re-running on every render due to a new function reference being created each cycle.

### Ref-Based Leaflet Integration

Leaflet's map instance lives outside React's rendering model. The `mapRef` pattern accesses it imperatively only when needed:

```javascript
const mapRef = useRef(null)
const heatmapLayerRef = useRef(null)
<MapContainer ref={mapRef} ...>
```

Storing the map in state would trigger unnecessary re-renders on every map interaction.

### Defensive Null Handling

```jsx
// MapViewer: shows base map while match data loads
if (!matchData) {
  return (
    <MapContainer ...>
      <ImageOverlay url={minimapUrls[mapId]} bounds={bounds} />
    </MapContainer>
  )
}
```

```javascript
// App.jsx: optional chaining before index loads
const dateMatches = idx?.dates?.[date] || []
```

No component ever crashes on missing async data — the UI degrades gracefully.

---

## 6. Communication

### Code That Reads Itself

Variable names carry their full meaning: `heatmapMode`, `showBots`, `showHumans`, `selectedMatch`, `normalized_ts`. No reader of `App.jsx` needs to guess what any state variable represents.

Critical non-obvious logic is annotated inline:
```python
"y": int((1 - v) * 1024)   # Y-flip: image origin is top-left, z increases "up"
```

### Documentation Layering

| File | Audience | Purpose |
|---|---|---|
| `README.md` | Any engineer | How to run, deploy, and understand the project structure |
| `ARCHITECTURE.md` | Technical reviewer | Why design decisions were made |
| `INSIGHTS.md` | Level designers / product | What the data reveals and what to do about it |
| `EXPLANATION.md` | Engineering reviewers | How the project demonstrates engineering quality |

Each document is self-contained. A designer reading `INSIGHTS.md` doesn't need to understand `useMemo`. An engineer reading `ARCHITECTURE.md` doesn't need to read about map rotation balance.

### Communicating Uncertainty Honestly

Known data limitations are documented explicitly:
- Timestamps span only ~300–800 ms per player file (not real game time) — playback is normalized, not real-time
- Position event density is constrained by the raw telemetry sampling rate
- February 14 data represents a partial day only

Documenting what is not known is as important as documenting what is.

### The Tool Speaks for Itself

A level designer opening the application should be able to — without any manual or tutorial:

1. Select AmbroseValley / February 10
2. See a match rendered on the minimap within 2 seconds
3. Scrub the timeline and watch player paths develop
4. Switch to the kill heat-map and immediately identify combat hotspots
5. Toggle bots off to isolate human behavior patterns

The UI labels are unambiguous. The legend explains every symbol. Controls are positioned where designers expect them. That is the highest form of technical communication: a system self-evident to its intended users.

---

*All code references point to the actual implementation in this repository.*
