import {
  Menu,
  Settings,
  Trophy,
  Activity,
  FileCode2,
  Braces,
  Gauge,
  PlayCircle,
  Layers,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { formatScore, formatTaskLabel, useAppContext } from '../AppContext'

const navItems = [
  { to: '/', label: 'Live Monitor', icon: Activity },
  { to: '/diff', label: 'Diff Viewer', icon: FileCode2 },
  { to: '/scoring', label: 'Analytics', icon: Gauge },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/replay', label: 'Replay', icon: PlayCircle },
  { to: '/tasks', label: 'Tasks', icon: Layers },
  { to: '/api', label: 'API', icon: Braces },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const sidebarStyles = `
.sidebar-toggle {
  position: fixed;
  z-index: 30;
  inset: 18px auto auto 18px;
  display: none;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(17, 17, 40, 0.96);
  border: 1px solid rgba(102, 102, 128, 0.24);
  color: var(--text);
  box-shadow: var(--shadow);
}
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: rgba(4, 4, 10, 0.72);
  border: 0;
}
.sidebar {
  position: sticky;
  top: 0;
  z-index: 24;
  display: flex;
  flex-direction: column;
  width: 320px;
  min-width: 320px;
  min-height: 100vh;
  padding: 40px 24px;
  background: var(--sidebar);
  border-right: 1px solid var(--line);
}
.sidebar-logo {
  font-size: 1.5rem;
  font-weight: 900;
  color: var(--text);
  margin-bottom: 8px;
  letter-spacing: -0.04em;
  text-align: left;
  background: none;
  padding: 0;
}
.sidebar-copy {
  margin: 0 0 40px;
  color: var(--muted);
  font-size: 0.95rem;
  line-height: 1.5;
}
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}
.sidebar-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  color: var(--muted);
  font-weight: 600;
  font-size: 0.95rem;
  transition: all 0.2s ease;
}
.sidebar-link:hover {
  background: var(--panel-soft);
  color: var(--text);
}
.sidebar-link.active {
  background: var(--blue-soft);
  color: var(--blue);
}
.sidebar-link svg {
  width: 20px;
  height: 20px;
  opacity: 0.7;
}
.sidebar-link.active svg {
  opacity: 1;
}
.sidebar-meta {
  margin-top: 40px;
  display: grid;
  gap: 24px;
}
.sidebar-panel {
  display: grid;
  gap: 8px;
}
.sidebar-label {
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.sidebar-score {
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.04em;
  line-height: 1;
}
.sidebar-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  color: var(--muted);
}
.sidebar-status strong {
  color: var(--text);
}
.sidebar-select {
  width: 100%;
  margin-top: 4px;
  background: var(--panel-soft);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px;
  color: var(--text);
  font-size: 0.9rem;
  font-family: inherit;
  font-weight: 500;
  outline: none;
  cursor: pointer;
}
.sidebar-select:hover {
  border-color: var(--blue);
}
.sidebar-select option {
  background: white;
  color: var(--text);
}
@media (max-width: 960px) {
  .sidebar-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    transform: translateX(-108%);
    transition: transform 180ms ease;
    box-shadow: var(--shadow);
  }
  .sidebar.is-open {
    transform: translateX(0);
  }
}
`

export default function Sidebar({ isOpen, onOpen, onClose }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { connectionStatus, observation, runState, updateSetting } = useAppContext()

  const taskLabel = formatTaskLabel(observation.task_name || observation.task_type)
  const socketTone = connectionStatus === 'live' ? 'live' : 'offline'

  return (
    <>
      <style>{sidebarStyles}</style>

      <button type="button" className="sidebar-toggle" onClick={isOpen ? onClose : onOpen}>
        <Menu size={22} />
      </button>

      {isOpen ? (
        <button type="button" aria-label="Close sidebar" className="sidebar-backdrop" onClick={onClose} />
      ) : null}

      <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
        <button type="button" className="sidebar-logo" onClick={() => navigate('/')}>
          AI Code Review
        </button>
        <p className="sidebar-copy">
          This project is an AI evaluation system where an agent reviews code, finds bugs, and is scored based on accuracy.
        </p>

        <nav className="sidebar-nav">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to

            return (
              <Link
                key={to}
                to={to}
                className={`sidebar-link ${active ? 'active' : ''}`}
                onClick={onClose}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-meta">
          <div className="sidebar-panel">
            <span className="sidebar-label">Select review model</span>
            <select 
              className="sidebar-select"
              value={runState.model_name || 'gemini-1.5-flash'}
              onChange={(e) => updateSetting('modelName', e.target.value)}
            >
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="claude-3-haiku">Claude 3.5 Haiku</option>
            </select>
          </div>

          <div className="sidebar-panel">
            <span className="sidebar-label">Score</span>
            <div className="sidebar-score">{formatScore(observation.current_score)}</div>
            <div className="sidebar-status">
              <span>{taskLabel}</span>
              <strong>{runState.done ? 'DONE' : observation.task_name ? 'RUNNING' : 'IDLE'}</strong>
            </div>
          </div>

          <div className="sidebar-panel">
            <span className="sidebar-label">Connection</span>
            <div className="sidebar-status">
              <span className={`status-dot ${socketTone}`} />
              <strong>{connectionStatus === 'live' ? 'Connected' : 'Disconnected'}</strong>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
