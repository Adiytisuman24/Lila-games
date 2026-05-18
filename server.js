import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

// Serve the compiled React SPA from the frontend build directory
app.use(express.static(path.join(__dirname, 'frontend/dist')))

// Serve pre-processed match JSON files
app.use('/output', express.static(path.join(__dirname, 'output')))

// Serve minimap images for all supported maps
app.use('/minimaps', express.static(path.join(__dirname, 'player_data/minimaps')))

// Catch-all: return the SPA entry point for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'))
})

const PORT = process.env.PORT || 10000
app.listen(PORT, () => console.log(`🎮 Lila Games server running on http://localhost:${PORT}`))
