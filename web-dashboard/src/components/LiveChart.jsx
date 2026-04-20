import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend
} from 'recharts';

export default function LiveChart({ history }) {
  return (
    <section className="card chart-panel">
      <header>
        <h3>Live Structural Signals</h3>
        <p>Updated every second (simulated)</p>
      </header>

      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 10, right: 22, left: 5, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="time" tick={{ fill: '#c6d2ed', fontSize: 11 }} minTickGap={20} />
            <YAxis tick={{ fill: '#c6d2ed', fontSize: 11 }} width={40} />
            <Tooltip contentStyle={{ backgroundColor: '#0f1525', border: '1px solid #334365' }} />
            <Legend wrapperStyle={{ color: '#dce5ff', fontSize: 12 }} />
            <Line type="monotone" dataKey="strain" stroke="#4da3ff" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="stress" stroke="#68f8d8" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="axialForce" stroke="#ffa658" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="deflection" stroke="#ff7cb8" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
