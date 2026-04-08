import { useState } from 'react'
import { useAppContext } from '../AppContext'

function ToggleRow({ label, description, checked, onChange, id }) {
  return (
    <div className="toggle-row">
      <div>
        <strong style={{ display: 'block' }}>{label}</strong>
        {description && <span style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>{description}</span>}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        className={`toggle ${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
        title={checked ? 'On' : 'Off'}
      />
    </div>
  )
}

function ConfigRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '13px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{label}</span>
      <code style={{ color: 'var(--green)', fontFamily: 'monospace', fontSize: '0.9rem', textAlign: 'right', wordBreak: 'break-all', maxWidth: '60%' }}>{String(value ?? '—')}</code>
    </div>
  )
}

export default function Settings() {
  const [apiCheck, setApiCheck] = useState({ loading: false, result: null })
  const {
    settings,
    updateSetting,
    configSummary,
    clearLeaderboard,
    clearReplayHistory,
    health,
    lastUpdated,
    refreshHealth,
    runState,
    observation,
    requestJson,
  } = useAppContext()

  const checkApi = async () => {
    setApiCheck({ loading: true, result: null })
    try {
      const data = await requestJson('/health')
      setApiCheck({ loading: false, result: data })
    } catch (err) {
      setApiCheck({ loading: false, result: { status: 'error', openai_active: false, gemini_active: false } })
    }
  }

  const healthUpdated = lastUpdated.health ? new Date(lastUpdated.health).toLocaleTimeString() : 'never'

  return (
    <section className="page">
      <div className="grid two">
        <article className="card metric-card">
          <span className="metric-label">Backend status</span>
          <strong className="metric-value" style={{ color: health.status === 'ok' ? 'var(--green)' : 'var(--red)' }}>
            {String(health.status || 'checking').toUpperCase()}
          </strong>
          <span className="metric-meta">
            Version {health.version || '—'} · Last checked {healthUpdated}
          </span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Active episode</span>
          <strong className="metric-value mono" style={{ fontSize: '1rem', wordBreak: 'break-all' }}>
            {runState.episode_id || 'None'}
          </strong>
          <span className="metric-meta">Task: {observation.task_name || 'idle'}</span>
        </article>
      </div>

      {/* API config */}
      <article className="card">
        <div className="card-header">
          <div>
            <h2>Reviewer API configuration</h2>
            <p>Verification of API keys in <code>.env</code> file for LLM-based reviews.</p>
          </div>
          <button type="button" className="ghost-button" onClick={checkApi}>
            {apiCheck.loading ? 'Checking...' : 'Check API Status'}
          </button>
        </div>
        <div className="settings-grid">
          <ConfigRow 
            label="Gemini API" 
            value={apiCheck.result ? (apiCheck.result.gemini_active ? '✅ Connected' : '❌ Not Configured') : 'Click Check to verify'} 
          />
          <ConfigRow 
            label="OpenAI API" 
            value={apiCheck.result ? (apiCheck.result.openai_active ? '✅ Connected' : '❌ Not Configured') : 'Click Check to verify'} 
          />
          {!apiCheck.result?.gemini_active && !apiCheck.result?.openai_active && apiCheck.result && (
            <p style={{ padding: '12px 0 0', fontSize: '0.85rem', color: 'var(--red)', margin: 0 }}>
              Verify your API keys in the <code>.env</code> file and restart the backend.
            </p>
          )}
        </div>
      </article>

      {/* UI toggles */}
      <article className="card">
        <div className="card-header">
          <div>
            <h2>Runtime configuration</h2>
            <p>Read-only values from the backend. Edit via <code>openenv.yaml</code> and restart the server.</p>
          </div>
          <button type="button" className="ghost-button" onClick={refreshHealth}>↻ Ping</button>
        </div>
        <div className="settings-grid">
          <ConfigRow label="Server URL" value={configSummary.serverUrl} />
          
          {/* Interactive Model Selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid var(--line)' }}>
             <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Reviewer model</span>
             <select 
               className="ghost-button" 
               style={{ background: 'var(--panel-soft)', border: '1px solid var(--line)', padding: '6px 12px', borderRadius: 10, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}
               value={settings.modelName || 'gemini-1.5-flash'}
               onChange={(e) => updateSetting('modelName', e.target.value)}
             >
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
             </select>
          </div>

          <ConfigRow label="Max steps — easy" value={configSummary.maxSteps?.easy} />
          <ConfigRow label="Max steps — medium" value={configSummary.maxSteps?.medium} />
          <ConfigRow label="Max steps — hard" value={configSummary.maxSteps?.hard} />
          <ConfigRow label="Anti-spam threshold" value={configSummary.antiSpamThreshold} />
          {health.error && <ConfigRow label="Last error" value={health.error} />}
        </div>
      </article>

      <article className="card">
        <div className="card-header">
          <div>
            <h2>UI preferences</h2>
            <p>Dashboard-only toggles. These are stored in <code>localStorage</code> and do not affect the backend.</p>
          </div>
        </div>
        <div className="settings-grid">
          <ToggleRow
            id="toggle-hints"
            label="Hints enabled"
            description="Allow the agent to consume hints. Each hint applies a -0.05 penalty."
            checked={!!settings.hintsEnabled}
            onChange={(v) => updateSetting('hintsEnabled', v)}
          />
          <ToggleRow
            id="toggle-llm-judge"
            label="LLM judge enabled"
            description="Use the LLM-based secondary judge alongside the rule-based grader."
            checked={!!settings.llmJudgeEnabled}
            onChange={(v) => updateSetting('llmJudgeEnabled', v)}
          />
          <div className="toggle-row">
            <div>
              <strong style={{ display: 'block' }}>भाषा / Language</strong>
              <span style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>दाखवलेली भाषा बदला (Set interface language)</span>
            </div>
            <select 
               className="ghost-button" 
               style={{ background: 'var(--panel-soft)', border: '1px solid var(--line)', padding: '6px 12px', borderRadius: 10, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}
               value={settings.language || 'en'}
               onChange={(e) => updateSetting('language', e.target.value)}
             >
                <option value="en">English</option>
                <option value="mr">मराठी (Marathi)</option>
             </select>
          </div>
        </div>
      </article>

      {/* Danger zone */}
      <article className="card" style={{ borderColor: 'rgba(255,68,68,0.25)' }}>
        <div className="card-header">
          <div>
            <h2 style={{ color: 'var(--red)' }}>Danger zone</h2>
            <p>These actions clear local dashboard caches. They do <strong>not</strong> reset the backend server state.</p>
          </div>
        </div>
        <div className="button-row">
          <button
            type="button"
            id="btn-clear-leaderboard"
            className="button red"
            onClick={() => {
              if (window.confirm('Clear the local leaderboard cache?')) clearLeaderboard()
            }}
          >
            Clear leaderboard cache
          </button>
          <button
            type="button"
            id="btn-clear-replay"
            className="button red"
            onClick={() => {
              if (window.confirm('Clear the local replay history cache?')) clearReplayHistory()
            }}
          >
            Clear replay history cache
          </button>
        </div>
        <p style={{ margin: '14px 0 0', color: 'var(--muted)', fontSize: '0.88rem' }}>
          To truly reset the server, call <code>POST /reset</code> from the API Docs page or restart the backend process.
        </p>
      </article>
    </section>
  )
}
