const MAP = {
  APPROVED: 'green', ACTIVE: 'green',
  PENDING: 'amber', OPEN: 'amber', PENDING_REVIEW: 'amber',
  REJECTED: 'red', BANNED: 'red',
  HOLD: 'amber', PROCESSING: 'blue',
  COMPLETED: 'green', SANDBOX: 'gray',
  ESCALATED: 'red', CLOSED: 'gray',
  RESOLVED_FOR_PUBLISHER: 'green', RESOLVED_FOR_ADVERTISER: 'red',
  ADVERTISER_REPLIED: 'blue',
}

export default function Badge({ status }) {
  const color = MAP[status] || 'gray'
  const label = status?.replace(/_/g, ' ') || '—'
  return <span className={`badge badge-${color}`}>{label}</span>
}
