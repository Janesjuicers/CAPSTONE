import { useMemo, useState, useEffect } from 'react';
import MetricCard from './components/MetricCard';
import LiveChart from './components/LiveChart';
import MemberTable from './components/MemberTable';
import BridgeSchematic from './components/BridgeSchematic';
import { MAX_POINTS, createInitialHistory, evaluateStatus, nextDataPoint } from './data/simulator';

function toneFromLevel(level) {
  if (level === 'Critical') return 'danger';
  if (level === 'High') return 'warning';
  if (level === 'Moderate') return 'attention';
  return 'safe';
}

export default function App() {
  const [isRunning, setIsRunning] = useState(true);
  const [history, setHistory] = useState(() => createInitialHistory());

  useEffect(() => {
    if (!isRunning) return undefined;

    const timer = setInterval(() => {
      setHistory((existing) => {
        const latest = existing[existing.length - 1];
        const next = nextDataPoint(latest);
        return [...existing.slice(-MAX_POINTS + 1), next];
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning]);

  const latest = history[history.length - 1];
  const status = useMemo(() => evaluateStatus(latest), [latest]);

  return (
    <div className="app-shell">
      <header className="top-header card">
        <div>
          <p className="eyebrow">VicRoads Concept Prototype</p>
          <h1>Bridge Structural Health Dashboard</h1>
          <p className="subtitle">Concrete girder bridge monitoring for critical strain, support movement, tilt drift, and maintenance decisions.</p>
        </div>

        <div className="actions">
          <button className={`run-toggle ${isRunning ? 'live' : ''}`} onClick={() => setIsRunning((x) => !x)}>
            {isRunning ? 'Stop Simulation' : 'Start Simulation'}
          </button>
          <p className="clock">Last update: {latest.time}</p>
        </div>
      </header>

      <section className="metrics-grid">
        <MetricCard title="Critical Strain" value={latest.criticalStrain.toFixed(1)} unit="με" />
        <MetricCard title="Deflection / Displacement" value={latest.midSpanDisplacement.toFixed(3)} unit="mm" />
        <MetricCard title="Support Displacement Above Bearing" value={latest.supportDisplacement.toFixed(3)} unit="mm" />
        <MetricCard title="Abutment / Wall Tilt" value={latest.abutmentTilt.toFixed(3)} unit="°" />
        <MetricCard title="Anomaly Status" value={status.level} unit="" tone={toneFromLevel(status.level)} />
      </section>

      <section className="primary-grid">
        <LiveChart history={history} />

        <section className="right-stack">
          <article className="card risk-panel" style={{ borderColor: status.color }}>
            <h3>Anomaly Interpretation</h3>
            <p className="risk-level" style={{ color: status.color }}>
              {status.level}
            </p>
            <p>{status.text}</p>
          </article>

          <article className="card alert-panel">
            <h3>Maintenance / Inspection Status</h3>
            <p>
              Current action level: <strong style={{ color: latest.maintenanceColor }}>{latest.maintenanceLevel}</strong>
            </p>
            <p>Load event: {latest.loadEvent}</p>
            <p>High-reading duration: {latest.highReadingDurationSec}s</p>
            <p>Tilt drift rate: {latest.tiltDriftRate.toFixed(3)}°/s</p>
          </article>

          <article className="card camera-panel">
            <h3>Reference Site Photo</h3>
            <div className="camera-frame">
              <img src="/bridge.jpg" alt="Actual bridge underside showing concrete girder beams" />
            </div>
            <p className="camera-caption">Use this panel to keep schematic placement aligned with real bridge geometry and sensor locations.</p>
          </article>
        </section>
      </section>

      <section className="bottom-grid">
        <MemberTable latest={latest} />
        <BridgeSchematic latest={latest} />
      </section>
    </div>
  );
}
