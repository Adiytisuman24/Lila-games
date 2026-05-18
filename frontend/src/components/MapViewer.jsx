import { useEffect, useRef, useMemo } from 'react'
import { MapContainer, ImageOverlay, Polyline, CircleMarker, useMap, Circle, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const HUMAN_COLORS = ['#00FFFF', '#FFFF00', '#FF69B4', '#7FFF00', '#FFA500', '#9370DB']
const BOT_COLOR = '#666666'

const createIcon = (emoji, bgColor, size = 24, offsetX = 0, offsetY = 0) => L.divIcon({
  html: `<div style="
    background: ${bgColor};
    width: ${size}px;
    height: ${size}px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${size * 0.6}px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    border: 2px solid rgba(255,255,255,0.3);
    transform: translate(${offsetX}px, ${offsetY}px);
  ">${emoji}</div>`,
  className: 'event-icon',
  iconSize: [size, size],
  iconAnchor: [size/2 - offsetX, size/2 - offsetY]
})

function MapController({ currentTime }) {
  const map = useMap()
  return null
}

export default function MapViewer({ matchData, mapId, mapConfig, currentTime, heatmapMode, showBots, showHumans }) {
  const mapRef = useRef(null)
  const heatmapLayerRef = useRef(null)

  const minimapUrls = {
    AmbroseValley: '/minimaps/AmbroseValley_Minimap.png',
    GrandRift: '/minimaps/GrandRift_Minimap.png',
    Lockdown: '/minimaps/Lockdown_Minimap.jpg'
  }

  const bounds = [[0, 0], [1024, 1024]]

  const heatmapData = useMemo(() => {
    if (!matchData || heatmapMode === 'none') return { kills: [], deaths: [], traffic: [] }
    
    const kills = []
    const deaths = []
    const traffic = []
    
    matchData.players.forEach(player => {
      const shouldShow = player.is_bot ? showBots : showHumans
      if (!shouldShow) return
      
      player.events.forEach(event => {
        if (event.type === 'Kill' || event.type === 'BotKill') {
          kills.push({ lat: event.py, lng: event.px, ts: event.normalized_ts })
        } else if (event.type === 'Killed' || event.type === 'BotKilled' || event.type === 'KilledByStorm') {
          deaths.push({ lat: event.py, lng: event.px, ts: event.normalized_ts, type: event.type })
        } else if (event.type === 'Position' || event.type === 'BotPosition') {
          traffic.push({ lat: event.py, lng: event.px, ts: event.normalized_ts })
        }
      })
    })
    
    return { kills, deaths, traffic }
  }, [matchData, heatmapMode, showBots, showHumans])

  useEffect(() => {
    if (!mapRef.current) return
    
    if (heatmapLayerRef.current) {
      mapRef.current.removeLayer(heatmapLayerRef.current)
    }

    const points = heatmapMode === 'kills' ? heatmapData.kills.map(k => [k.lat, k.lng, 1]) :
                   heatmapMode === 'deaths' ? heatmapData.deaths.map(d => [d.lat, d.lng, 1]) :
                   heatmapMode === 'traffic' ? heatmapData.traffic.map(t => [t.lat, t.lng, 0.3]) : []

    if (points.length > 0 && heatmapMode !== 'none') {
      try {
        const gradient = heatmapMode === 'kills' ? {0.2: '#FF0000', 0.4: '#FF6600', 0.6: '#FFCC00', 0.8: '#FFFF00', 1: '#FFFFFF'} :
                        heatmapMode === 'deaths' ? {0.2: '#4B0082', 0.4: '#8B00FF', 0.6: '#CC33FF', 0.8: '#FF66FF', 1: '#FFFFFF'} :
                        {0.2: '#000033', 0.4: '#003366', 0.6: '#0066CC', 0.8: '#00AAFF', 1: '#FFFFFF'}
        
        heatmapLayerRef.current = L.heatLayer(points, {
          radius: heatmapMode === 'traffic' ? 15 : 30,
          blur: heatmapMode === 'traffic' ? 10 : 20,
          maxZoom: 2,
          gradient: gradient
        }).addTo(mapRef.current)
      } catch (e) {
        console.log('Heatmap plugin not available')
      }
    }
  }, [heatmapMode, heatmapData])

  const renderZoneOverlay = () => {
    if (heatmapMode === 'none' || !matchData) return null
    
    const items = heatmapMode === 'kills' ? heatmapData.kills :
                 heatmapMode === 'deaths' ? heatmapData.deaths : []
    
    if (items.length === 0) return null
    
    return items.map((item, idx) => {
      const color = heatmapMode === 'kills' ? '#ff3333' : '#9933ff'
      const radius = heatmapMode === 'kills' ? 40 : 35
      return (
        <Circle
          key={`zone-${idx}`}
          center={[item.lat, item.lng]}
          radius={radius}
          pathOptions={{
            color: color,
            fillColor: color,
            fillOpacity: 0.3,
            weight: 2
          }}
        />
      )
    })
  }

  if (!matchData) {
    return (
      <MapContainer center={[512, 512]} zoom={-1} crs={L.CRS.Simple} bounds={bounds} className="map-container">
        <ImageOverlay url={minimapUrls[mapId]} bounds={bounds} />
      </MapContainer>
    )
  }

  const renderPlayerPaths = () => {
    const paths = []
    const colorMap = new Map()
    let colorIdx = 0

    matchData.players.forEach((player, pIdx) => {
      const shouldShow = player.is_bot ? showBots : showHumans
      if (!shouldShow) return

      const color = player.is_bot ? BOT_COLOR : HUMAN_COLORS[colorIdx++ % HUMAN_COLORS.length]
      colorMap.set(player.user_id, color)

      const positions = player.events
        .filter(e => (e.type === 'Position' || e.type === 'BotPosition') && e.normalized_ts <= currentTime)
        .sort((a, b) => a.normalized_ts - b.normalized_ts)

      if (positions.length > 1) {
        const pathCoords = positions.map(e => [e.py, e.px])
        paths.push(
          <Polyline
            key={player.user_id}
            positions={pathCoords}
            pathOptions={{
              color: color,
              weight: 2,
              dashArray: player.is_bot ? '5, 5' : null,
              opacity: 0.7
            }}
          />
        )
      }
    })

    return paths
  }

  const renderEventMarkers = () => {
    const markers = []
    let colorIdx = 0
    
    const offsetMap = new Map()

    matchData.players.forEach((player) => {
      const shouldShow = player.is_bot ? showBots : showHumans
      if (!shouldShow && !(showBots && showHumans)) return

      player.events.forEach(event => {
        if (event.normalized_ts > currentTime) return

        let icon = null
        let emoji, bgColor, size

        if (event.type === 'Kill' || event.type === 'BotKill') {
          emoji = '💀'; bgColor = '#ff3333'; size = 24
        } else if (event.type === 'Killed' || event.type === 'BotKilled') {
          emoji = '💀'; bgColor = '#9933ff'; size = 24
        } else if (event.type === 'KilledByStorm') {
          emoji = '⚡'; bgColor = '#ff00ff'; size = 24
        } else if (event.type === 'Loot') {
          emoji = '📦'; bgColor = '#ffd700'; size = 20
        }

        if (emoji) {
          const key = `${event.py}-${event.px}`
          if (!offsetMap.has(key)) {
            offsetMap.set(key, 0)
          }
          const offset = offsetMap.get(key)
          const jitter = offset * 15
          offsetMap.set(key, offset + 1)
          
          markers.push(
            <Marker
              key={`${player.user_id}-${event.ts}-${event.type}`}
              position={[event.py, event.px]}
              icon={createIcon(emoji, bgColor, size, Math.cos(offset) * jitter, Math.sin(offset) * jitter)}
            />
          )
        }
      })
    })

    return markers
  }

  return (
    <MapContainer 
      ref={mapRef}
      center={[512, 512]} 
      zoom={-1}
      minZoom={-2}
      maxZoom={2}
      crs={L.CRS.Simple} 
      bounds={bounds} 
      className="map-container"
      zoomControl={true}
    >
      <ImageOverlay url={minimapUrls[mapId]} bounds={bounds} />
      <MapController currentTime={currentTime} />
      {renderPlayerPaths()}
      {renderEventMarkers()}
      {renderZoneOverlay()}
    </MapContainer>
  )
}
