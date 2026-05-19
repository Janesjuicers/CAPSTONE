import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

export default function LiveChart({ history, title, subtitle, dataKey, color, unit }) {
  return (
    <section className="card chart-panel mini-chart-panel">
      <header>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </header>

      <div className="chart-wrap mini-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 8, right: 14, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="time" tick={{ fill: '#c6d2ed', fontSize: 10 }} minTickGap={24} />
            <YAxis tick={{ fill: '#c6d2ed', fontSize: 10 }} width={42} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f1525', border: '1px solid #334365' }}
              formatter={(value) => [`${value} ${unit}`, title]}
            />
            <Line type="monotone" dataKey={dataKey} name={title} stroke={color} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
