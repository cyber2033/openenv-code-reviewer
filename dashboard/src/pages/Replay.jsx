import { useState } from 'react'
import { formatDate, formatScore, formatSigned, formatTaskLabel, useAppContext } from '../AppContext'

function severityColor(severity) {
  const s = String(severity || '').toLowerCase()
  if (s === 'critical' || s === 'high') return 'var(--red)'
  if (s === 'medium') return 'var(--amber)'
  return 'var(--blue)'
}

function exportJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Replay() {
  const {
    episodes,
    selectedEpisodeId,
    selectedReplay,
    loadReplay,
    errors,
    loading,
    refreshEpisodes,
    apiBase,
  } = useAppContext()

  const [stepIndex, setStepIndex] = useState(0)

  const steps = Array.isArray(selectedReplay?.steps) ? selectedReplay.steps : []
  const maxIndex = Math.max(0, steps.length - 1)
  const currentStep = steps[Math.min(stepIndex, maxIndex)]

  function handleSelect(id) {
    loadReplay(id)
    setStepIndex(0)
  }

  function handleExport() {
    if (!selectedReplay) return
    exportJson(selectedReplay, `replay-${selectedReplay.episode_id || 'unknown'}.json`)
  }

  return (
    <section className="page">
      <div className="grid two">
        <article className="card metric-card">
          <span className="metric-label">Episodes stored</span>
          <strong className="metric-value">{episodes.length}</strong>
          <span className="metric-meta">
            <button
              type="button"
              className="ghost-button"
              style={{ fontSize: '0.85rem', padding: '6px 12px' }}
              onClick={refreshEpisodes}
            >
              ↻ Refresh list
            </button>
          </span>
        </article>
        {selectedReplay && (
          <article className="card metric-card">
            <span className="metric-label">Episode score</span>
            <strong className="metric-value" style={{ color: 'var(--green)' }}>
              {formatScore(selectedReplay.final_score)}
            </strong>
            <span className="metric-meta">{steps.length} steps recorded</span>
          </article>
        )}
      </div>

      <div className="split-view">
        {/* Episode list */}
        <article className="card" style={{ padding: 16 }}>
          <h3 style={{ margin: '0 0 14px', fontFamily: 'monospace' }}>Past episodes</h3>
          {errors.episodes && (
            <div className="empty" style={{ borderColor: 'var(--red)', color: 'var(--red)', marginBottom: 10 }}>
              {errors.episodes}
            </div>
          )}
          {episodes.length === 0 ? (
            <div className="empty">No episodes recorded yet. Complete a run to see it here.</div>
          ) : (
            <div className="episode-list">
              {episodes.map((ep) => (
                <button
                  key={ep.episode_id}
                  type="button"
                  className={`episode-item ${ep.episode_id === selectedEpisodeId ? 'active' : ''}`}
                  onClick={() => handleSelect(ep.episode_id)}
                >
                  <strong className="mono" style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>
                    {ep.episode_id}
                  </strong>
                  <div className="mini-meta">
                    <span>{formatTaskLabel(ep.task_name || ep.task)}</span>
                    <span style={{ color: 'var(--green)' }}>{formatScore(ep.final_score)}</span>
                    <span>{formatDate(ep.finished_at || ep.timestamp)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </article>

        {/* Replay viewer */}
        <article className="card">
          {loading.replay && (
            <div className="empty" style={{ marginBottom: 12 }}>Loading replay…</div>
          )}
          {errors.replay && (
            <div className="empty" style={{ borderColor: 'var(--red)', color: 'var(--red)', marginBottom: 12 }}>
              {errors.replay}
            </div>
          )}

          {selectedReplay ? (
            <>
              <div className="card-header">
                <div>
                  <h2 className="mono" style={{ fontSize: '1rem', wordBreak: 'break-all' }}>
                    {selectedReplay.episode_id}
                  </h2>
                  <div className="mini-meta" style={{ marginTop: 6 }}>
                    <span>Task: {formatTaskLabel(selectedReplay.task_name || selectedReplay.task)}</span>
                    <span style={{ color: 'var(--green)' }}>
                      Score: {formatScore(selectedReplay.final_score)}
                    </span>
                    <span>{steps.length} steps</span>
                  </div>
                </div>
                <button type="button" className="ghost-button" onClick={handleExport}>
                  ↓ Export JSON
                </button>
              </div>

              {/* Scrub slider */}
              {steps.length > 1 && (
                <div style={{ margin: '16px 0' }}>
                  <label
                    htmlFor="replay-scrub"
                    style={{ display: 'block', marginBottom: 8, color: 'var(--muted)', fontSize: '0.85rem' }}
                  >
                    Step {stepIndex + 1} of {steps.length}
                  </label>
                  <input
                    id="replay-scrub"
                    type="range"
                    className="slider"
                    min={0}
                    max={maxIndex}
                    value={stepIndex}
                    onChange={(e) => setStepIndex(Number(e.target.value))}
                  />
                </div>
              )}

              {/* Current step detail */}
              {currentStep && (
                <div
                  style={{
                    padding: 24,
                    borderRadius: 20,
                    border: '1px solid var(--line)',
                    background: 'var(--panel-soft)',
                    marginBottom: 24,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                    <strong style={{ color: 'var(--blue)', fontFamily: 'monospace', fontSize: '1rem' }}>
                      Step {currentStep.step_number} · Line {currentStep.line ?? '-'}
                    </strong>
                    <span
                      style={{
                        color: severityColor(currentStep.severity),
                        fontFamily: 'monospace',
                        fontSize: '0.9rem',
                        fontWeight: 800,
                      }}
                    >
                      {String(currentStep.severity || 'unknown').toUpperCase()}
                    </span>
                    <span
                      style={{
                        color: Number(currentStep.reward || currentStep.score_delta) >= 0
                          ? 'var(--green)'
                          : 'var(--red)',
                        fontFamily: 'monospace',
                        fontWeight: 700
                      }}
                    >
                      {formatSigned(currentStep.reward ?? currentStep.score_delta)}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text)', fontSize: '1.05rem', fontWeight: 500 }}>
                    {currentStep.message || 'No message recorded for this step.'}
                  </p>
                  {currentStep.reason && (
                    <p style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--muted)', marginTop: 12 }}>
                      <strong>Judge's Verdict:</strong> {currentStep.reason}
                    </p>
                  )}
                  {currentStep.fix && (
                    <div style={{ marginTop: 16, padding: 16, background: 'white', borderRadius: 12, border: '1px solid var(--line)' }}>
                       <span className="metric-label" style={{ fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>Proposed Fix</span>
                       <code style={{ color: 'var(--blue)' }}>{currentStep.fix}</code>
                    </div>
                  )}
                </div>
              )}

              {/* Full timeline */}
              <h3 style={{ margin: '0 0 12px', fontFamily: 'monospace', fontSize: '1rem' }}>
                Full timeline
              </h3>
              <div className="timeline">
                {steps.map((s, i) => (
                  <div
                    key={i}
                    className="timeline-item"
                    style={{
                      borderLeftColor: i === stepIndex ? 'var(--green)' : 'var(--blue)',
                      cursor: 'pointer',
                      opacity: i === stepIndex ? 1 : 0.7,
                    }}
                    onClick={() => setStepIndex(i)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <strong style={{ fontFamily: 'monospace', fontSize: '0.88rem' }}>
                        Step {s.step_number} · L{s.line ?? '-'} ·{' '}
                        <span style={{ color: severityColor(s.severity) }}>
                          {String(s.severity || '?').toUpperCase()}
                        </span>
                      </strong>
                      <span
                        className="mono"
                        style={{
                          color:
                            Number(s.reward ?? s.score_delta) >= 0 ? 'var(--green)' : 'var(--red)',
                          fontSize: '0.88rem',
                        }}
                      >
                        {formatSigned(s.reward ?? s.score_delta)}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--muted)' }}>
                      {s.message || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty">
              Select an episode on the left to start replaying it here.
            </div>
          )}
        </article>
      </div>
    </section>
  )
}
