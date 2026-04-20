const PARTS = [
  { id: 'G1', x: 14, y: 45, width: 18, height: 8 },
  { id: 'G2', x: 34, y: 45, width: 18, height: 8 },
  { id: 'G3', x: 54, y: 45, width: 18, height: 8 },
  { id: 'D1', x: 20, y: 30, width: 25, height: 8 },
  { id: 'D2', x: 47, y: 30, width: 25, height: 8 },
  { id: 'P1', x: 28, y: 58, width: 7, height: 20 },
  { id: 'P2', x: 55, y: 58, width: 7, height: 20 }
];

function scoreToColor(score) {
  if (score >= 84) return '#2dcf85';
  if (score >= 72) return '#f7b731';
  if (score >= 60) return '#ff7b59';
  return '#ff4d4f';
}

export default function BridgeSchematic({ members }) {
  const map = Object.fromEntries(members.map((m) => [m.member.replace('Girder ', 'G').replace('Deck ', 'D').replace('Pier ', 'P'), m]));

  return (
    <section className="card schematic-panel">
      <header>
        <h3>Bridge Schematic (Condition Highlighting)</h3>
      </header>
      <div className="schematic-wrap">
        <svg viewBox="0 0 100 90" className="bridge-svg" role="img" aria-label="Bridge condition schematic">
          <rect x="8" y="20" width="84" height="6" rx="2" fill="#8595be" opacity="0.5" />
          {PARTS.map((part) => {
            const item = map[part.id];
            const color = item ? scoreToColor(item.conditionScore) : '#7f8ba8';
            return <rect key={part.id} {...part} rx="2" fill={color} opacity="0.92" />;
          })}
        </svg>
      </div>
      <p className="legend-text">Green: Normal · Yellow: Observe · Orange: Warning · Red: Critical</p>
    </section>
  );
}
