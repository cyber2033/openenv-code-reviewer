import { formatDate, formatSigned, formatTaskLabel, useAppContext } from '../AppContext'

function CommentCard({ comment }) {
  const positive = Number(comment?.score_delta) > 0

  return (
    <article className="list-item">
      <div className="card-header" style={{ marginBottom: 12 }}>
        <strong>Line {comment?.line ?? '-'} · {String(comment?.severity || 'Bug').toUpperCase()}</strong>
        <span className={`badge ${positive ? 'green' : 'blue'}`}>
          {formatSigned(comment?.score_delta)}
        </span>
      </div>
      <div className="mini-meta" style={{ marginBottom: 12 }}>
        <span>Category: {formatTaskLabel(comment?.category)}</span>
      </div>
      <p style={{ color: 'var(--text)', marginBottom: 8, fontWeight: 500 }}>{comment?.message}</p>
      {comment?.reason && (
        <p style={{ fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--muted)', marginTop: 8 }}>
          <strong>Judge's Verdict:</strong> {comment.reason}
        </p>
      )}
      {comment?.fix && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--blue-soft)', borderRadius: 12, fontSize: '0.88rem' }}>
          <strong style={{ display: 'block', fontSize: '0.7rem', color: 'var(--blue)', textTransform: 'uppercase', marginBottom: 4 }}>{t('remediation')}</strong>
          <code style={{ fontSize: '0.85rem' }}>{comment?.fix}</code>
        </div>
      )}
    </article>
  )
}

function ProgressCard({ observation, runState }) {
  const progress = observation.max_steps > 0 ? (observation.step / observation.max_steps) * 100 : 0
  
  return (
    <div className="progress-container">
      <div className="progress-label">
        <span>Review Progress</span>
        <span>{Math.round(progress)}% Complete</span>
      </div>
      <div className="progress-track">
        <div className="progress-bar" style={{ width: `${progress}%`, background: runState.done ? 'var(--green)' : 'var(--blue)' }} />
      </div>
      <div className="mini-meta" style={{ marginTop: 12 }}>
        <span>Episode step {observation.step} / {observation.max_steps}</span>
      </div>
    </div>
  )
}

