import { useMemo, useState, useEffect } from 'react';
import MetricCard from './components/MetricCard';
import LiveChart from './components/LiveChart';
import MemberTable from './components/MemberTable';
import BridgeSchematic from './components/BridgeSchematic';
import { MAX_POINTS, createInitialHistory, evaluateStatus, jumpToScenario, nextDataPoint, scenarioCatalog } from './data/simulator';

function toneFromTraffic(statusKey) {
  if (statusKey === 'red') return 'danger';
  if (statusKey === 'amber') return 'attention';
  if (statusKey === 'grey') return 'muted';
  return 'safe';
}

function StatusBadge({ status }) {
  return (
    <span className={`traffic-badge traffic-${status.key}`}>
      <span className="traffic-dot" />
      {status.label}: {status.action}
    </span>
  );
}

function ScenarioProgress({ latest }) {
  const progressPercent = Math.round(latest.scenarioProgress * 100);

  return (
    <section className="scenario-banner card">
      <div>
        <p className="scenario-label">Current Scenario</p>
        <h2>{latest.scenarioLabel}</h2>
        <p>
          {latest.scenarioRemainingSec}s remaining · next begins in {latest.nextScenarioInSec}s: {latest.nextScenarioLabel}
        </p>
      </div>
      <div className="scenario-progress-block" aria-label="Scenario timer and progress">
        <strong>{progressPercent}%</strong>
        <span>active phase complete</span>
        <div className="scenario-progress-track">
          <div className="scenario-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
    </section>
  );
}

function WhyStatusPanel({ latest }) {
  return (
    <article className="card why-panel">
      <h3>Why this status?</h3>
      <ul className="driver-list">
        {latest.statusDrivers.map((driver) => (
          <li key={driver.label}>
            <span className={`driver-light traffic-${driver.status.key}`} />
            <div>
              <strong>{driver.label}</strong>
              <p>{driver.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

function DiagnosticGuide() {
  return (
    <article className="card diagnostic-guide">
      <h3>Diagnostic guide</h3>
      <ul>
        <li><strong>Green:</strong> readings are in normal simulated operating range.</li>
        <li><strong>Amber:</strong> observe trend or schedule inspection if persistence continues.</li>
        <li><strong>Red:</strong> urgent inspection / critical anomaly rule has been triggered.</li>
        <li><strong>Grey:</strong> reserved for invalid telemetry or sensor fault readings.</li>
      </ul>
    </article>
  );
}

export default function App() {
  const [isRunning, setIsRunning] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
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
          <p className="subtitle">Single concrete girder/span monitoring with three strain locations, bearing displacement, wall tilt, and scenario-based simulation.</p>
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

      <ScenarioProgress latest={latest} />

      <nav className="tab-bar card" aria-label="Dashboard sections">
        <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={activeTab === 'sensors' ? 'active' : ''} onClick={() => setActiveTab('sensors')}>Bridge & Sensors</button>
      </nav>

      {activeTab === 'overview' ? (
        <main className="tab-content">
          <section className="metrics-grid overview-metrics">
            <MetricCard title="Overall Bridge Condition" value={status.label} unit={status.action} tone={toneFromTraffic(status.key)} />
            <MetricCard title="Critical Strain" value={latest.criticalStrain.toFixed(1)} unit={`με · ${latest.criticalLocation}`} tone={toneFromTraffic(latest.sensorStatuses.strainMidspan.key)} />
            <MetricCard title="Support Displacement Above Bearing" value={latest.supportDisplacement.toFixed(3)} unit="mm" tone={toneFromTraffic(latest.sensorStatuses.supportDisplacement.key)} />
            <MetricCard title="Abutment / Wall Tilt" value={latest.abutmentTilt.toFixed(3)} unit="°" tone={toneFromTraffic(latest.sensorStatuses.abutmentTilt.key)} />
          </section>

          <section className="overall-status card" style={{ borderColor: status.color }}>
            <div>
              <p className="scenario-label">Traffic-light condition</p>
              <h2 style={{ color: status.color }}>{status.label}</h2>
              <p>{status.action}</p>
            </div>
            <StatusBadge status={status} />
          </section>

          <section className="primary-grid">
            <section className="mini-charts-grid">
              <LiveChart
                history={history}
                title="Critical Strain Over Time"
                subtitle="Maximum of left support, midspan, and right support gauges"
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
                <h3>Current Anomaly State</h3>
                <p className="risk-level" style={{ color: status.color }}>{status.label}</p>
                <p>{status.currentAnomaly}</p>
                <p className="small-muted">Load event: {latest.loadEvent}</p>
              </article>

              <article className="card alert-panel">
                <h3>Maintenance / Inspection Status</h3>
                <p>Current action: <strong style={{ color: status.color }}>{status.action}</strong></p>
                <p>High strain duration: {latest.highStrainDurationSec}s</p>
                <p>Support persistence: {latest.supportPersistenceSec}s</p>
                <p>Tilt drift rate: {latest.tiltDriftRate.toFixed(3)}°/s</p>
              </article>

              <WhyStatusPanel latest={latest} />
              <DiagnosticGuide />
            </section>
          </section>
        </main>
      ) : (
        <main className="tab-content">
          <section className="bridge-sensors-grid">
            <BridgeSchematic latest={latest} />
            <MemberTable latest={latest} />
          </section>

          <section className="image-grid sensors-images">
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
              <h3>Strain Gauge Installation</h3>
              <div className="camera-frame">
                <img src="/strain-gauge.jpg" alt="Strain gauge installation" />
              </div>
            </article>
          </section>
        </main>
      )}
    </div>
  );
}
