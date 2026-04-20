export default function MetricCard({ title, value, unit, tone = 'default' }) {
  return (
    <article className={`card metric-card tone-${tone}`}>
      <p className="metric-label">{title}</p>
      <p className="metric-value">
        {value}
        <span>{unit}</span>
      </p>
    </article>
  );
}
