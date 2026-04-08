import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../AppContext'

export default function LabAudit() {
  const navigate = useNavigate()
  const { requestJson, settings, agentStatus } = useAppContext()
  const [code, setCode] = useState(`# Paste your Python or JS code here for audit\nimport os\n\ndef my_unsafe_function(user_input):\n    os.system(user_input) # Bug here!\n`)
  const [loading, setLoading] = useState(false)

  const handleRun = async () => {
    if (!code.trim()) return
    setLoading(true)

    try {
      console.log('Starting custom audit for code snippet...')
      const response = await requestJson('/api/custom/review', {
        method: 'POST',
        body: JSON.stringify({ code, model_name: settings.modelName }),
      })
      
      if (response && response.status === 'started') {
        console.log('Audit started successfully:', response.episode_id)
        navigate('/') // Go to Live Monitor to see result
      } else {
        throw new Error('Backend failed to start the review')
      }
    } catch (err) {
      console.error('Audit initialization failed:', err)
      alert(`Error starting audit: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="page transition">
      <div className="grid sidebar-right">
        <div className="stack">
          <article className="card">
            <div className="card-header" style={{ marginBottom: 24 }}>
              <div>
                <h2>Custom Security Lab</h2>
                <p>Paste any snippet below to run a professional AI security audit.</p>
              </div>
              <button 
                className="button primary" 
                onClick={handleRun} 
                disabled={loading || agentStatus === 'RUNNING'}
              >
                {loading ? 'Starting...' : 'Run Security Audit'}
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: 14,
                left: 14,
                zIndex: 4,
                padding: '4px 10px',
                background: 'var(--blue-soft)',
                color: 'var(--blue)',
                borderRadius: 8,
                fontSize: '0.65rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
              }}>
                Security Sandbox v1.1
              </div>
              <textarea 
                className="textarea mono"
                style={{ 
                  background: '#090913', 
                  color: '#dff5e7', 
                  padding: '48px 24px 24px',
                  borderRadius: 24,
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                  border: '1px solid var(--line)',
                  minHeight: '480px'
                }}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          </article>
        </div>

        <div className="stack">
          <article className="card">
            <h3>Laboratory Guide</h3>
            <p style={{ marginTop: 12, fontSize: '0.95rem', lineHeight: 1.6 }}>
              The Custom Lab allows for <strong>Ad-Hoc Security Scanning.</strong>
            </p>
            <ul style={{ marginTop: 24, paddingLeft: 20, color: 'var(--muted)', fontSize: '0.9rem', display: 'grid', gap: 16 }}>
              <li>Paste raw code (doesn't need to be a full file).</li>
              <li>Toggle the <strong>AI Engine Config</strong> in the sidebar before running.</li>
              <li>Go to <strong>Live Monitor</strong> to watch results in real-time.</li>
              <li>View the <strong>Analytics</strong> page for the final Audit Tier.</li>
            </ul>
          </article>

          <article className="card" style={{ background: 'var(--panel-soft)' }}>
             <span className="metric-label">Status</span>
             <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className={`status-dot ${agentStatus === 'RUNNING' ? 'live' : ''}`} />
                <strong>{agentStatus === 'RUNNING' ? 'System Busy' : 'System Ready'}</strong>
             </div>
          </article>
        </div>
      </div>
    </section>
  )
}
