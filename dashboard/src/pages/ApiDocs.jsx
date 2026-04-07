import { useState } from 'react'
import { prettyJson, useAppContext } from '../AppContext'

const METHOD_COLOR = { GET: 'var(--green)', POST: 'var(--blue)', WS: 'var(--amber)' }

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {}
  }
  return (
    <button type="button" className="ghost-button" onClick={handleCopy} style={{ fontSize: '0.8rem', padding: '5px 12px' }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function EndpointCard({ endpoint, onTest, testResult }) {
  const [open, setOpen] = useState(false)
  const methodColor = METHOD_COLOR[endpoint.method] || 'var(--text)'
  return (
    <div className="endpoint-card">
      <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }} onClick={() => setOpen(v => !v)}>
        <span style={{ color: methodColor, fontFamily: 'monospace', fontWeight: 800, fontSize: '0.9rem', minWidth: 48 }}>{endpoint.method}</span>
        <code style={{ color: 'var(--text)', fontFamily: 'monospace', fontSize: '0.95rem', flex: 1, minWidth: 0 }}>{endpoint.path}</code>
        <span style={{ color: 'var(--muted)', fontSize: '0.88rem', flex: 2 }}>{endpoint.description}</span>
        <span style={{ color: 'var(--muted)', marginLeft: 'auto', fontWeight: 700 }}>{open ? '−' : '+'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 24 }}>
          {endpoint.requestExample && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="metric-label" style={{ fontSize: '0.7rem' }}>Request template</span>
                <CopyButton text={prettyJson(endpoint.requestExample)} />
              </div>
              <pre className="response-box">{prettyJson(endpoint.requestExample)}</pre>
            </div>
          )}
          {endpoint.responseExample && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="metric-label" style={{ fontSize: '0.7rem' }}>Response schema</span>
                <CopyButton text={typeof endpoint.responseExample === 'string' ? endpoint.responseExample : prettyJson(endpoint.responseExample)} />
              </div>
              <pre className="response-box">
                {typeof endpoint.responseExample === 'string' ? endpoint.responseExample : prettyJson(endpoint.responseExample)}
              </pre>
            </div>
          )}
          {endpoint.canTest && (
            <div style={{ padding: 24, background: 'var(--panel-soft)', borderRadius: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <button type="button" className="button primary" style={{ fontSize: '0.8rem', padding: '10px 20px' }} onClick={() => onTest(endpoint.path)} disabled={testResult?.loading}>
                  {testResult?.loading ? 'Executing...' : 'Invoke local test'}
                </button>
                {testResult?.status && !testResult.loading && (
                  <span className={`badge ${testResult.status.startsWith('2') ? 'green' : 'red'}`}>HTTP {testResult.status}</span>
                )}
              </div>
              {testResult?.response && !testResult.loading && (
                <pre className="response-box" style={{ marginTop: 16, maxHeight: 320 }}>{testResult.response}</pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ApiDocs() {
  const { apiDocs, endpointTests, testEndpoint, apiBase } = useAppContext()
  return (
    <section className="page">
      <div className="grid two">
        <article className="card metric-card">
          <span className="metric-label">Total endpoints</span>
          <strong className="metric-value">{apiDocs.length}</strong>
          <span className="metric-meta">{apiDocs.filter(e => e.canTest).length} live-testable GET routes</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">Server URL</span>
          <strong className="metric-value mono" style={{ fontSize: '1.1rem', wordBreak: 'break-all' }}>{apiBase || 'http://localhost:7860'}</strong>
          <span className="metric-meta">Configured via VITE_SERVER_URL</span>
        </article>
      </div>
      <article className="card">
        <div className="card-header">
          <div>
            <h2>Endpoint reference</h2>
            <p>Click any row to see request/response shapes. Use the live-test button for GET routes.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['GET', 'POST', 'WS'].map(m => (
              <span key={m} style={{ color: METHOD_COLOR[m], fontFamily: 'monospace', fontWeight: 700, fontSize: '0.88rem' }}>{m}</span>
            ))}
          </div>
        </div>
        <div className="endpoint-grid">
          {apiDocs.map(ep => (
            <EndpointCard key={ep.path} endpoint={ep} onTest={testEndpoint} testResult={endpointTests[ep.path]} />
          ))}
        </div>
      </article>
    </section>
  )
}
