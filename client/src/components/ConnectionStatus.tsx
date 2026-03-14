/**
 * ConnectionStatus — Small indicator showing WebSocket connection state.
 */

import type { ConnectionStatus as Status } from '../hooks/useWebSocket';

interface Props {
  status: Status;
  className?: string;
}

export default function ConnectionStatus({ status, className = '' }: Props) {
  const label =
    status === 'connected'
      ? 'Live'
      : status === 'connecting'
      ? 'Connecting…'
      : status === 'error'
      ? 'Error'
      : 'Offline';

  const dotClass =
    status === 'connected'
      ? 'connection-dot dot-connected'
      : status === 'connecting'
      ? 'connection-dot dot-connecting'
      : 'connection-dot dot-disconnected';

  return (
    <span className={`connection-status ${className}`}>
      <span className={dotClass} />
      <span className="connection-label">{label}</span>
    </span>
  );
}
