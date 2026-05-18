import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(express.static(path.join(__dirname, 'frontend/dist')))

app.use('/output', express.static(path.join(__dirname, 'output')))
app.use('/minimaps', express.static(path.join(__dirname, 'player_data/minimaps')))

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'))
})

const PORT = process.env.PORT || 10000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
