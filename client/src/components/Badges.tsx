import { RiskLevel, ComplianceStatus } from '../types';

interface RiskBadgeProps {
  level: RiskLevel;
}

export function RiskBadge({ level }: RiskBadgeProps) {
  return <span className={`badge risk-${level.toLowerCase()}`}>{level}</span>;
}

interface StatusBadgeProps {
  status: ComplianceStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`badge status-${status.toLowerCase().replace('_', '-')}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
