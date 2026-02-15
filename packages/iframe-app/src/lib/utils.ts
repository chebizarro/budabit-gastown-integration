/**
 * Shared utilities for the Gas Town dashboard UI.
 */

/** Format a unix timestamp (seconds) to a human-readable relative time. */
export function timeAgo(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;

  // Handle future timestamps (clock skew)
  if (diff < 0) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Format an ISO timestamp string to relative time. */
export function isoTimeAgo(iso: string): string {
  const ts = Math.floor(new Date(iso).getTime() / 1000);
  return timeAgo(ts);
}

/** Truncate a string to maxLen, adding ellipsis. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/** Status badge color mapping. */
export function statusColor(status: string): string {
  switch (status) {
    case 'ready': return '#28a745';
    case 'busy': return '#ffc107';
    case 'retiring': return '#fd7e14';
    case 'dead': return '#dc3545';
    case 'open': return '#17a2b8';
    case 'in_progress': return '#ffc107';
    case 'closed': return '#6c757d';
    case 'blocked': return '#dc3545';
    case 'landed': return '#28a745';
    case 'cancelled': return '#6c757d';
    case 'available': return '#17a2b8';
    case 'claimed': return '#ffc107';
    case 'completed': return '#28a745';
    case 'failed': return '#dc3545';
    case 'active': return '#28a745';
    case 'paused': return '#ffc107';
    default: return '#6c757d';
  }
}

/** Role emoji mapping. */
export function roleIcon(role: string): string {
  switch (role) {
    case 'mayor': return '👑';
    case 'deacon': return '⛪';
    case 'witness': return '👁';
    case 'refinery': return '🔧';
    case 'crew': return '👷';
    case 'polecat': return '🦨';
    case 'dog': return '🐕';
    default: return '🤖';
  }
}

/** Log event type emoji. */
export function logTypeIcon(type: string): string {
  switch (type) {
    case 'sling': return '🎯';
    case 'done': return '✅';
    case 'spawn': return '🚀';
    case 'kill': return '💀';
    case 'nudge': return '👉';
    case 'session_start': return '▶️';
    case 'session_end': return '⏹';
    case 'session_death': return '💀';
    case 'mass_death': return '🚨';
    case 'merge_started': return '🔀';
    case 'merged': return '✅';
    case 'merge_failed': return '❌';
    case 'merge_skipped': return '⏭';
    case 'patrol_started': return '🔍';
    case 'patrol_complete': return '✔️';
    case 'escalation_sent': return '⚠️';
    case 'handoff': return '🤝';
    case 'boot': return '🔌';
    case 'halt': return '🛑';
    default: return '📋';
  }
}

/** Protocol message type emoji. */
export function protocolIcon(msgType: string): string {
  switch (msgType) {
    case 'POLECAT_DONE': return '🏁';
    case 'MERGE_READY': return '🔀';
    case 'MERGED': return '✅';
    case 'MERGE_FAILED': return '❌';
    case 'REWORK_REQUEST': return '🔄';
    case 'HELP': return '⚠️';
    default: return '📡';
  }
}

/** Priority badge color. */
export function priorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return '#dc3545';
    case 'high': return '#fd7e14';
    case 'medium': return '#ffc107';
    case 'low': return '#6c757d';
    case 'urgent': return '#dc3545';
    default: return '#6c757d';
  }
}
