export default function TimelineSlider({ maxTime, currentTime, onTimeChange }) {
  const formatTime = (val) => {
    return `${Math.round(val)}%`
  }

  const progress = maxTime > 0 ? (currentTime / maxTime) * 100 : 0

  return (
    <div className="timeline-slider">
      <span className="time-label">{formatTime(currentTime)}</span>
      <div className="slider-container">
        <div className="slider-track">
          <div className="slider-progress" style={{ width: `${progress}%` }}></div>
        </div>
        <input
          type="range"
          min="0"
          max={maxTime}
          value={currentTime}
          onChange={e => onTimeChange(Number(e.target.value))}
          className="slider"
        />
      </div>
      <span className="time-label max">{formatTime(maxTime)}</span>
    </div>
  )
}
