import { useState } from 'react'
import { useAppContext } from '../AppContext'

const CARD_ACCENT = {
  easy: 'var(--green)',
  medium: 'var(--blue)',
  hard: 'var(--red)',
}

const BADGE_CLASS = {
  easy: 'green',
  medium: 'blue',
  hard: 'red',
}

function TaskCard({ task, onRun }) {
  const [expanded, setExpanded] = useState(false)
  const accent = CARD_ACCENT[task.id] || 'var(--muted)'
  const badge = BADGE_CLASS[task.id] || 'muted'

  return (
    <article
      className={`card task-card ${expanded ? 'expanded' : ''}`}
      style={{ borderColor: expanded ? `${accent}88` : undefined, cursor: 'pointer' }}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="card-header" style={{ marginBottom: 12 }}>
        <div>
          <span className={`badge ${badge}`} style={{ marginBottom: 10 }}>
            {task.title}
          </span>
          <h2 style={{ marginTop: 6, color: 'var(--text)' }}>{task.title} Tasks</h2>
        </div>
        <span style={{ color: 'var(--muted)', fontSize: '1.4rem', lineHeight: 1, fontWeight: 700 }}>
          {expanded ? '−' : '+'}
        </span>
      </div>

      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '1.05rem' }}>{task.description}</p>

      <div className="mini-meta" style={{ marginTop: 24, gap: 24 }}>
        <span>
            <strong style={{ color: 'var(--text)' }}>Bugs:</strong> {task.bugs}
        </span>
        <span>
            <strong style={{ color: 'var(--text)' }}>Max steps:</strong> {task.steps}
        </span>
        <span>
            <strong style={{ color: 'var(--text)' }}>Baseline:</strong> {task.baseline}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 32, animation: 'pageFade 0.2s ease' }} onClick={(e) => e.stopPropagation()}>
          <div className="grid two" style={{ marginBottom: 32, gap: 24 }}>
            <div className="list-item">
              <strong style={{ color: accent }}>Expected score</strong>
              <p style={{ margin: '6px 0 0', fontWeight: 600 }}>{task.expectedScore}</p>
            </div>
            <div className="list-item">
              <strong style={{ color: 'var(--blue)' }}>Grader formula</strong>
              <p style={{ margin: '6px 0 0', fontSize: '0.9rem', lineHeight: 1.6 }}>
                {task.formula}
              </p>
            </div>
          </div>

          <div style={{ background: 'var(--panel-soft)', padding: 32, borderRadius: 20 }}>
            <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Sample snippet
            </p>
            <pre className="mono" style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text)', fontSize: '0.9rem' }}>{task.snippet}</pre>
          </div>

          <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
            <button
              className="button primary"
              onClick={(e) => {
                e.stopPropagation();
                onRun(task.id);
              }}
            >
              Run AI Review
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

export default function TaskExplorer() {
  const { taskCatalog, runAgent, settings } = useAppContext()

  const handleRun = async (taskId) => {
    try {
      await runAgent(taskId + '_001', settings.modelName);
      alert(`AI Review started for ${taskId}_001 using ${settings.modelName || 'default'}. Check the Live Monitor!`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  }

  return (
    <section className="page transition">
      <div
        style={{
          padding: '32px',
          borderRadius: 24,
          border: '1px solid var(--line)',
          background: 'var(--panel-soft)',
          marginBottom: 8,
        }}
      >
        <h3 style={{ margin: '0 0 12px' }}>Operational Guide</h3>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '1.05rem', lineHeight: 1.7 }}>
          Each task presents a code snippet with real vulnerabilities. Agents must submit structured review comments.
          The grader scores each comment based on line match, severity accuracy, and category correctness. 
          Redundant or spurious comments reduce precision and drag down your final score.
        </p>
      </div>

      <div className="grid three">
        <article className="card metric-card">
          <span className="metric-label">Easy baseline</span>
          <strong className="metric-value" style={{ color: 'var(--green)' }}>0.80+</strong>
          <span className="metric-meta">Strong run threshold</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Medium baseline</span>
          <strong className="metric-value" style={{ color: 'var(--blue)' }}>0.85+</strong>
          <span className="metric-meta">Strong run threshold</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Hard baseline</span>
          <strong className="metric-value" style={{ color: 'var(--red)' }}>0.90+</strong>
          <span className="metric-meta">Elite run threshold</span>
        </article>
      </div>

      <div className="stack">
        {taskCatalog.map((task) => (
          <TaskCard key={task.id} task={task} onRun={handleRun} />
        ))}
      </div>
    </section>
  )
}
