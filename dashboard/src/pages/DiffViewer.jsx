import { useState } from 'react'
import { formatTaskLabel, parseDiffLines, useAppContext } from '../AppContext'

function severityClass(severity) {
  const s = String(severity || '').toLowerCase()
  if (s === 'critical' || s === 'high') return 'critical'
  if (s === 'medium') return 'medium'
  return 'low'
}

function highlightLine(text) {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    .replace(/(def |class |return |import |from |if |else:|elif |for |while |with |try:|except |raise |pass |and |or |not |in |is |lambda )/g, '<span class="kw">$1</span>')
    .replace(/(["'`])(.*?)\1/g, '<span class="str">$1$2$1</span>')
    .replace(/\b(\d+(\.\d+)?)\b/g, '<span class="num">$1</span>')
    .replace(/(#.*)$/gm, '<span class="com">$1</span>')
}

function DiffLine({ line, index }) {
  const [open, setOpen] = useState(false)
  const cls = line.positive ? 'positive' : line.negative ? 'negative' : ''
  const hasMarkers = line.markers.length > 0

  return (
    <div
      className={`diff-line ${cls}`}
      style={{ cursor: hasMarkers ? 'pointer' : 'default' }}
      onClick={() => hasMarkers && setOpen((v) => !v)}
    >
      <span className="diff-line__number mono">{String(line.number).padStart(4, ' ')}</span>
      <code
        className="diff-line__content mono"
        dangerouslySetInnerHTML={{ __html: highlightLine(line.content) }}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {line.markers.map((m, i) => (
          <span
            key={i}
            className={`severity-pill ${severityClass(m.severity)}`}
          >
            {String(m.severity || 'unknown').toUpperCase()}
          </span>
        ))}
      </div>

      {open && hasMarkers && (
        <div
          style={{
            gridColumn: '1 / -1',
            marginTop: 10,
            padding: 14,
            borderRadius: 14,
            background: '#13132b',
            border: '1px solid rgba(102,102,128,0.24)',
          }}
        >
          {line.markers.map((m, i) => (
            <div key={i} style={{ marginBottom: i < line.markers.length - 1 ? 12 : 0 }}>
              <strong style={{ color: 'var(--green)', fontFamily: 'monospace' }}>
                {String(m.category || 'bug').toUpperCase()} · {String(m.severity || 'unknown').toUpperCase()}
              </strong>
              <p style={{ margin: '6px 0 0', color: '#c9c9e8' }}>{m.message || 'No message.'}</p>
              {m.fix && (
                <p style={{ margin: '4px 0 0', color: 'var(--blue)' }}>
                  <strong>Fix:</strong> {m.fix}
                </p>
              )}
              <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                Score delta: {Number(m.score_delta || 0) >= 0 ? '+' : ''}{Number(m.score_delta || 0).toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DiffViewer() {
  const { diffLines, observation, comments } = useAppContext()

  const positiveCount = diffLines.filter((l) => l.positive).length
  const negativeCount = diffLines.filter((l) => l.negative).length
  const totalSignals = comments.length

  return (
    <section className="page">
      <div className="grid three">
        <article className="card metric-card">
          <span className="metric-label">Total lines</span>
          <strong className="metric-value">{diffLines.length}</strong>
          <span className="metric-meta">File: {observation.filename || 'snippet.py'}</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Correct signals</span>
          <strong className="metric-value" style={{ color: 'var(--green)' }}>
            {positiveCount}
          </strong>
          <span className="metric-meta">{totalSignals} total agent signals</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Incorrect signals</span>
          <strong className="metric-value" style={{ color: 'var(--red)' }}>
            {negativeCount}
          </strong>
          <span className="metric-meta">Lines with negative reward</span>
        </article>
      </div>

      <article className="card" style={{ padding: 0 }}>
        <div className="diff-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="mono" style={{ color: 'var(--green)', fontWeight: 700 }}>
              {observation.filename || 'snippet.py'}
            </span>
            <span className="badge muted">{diffLines.length} lines</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge green">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
              {positiveCount} correct
            </span>
            <span className="badge red">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />
              {negativeCount} flagged
            </span>
          </div>
        </div>

        {diffLines.length > 0 ? (
          <div className="diff-list">
            {diffLines.map((line, i) => (
              <DiffLine key={`${line.number}-${i}`} line={line} index={i} />
            ))}
          </div>
        ) : (
          <div className="empty" style={{ margin: 16 }}>
            No diff loaded yet. Start an episode via <code>/reset</code> to see the code here.
          </div>
        )}
      </article>

      {comments.length > 0 && (
        <article className="card">
          <div className="card-header">
            <div>
              <h2>All agent signals</h2>
              <p>Every comment submitted so far, ordered by step. Click a diff line above for inline context.</p>
            </div>
            <span className="badge blue">{comments.length} signals</span>
          </div>
          <div className="signal-group">
            {comments.map((c, i) => (
              <div key={i} className="signal-badge">
                <span className={`severity-pill ${severityClass(c.severity)}`}>
                  L{c.line} · {formatTaskLabel(c.category)} · {String(c.severity || '?').toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </article>
      )}
    </section>
  )
}
