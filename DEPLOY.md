# LILA BLACK Match Viewer - Deployment Guide

## Option 1: Deploy to Render (Recommended)

### Files ready for deployment:
- `server.js` - Express server serving frontend + data
- `output/` - 797 match data files  
- `player_data/minimaps/` - Map images
- `frontend/dist/` - Built React app

### Deploy to Render:
1. Push code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo
4. Settings:
   - Build Command: `npm run build`
   - Start Command: `npm start`
   - Node Version: 20

---

## Option 2: Docker (Single Container)

### Build & Run locally:
```bash
docker build -t lila-black .
docker run -p 3000:3000 lila-black
```

### Push to container registry and deploy to Render/Railway/Fly.io

---

## Option 3: Vercel + External Data

If you want frontend on Vercel:
1. Deploy `frontend/dist/` to Vercel
2. Data must be hosted elsewhere (S3, etc.)

---

## Current Structure
```
/output        → Match JSON files
/minimaps      → Map images  
/              → Frontend (served by Express)
```
