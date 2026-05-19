function severityClass(level) {
  return level.toLowerCase().replace(/\s+/g, '-');
}

export default function MemberTable({ latest }) {
  const anomalies = latest?.anomalies ?? [];

  return (
    <section className="card table-panel">
      <header>
        <h3>Inspection & Maintenance Focus</h3>
        <p>Critical strain, support displacement, and abutment tilt diagnostics</p>
      </header>
      <table>
        <tbody>
          <tr>
            <th>Critical strain</th>
            <td>{latest.criticalStrain.toFixed(1)} με</td>
          </tr>
          <tr>
            <th>Support displacement above bearing</th>
            <td>{latest.supportDisplacement.toFixed(3)} mm</td>
          </tr>
          <tr>
            <th>Abutment / retaining wall tilt</th>
            <td>{latest.abutmentTilt.toFixed(3)}°</td>
          </tr>
          <tr>
            <th>Maintenance status</th>
            <td>
              <span className={`status-pill ${severityClass(latest.maintenanceLevel)}`}>{latest.maintenanceLevel}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="anomaly-block">
        <h4>Anomaly interpretation</h4>
        {anomalies.length === 0 ? (
          <p className="ok-text">No active anomaly interpretation flags.</p>
        ) : (
          <ul>
            {anomalies.map((anomaly) => (
              <li key={anomaly.code}>{anomaly.message}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
