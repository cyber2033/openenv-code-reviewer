import { useEffect, useRef, useState } from 'react'
import { formatScore, formatTaskLabel, normalizeTaskType, useAppContext } from '../AppContext'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }
const RANK_CLASSES = { 1: 'rank-1', 2: 'rank-2', 3: 'rank-3' }

function SubmitForm({ onSubmit, error, loading }) {
  const [form, setForm] = useState({
    agent_name: '',
    task: 'easy_001',
    score: '',
    steps: '',
    model: '',
  })
  const [ok, setOk] = useState(false)

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
    setOk(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await onSubmit({
        ...form,
        score: Number(form.score),
        steps: Number(form.steps),
      })
      setOk(true)
      setForm({ agent_name: '', task: 'easy_001', score: '', steps: '', model: '' })
    } catch {
      /* error shown from context */
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid two">
        <div className="field">
          <label htmlFor="lb-agent-name">Agent name</label>
          <input
            id="lb-agent-name"
            className="input"
            required
            placeholder="My Agent"
            value={form.agent_name}
            onChange={(e) => set('agent_name', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="lb-task">Task</label>
          <select
            id="lb-task"
            className="select"
            value={form.task}
            onChange={(e) => set('task', e.target.value)}
          >
            <option value="easy_001">easy_001</option>
            <option value="medium_001">medium_001</option>
            <option value="hard_001">hard_001</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="lb-score">Score (0–1)</label>
          <input
            id="lb-score"
            className="input"
            type="number"
            min="0"
            max="1"
            step="0.001"
            required
            placeholder="0.920"
            value={form.score}
            onChange={(e) => set('score', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="lb-steps">Steps used</label>
          <input
            id="lb-steps"
            className="input"
            type="number"
            min="1"
            required
            placeholder="4"
            value={form.steps}
            onChange={(e) => set('steps', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="lb-model">Model (optional)</label>
          <input
            id="lb-model"
            className="input"
            placeholder="gpt-4o"
            value={form.model}
            onChange={(e) => set('model', e.target.value)}
          />
        </div>
      </div>

      <div className="button-row" style={{ marginTop: 16 }}>
        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Submitting…' : 'Submit score'}
        </button>
        {ok && <span className="badge green">Submitted successfully!</span>}
        {error && <span className="badge red">{error}</span>}
      </div>
    </form>
  )
}

export default function Leaderboard() {
  const { leaderboard, refreshLeaderboard, submitLeaderboard, errors, loading, lastUpdated } =
    useAppContext()

  const [filter, setFilter] = useState('all')
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = window.setInterval(refreshLeaderboard, 10000)
    return () => window.clearInterval(timerRef.current)
  }, [refreshLeaderboard])

  const filtered = leaderboard.filter((entry) => {
    if (filter === 'all') return true
    return normalizeTaskType(entry.task) === filter
  })

  const updatedStr = lastUpdated.leaderboard
    ? new Date(lastUpdated.leaderboard).toLocaleTimeString()
    : 'never'

  return (
    <section className="page">
      <div className="grid two">
        <article className="card metric-card">
          <span className="metric-label">Total entries</span>
          <strong className="metric-value">{leaderboard.length}</strong>
          <span className="metric-meta">Auto-refreshes every 10 s · Last: {updatedStr}</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Top score</span>
          <strong className="metric-value" style={{ color: 'var(--amber)' }}>
            {leaderboard.length ? formatScore(leaderboard[0]?.score) : '—'}
          </strong>
          <span className="metric-meta">{leaderboard[0]?.agent_name || 'No entries yet'}</span>
        </article>
      </div>

      <article className="card">
        <div className="card-header">
          <div>
            <h2>Rankings</h2>
            <p>Top 3 highlighted with gold, silver, and bronze. Filter by task type below.</p>
          </div>
          <button type="button" className="ghost-button" onClick={refreshLeaderboard}>
            ↻ Refresh
          </button>
        </div>

        <div className="filter-row" style={{ marginBottom: 16 }}>
          {['all', 'easy', 'medium', 'hard'].map((f) => (
            <button
              key={f}
              type="button"
              className={`chip-button ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {errors.leaderboard && (
          <div className="empty" style={{ borderColor: 'var(--red)', color: 'var(--red)', marginBottom: 12 }}>
            {errors.leaderboard}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="empty">
            No entries{filter !== 'all' ? ` for "${filter}"` : ''} yet. Submit a run below!
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Agent</th>
                  <th>Task</th>
                  <th>Score</th>
                  <th>Steps</th>
                  <th>Model</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => {
                  const rank = entry.rank || i + 1
                  const rowClass = RANK_CLASSES[rank] || ''
                  return (
                    <tr key={`${entry.agent_name}-${entry.task}-${i}`} className={rowClass}>
                      <td className="mono">
                        {MEDAL[rank] || rank}
                      </td>
                      <td>
                        <strong>{entry.agent_name || 'Unknown'}</strong>
                      </td>
                      <td>
                        <span className={`badge ${normalizeTaskType(entry.task) === 'hard' ? 'red' : normalizeTaskType(entry.task) === 'medium' ? 'blue' : 'green'}`}>
                          {formatTaskLabel(entry.task)}
                        </span>
                      </td>
                      <td className="mono" style={{ color: 'var(--green)', fontWeight: 700 }}>
                        {formatScore(entry.score)}
                      </td>
                      <td className="mono">{entry.steps ?? '-'}</td>
                      <td style={{ color: 'var(--muted)' }}>{entry.model || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="card">
        <div className="card-header">
          <div>
            <h2>Submit your score</h2>
            <p>Add your agent's result to the leaderboard without leaving this tab.</p>
          </div>
        </div>
        <SubmitForm
          onSubmit={submitLeaderboard}
          error={errors.submit}
          loading={loading.submit}
        />
      </article>
    </section>
  )
}
