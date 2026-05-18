# Lila Games — System Architecture Overview

> A concise technical reference covering the core design decisions, data flow, coordinate system, and deployment strategy behind the Player Journey Visualization Tool.

---

## What This Project Does and Why

A **browser-based replay and heat-map analytics tool** that allows level designers to scrub through real player sessions overlaid on live minimaps. Users can filter by date, map, and match ID, toggle bot visibility on/off, and switch between player path view and kill/death/traffic heat-map modes.

### Technology Decisions

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend Framework** | React + Vite | Fast hot-module reloading during development; JSX makes the filter/stats UI intuitive and easy to reason about. |
| **Map Rendering** | Leaflet.js + react-leaflet | `CRS.Simple` mode converts any image into a fully zoomable, pannable canvas — perfect for game minimaps. The `leaflet.heat` plugin integrates seamlessly. No WebGL dependency required. |
| **Data Format** | Pre-processed JSON (one file per match) | Designers need instant data loads. Serving raw parquet to the browser would require a WASM runtime and introduce latency. Pre-processing in Python computes pixel coordinates once, keeping the browser as a pure, stateless renderer. |
| **Data Pipeline** | Python + PyArrow | PyArrow reads `.nakama-0` parquet files natively without requiring a `.parquet` extension. No pandas dependency needed, keeping the environment lean. |
| **Server** | Express.js | A single Node process serves the React SPA, the `/output/` JSON tree, and the `/minimaps/` image assets. Trivially deployable on Render, Railway, Fly.io, or any Docker host. |
| **Deployment** | Render / Docker | Processed JSON data lives directly in the repository — no external database or blob storage required. One container handles the full stack. |

---

## Data Flow — From Parquet Files to the Screen

```
player_data/
└── February_10..14/
   └── {user_id}_{match_id}.nakama-0   ← Raw parquet, one file per player session
         │
         ▼
   process_data.py
   ┌──────────────────────────────────────────┐
   │  1. pq.read_table(file)                  │
   │  2. Decode event column (bytes → string) │
   │  3. Classify human vs bot (UUID check)   │
   │  4. Map world (x,z) → pixel (px, py)     │
   │  5. Convert ts → match-relative ms       │
   │  6. Group all players by match_id        │
   │  7. Write output/{day}/{match_id}.json   │
   └──────────────────────────────────────────┘
         │
         ▼
   build_index.py  →  output/index.json
   (Match metadata: map, date, player counts)
         │
         ▼  (npm run build)
   frontend/public/output/  ← Data copied into Vite's public directory
         │
         ▼  Browser
   App.jsx  →  GET /output/index.json         (on initial mount)
            →  GET /output/{date}/{id}.json   (on match selection)
         │
         ▼
   MapViewer.jsx
   ┌─────────────────────────────────────────┐
   │  Leaflet CRS.Simple + ImageOverlay      │
   │  Polylines  (player paths, time-gated)  │
   │  Markers    (kill/death/loot icons)     │
   │  heatLayer  (kill/death/traffic modes)  │
   └─────────────────────────────────────────┘
```

---

## Coordinate Mapping — Converting Game Space to Screen Space

The minimap images are **1024×1024 pixels**. Game world coordinates use a 3D axis where `y` represents elevation — irrelevant for this top-down tool. Only `x` (east-west) and `z` (north-south) are used.

### The Formula

```
u  = (world_x - origin_x) / scale       # Normalized 0..1 across map width
v  = (world_z - origin_z) / scale       # Normalized 0..1 across map depth

pixel_x = u * 1024
pixel_y = (1 - v) * 1024               # ← Y-axis is FLIPPED
```

**Why the Y-flip?** Image coordinates place `(0,0)` at the top-left corner. Game world coordinates have `z` increasing visually "upward". Without this inversion, north becomes south on the rendered minimap.

### Map Configuration Constants

| Map | `scale` | `origin_x` | `origin_z` |
|---|---|---|---|
| AmbroseValley | 900 | −370 | −473 |
| GrandRift | 581 | −290 | −290 |
| Lockdown | 1000 | −500 | −500 |

### Worked Verification Example

```
World coords:  x = -301.45,  z = -355.55  (AmbroseValley)
u = (-301.45 − (−370)) / 900 = 0.0762  →  pixel_x = 78
v = (-355.55 − (−473)) / 900 = 0.1305  →  pixel_y = (1 − 0.1305) × 1024 = 890
Result: (78, 890) ✓
```

In the frontend, Leaflet's `CRS.Simple` treats `[lat, lng]` as `[y, x]` on screen. Every marker and polyline point is therefore passed as `[pixel_y, pixel_x]` — aligned with Leaflet's row-major coordinate convention.

---

## Design Assumptions (Where Data Was Ambiguous)

### 1. Timestamps Are Match-Relative, Not Wall-Clock
Raw `ts` values resemble `1970-01-21 11:52:36.501` (Unix epoch + ~21 days). The date portion is meaningless — only intra-match ordering matters. Values are converted to "milliseconds since midnight" and then normalized per-match to a 0–100% scale for the timeline slider, ensuring consistent playback speed across all matches regardless of absolute duration.

### 2. Human vs. Bot Detection via `user_id` Format
UUIDs (containing `-`, length > 10) are human players. Short numeric IDs like `1440` are bots. This classification is applied at processing time and baked in as an `is_bot` boolean on every JSON player object.

### 3. One JSON File = One Complete Match
Raw data is one parquet file per player, per match. All player files sharing the same `match_id` are merged during processing. The browser fetches a single JSON and receives every player's complete journey — both humans and bots — in one round-trip.

### 4. The `.nakama-0` Suffix Is a Server Tag, Not Meaningful Data
This suffix is stripped when writing output filenames and when constructing fetch URLs in the frontend. Inconsistency here would silently produce 404 errors for certain matches.

### 5. Elevation (`y`) Is Ignored
The `y` column records 3D world height. It is discarded for this 2D top-down view. A future "elevation profile" mode could leverage this column.

---

## Key Tradeoffs

| Decision | Chosen Approach | Alternative Considered | Reasoning |
|---|---|---|---|
| **Data format** | Pre-processed static JSON | Live parquet query via DuckDB WASM | Static JSON loads instantly; WASM adds ~1.5 MB bundle size and cold-parse latency |
| **Map library** | Leaflet + `CRS.Simple` | Canvas / WebGL (PixiJS, deck.gl) | Leaflet provides zoom, pan, and interaction for free; no GPU required; runs on any machine |
| **Heat-map** | `leaflet.heat` density gradient | Grid-cell count visualization | Gradients are more intuitive for spatial hotspot reading; grid requires manual cell-size tuning |
| **Timeline** | 0–100% normalized slider | Real-time clock display (mm:ss) | Raw timestamps span only ~300–800 ms per player file (not real game time); normalizing ensures consistent playback across all matches |
| **Bot display** | Same canvas, dashed grey lines | Separate layer or side panel | Keeping bots on the main map lets designers immediately see how bot density influences lane pressure and safe zones |
| **Data density** | All position events retained | Downsampled to every 2 seconds | Downsampling discarded path detail valuable for fine-grained movement analysis |
| **Deployment** | Single Express server (SPA + data) | Separate static host + CDN | Simpler operations for an internal tool; the data directory (~5 MB) fits comfortably on a free Render instance |