export default function LiveMonitor() {
  const {
    agentStatus,
    comments,
    connectionStatus,
    health,
    leaderboard,
    observation,
    runState,
    testEndpoint,
    refreshLeaderboard,
    t
  } = useAppContext()

  const handleHint = async () => {
    try {
      const data = await testEndpoint('/hint')
      alert(data.hint || data.error)
    } catch (e) {
      alert('Failed to fetch hint')
    }
  }

  const latestComments = comments.slice(-10).reverse()

  return (
    <section className="page transition">
      <div className="grid three">
        <article className="card metric-card">
          <span className="metric-label">{t('performanceScore')}</span>
          <strong className="metric-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {Number(observation.current_score || 0).toFixed(3)}
          </strong>
          <span className="metric-meta" style={{ minHeight: '1.2em' }}>
            Session status: {health.status}
          </span>
        </article>

        <article className="card metric-card">
          <span className="metric-label">{t('assignedComplexity')}</span>
          <strong className="metric-value" style={{ color: 'var(--blue)' }}>
            {String(observation.task_type || 'none').toUpperCase()}
          </strong>
          <span className="metric-meta">File: {observation.filename}</span>
        </article>

        <article className="card metric-card">
          <span className="metric-label">{t('agentDeployment')}</span>
          <strong className="metric-value" style={{ color: agentStatus === 'RUNNING' ? 'var(--green)' : 'var(--text)' }}>
            {agentStatus === 'RUNNING' ? 'ACTIVE' : agentStatus}
          </strong>
          <span className="metric-meta" style={{ minHeight: '1.2em' }}>
            {connectionStatus === 'live' ? 'Synchronized with socket' : '\u00A0'}
          </span>
        </article>
      </div>

      <div className="grid sidebar-right">
        <div className="stack">
          <article className="card">
            <div className="card-header" style={{ marginBottom: 32 }}>
              <div>
                <h2>{t('intelligenceView')}</h2>
                <p>Telemetry from the AI agent's current code review iteration.</p>
              </div>
              <button className="button outline" onClick={handleHint}>Request Clue</button>
            </div>
            
            <div className="grid two" style={{ gap: 40 }}>
              <div className="stack" style={{ gap: 24 }}>
                <div style={{ padding: 24, background: 'var(--panel-soft)', borderRadius: 20 }}>
                  <span className="metric-label" style={{ fontSize: '0.65rem' }}>{t('accuracySignal')}</span>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 4 }}>
                    {agentStatus === 'IDLE' ? 'Ready' : runState.success ? 'Success' : runState.done ? 'Missed' : 'Analyzing...'}
                  </div>
                </div>
                <div style={{ padding: 24, background: 'var(--panel-soft)', borderRadius: 20 }}>
                  <span className="metric-label" style={{ fontSize: '0.65rem' }}>{t('bugsFound')}</span>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 4 }}>
                    {comments.length}
                  </div>
                </div>
              </div>
              <div>
                <ProgressCard observation={observation} runState={runState} />
                <div className="stack" style={{ marginTop: 24, gap: 12 }}>
                  <div className="mini-meta"><span>Session ID:</span> <span style={{ color: 'var(--text)' }}>{runState.episode_id ? `SID-${runState.episode_id.slice(0, 8).toUpperCase()}` : '---'}</span></div>
                  <div className="mini-meta"><span>Started At:</span> <span style={{ color: 'var(--text)' }}>{formatDate(runState.started_at) || '---'}</span></div>
                </div>
              </div>
            </div>
          </article>

          <article className="card">
            <div className="card-header">
              <div>
                <h2>{t('latestObservations')}</h2>
                <p>Structured feedback and proposes for bug remediation.</p>
              </div>
              <span className="badge">{comments.length} events recorded</span>
            </div>

            {latestComments.length ? (
              <div className="list">
                {latestComments.map((comment, index) => (
                  <CommentCard key={`${comment?.line}-${index}`} comment={comment} />
                ))}
              </div>
            ) : (
              <div className="empty">The agent has not submitted any findings for this task yet.</div>
            )}
          </article>
        </div>

        <div className="stack">
          <article className="card" style={{ background: 'var(--panel-soft)' }}>
            <h3>Task Context</h3>
            <p style={{ fontSize: '0.92rem', marginBottom: 24 }}>Currently auditing <strong>{observation.filename}</strong> for logical flaws and security vulnerabilities.</p>
            <div className="stack" style={{ gap: 12 }}>
              <div className="badge blue" style={{ width: '100%', justifyContent: 'center', background: 'white' }}>{formatTaskLabel(observation.task_name)}</div>
              <div className="badge" style={{ width: '100%', justifyContent: 'center', background: 'white' }}>{observation.bugs_remaining_hint || 'No'} bugs remaining</div>
            </div>
          </article>

          <article className="card">
            <h3>Recent Score Impact</h3>
            <p style={{ fontSize: '0.92rem', marginBottom: 20 }}>Top 3 historical reviewers currently in the environment.</p>
            <div className="list">
               {leaderboard.length > 0 ? (
                 leaderboard.slice(0, 3).map((item, idx) => (
                   <div key={`${item.submission_id}-${idx}`} className="list-item" style={{ padding: '12px 16px', background: idx === 0 ? 'var(--panel-soft)' : 'transparent', border: idx === 0 ? 'none' : '1px solid var(--line)', marginBottom: 8, borderRadius: 12 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <span style={{ fontWeight: 600 }}>{item.agent_name}</span>
                       <span className="text-green">+{Number(item.score).toFixed(3)}</span>
                     </div>
                   </div>
                 ))
               ) : (
                 <div className="empty" style={{ padding: 20, textAlign: 'center', fontSize: '0.85rem' }}>
                   No historical data recorded yet.
                 </div>
               )}
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
