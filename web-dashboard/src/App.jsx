import { useMemo, useState, useEffect } from 'react';
import MetricCard from './components/MetricCard';
import LiveChart from './components/LiveChart';
import MemberTable from './components/MemberTable';
import BridgeSchematic from './components/BridgeSchematic';
import { MAX_POINTS, createInitialHistory, evaluateStatus, jumpToScenario, nextDataPoint, scenarioCatalog } from './data/simulator';

function toneFromLevel(level) {
  if (level === 'Critical') return 'danger';
  if (level === 'High') return 'warning';
  if (level === 'Moderate') return 'attention';
  return 'safe';
}

export default function App() {
  const [isRunning, setIsRunning] = useState(true);
  const [history, setHistory] = useState(() => createInitialHistory());
  const scenarios = useMemo(() => scenarioCatalog(), []);

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
          <div className="control-row">
            <button className={`run-toggle ${isRunning ? 'live' : ''}`} onClick={() => setIsRunning((x) => !x)}>
              {isRunning ? 'Pause Simulation' : 'Resume Simulation'}
            </button>
            <button className="run-toggle" onClick={() => setHistory(createInitialHistory())}>Reset</button>
            <button
              className="run-toggle"
              onClick={() =>
                setHistory((existing) => {
                  const latestPoint = existing[existing.length - 1];
                  const nextScenarioIndex = (scenarios.findIndex((s) => s.id === latestPoint.scenarioId) + 1) % scenarios.length;
                  const jumped = jumpToScenario(latestPoint, nextScenarioIndex);
                  return [...existing.slice(-MAX_POINTS + 1), jumped];
                })
              }
            >
              Next Scenario
            </button>
          </div>
          <p className="clock">Last update: {latest.time}</p>
        </div>
      </header>

      <section className="scenario-banner card">
        <p className="scenario-label">Current Scenario</p>
        <h2>{latest.scenarioLabel}</h2>
        <p>Step {latest.scenarioTick + 1} in current phase · Loop tick {latest.globalTick}</p>
      </section>

      <section className="metrics-grid single-emphasis">
        <MetricCard title="Critical Strain" value={latest.criticalStrain.toFixed(1)} unit="με" />
        <MetricCard title="Maintenance Status" value={latest.maintenanceLevel} unit="" />
        <MetricCard title="Anomaly Status" value={status.level} unit="" tone={toneFromLevel(status.level)} />
      </section>

      <section className="primary-grid">
        <section className="mini-charts-grid">
          <LiveChart
            history={history}
            title="Critical Strain Over Time"
            subtitle="Primary engineering signal"
            dataKey="criticalStrain"
            color="#4da3ff"
            unit="με"
          />
          <LiveChart
            history={history}
            title="Support Displacement Above Bearing"
            subtitle="Relative support movement trend"
            dataKey="supportDisplacement"
            color="#68f8d8"
            unit="mm"
          />
          <LiveChart
            history={history}
            title="Abutment / Wall Tilt Over Time"
            subtitle="Abutment and retaining wall drift"
            dataKey="abutmentTilt"
            color="#ffa658"
            unit="°"
          />
        </section>

        <section className="right-stack">
          <article className="card risk-panel" style={{ borderColor: status.color }}>
            <h3>Anomaly Interpretation</h3>
            <p className="risk-level" style={{ color: status.color }}>
              {status.level}
            </p>
            <p>{status.text}</p>
            <ul className="guidance-list">
              <li>Spike without load/event → possible permanent deflection or local damage.</li>
              <li>Continuously high reading → possible sensor fault or structural issue.</li>
              <li>Tilt drift trend → possible abutment or soil movement.</li>
            </ul>
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
        </section>
      </section>

      <section className="image-grid">
        <article className="card image-panel">
          <h3>Bridge Overview</h3>
          <div className="camera-frame">
            <img src="/bridge-overview.jpg" alt="Bridge overview" />
          </div>
        </article>
        <article className="card image-panel">
          <h3>Bridge Underside</h3>
          <div className="camera-frame">
            <img src="/bridge-underside.jpg" alt="Bridge underside and girders" />
          </div>
        </article>
        <article className="card image-panel">
          <h3>Support Displacement Sensor</h3>
          <div className="camera-frame">
            <img src="/displacement-sensor.jpg" alt="Support displacement sensor above bearing" />
          </div>
        </article>
        <article className="card image-panel">
          <h3>Critical Strain Sensor</h3>
          <div className="camera-frame">
            <img src="/strain-gauge.jpg" alt="Critical strain gauge installation" />
          </div>
        </article>
      </section>

      <section className="bottom-grid">
        <MemberTable latest={latest} />
        <BridgeSchematic latest={latest} />
      </section>
    </div>
  );
}
