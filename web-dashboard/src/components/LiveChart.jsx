import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

export default function LiveChart({ history, title, subtitle, dataKey, color, unit }) {
  const latest = history[history.length - 1];
  const scenarioLabel = latest?.scenarioLabel ?? 'Awaiting scenario';

  return (
    <section className="card chart-panel mini-chart-panel">
      <header>
        <h3>{title}</h3>
        <p>{subtitle}</p>
        <span className="chart-context">Current scenario trace only · {scenarioLabel}</span>
      </header>

      <div className="chart-wrap mini-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 8, right: 14, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="scenarioTick" tick={{ fill: '#c6d2ed', fontSize: 10 }} minTickGap={18} label={{ value: 'seconds in active scenario', position: 'insideBottomRight', fill: '#8fa1c6', fontSize: 10 }} />
            <YAxis tick={{ fill: '#c6d2ed', fontSize: 10 }} width={42} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f1525', border: '1px solid #334365' }}
              labelFormatter={(_, payload) => payload?.[0]?.payload ? `${payload[0].payload.scenarioLabel} · t=${payload[0].payload.scenarioTick}s` : ''}
              formatter={(value) => [`${value} ${unit}`, title]}
            />
            <Line type="linear" dataKey={dataKey} name={title} stroke={color} dot={false} activeDot={{ r: 4 }} strokeWidth={2.2} isAnimationActive={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
