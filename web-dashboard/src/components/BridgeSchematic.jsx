function statusColor(level) {
  if (level === 'Urgent Inspection') return '#ff4d4f';
  if (level === 'Schedule Inspection') return '#ff7b59';
  if (level === 'Monitor Closely') return '#f7b731';
  return '#2dcf85';
}

export default function BridgeSchematic({ latest }) {
  const accent = statusColor(latest.maintenanceLevel);

  return (
    <section className="card schematic-panel">
      <header>
        <h3>Concrete Girder Bridge Schematic</h3>
      </header>
      <div className="schematic-wrap">
        <svg viewBox="0 0 120 90" className="bridge-svg" role="img" aria-label="Concrete girder bridge monitoring schematic">
          <rect x="8" y="20" width="104" height="8" rx="3" fill="#8595be" opacity="0.72" />

          <rect x="12" y="32" width="96" height="6" rx="2" fill="#6079b2" opacity="0.7" />
          <rect x="12" y="42" width="96" height="6" rx="2" fill="#6079b2" opacity="0.7" />
          <rect x="12" y="52" width="96" height="6" rx="2" fill="#6079b2" opacity="0.7" />

          <rect x="6" y="60" width="14" height="22" rx="2" fill="#3f4d70" opacity="0.92" />
          <rect x="100" y="60" width="14" height="22" rx="2" fill="#3f4d70" opacity="0.92" />

          <circle cx="60" cy="34" r="2.5" fill="#4da3ff" />
          <text x="64" y="35" fill="#dce5ff" fontSize="3.2">Critical strain gauge</text>

          <circle cx="98" cy="56" r="2.5" fill="#68f8d8" />
          <text x="72" y="63" fill="#dce5ff" fontSize="3.2">Support displacement above bearing</text>

          <circle cx="14" cy="72" r="2.5" fill="#ffa658" />
          <text x="20" y="74" fill="#dce5ff" fontSize="3.2">Abutment / retaining wall tilt</text>

          <rect x="88" y="6" width="26" height="8" rx="2" fill={accent} opacity="0.92" />
          <text x="90" y="11.3" fill="#0b1221" fontSize="3.3">{latest.maintenanceLevel}</text>
        </svg>
      </div>
      <p className="legend-text">Blue: strain sensor · Cyan: support displacement · Orange: tilt sensor</p>
    </section>
  );
}
