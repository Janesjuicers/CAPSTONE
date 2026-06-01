const SENSOR_ROWS = [
  { key: 'strainLeft', label: 'Near left support strain gauge', unit: 'με', location: 'Bottom flange near left support' },
  { key: 'strainMidspan', label: 'Midspan strain gauge', unit: 'με', location: 'Bottom flange at midspan' },
  { key: 'strainRight', label: 'Near right support strain gauge', unit: 'με', location: 'Bottom flange near right support' },
  { key: 'supportDisplacement', label: 'Support displacement above bearing', unit: 'mm', location: 'Above right bearing seat' },
  { key: 'abutmentTilt', label: 'Abutment / retaining wall tilt', unit: '°', location: 'Left abutment retaining wall' }
];

function formatValue(value, unit) {
  const decimals = unit === 'με' ? 1 : 3;
  return `${Number(value).toFixed(decimals)} ${unit}`;
}

export default function MemberTable({ latest }) {
  return (
    <section className="card table-panel live-readings-panel">
      <header>
        <h3>Live Readings by Location</h3>
        <p>Single monitored concrete girder/span sensor list</p>
      </header>
      <table>
        <thead>
          <tr>
            <th>Location</th>
            <th>Reading</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {SENSOR_ROWS.map((row) => {
            const status = latest.sensorStatuses[row.key];
            const isCritical = row.key === latest.dominantSensorKey;
            return (
              <tr key={row.key} className={isCritical ? 'critical-row' : ''}>
                <td>
                  <strong>{row.label}</strong>
                  <span>{row.location}</span>
                </td>
                <td>{formatValue(latest[row.key], row.unit)}</td>
                <td>
                  <span className={`traffic-badge compact traffic-${status.key}`}>
                    <span className="traffic-dot" />
                    {status.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="anomaly-block">
        <h4>Current anomaly state</h4>
        {latest.anomalies.length === 0 ? (
          <p className="ok-text">No active anomaly interpretation flags.</p>
        ) : (
          <ul>
            {latest.anomalies.map((anomaly) => (
              <li key={anomaly.code}>{anomaly.message}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
