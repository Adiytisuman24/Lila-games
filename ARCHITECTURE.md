# LILA BLACK – Match Viewer: Architecture

> One-page architecture overview for the Player Journey Visualization Tool.

---

## What We Built and Why

A **browser-based replay & heat-map tool** that lets level designers scrub through actual player sessions on a live minimap — filtering by date, map, and match, toggling bots on/off, and switching between path view and kill/death/traffic heat-maps.

### Tech Choices

| Layer | Choice | Why |
|---|---|---|
| **Frontend framework** | React + Vite | Fast HMR during iteration; JSX makes the filter/stats UI easy to reason about |
| **Map rendering** | Leaflet.js + react-leaflet | `CRS.Simple` mode turns any image into a zoomable, pannable canvas — perfect for game minimaps. It has a `heatLayer` plugin that works out of the box. No WebGL required. |
| **Data format** | Pre-processed JSON (one file per match) | Designers want instant loads. Serving parquet to the browser would need a WASM runtime and still be slower. Pre-processing in Python lets us compute pixel coords once, keeping the browser as a pure renderer. |
| **Data pipeline** | Python + PyArrow | PyArrow reads the `.nakama-0` parquet files natively, even without a `.parquet` extension. No pandas dependency needed. |
| **Server** | Express.js | Serves the React SPA, the `/output/` JSON tree, and the `/minimaps/` images through a single Node process. Trivially deployable on Render, Railway, Fly, or Docker. |
| **Deployment** | Render (Docker / Node Web Service) | The processed JSON data lives in the repo, so there is no external database or blob store required. A single container handles everything. |

---

## Data Flow — Parquet Files → Screen

```
player_data/
└──February_10..14/
   └── {user_id}_{match_id}.nakama-0   ← raw parquet, one file per player-session
         │
         ▼
   process_data.py
   ┌──────────────────────────────────────────┐
   │  1. pq.read_table(file)                  │
   │  2. decode event column (bytes → str)    │
   │  3. classify human vs bot (UUID check)   │
   │  4. world (x,z) → pixel (px, py)         │
   │  5. convert ts → match-relative ms       │
   │  6. group all players by match_id        │
   │  7. write output/{day}/{match_id}.json   │
   └──────────────────────────────────────────┘
         │
         ▼
   build_index.py  →  output/index.json
   (match metadata: map, date, player counts)
         │
         ▼  (npm run build)
   frontend/public/output/  ← copied into Vite's public dir
         │
         ▼  Browser
   App.jsx  →  GET /output/index.json       (on mount)
            →  GET /output/{date}/{id}.json  (on match select)
         │
         ▼
   MapViewer.jsx
   ┌─────────────────────────────────────────┐
   │  Leaflet CRS.Simple + ImageOverlay      │
   │  Polylines  (player paths, time-gated)  │
   │  Marker     (kill/death/loot icons)     │
   │  heatLayer  (kill/death/traffic modes)  │
   └─────────────────────────────────────────┘
```

---

## Coordinate Mapping — The Tricky Part

The minimap images are 1024×1024 pixels. World coordinates use a 3-D axis where `y` is elevation — irrelevant for a top-down view. Only `x` (east-west) and `z` (north-south) matter.

### Formula

```
u  = (world_x - origin_x) / scale        # 0..1 across the map width
v  = (world_z - origin_z) / scale        # 0..1 across the map depth

pixel_x = u * 1024
pixel_y = (1 - v) * 1024                 # ← Y is FLIPPED
```

**Why the Y-flip?** Image coordinates have `(0,0)` at the top-left. Game world coordinates have z increasing "upward" visually. Without the flip, north becomes south on the minimap.

### Map Constants (from README spec)

| Map | `scale` | `origin_x` | `origin_z` |
|---|---|---|---|
| AmbroseValley | 900 | −370 | −473 |
| GrandRift | 581 | −290 | −290 |
| Lockdown | 1000 | −500 | −500 |

### Verification

The README provides a worked example:
```
World: x = -301.45, z = -355.55  (AmbroseValley)
u = (-301.45 − (−370)) / 900 = 0.0762  →  pixel_x = 78
v = (-355.55 − (−473)) / 900 = 0.1305  →  pixel_y = (1 − 0.1305) × 1024 = 890
```
Our implementation matches this exactly — validated at import time.

In the frontend, Leaflet's `CRS.Simple` treats `[lat, lng]` as `[y, x]` on screen. So every marker and polyline point is passed as `[pixel_y, pixel_x]` — matching Leaflet's row-major convention without any additional transforms.

---

## Assumptions Made Where Data Was Ambiguous

### 1. Timestamps represent match-relative time, not wall-clock time
Raw `ts` values look like `1970-01-21 11:52:36.501000` (Unix epoch + ~21 days). The date component is meaningless — what matters is the intra-match ordering. We convert to "milliseconds since midnight" (`hour×3600000 + …`), then normalise each match to a 0–100% scale for the timeline slider. This way the playback speed is consistent regardless of absolute match length.

### 2. Human vs. Bot detection by `user_id` format
The README confirms: UUIDs (containing `-`, length >10) are human players; short numeric IDs like `1440` are bots. We apply this check at processing time and bake an `is_bot` boolean into every JSON player object.

### 3. One JSON file = one match (all players combined)
Raw data is one parquet file per player per match. We group by `match_id` during processing so the frontend fetches a single JSON and gets every player's journey — humans and bots — in one round-trip.

### 4. The `.nakama-0` suffix is a server-instance tag, not meaningful data
We strip it when writing output filenames (e.g., `b71aaad8-aa62-4b3a-8534-927d4de18f22.json`) and when fetching from the frontend.

### 5. `y` (elevation) is ignored
The data includes a `y` column (height in the 3D world). For this 2D top-down tool we discard it — a future "elevation profile" view could use it.

---

## Major Tradeoffs

| Decision | We Chose | vs. | Why |
|---|---|---|---|
| **Data format** | Pre-processed JSON served statically | Live parquet query (DuckDB WASM) | Static JSON is instant; WASM adds ~1.5 MB bundle and cold-parse latency |
| **Map library** | Leaflet + `CRS.Simple` | Canvas / WebGL (PixiJS, deck.gl) | Leaflet handles zoom/pan/interactions for free; no GPU required; designers can run it on any machine |
| **Heat-map** | `leaflet.heat` (density gradient) | Grid-cell counts | Gradient is more intuitive for spatial hotspot reading; grid requires tuning cell size |
| **Timeline** | 0–100% normalised slider | Real-time clock (minutes:seconds) | Raw timestamps span only ~300–800 ms per player file (not real game time); normalising makes playback consistent across all matches |
| **Bot display** | Same coordinate system, dotted lines | Separate layer / panel | Keeping bots on the main map lets designers immediately see how bot density affects lane pressure and safe zones |
| **Data volume** | Keep all position events | Downsample to every 2s | We opted to keep all events after testing — downsampling discarded path detail valuable for fine-grained movement analysis |
| **Deployment** | Single Express server (frontend + data) | Separate static host + CDN | Simpler ops for an internal tool; the data directory (~5 MB) fits comfortably in a free Render instance |
