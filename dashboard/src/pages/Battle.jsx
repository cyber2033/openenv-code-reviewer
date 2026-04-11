import { useState, useEffect, useRef } from 'react'
import { Swords, Trophy, RotateCcw, Play } from 'lucide-react'
import { useAppContext } from '../AppContext'

const MODELS = [
  { name: 'gpt-4o',                     label: 'GPT-4o',   color: '#00aaff', glow: 'rgba(0,170,255,0.25)' },
  { name: 'gemini-1.5-flash',            label: 'Gemini',   color: '#ff4444', glow: 'rgba(255,68,68,0.25)' },
  { name: 'Qwen/Qwen2.5-72B-Instruct',  label: 'Qwen',     color: '#00ff88', glow: 'rgba(0,255,136,0.25)' },
]

const TASKS = ['easy', 'medium', 'hard']

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://127.0.0.1:7860'

const battleStyles = `
.battle-page { display: grid; gap: 32px; }

.battle-controls {
  display: flex; gap: 16px; align-items: center; flex-wrap: wrap;
}
.battle-task-select {
  padding: 10px 18px; border-radius: 12px;
  border: 1px solid var(--line); background: var(--panel-soft);
  color: var(--text); font-size: 0.95rem; font-weight: 600;
  cursor: pointer; outline: none;
}
.battle-start-btn {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 12px 28px; border-radius: 14px; border: none;
  font-size: 1rem; font-weight: 800; cursor: pointer;
  transition: all 0.2s ease; letter-spacing: -0.01em;
}
.battle-start-btn.ready {
  background: linear-gradient(135deg, #00aaff 0%, #0066cc 100%);
  color: white; box-shadow: 0 4px 20px rgba(0,170,255,0.4);
}
.battle-start-btn.ready:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,170,255,0.5); }
.battle-start-btn.running {
  background: var(--panel-soft); color: var(--muted);
  border: 1px solid var(--line); cursor: not-allowed;
}
.battle-again-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 22px; border-radius: 12px; border: 1px solid var(--line);
  background: var(--panel-soft); color: var(--text);
  font-weight: 700; cursor: pointer; transition: all 0.2s ease;
}
.battle-again-btn:hover { border-color: var(--text); transform: translateY(-1px); }

.battle-arena {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.battle-card {
  border-radius: 24px;
  overflow: hidden;
  border: 2px solid transparent;
  background: var(--panel);
  box-shadow: var(--shadow);
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
}
.battle-card.winner {
  transform: translateY(-8px) scale(1.02);
}

.battle-card-header {
  padding: 20px 24px 16px;
  display: flex; align-items: center; gap: 12px;
}
.battle-model-icon {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.1rem; font-weight: 900; color: white;
}
.battle-model-name {
  font-size: 1.1rem; font-weight: 800; letter-spacing: -0.02em;
}
.battle-model-tag {
  font-size: 0.72rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.12em; color: var(--muted); margin-top: 2px;
}

.battle-score-block {
  padding: 0 24px 20px;
}
.battle-score-num {
  font-size: 3.8rem; font-weight: 900; letter-spacing: -0.06em;
  line-height: 1;
}
.battle-steps-label {
  font-size: 0.85rem; color: var(--muted); margin-top: 4px; font-weight: 500;
}

.battle-progress-track {
  margin: 0 24px 20px;
  height: 8px; border-radius: 99px; background: var(--panel-soft);
  overflow: hidden; border: 1px solid var(--line);
}
.battle-progress-fill {
  height: 100%; border-radius: 99px;
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.battle-comments {
  padding: 0 24px 24px;
  display: grid; gap: 8px;
  max-height: 180px; overflow: auto;
}
.battle-comment-item {
  padding: 8px 12px; border-radius: 10px;
  background: var(--panel-soft); border: 1px solid var(--line);
  font-size: 0.8rem; color: var(--muted);
  animation: commentSlide 0.3s ease;
}
.battle-comment-item strong { color: var(--text); font-size: 0.78rem; }

@keyframes commentSlide {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.battle-winner-banner {
  border-radius: 24px; padding: 40px;
  text-align: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: var(--shadow-rich);
  animation: winnerPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes winnerPop {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
.battle-winner-trophy { font-size: 4rem; margin-bottom: 12px; }
.battle-winner-title {
  font-size: 0.8rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.18em; color: #94a3b8; margin-bottom: 8px;
}
.battle-winner-name {
  font-size: 2.4rem; font-weight: 900; letter-spacing: -0.04em;
  margin-bottom: 4px;
}
.battle-winner-score {
  font-size: 1rem; color: #94a3b8; font-weight: 500;
}

.battle-status-bar {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 20px; border-radius: 14px;
  background: var(--panel-soft); border: 1px solid var(--line);
  font-size: 0.9rem; font-weight: 600; color: var(--muted);
}
.battle-pulse {
  width: 10px; height: 10px; border-radius: 99px;
  background: var(--green); animation: pulse 1s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
  50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(16,185,129,0); }
}

@media (max-width: 900px) {
  .battle-arena { grid-template-columns: 1fr; }
}
`

