import { useMemo, useState, useEffect } from 'react';
import MetricCard from './components/MetricCard';
import LiveChart from './components/LiveChart';
import MemberTable from './components/MemberTable';
import BridgeSchematic from './components/BridgeSchematic';
import { MAX_POINTS, createInitialHistory, evaluateRisk, memberConditions, nextDataPoint } from './data/simulator';

function toneFromRisk(level) {
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

    // Main simulation interval (1 Hz).
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
  const members = useMemo(() => memberConditions(latest), [latest]);
  const risk = useMemo(() => evaluateRisk(latest, members), [latest, members]);

  const alerts = members.filter((member) => member.status === 'Warning' || member.status === 'Critical');

  return (
    <div className="app-shell">
      <header className="top-header card">
        <div>
          <p className="eyebrow">VicRoads Concept Prototype</p>
          <h1>Bridge Structural Health Dashboard</h1>
          <p className="subtitle">Simulated real-time sensing for load response, condition trend, and operational risk.</p>
        </div>

        <div className="actions">
          <button className={`run-toggle ${isRunning ? 'live' : ''}`} onClick={() => setIsRunning((x) => !x)}>
            {isRunning ? 'Stop Simulation' : 'Start Simulation'}
          </button>
          <p className="clock">Last update: {latest.time}</p>
        </div>
      </header>

      <section className="metrics-grid">
        <MetricCard title="Strain" value={latest.strain.toFixed(1)} unit="με" />
        <MetricCard title="Stress" value={latest.stress.toFixed(1)} unit="MPa" />
        <MetricCard title="Axial Force" value={latest.axialForce.toFixed(1)} unit="kN" />
        <MetricCard title="Estimated Deflection" value={latest.deflection.toFixed(2)} unit="mm" />
        <MetricCard title="Bridge Risk" value={risk.level} unit="" tone={toneFromRisk(risk.level)} />
      </section>

      <section className="primary-grid">
        <LiveChart history={history} />

        <section className="right-stack">
          <article className="card risk-panel" style={{ borderColor: risk.color }}>
            <h3>Health / Risk Status</h3>
            <p className="risk-level" style={{ color: risk.color }}>
              {risk.level}
            </p>
            <p>{risk.text}</p>
          </article>

          <article className="card alert-panel">
            <h3>Alerts</h3>
            {alerts.length === 0 ? (
              <p className="ok-text">No active structural warnings.</p>
            ) : (
              <ul>
                {alerts.map((alert) => (
                  <li key={alert.member}>
                    {alert.member}: <strong>{alert.status}</strong> ({alert.conditionScore})
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="card camera-panel">
            <h3>Camera Feed (Demo Placeholder)</h3>
            <div className="camera-frame">
              <img
                src="https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=1200&q=80"
                alt="Bridge camera placeholder"
              />
            </div>
            <p className="camera-caption">Replace with live CCTV stream or recorded site footage during future integration.</p>
          </article>
        </section>
      </section>

      <section className="bottom-grid">
        <MemberTable members={members} />
        <BridgeSchematic members={members} />
      </section>
    </div>
  );
}
