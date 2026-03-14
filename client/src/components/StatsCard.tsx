interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  accent?: 'default' | 'warning' | 'danger' | 'success';
}

export default function StatsCard({
  title,
  value,
  subtitle,
  accent = 'default',
}: StatsCardProps) {
  return (
    <div className={`stats-card accent-${accent}`}>
      <div className="stats-card-title">{title}</div>
      <div className="stats-card-value">{value}</div>
      {subtitle && <div className="stats-card-subtitle">{subtitle}</div>}
    </div>
  );
}
