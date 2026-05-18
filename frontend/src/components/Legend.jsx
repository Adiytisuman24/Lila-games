export default function Legend({ heatmapMode, matchData }) {
  const stats = matchData ? {
    kills: matchData.players.flatMap(p => p.events).filter(e => e.type === 'Kill' || e.type === 'BotKill').length,
    deaths: matchData.players.flatMap(p => p.events).filter(e => e.type === 'Killed' || e.type === 'BotKilled' || e.type === 'KilledByStorm').length,
    loot: matchData.players.flatMap(p => p.events).filter(e => e.type === 'Loot').length
  } : null

  return (
    <div className="legend">
      <div className="legend-title">
        {heatmapMode === 'none' ? 'Event Types' : 
         heatmapMode === 'kills' ? 'Kill Zones (Hotspots)' :
         heatmapMode === 'deaths' ? 'Death Zones (Hotspots)' : 'Player Traffic Heatmap'}
      </div>
      
      {stats && (
        <div className="legend-stats">
          <span className="stat-kill">💀 {stats.kills} Kills</span>
          <span className="stat-death">💀 {stats.deaths} Deaths</span>
          <span className="stat-loot">📦 {stats.loot} Loot</span>
        </div>
      )}

      {heatmapMode === 'none' && (
        <>
          <div className="legend-item">
            <span className="legend-icon kill">💀</span>
            <span>Kill / Bot Kill</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon death">💀</span>
            <span>Death / Bot Killed</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon storm">⚡</span>
            <span>Storm Death</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon loot">📦</span>
            <span>Loot Event</span>
          </div>
          <div className="legend-item">
            <span className="legend-line human"></span>
            <span>Human Path</span>
          </div>
          <div className="legend-item">
            <span className="legend-line bot"></span>
            <span>Bot Path</span>
          </div>
        </>
      )}
      
      {heatmapMode !== 'none' && (
        <div className="heatmap-legend">
          <div className="heatmap-gradient">
            <div className="gradient-bar"></div>
            <div className="gradient-labels">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>
          <div className="heatmap-info">
            {heatmapMode === 'kills' && <span>Red = High kill activity</span>}
            {heatmapMode === 'deaths' && <span>Purple = High death activity</span>}
            {heatmapMode === 'traffic' && <span>Blue = Player movement density</span>}
          </div>
        </div>
      )}
    </div>
  )
}
