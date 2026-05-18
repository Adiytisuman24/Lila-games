import { useState } from 'react'
import './FilterPanel.css'

export default function FilterPanel({
  dates,
  maps,
  selectedDate,
  selectedMap,
  onDateChange,
  onMapChange,
  matches,
  selectedMatch,
  onMatchSelect
}) {
  const [showMultiplayer, setShowMultiplayer] = useState(false)

  const filteredMatches = showMultiplayer 
    ? matches.filter(m => m.human_count >= 1 && m.bot_count >= 1)
    : matches

  return (
    <div className="filter-panel">
      <div className="filter-group">
        <label>Date:</label>
        <div className="select-wrapper">
          <select value={selectedDate} onChange={e => onDateChange(e.target.value)}>
            {dates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      
      <div className="filter-group">
        <label>Map:</label>
        <div className="select-wrapper">
          <select value={selectedMap} onChange={e => onMapChange(e.target.value)}>
            {maps.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="filter-group checkbox-group">
        <label className={`checkbox-label ${showMultiplayer ? 'active' : ''}`}>
          <input 
            type="checkbox" 
            checked={showMultiplayer} 
            onChange={e => {
              setShowMultiplayer(e.target.checked)
              if (e.target.checked) {
                const multi = matches.filter(m => m.human_count >= 1 && m.bot_count >= 1)
                if (multi.length > 0) {
                  onMatchSelect(multi[0])
                }
              }
            }} 
          />
          <span className="checkbox-custom"></span>
          Multi-player
        </label>
      </div>
      
      <div className="filter-group">
        <label>Match:</label>
        <div className="select-wrapper">
          <select 
            value={selectedMatch?.match_id || ''} 
            onChange={e => {
              const match = filteredMatches.find(m => m.match_id === e.target.value)
              onMatchSelect(match)
            }}
          >
            {filteredMatches.map(m => (
              <option key={m.match_id} value={m.match_id}>
                {m.match_id.slice(0, 8)}... ({m.human_count}h/{m.bot_count}b)
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
