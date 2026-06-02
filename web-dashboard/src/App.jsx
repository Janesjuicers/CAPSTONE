import { useMemo, useState, useEffect } from 'react';
import MetricCard from './components/MetricCard';
import LiveChart from './components/LiveChart';
import MemberTable from './components/MemberTable';
import BridgeSchematic from './components/BridgeSchematic';
import { MAX_POINTS, THRESHOLD_GUIDE, createInitialHistory, evaluateStatus, jumpToScenario, nextDataPoint, scenarioCatalog } from './data/simulator';

function toneFromTraffic(statusKey) {
  if (statusKey === 'red') return 'danger';
  if (statusKey === 'amber') return 'attention';
  if (statusKey === 'grey') return 'muted';
  return 'safe';
}


function findHighestPoint(points, dataKey) {
  if (!points.length) return undefined;
  return points.reduce((highest, point) => (Number(point[dataKey]) > Number(highest[dataKey]) ? point : highest), points[0]);
}

function peakLabel(point, dataKey, unit) {
  const decimals = unit === 'με' ? 1 : 3;
  return `Peak ${Number(point[dataKey]).toFixed(decimals)} ${unit}`;
}

function createPeakMarkers(history, dataKey, unit) {
  const latest = history[history.length - 1];
  if (!latest || !['load_event', 'persistent_high'].includes(latest.scenarioId)) return [];

  if (latest.scenarioId === 'load_event') {
    const firstCrossing = findHighestPoint(history.filter((point) => point.scenarioProgress >= 0.16 && point.scenarioProgress <= 0.46), dataKey);
    const secondCrossing = findHighestPoint(history.filter((point) => point.scenarioProgress >= 0.48 && point.scenarioProgress <= 0.78), dataKey);
    return [firstCrossing, secondCrossing]
      .filter(Boolean)
      .map((point) => ({ scenarioTick: point.scenarioTick, value: point[dataKey], label: peakLabel(point, dataKey, unit) }));
  }

  const peak = findHighestPoint(history, dataKey);
  return peak ? [{ scenarioTick: peak.scenarioTick, value: peak[dataKey], label: peakLabel(peak, dataKey, unit) }] : [];
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
        <p className="scenario-assumption">Assumption: {latest.scenarioAssumption}</p>
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

function ThresholdGuide() {
  return (
    <article className="card threshold-guide">
      <h3>Threshold reference</h3>
      <p className="small-muted">Compact Green / Amber / Red limits used by the simulated traffic-light rules.</p>
      <div className="threshold-grid" role="table" aria-label="Traffic light threshold reference">
        <div className="threshold-row threshold-head" role="row">
          <span role="columnheader">Metric</span>
          <span role="columnheader" className="traffic-green">Green</span>
          <span role="columnheader" className="traffic-amber">Amber</span>
          <span role="columnheader" className="traffic-red">Red</span>
        </div>
        {THRESHOLD_GUIDE.map((threshold) => (
          <div className="threshold-row" role="row" key={threshold.metric}>
            <span role="cell"><strong>{threshold.metric}</strong> <em>({threshold.unit})</em></span>
            <span role="cell">{threshold.green}</span>
            <span role="cell">{threshold.amber}</span>
            <span role="cell">{threshold.red}</span>
          </div>
        ))}
      </div>
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
        if (next.scenarioId !== latest.scenarioId) {
          return [next];
        }
        return [...existing.slice(-MAX_POINTS + 1), next];
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning]);

  const latest = history[history.length - 1];
  const activeScenarioHistory = useMemo(() => history.filter((point) => point.scenarioId === latest.scenarioId), [history, latest.scenarioId]);
  const status = useMemo(() => evaluateStatus(latest), [latest]);
  const criticalStrainMarkers = useMemo(() => createPeakMarkers(activeScenarioHistory, 'criticalStrain', 'με'), [activeScenarioHistory]);
  const supportDisplacementMarkers = useMemo(() => createPeakMarkers(activeScenarioHistory, 'supportDisplacement', 'mm'), [activeScenarioHistory]);
  const abutmentTiltMarkers = useMemo(() => createPeakMarkers(activeScenarioHistory, 'abutmentTilt', '°'), [activeScenarioHistory]);

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
                  return [jumped];
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
            <MetricCard title="Critical Strain" value={latest.criticalStrain.toFixed(1)} unit={`με · ${latest.criticalLocation}`} tone={toneFromTraffic(latest.sensorStatuses[latest.criticalSensorKey].key)} />
            <MetricCard title="Support Displacement Above Bearing" value={latest.supportDisplacement.toFixed(3)} unit="mm" tone={toneFromTraffic(latest.sensorStatuses.supportDisplacement.key)} />
            <MetricCard title="Abutment / Wall Tilt" value={latest.abutmentTilt.toFixed(3)} unit="°" tone={toneFromTraffic(latest.sensorStatuses.abutmentTilt.key)} />
          </section>

          <section className="overall-status card" style={{ borderColor: status.color }}>
            <div>
              <p className="scenario-label">Traffic-light condition</p>
              <h2 style={{ color: status.color }}>{status.label}</h2>
              <p>{status.action}</p>
              <p className="status-driver-pill">Driver: {status.statusDriverLabel}</p>
            </div>
            <StatusBadge status={status} />
          </section>

          <section className="primary-grid">
            <section className="mini-charts-grid">
              <LiveChart
                history={activeScenarioHistory}
                title="Critical Strain Over Time"
                subtitle="Maximum of left support, midspan, and right support gauges"
                dataKey="criticalStrain"
                color="#4da3ff"
                unit="με"
                peakMarkers={criticalStrainMarkers}
              />
              <LiveChart
                history={activeScenarioHistory}
                title="Support Displacement Above Bearing"
                subtitle="Relative support movement trend"
                dataKey="supportDisplacement"
                color="#68f8d8"
                unit="mm"
                peakMarkers={supportDisplacementMarkers}
              />
              <LiveChart
                history={activeScenarioHistory}
                title="Abutment / Wall Tilt Over Time"
                subtitle="Abutment and retaining wall drift"
                dataKey="abutmentTilt"
                color="#ffa658"
                unit="°"
                peakMarkers={abutmentTiltMarkers}
              />
            </section>

            <section className="right-stack">
              <article className="card risk-panel" style={{ borderColor: status.color }}>
                <h3>Current Anomaly State</h3>
                <p className="risk-level" style={{ color: status.color }}>{status.label}</p>
                <p>{status.currentAnomaly}</p>
                <p className="small-muted">{status.currentAnomalyDetail}</p>
              </article>

              <article className="card alert-panel">
                <h3>Maintenance / Inspection Status</h3>
                <p>Current action: <strong style={{ color: status.color }}>{status.action}</strong></p>
                <p>High strain duration: {latest.highStrainDurationSec}s</p>
                <p>Support persistence: {latest.supportPersistenceSec}s</p>
                <p>Tilt drift rate: {latest.tiltDriftRate.toFixed(3)}°/s</p>
              </article>

              <WhyStatusPanel latest={latest} />
            </section>
          </section>
        </main>
      ) : (
        <main className="tab-content">
          <section className="bridge-sensors-grid">
            <BridgeSchematic latest={latest} />
            <div className="sensor-technical-stack">
              <MemberTable latest={latest} />
              <ThresholdGuide />
            </div>
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
