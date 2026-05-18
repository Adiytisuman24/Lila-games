# LILA BLACK — Player Journey Visualization Tool

> A browser-based replay and heat-map tool for level designers to explore player behavior on game maps.
> Filter by date, map, and match. Scrub a timeline. Toggle bots. Switch between path view, kill zones, and traffic density.

**Live demo:** *(Deploy URL goes here — see [Deployment](#deployment) section below)*

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19 + Vite 8 | Fast dev server, JSX-based UI |
| **Map rendering** | Leaflet.js + react-leaflet | `CRS.Simple` turns game minimaps into zoomable/pannable canvases with heat-layer support |
| **Data pipeline** | Python 3 + PyArrow | Reads `.nakama-0` parquet files, converts coords, groups by match, writes JSON |
| **Server** | Express.js | Serves the built SPA + `/output/` JSON tree + `/minimaps/` images from one Node process |
| **Containerisation** | Docker (node:20-alpine) | One-command deploy to Render, Railway, Fly.io, or any Docker host |

---

## Quick Start

### Prerequisites

- **Node.js 20+** (for frontend & server)
- **Python 3.8+** with `pyarrow` (only needed if re-processing raw data)

### 1. Install & run in dev mode

```bash
# Navigate to project directory
cd Lila-game

# Install root (Express) dependencies
npm install

# Start the Vite dev server (frontend only)
npm run dev
# → http://localhost:5173
```

> The dev server proxies `/output/` and `/minimaps/` from `frontend/public/`, so no separate backend is needed during development.

### 2. Build for production

```bash
# Builds the React app into frontend/dist/
npm run build

# Start the Express server (serves built SPA + data)
npm start
# → http://localhost:10000
```

### 3. Docker (optional)

```bash
docker build -t lila-black .
docker run -p 10000:10000 lila-black
# → http://localhost:10000
```

---

## Environment Variables

**None required.** All data is preprocessed and bundled statically.

If you self-host and want to change the port:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `10000` | Port the Express server listens on |

---

## Data Processing (already done — only needed to reprocess)

The processed data is already in `frontend/public/output/`. To rebuild from raw parquet:

```bash
# Install Python dependencies
pip install pyarrow

# Step 1: Process raw parquet → per-match JSON
python process_data.py

# Step 2: Build match index
python build_index.py

# Step 3: Copy into frontend public dir (Windows)
xcopy /E /I output frontend\public\output

# (macOS/Linux)
cp -r output/* frontend/public/output/
```

---

## Deployment

### Option A — Render (recommended, free tier available)

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your repo
4. Set:
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
   - **Node version:** 20
5. Click **Deploy** — Render will install deps, build the frontend, and start the server

### Option B — Railway / Fly.io (Docker)

Both platforms auto-detect the `Dockerfile`:

```bash
# Railway
railway up

# Fly.io
fly launch
fly deploy
```

### Option C — Vercel (frontend only)

If you only want the UI on Vercel and don't need the `/output/` data served dynamically:

```bash
cd frontend
vercel deploy --prod
```

> You'll need to host the `output/` JSON files on an external CDN (S3, Cloudflare R2, etc.) and update the fetch URLs in `App.jsx`.

---

## Project Structure

```
Lila-game/
├── player_data/                # Original parquet data (read-only source)
│   ├── February_10/            # 437 files (~2.85 MB)
│   ├── February_11/            # 293 files
│   ├── February_12/            # 268 files
│   ├── February_13/            # 166 files
│   ├── February_14/            # 79 files (partial day)
│   └── minimaps/               # AmbroseValley, GrandRift, Lockdown map images
├── output/                     # Processed JSON (checked in, one file per match)
│   ├── index.json              # Match index with metadata
│   └── February_*/             # Match JSON files grouped by date
├── frontend/                   # React application
│   ├── src/
│   │   ├── App.jsx             # Main app: state, filters, playback
│   │   ├── App.css             # Global styles
│   │   ├── components/
│   │   │   ├── MapViewer.jsx   # Leaflet map, paths, markers, heat-maps
│   │   │   ├── FilterPanel.jsx # Date / map / match selectors
│   │   │   ├── TimelineSlider.jsx # Scrub bar
│   │   │   └── Legend.jsx      # Event legend
│   │   └── main.jsx
│   └── public/
│       ├── output/             # Symlinked / copied match JSON
│       └── minimaps/           # Symlinked / copied minimap images
├── process_data.py             # Parquet → JSON pipeline
├── build_index.py              # Builds output/index.json
├── server.js                   # Express server (prod)
├── Dockerfile                  # Docker image definition
├── ARCHITECTURE.md             # Architecture & design decisions
└── INSIGHTS.md                 # Game insights from the data
```

---

## Features

| Feature | Description |
|---|---|
| **Map overlay** | Real minimap images for all 3 maps |
| **Player paths** | Solid colored lines for humans, dotted grey for bots |
| **Event markers** | 💀 Kill (red), 💀 Death (purple), ⚡ Storm kill (magenta), 📦 Loot (gold) |
| **Timeline playback** | Play/pause with 0.25×, 0.5×, 1×, 1.5× speed |
| **Filtering** | By date (Feb 10–14), map, and individual match |
| **Human/Bot toggle** | Show/hide each population independently |
| **Heat-maps** | Kill density, death density, traffic density overlays |
| **Match stats** | Human/bot player counts shown in footer |

---

## Data Notes

- Raw files are Apache Parquet despite the `.nakama-0` extension — any parquet reader works
- `ts` timestamps represent **time within the match**, not wall-clock time
- Bot detection: numeric `user_id` (e.g., `1440`) = bot; UUID = human
- `y` column in parquet is elevation — ignored for 2D mapping (use `x` and `z` only)
- February 14 is a **partial day** (data collection still ongoing)
- See [ARCHITECTURE.md](ARCHITECTURE.md) for coordinate mapping formula
- See [INSIGHTS.md](INSIGHTS.md) for data-backed level design recommendations
