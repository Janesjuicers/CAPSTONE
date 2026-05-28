const SENSOR_POINTS = [
  { key: 'strainLeft', label: 'Left support strain', short: 'L strain', unit: 'με', x: 27, y: 43, type: 'strain' },
  { key: 'strainMidspan', label: 'Midspan strain', short: 'Mid strain', unit: 'με', x: 60, y: 43, type: 'strain' },
  { key: 'strainRight', label: 'Right support strain', short: 'R strain', unit: 'με', x: 93, y: 43, type: 'strain' },
  { key: 'supportDisplacement', label: 'Support displacement above bearing', short: 'Bearing disp.', unit: 'mm', x: 101, y: 59, type: 'support' },
  { key: 'abutmentTilt', label: 'Abutment / wall tilt', short: 'Wall tilt', unit: '°', x: 16, y: 72, type: 'tilt' }
];

function formatSensorValue(value, unit) {
  return `${Number(value).toFixed(unit === 'με' ? 1 : 3)} ${unit}`;
}

function isCriticalPoint(point, latest) {
  if (point.key === 'strainLeft') return latest.criticalLocation === 'Left support strain gauge';
  if (point.key === 'strainMidspan') return latest.criticalLocation === 'Midspan strain gauge';
  if (point.key === 'strainRight') return latest.criticalLocation === 'Right support strain gauge';
  return latest.sensorStatuses[point.key]?.key === 'red';
}

export default function BridgeSchematic({ latest }) {
  const criticalPoint = SENSOR_POINTS.find((point) => isCriticalPoint(point, latest));

  return (
    <section className="card schematic-panel">
      <header className="schematic-header">
        <div>
          <h3>Single Girder / Span Sensor Schematic</h3>
          <p>Traffic-light colors show the current sensor/location condition.</p>
        </div>
        <span className={`traffic-badge traffic-${latest.overallStatus.key}`}>
          <span className="traffic-dot" />
          {latest.overallStatus.label}
        </span>
      </header>
      <div className="schematic-wrap">
        <svg viewBox="0 0 120 92" className="bridge-svg" role="img" aria-label="Single concrete girder bridge monitoring schematic">
          <rect x="8" y="18" width="104" height="7" rx="2.5" fill="#9aa9c8" opacity="0.75" />
          <rect x="12" y="32" width="96" height="13" rx="4" fill="#6079b2" opacity="0.92" />
          <rect x="16" y="45" width="88" height="4" rx="2" fill="#3e568a" opacity="0.9" />

          <rect x="9" y="58" width="16" height="24" rx="2" fill="#3f4d70" opacity="0.96" />
          <rect x="95" y="58" width="16" height="24" rx="2" fill="#3f4d70" opacity="0.96" />
          <rect x="14" y="52" width="10" height="4" rx="1" fill="#c4cad8" opacity="0.86" />
          <rect x="96" y="52" width="10" height="4" rx="1" fill="#c4cad8" opacity="0.86" />
          <text x="8" y="88" fill="#9fb0d4" fontSize="3.1">left support / abutment</text>
          <text x="86" y="88" fill="#9fb0d4" fontSize="3.1">right bearing</text>

          <line x1="27" y1="39" x2="27" y2="29" stroke="#9fb0d4" strokeDasharray="1.5 1.5" opacity="0.65" />
          <line x1="60" y1="39" x2="60" y2="27" stroke="#9fb0d4" strokeDasharray="1.5 1.5" opacity="0.65" />
          <line x1="93" y1="39" x2="93" y2="29" stroke="#9fb0d4" strokeDasharray="1.5 1.5" opacity="0.65" />
          <path d="M101 58 L101 50" stroke="#9fb0d4" strokeDasharray="1.5 1.5" opacity="0.7" />
          <path d="M16 72 L25 52" stroke="#9fb0d4" strokeDasharray="1.5 1.5" opacity="0.7" />

          {SENSOR_POINTS.map((point) => {
            const status = latest.sensorStatuses[point.key];
            const critical = isCriticalPoint(point, latest);
            const value = formatSensorValue(latest[point.key], point.unit);
            const labelY = point.type === 'tilt' ? point.y + 7 : point.y - 8;
            const labelX = point.key === 'supportDisplacement' ? point.x - 27 : point.x - 11;

            return (
              <g key={point.key} className={critical ? 'critical-sensor' : ''}>
                {critical ? <circle cx={point.x} cy={point.y} r="6.2" fill="none" stroke={status.color} strokeWidth="1.8" opacity="0.95" /> : null}
                <circle cx={point.x} cy={point.y} r="3.4" fill={status.color} stroke="#07101f" strokeWidth="1" />
                <rect x={labelX} y={labelY - 5} width="31" height="10" rx="2" fill="#0b1220" stroke={status.color} strokeWidth="0.5" opacity="0.94" />
                <text x={labelX + 2} y={labelY - 1.2} fill="#edf3ff" fontSize="2.7">{point.short}</text>
                <text x={labelX + 2} y={labelY + 2.8} fill={status.color} fontSize="2.7">{value}</text>
              </g>
            );
          })}

          <rect x="39" y="5" width="42" height="9" rx="2" fill={latest.overallStatus.color} opacity="0.95" />
          <text x="42" y="10.7" fill="#07101f" fontSize="3.4">Most critical: {criticalPoint?.short}</text>
        </svg>
      </div>
      <p className="legend-text">Three strain gauges are located on the same girder near the left support, at midspan, and near the right support. Support displacement remains above the bearing; tilt remains on the abutment / retaining wall.</p>
    </section>
  );
}
