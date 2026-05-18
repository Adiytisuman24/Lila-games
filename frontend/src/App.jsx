import { useState, useEffect, useMemo, useCallback } from 'react'
import MapViewer from './components/MapViewer'
import FilterPanel from './components/FilterPanel'
import TimelineSlider from './components/TimelineSlider'
import Legend from './components/Legend'
import './App.css'

const MAP_CONFIG = {
  AmbroseValley: { scale: 900, originX: -370, originZ: -473 },
  GrandRift: { scale: 581, originX: -290, originZ: -290 },
  Lockdown: { scale: 1000, originX: -500, originZ: -500 }
}

function App() {
  const [index, setIndex] = useState(null)
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [matchData, setMatchData] = useState(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [maxTime, setMaxTime] = useState(0)
  const [heatmapMode, setHeatmapMode] = useState('none')
  const [showBots, setShowBots] = useState(true)
  const [showHumans, setShowHumans] = useState(true)
  const [selectedDate, setSelectedDate] = useState('February_10')
  const [selectedMap, setSelectedMap] = useState('AmbroseValley')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  useEffect(() => {
    fetch('/output/index.json')
      .then(res => res.json())
      .then(data => {
        setIndex(data)
        loadMatches('February_10', 'AmbroseValley', data)
      })
      .catch(err => setError('Failed to load index'))
  }, [])

  const loadMatches = useCallback((date, map, idx) => {
    const dateMatches = idx?.dates?.[date] || []
    const filtered = dateMatches.filter(m => m.map_id === map)
    setMatches(filtered)
    if (filtered.length > 0) {
      setSelectedMatch(filtered[0])
    }
  }, [])

  useEffect(() => {
    if (index && selectedDate && selectedMap) {
      loadMatches(selectedDate, selectedMap, index)
    }
  }, [selectedDate, selectedMap, index, loadMatches])

  useEffect(() => {
    if (selectedMatch) {
      setLoading(true)
      setError(null)
      fetch(`/output/${selectedMatch.date}/${selectedMatch.match_id.replace('.nakama-0', '')}.json`)
        .then(res => res.json())
        .then(data => {
          const times = data.players.flatMap(p => p.events.map(e => e.ts))
          const minT = Math.min(...times)
          const maxT = Math.max(...times)
          const range = maxT - minT || 1
          
          data.players.forEach(p => {
            p.events.forEach(e => {
              e.normalized_ts = ((e.ts - minT) / range) * 100
            })
          })
          
          setMatchData(data)
          setMaxTime(100)
          setCurrentTime(0)
          setLoading(false)
        })
        .catch(err => {
          setError('Failed to load match data')
          setLoading(false)
        })
    }
  }, [selectedMatch])

  useEffect(() => {
    let interval
    if (isPlaying && currentTime < maxTime) {
      interval = setInterval(() => {
        setCurrentTime(t => {
          const next = t + (playbackSpeed * 0.5)
          if (next >= maxTime) {
            setIsPlaying(false)
            return maxTime
          }
          return next
        })
      }, 50)
    }
    return () => clearInterval(interval)
  }, [isPlaying, currentTime, maxTime, playbackSpeed])

  const formatDuration = (val) => {
    return `${Math.round(val)}%`
  }

  const matchStats = useMemo(() => {
    if (!matchData) return null
    const humans = matchData.players.filter(p => !p.is_bot).length
    const bots = matchData.players.filter(p => p.is_bot).length
    return { humans, bots, total: matchData.players.length }
  }, [matchData])

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>LILA BLACK</h1>
          <span className="subtitle">Match Viewer</span>
        </div>
        <FilterPanel
          dates={index?.dates ? Object.keys(index.dates) : []}
          maps={index?.maps ? Object.keys(index.maps) : []}
          selectedDate={selectedDate}
          selectedMap={selectedMap}
          onDateChange={setSelectedDate}
          onMapChange={setSelectedMap}
          matches={matches}
          selectedMatch={selectedMatch}
          onMatchSelect={setSelectedMatch}
        />
      </header>
      
      <main className="main">
        {error && <div className="error-banner">{error}</div>}
        {loading && <div className="loading-overlay">Loading...</div>}
        <MapViewer
          matchData={matchData}
          mapId={selectedMap}
          mapConfig={MAP_CONFIG[selectedMap]}
          currentTime={currentTime}
          heatmapMode={heatmapMode}
          showBots={showBots}
          showHumans={showHumans}
        />
        <Legend heatmapMode={heatmapMode} matchData={matchData} />
      </main>

      <footer className="footer">
        <div className="match-stats">
          {matchStats && (
            <>
              <span className="stat human">{matchStats.humans} Human{matchStats.humans !== 1 ? 's' : ''}</span>
              <span className="stat bot">{matchStats.bots} Bot{matchStats.bots !== 1 ? 's' : ''}</span>
              <span className="stat">{formatDuration(maxTime)}</span>
            </>
          )}
        </div>
        <div className="playback-controls">
          <button className="play-btn" onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <select value={playbackSpeed} onChange={e => setPlaybackSpeed(Number(e.target.value))}>
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
          </select>
        </div>
        <TimelineSlider
          maxTime={maxTime}
          currentTime={currentTime}
          onTimeChange={setCurrentTime}
        />
        <div className="heatmap-controls">
          <button className={heatmapMode === 'none' ? 'active' : ''} onClick={() => setHeatmapMode('none')}>Map</button>
          <button className={heatmapMode === 'kills' ? 'active' : ''} onClick={() => setHeatmapMode('kills')}>Kills</button>
          <button className={heatmapMode === 'deaths' ? 'active' : ''} onClick={() => setHeatmapMode('deaths')}>Deaths</button>
          <button className={heatmapMode === 'traffic' ? 'active' : ''} onClick={() => setHeatmapMode('traffic')}>Traffic</button>
        </div>
        <div className="player-toggles">
          <label className={showHumans ? 'active' : ''}>
            <input type="checkbox" checked={showHumans} onChange={e => setShowHumans(e.target.checked)} />
            <span className="human-dot"></span>
            Humans
          </label>
          <label className={showBots ? 'active' : ''}>
            <input type="checkbox" checked={showBots} onChange={e => setShowBots(e.target.checked)} />
            <span className="bot-dot"></span>
            Bots
          </label>
        </div>
      </footer>
    </div>
  )
}

export default App
