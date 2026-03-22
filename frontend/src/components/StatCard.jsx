export default function StatCard({ label, value, sub, trend, color = 'blue', icon: Icon }) {
  const colors = {
    blue:  { bg: 'var(--accent-bg)', fg: 'var(--accent)' },
    green: { bg: 'var(--green-bg)',  fg: 'var(--green)'  },
    amber: { bg: 'var(--amber-bg)',  fg: 'var(--amber)'  },
    red:   { bg: 'var(--red-bg)',    fg: 'var(--red)'    },
  }
  const c = colors[color] || colors.blue

  return (
    <div className="card stat-card" style={{ padding: '18px 20px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          {label}
        </span>
        {Icon && (
          <span style={{
            width: 34, height: 34,
            background: c.bg,
            color: c.fg,
            borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'transform .2s ease',
          }}>
            <Icon size={16} strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="stat-value" style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
        {value ?? <span style={{ color: 'var(--text-3)' }}>—</span>}
      </div>
      {(sub || trend != null) && (
        <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
          {trend != null && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: trend >= 0 ? 'var(--green)' : 'var(--red)',
              background: trend >= 0 ? 'var(--green-bg)' : 'var(--red-bg)',
              padding: '2px 7px', borderRadius: 20
            }}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
          {sub && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{sub}</span>}
        </div>
      )}
    </div>
  )
}