function ModelCard({ model, score, steps, comments, isWinner, isRunning }) {
  const pct = Math.min((score / 1.0) * 100, 100)

  return (
    <div
      className={`battle-card ${isWinner ? 'winner' : ''}`}
      style={{
        borderColor: isWinner ? model.color : 'transparent',
        boxShadow: isWinner ? `0 0 40px ${model.glow}` : undefined,
      }}
    >
      {/* Header */}
      <div className="battle-card-header">
        <div className="battle-model-icon" style={{ background: model.color }}>
          {model.label[0]}
        </div>
        <div>
          <div className="battle-model-name" style={{ color: model.color }}>
            {model.label}
          </div>
          <div className="battle-model-tag">{isWinner ? '🏆 Winner' : isRunning ? 'Reviewing…' : 'Standby'}</div>
        </div>
      </div>

      {/* Score */}
      <div className="battle-score-block">
        <div className="battle-score-num" style={{ color: model.color }}>
          {score.toFixed(2)}
        </div>
        <div className="battle-steps-label">{steps} step{steps !== 1 ? 's' : ''} taken</div>
      </div>

      {/* Progress bar */}
      <div className="battle-progress-track">
        <div
          className="battle-progress-fill"
          style={{ width: `${pct}%`, background: model.color }}
        />
      </div>

      {/* Comments feed */}
      <div className="battle-comments">
        {comments.length === 0 && (
          <div className="battle-comment-item">Waiting for review…</div>
        )}
        {[...comments].reverse().slice(0, 5).map((c, i) => (
          <div key={i} className="battle-comment-item">
            <strong>Line {c.line} · {c.severity}</strong><br />
            {c.message?.slice(0, 60)}{c.message?.length > 60 ? '…' : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Battle() {
  const { settings } = useAppContext()

  const [task, setTask] = useState('easy')
  const [status, setStatus] = useState('idle') // idle | running | done
  const [battleData, setBattleData] = useState(null)
  const [battleId, setBattleId] = useState(null)
  const wsRef = useRef(null)

  // Initialize score/steps/comments state per model
  const initState = () =>
    Object.fromEntries(MODELS.map(m => [m.name, { score: 0, steps: 0, comments: [] }]))

  const [modelState, setModelState] = useState(initState)

  // Connect to WebSocket for live updates
  const connectWs = (id) => {
    if (wsRef.current) wsRef.current.close()
    const wsUrl = SERVER_URL.replace('http', 'ws')
    const ws = new WebSocket(`${wsUrl}/battle/${id}/ws`)
    wsRef.current = ws

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data)
        setBattleData(data)

        // Update per-model state from server broadcast
        const next = {}
        for (const m of MODELS) {
          next[m.name] = {
            score: data.scores?.[m.name] ?? 0,
            steps: data.steps?.[m.name] ?? 0,
            comments: data.comments?.[m.name] ?? [],
          }
        }
        setModelState(next)

        if (data.status === 'completed') {
          setStatus('done')
          ws.close()
        }
      } catch (_) {}
    }
    ws.onerror = () => ws.close()
  }

  // Simulate battle steps by calling /battle/{id}/step/{model}
  const simulateBattle = async (id) => {
    const delay = (ms) => new Promise(r => setTimeout(r, ms))
    const maxSteps = 6

    const runModel = async (model) => {
      for (let step = 0; step < maxSteps; step++) {
        await delay(600 + Math.random() * 800) // stagger steps

        const payload = {
          line: Math.floor(Math.random() * 20) + 1,
          severity: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
          category: 'security',
          message: `Potential vulnerability detected at step ${step + 1}`,
          fix: 'Apply input sanitization.',
          done: step === maxSteps - 1,
        }

        await fetch(`${SERVER_URL}/battle/${id}/step/${encodeURIComponent(model)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {})
      }
    }

    // Run all 3 models concurrently
    await Promise.all(MODELS.map(m => runModel(m.name)))
  }

  const startBattle = async () => {
    setStatus('running')
    setModelState(initState())
    setBattleData(null)

    try {
      const resp = await fetch(`${SERVER_URL}/battle/create?task=${task}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, models: MODELS.map(m => m.name) }),
      })
      const data = await resp.json()
      const id = data.battle_id
      setBattleId(id)
      connectWs(id)
      simulateBattle(id) // fire and forget
    } catch (e) {
      console.error('Battle start failed:', e)
      setStatus('idle')
    }
  }

  const resetBattle = () => {
    if (wsRef.current) wsRef.current.close()
    setStatus('idle')
    setBattleData(null)
    setBattleId(null)
    setModelState(initState())
  }

  // Cleanup on unmount
  useEffect(() => () => wsRef.current?.close(), [])

  const winner = battleData?.winner

  return (
    <div className="battle-page">
      <style>{battleStyles}</style>

      {/* Controls */}
      <div className="battle-controls">
        <select
          className="battle-task-select"
          value={task}
          onChange={e => setTask(e.target.value)}
          disabled={status === 'running'}
        >
          {TASKS.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Task</option>
          ))}
        </select>

        <button
          className={`battle-start-btn ${status === 'running' ? 'running' : 'ready'}`}
          onClick={startBattle}
          disabled={status === 'running'}
        >
          {status === 'running'
            ? <><span className="battle-pulse" />Battle in progress…</>
            : <><Swords size={18} />Start Battle</>
          }
        </button>

        {status === 'done' && (
          <button className="battle-again-btn" onClick={resetBattle}>
            <RotateCcw size={16} /> Fight Again
          </button>
        )}
      </div>

      {/* Status bar when running */}
      {status === 'running' && (
        <div className="battle-status-bar">
          <span className="battle-pulse" />
          3 models reviewing the <strong style={{ color: 'var(--text)', marginLeft: 4 }}>{task}</strong>&nbsp;task simultaneously…
        </div>
      )}

      {/* Winner banner */}
      {status === 'done' && winner && (() => {
        const winnerModel = MODELS.find(m => m.name === winner)
        return (
          <div className="battle-winner-banner">
            <div className="battle-winner-trophy">🏆</div>
            <div className="battle-winner-title">Battle Winner</div>
            <div className="battle-winner-name" style={{ color: winnerModel?.color ?? '#fff' }}>
              {winnerModel?.label ?? winner}
            </div>
            <div className="battle-winner-score">
              Final Score: {modelState[winner]?.score.toFixed(3)}
            </div>
          </div>
        )
      })()}

      {/* Arena — 3 columns */}
      <div className="battle-arena">
        {MODELS.map(model => (
          <ModelCard
            key={model.name}
            model={model}
            score={modelState[model.name]?.score ?? 0}
            steps={modelState[model.name]?.steps ?? 0}
            comments={modelState[model.name]?.comments ?? []}
            isWinner={status === 'done' && winner === model.name}
            isRunning={status === 'running'}
          />
        ))}
      </div>
    </div>
  )
}
