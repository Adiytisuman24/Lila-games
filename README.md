# Lila Games — Game Data & Analytics Visualizer

> An interactive, browser-based analytics dashboard and heat-map visualization tool. Designed specifically for level designers and game developers to monitor, explore, and analyze player behavior across various game maps.
> Filter sessions by date, map, and specific match IDs. Play back events on a dynamic timeline. Toggle between human and bot data, and visualize player paths, kill zones, and high-traffic areas via heat-maps.

**Live Demo:** [https://lila-games-1.onrender.com](https://lila-games-1.onrender.com)

---

## 🛠️ Technology Stack

| Component | Tech Used | Description |
|---|---|---|
| **Frontend** | React 19 + Vite 8 | Fast, modern development server with a JSX-driven user interface. |
| **Mapping Engine** | Leaflet.js + react-leaflet | Uses `CRS.Simple` to transform static 2D minimaps into fully zoomable/pannable canvases, complete with heatmap layers. |
| **Data Processing** | Python 3 + PyArrow | Parses `.nakama-0` parquet logs, normalizes coordinates, organizes data by match, and outputs structured JSON. |
| **Backend API** | Express.js | A lightweight server that serves the production SPA, the generated JSON data tree (`/output/`), and minimap assets (`/minimaps/`). |
| **Deployment** | Docker (node:20-alpine) | Containerized for seamless, one-command deployments across platforms like Render, Railway, and Fly.io. |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 20+** (Required for the frontend application and backend server)
- **Python 3.8+** with `pyarrow` (Only required if you plan on reprocessing the raw parquet data)

### 1. Local Development Mode

```bash
# Clone and enter the repository
cd Lila-game

# Install the backend server dependencies
npm install

# Start the Vite development server (frontend)
npm run dev
# → Application available at: http://localhost:5173
```

> **Note:** The Vite dev server automatically proxies requests for `/output/` and `/minimaps/` from `frontend/public/`, meaning you don't need to run the Express backend separately during UI development.

### 2. Production Build

```bash
# Compile the React application into frontend/dist/
npm run build

# Start the production Express server (serves the SPA and data)
npm start
# → Application available at: http://localhost:10000
```

### 3. Docker Deployment (Optional)

```bash
# Build the Docker image
docker build -t lila-black .

# Run the container
docker run -p 10000:10000 lila-black
# → Application available at: http://localhost:10000
```

---

## ⚙️ Environment Configuration

**No strict environment variables are required.** The application uses preprocessed static data bundles.

If you choose to self-host and wish to modify the default port, you can use:

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `10000` | The port the Express.js server will bind to. |

---

## 📊 Data Pipeline (Optional)

The raw telemetry data has already been processed and placed inside `frontend/public/output/`. If you need to recompile the data from raw `.nakama-0` parquet files, follow these steps:

```bash
# Install the necessary Python packages
pip install pyarrow

# Step 1: Parse the raw parquet files and generate per-match JSON data
python process_data.py

# Step 2: Construct the global match index
python build_index.py

# Step 3 (Windows): Move the output to the frontend directory
xcopy /E /I output frontend\public\output

# Step 3 (macOS/Linux): Move the output to the frontend directory
cp -r output/* frontend/public/output/
```

---

## 🌐 Deployment Guide

### Option A: Render (Recommended — Free Tier)

1. Navigate to [Render](https://render.com) and click **New → Web Service**.
2. Link your GitHub repository.
3. Configure the following settings:
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
   - **Node version:** `20`
4. Click **Deploy**. Render will handle the dependencies, build the React app, and launch the server.

### Option B: Railway / Fly.io (Docker-based)

Both of these platforms will automatically detect the provided `Dockerfile`:

```bash
# For Railway
railway up

# For Fly.io
fly launch
fly deploy
```

### Option C: Vercel (Frontend Only)

If you strictly want to host the user interface on Vercel and handle data elsewhere:

```bash
cd frontend
vercel deploy --prod
```

> **Warning:** You will need to host your `output/` JSON folder on a CDN (like AWS S3 or Cloudflare R2) and update the fetch paths in `App.jsx`.

---

## 📂 Project Architecture

```text
Lila-game/
├── player_data/                # Raw telemetry data in Parquet format (Read-only)
│   ├── February_10/            # 437 files (~2.85 MB)
│   ├── February_11/            # 293 files
│   ├── February_12/            # 268 files
│   ├── February_13/            # 166 files
│   ├── February_14/            # 79 files (Incomplete dataset)
│   └── minimaps/               # Source images for AmbroseValley, GrandRift, and Lockdown
├── output/                     # Compiled JSON telemetry (Checked in, organized by match)
│   ├── index.json              # Global index and metadata for all matches
│   └── February_*/             # Daily match data folders
├── frontend/                   # Main React SPA
│   ├── src/
│   │   ├── App.jsx             # Core application logic, filters, and timeline state
│   │   ├── App.css             # Root stylesheet
│   │   ├── components/
│   │   │   ├── MapViewer.jsx   # Leaflet map instance, pathing, and heat-map layers
│   │   │   ├── FilterPanel.jsx # Dropdowns for Date, Map, and Match selection
│   │   │   ├── TimelineSlider.jsx # Interactive playback scrubber
│   │   │   └── Legend.jsx      # Visual key for map markers
│   │   └── main.jsx
│   └── public/
│       ├── output/             # Link/Copy of the processed JSON
│       └── minimaps/           # Link/Copy of the minimap images
├── process_data.py             # Python script: Parquet → JSON conversion
├── build_index.py              # Python script: Generates output/index.json
├── server.js                   # Node.js/Express production server
├── Dockerfile                  # Instructions for containerization
├── ARCHITECTURE.md             # In-depth architectural decisions
└── INSIGHTS.md                 # Level design insights derived from the dataset
```

---

## 🎨 Features & Color Codes

| Feature | Description | Color Code / Hex |
|---|---|---|
| **Map Base Overlays** | High-fidelity minimap images for all 3 supported levels. | N/A |
| **Human Player Paths** | Solid colored traversal lines. | <span style="color:#007BFF;font-weight:bold;">#007BFF (Blue)</span> |
| **Bot Player Paths** | Dotted lines indicating AI movement. | <span style="color:#6C757D;font-weight:bold;">#6C757D (Grey)</span> |
| **Kill Events** | 💀 Marks locations of successful eliminations. | <span style="color:#FF0000;font-weight:bold;">#FF0000 (Red)</span> |
| **Death Events** | 💀 Marks locations where a player died. | <span style="color:#800080;font-weight:bold;">#800080 (Purple)</span> |
| **Storm Kills** | ⚡ Eliminations caused by the map's storm mechanic. | <span style="color:#FF00FF;font-weight:bold;">#FF00FF (Magenta)</span> |
| **Loot Events** | 📦 Interaction locations with loot boxes. | <span style="color:#FFD700;font-weight:bold;">#FFD700 (Gold)</span> |
| **Heat-maps** | Aggregated visual density of kills, deaths, and general foot traffic. | Thermal Gradient |

---

## 📝 Important Notes

- **File Formats:** Despite the `.nakama-0` file extension, the raw telemetry logs are standard **Apache Parquet** files and can be read by any compliant parquet parser.
- **Timestamps:** The `ts` field represents relative **time elapsed within the match**, not absolute real-world time.
- **Entity Identification:** Bots are assigned numeric `user_id`s (e.g., `1440`), whereas Human players are assigned standard UUID strings.
- **Elevation Data:** The `y` column represents elevation but is currently ignored for the 2D mapping visualizations. (Only `x` and `z` are rendered).
- **Data Completeness:** The data for February 14th represents a **partial day**.
- **Coordinate Math:** For detailed information on how game coordinates translate to map pixels, refer to the [ARCHITECTURE.md](ARCHITECTURE.md) document.
- **Design Takeaways:** Review the [INSIGHTS.md](INSIGHTS.md) document for data-driven recommendations on map flow and chokepoints.
