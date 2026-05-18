# Lila Games — Deployment Guide

> Step-by-step instructions to deploy the Player Journey Visualization Tool to your preferred hosting platform.

---

## Prerequisites — Build the App First

Before deploying, make sure the React frontend is compiled:

```bash
npm run build
# Outputs the production bundle to: frontend/dist/
```

---

## Option 1: Render (Recommended — Free Tier Available)

Render provides the simplest deployment experience and is the recommended hosting platform for this project.

### Files Included for Deployment

| Path | Contents |
|---|---|
| `server.js` | Express server that serves the frontend SPA and all data |
| `output/` | 797 pre-processed match JSON files |
| `player_data/minimaps/` | Minimap images for all three game maps |
| `frontend/dist/` | Compiled React production bundle |

### Steps to Deploy on Render

1. Push your repository to GitHub (or GitLab).
2. Navigate to [render.com](https://render.com) → **New → Web Service**.
3. Connect your GitHub repository.
4. Configure the service settings:
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Node Version:** `20`
5. Click **Deploy**. Render will install dependencies, build the frontend, and launch the Express server automatically.

---

## Option 2: Docker (Single Container)

The project includes a `Dockerfile` for containerized deployments. This approach works on any Docker-compatible platform including Railway, Fly.io, and self-hosted servers.

### Build and Run Locally

```bash
# Build the Docker image
docker build -t lila-games .

# Start the container and bind to port 3000
docker run -p 3000:3000 lila-games
# → Application available at: http://localhost:3000
```

### Deploy to a Container Registry

```bash
# Tag and push to Docker Hub (replace with your username)
docker tag lila-games yourusername/lila-games:latest
docker push yourusername/lila-games:latest
```

Once pushed, you can deploy to **Render**, **Railway**, or **Fly.io** by pointing their Docker deployment to your registry image.

---

## Option 3: Vercel (Frontend Only)

If you only need to host the user interface on Vercel and plan to serve data separately:

```bash
cd frontend
vercel deploy --prod
```

> **Important:** With this approach, the `output/` JSON data files must be hosted separately on an external storage service (e.g., AWS S3 or Cloudflare R2). You will also need to update the data fetch URLs inside `frontend/src/App.jsx` to point to your CDN endpoint.

---

## Server Directory Structure

When the Express server is running, it maps the following URL paths:

```
URL Path        →  Directory Served
/               →  frontend/dist/index.html  (React SPA)
/assets/*       →  frontend/dist/assets/     (JS & CSS bundles)
/output/*       →  output/                   (Match JSON files)
/minimaps/*     →  player_data/minimaps/     (Map images)
```

---

## Environment Variables

The application runs with no required environment variables out of the box. The only optional variable is:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `10000` | The port the Express server listens on |
