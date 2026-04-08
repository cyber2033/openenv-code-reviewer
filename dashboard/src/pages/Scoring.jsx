import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatScore, formatSigned, useAppContext } from '../AppContext'

const CHART_TOOLTIP_STYLE = {
  background: 'white',
  border: '1px solid var(--line)',
  borderRadius: 12,
  color: 'var(--text)',
  fontSize: '0.88rem',
  boxShadow: 'var(--shadow-rich)',
}

function TrendArrow({ trend }) {
  if (trend === 'up') return <span style={{ color: 'var(--green)', fontSize: '1.6rem' }}>↑</span>
  if (trend === 'down') return <span style={{ color: 'var(--red)', fontSize: '1.6rem' }}>↓</span>
  return <span style={{ color: 'var(--muted)', fontSize: '1.6rem' }}>→</span>
}

export default function Scoring() {
  const { observation, runState, scoreSeries, rewardSeries, analytics, liveSteps } = useAppContext()

  const currentScore = Number(observation.current_score || 0)
  const totalReward = Number(runState.total_reward || 0)
  const { truePositives, falsePositives, severityAccuracy, trend } = analytics

  return (
    <section className="page">
      {/* KPI strip */}
      <div className="grid four">
        <article className="card metric-card">
          <span className="metric-label">Evaluation Result</span>
          <strong className="metric-value" style={{ 
            fontSize: '2.2rem', 
            color: currentScore >= 0.8 ? 'var(--green)' : currentScore >= 0.5 ? 'var(--amber)' : 'var(--muted)' 
          }}>
            {currentScore >= 0.9 ? 'EXCEPTIONAL' : currentScore >= 0.8 ? 'PROFESSIONAL' : currentScore >= 0.5 ? 'RELIABLE' : 'BASELINE'}
          </strong>
          <span className="metric-meta">Performance Rating</span>
        </article>

        <article className="card metric-card">
          <span className="metric-label">Current score</span>
          <strong className="metric-value">{formatScore(currentScore)}</strong>
          <span className="badge green">Judge active</span>
          <span className="metric-meta">Total reward {formatSigned(totalReward)}</span>
        </article>

        <article className="card metric-card">
          <span className="metric-label">True positives</span>
          <strong className="metric-value" style={{ color: 'var(--green)' }}>
            {truePositives}
          </strong>
          <span className="metric-meta" style={{ color: 'var(--muted)' }}>
            Steps with positive reward
          </span>
        </article>

        <article className="card metric-card">
          <span className="metric-label">False positives</span>
          <strong className="metric-value" style={{ color: 'var(--red)' }}>
            {falsePositives}
          </strong>
          <span className="metric-meta" style={{ color: 'var(--muted)' }}>
            Steps with zero or negative reward
          </span>
        </article>
      </div>

      <div className="grid two">
        {/* Severity accuracy */}
        <article className="card metric-card">
          <span className="metric-label">Severity accuracy</span>
          <strong className="metric-value" style={{ color: 'var(--blue)' }}>
            {severityAccuracy}%
          </strong>
          <span className="metric-meta">Correct signals ÷ total signals × 100</span>
        </article>

        {/* Performance trend */}
        <article className="card metric-card">
          <span className="metric-label">Performance trend</span>
          <strong className="metric-value">
            <TrendArrow trend={trend} />
            <span style={{ fontSize: '1.4rem', marginLeft: 8, color: 'var(--text)' }}>
              {String(trend || 'stable').toUpperCase()}
            </span>
          </strong>
          <span className="metric-meta">Based on last 5 reward deltas</span>
        </article>
      </div>

      {/* Score over time */}
      <article className="card">
        <div className="card-header">
          <div>
            <h2>Score over time</h2>
            <p>Cumulative score after each step. Pulled from the shared context — no extra fetches.</p>
          </div>
          <span className="badge blue">{scoreSeries.length} points</span>
        </div>

        {scoreSeries.length > 1 ? (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreSeries} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(102,102,128,0.18)" />
                <XAxis
                  dataKey="step"
                  stroke="var(--muted)"
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                  label={{ value: 'Step', position: 'insideBottomRight', offset: -4, fill: 'var(--muted)', fontSize: 12 }}
                />
                <YAxis
                  stroke="var(--muted)"
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                  domain={[0, 1]}
                />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--green)"
                  strokeWidth={2.5}
                  dot={{ fill: 'var(--green)', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty">Score plot will appear once the agent starts submitting steps.</div>
        )}
      </article>

      {/* Reward per step */}
      <article className="card">
        <div className="card-header">
          <div>
            <h2>Reward per step</h2>
            <p>Per-step delta — green bars are positive signals, red bars are wasted comments.</p>
          </div>
          <span className="badge blue">{rewardSeries.length} steps</span>
        </div>

        {rewardSeries.length > 0 ? (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rewardSeries} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(102,102,128,0.18)" />
                <XAxis
                  dataKey="step"
                  stroke="var(--muted)"
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                />
                <YAxis stroke="var(--muted)" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar
                  dataKey="reward"
                  radius={[6, 6, 0, 0]}
                  fill="var(--green)"
                  label={false}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty">Reward bars appear after the first step is submitted.</div>
        )}
      </article>

      {/* Step table */}
      {liveSteps.length > 0 && (
        <article className="card">
          <div className="card-header">
            <div>
              <h2>Step breakdown</h2>
              <p>Every step with line, severity, message, and reward delta.</p>
            </div>
            <span className="badge muted">{liveSteps.length} steps</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Line</th>
                  <th>Severity</th>
                  <th>Category</th>
                  <th>Message</th>
                  <th>Reward</th>
                </tr>
              </thead>
              <tbody>
                {liveSteps.map((s, i) => (
                  <tr key={i}>
                    <td className="mono">{s.step_number}</td>
                    <td className="mono">{s.line ?? '-'}</td>
                    <td>
                      <span
                        style={{
                          color: Number(s.reward) > 0 ? 'var(--green)' : 'var(--red)',
                          fontFamily: 'monospace',
                          fontSize: '0.85rem',
                        }}
                      >
                        {String(s.severity || '-').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{s.category || '-'}</td>
                    <td
                      style={{
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.message || '-'}
                    </td>
                    <td
                      className="mono"
                      style={{ color: Number(s.reward) > 0 ? 'var(--green)' : 'var(--red)' }}
                    >
                      {formatSigned(s.reward)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </section>
  )
}
