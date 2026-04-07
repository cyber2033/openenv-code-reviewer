import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import {
  AppProvider,
  formatTaskLabel,
  normalizeTaskType,
  useAppContext,
} from './AppContext'
import Sidebar from './components/Sidebar'
import ApiDocs from './pages/ApiDocs'
import DiffViewer from './pages/DiffViewer'
import Leaderboard from './pages/Leaderboard'
import LiveMonitor from './pages/LiveMonitor'
import Replay from './pages/Replay'
import Scoring from './pages/Scoring'
import Settings from './pages/Settings'
import TaskExplorer from './pages/TaskExplorer'

const routeMeta = {
  '/': {
    eyebrow: 'PHASE 1',
    title: 'AI Code Review Environment',
    subtitle: 'This project is an AI evaluation system where an agent reviews code, finds bugs, and is scored based on accuracy.',
  },
  '/diff': {
    eyebrow: 'Review Surface',
    title: 'Code Diff Viewer',
    subtitle: 'Active code under review.',
  },
  '/scoring': {
    eyebrow: 'Judge Analytics',
    title: 'Score Analytics',
    subtitle: 'Episode performance breakdown.',
  },
  '/leaderboard': {
    eyebrow: 'Competitive View',
    title: 'Leaderboard',
    subtitle: 'Top performing agents ranked by score.',
  },
  '/replay': {
    eyebrow: 'History Browser',
    title: 'Episode Replay',
    subtitle: 'Browse and replay past episodes.',
  },
  '/tasks': {
    eyebrow: 'Task Library',
    title: 'Task Explorer',
    subtitle: 'Browse available tasks by difficulty.',
  },
  '/api': {
    eyebrow: 'Integration Surface',
    title: 'API Reference',
    subtitle: 'All available endpoints and schemas.',
  },
  '/settings': {
    eyebrow: 'Local Controls',
    title: 'Settings',
    subtitle: 'Environment and runtime configuration.',
  },
}

const globalStyles = `
:root {
  --bg: #ffffff;
  --sidebar: #fcfdfe;
  --panel: #ffffff;
  --panel-soft: #f8fafc;
  --line: rgba(15, 23, 42, 0.08);
  --text: #0f172a;
  --muted: #64748b;
  --green: #10b981;
  --green-soft: rgba(16, 185, 129, 0.08);
  --red: #ef4444;
  --red-soft: rgba(239, 68, 68, 0.08);
  --blue: #3b82f6;
  --blue-soft: rgba(59, 130, 246, 0.08);
  --amber: #f59e0b;
  --silver: #cbd5e1;
  --bronze: #94a3b8;
  --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-rich: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.05);
  color: var(--text);
  background: white;
  font-family: "Outfit", "Inter", system-ui, sans-serif;
}
*,
*::before,
*::after {
  box-sizing: border-box;
}
html,
body,
#root {
  min-height: 100%;
}
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}
button,
input,
textarea,
select {
  font: inherit;
}
button {
  border: 0;
  cursor: pointer;
}
pre,
code,
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
a {
  color: inherit;
  text-decoration: none;
}
#root {
  min-height: 100vh;
}
.app-shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg);
}
.main-shell {
  flex: 1;
  min-width: 0;
  padding: 40px;
}
.top-strip {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 40px;
}
.page-transition {
  animation: pageFade 180ms ease;
}
.eyebrow {
  margin: 0 0 12px;
  color: var(--muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 0.75rem;
  font-weight: 600;
}
.page-title {
  margin: 0;
  font-size: 3.2rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--text);
}
.page-subtitle {
  margin: 16px 0 0;
  max-width: 64ch;
  color: var(--muted);
  font-size: 1.15rem;
  line-height: 1.6;
}
.top-strip__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-end;
}
.status-pill,
.chip,
.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 99px;
  border: 1px solid var(--line);
  background: var(--panel-soft);
  color: var(--text);
  font-size: 0.88rem;
  font-weight: 500;
}
.status-pill strong,
.chip strong {
  font-weight: 700;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 99px;
  background: var(--muted);
}
.status-dot.live {
  background: var(--green);
  box-shadow: 0 0 12px var(--green);
}
.status-dot.offline {
  background: var(--red);
}
.page {
  display: grid;
  gap: 32px;
}
.grid {
  display: grid;
  gap: 32px;
}
.grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.grid.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.grid.sidebar-right {
  grid-template-columns: minmax(0, 1.4fr) minmax(360px, 0.9fr);
  align-items: start;
}
.grid.sidebar-left {
  grid-template-columns: minmax(360px, 0.9fr) minmax(0, 1.4fr);
  align-items: start;
}
.stack {
  display: grid;
  gap: 24px;
}
.card {
  border: 1px solid var(--line);
  border-radius: 24px;
  background: var(--panel);
  box-shadow: var(--shadow);
  padding: 32px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.card:hover {
  box-shadow: var(--shadow-rich);
  transform: translateY(-2px);
}
.card h2,
.card h3 {
  margin: 0 0 8px;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.02em;
}
.card p {
  color: var(--muted);
  line-height: 1.6;
  margin: 0;
}
.metric-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  min-height: 160px;
}
.metric-label {
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.8rem;
  font-weight: 600;
}
.metric-value {
  font-size: 3.5rem;
  font-weight: 800;
  letter-spacing: -0.05em;
  color: var(--text);
  line-height: 1;
}
.metric-meta {
  font-size: 0.9rem;
  color: var(--muted);
}
.text-green { color: var(--green); }
.text-red { color: var(--red); }
.text-blue { color: var(--blue); }
.badge.green {
  background: var(--green-soft);
  color: var(--green);
  border-color: transparent;
}
.badge.red {
  background: var(--red-soft);
  color: var(--red);
  border-color: transparent;
}
.badge.blue {
  background: var(--blue-soft);
  color: var(--blue);
}
.badge.muted {
  color: #b8b8d8;
}
.list {
  display: grid;
  gap: 12px;
}
.list-item {
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.02);
}
.list-item strong {
  display: block;
  margin-bottom: 6px;
}
.mini-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: #9e9ebe;
  font-size: 0.9rem;
}
.feed {
  display: grid;
  gap: 12px;
  max-height: 380px;
  overflow: auto;
}
.feed-item {
  border-left: 3px solid var(--blue);
  padding: 10px 0 10px 14px;
}
.feed-item.positive {
  border-left-color: var(--green);
}
.feed-item.negative {
  border-left-color: var(--red);
}
.feed-item p,
.feed-item pre {
  margin: 8px 0 0;
}
.json-stream {
  max-height: 420px;
  overflow: auto;
  padding: 16px;
  border-radius: 18px;
  background: #080810;
  border: 1px solid var(--line);
}
.json-stream pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: #bdf9da;
  line-height: 1.5;
}
.diff-panel {
  border: 1px solid var(--line);
  border-radius: 20px;
  overflow: hidden;
  background: #090913;
}
.diff-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
}
.diff-list {
  max-height: 70vh;
  overflow: auto;
}
.diff-line {
  position: relative;
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: start;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}
.diff-line:hover {
  background: rgba(255, 255, 255, 0.025);
}
.diff-line.positive {
  background: rgba(0, 255, 136, 0.06);
}
.diff-line.negative {
  background: rgba(255, 68, 68, 0.08);
}
.diff-line__number {
  color: var(--muted);
  font-size: 0.88rem;
}
.diff-line__content {
  min-width: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: #f4f6ff;
}
.diff-line__content .kw {
  color: #7db8ff;
}
.diff-line__content .str {
  color: #f5d38a;
}
.diff-line__content .num {
  color: #9af0bc;
}
.diff-line__content .com {
  color: #8b8ba7;
}
.severity-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.severity-pill.critical,
.severity-pill.high {
  background: var(--red-soft);
  color: var(--red);
}
.severity-pill.medium {
  background: rgba(248, 193, 79, 0.12);
  color: var(--amber);
}
.severity-pill.low,
.severity-pill.unknown {
  background: var(--blue-soft);
  color: var(--blue);
}
.tooltip {
  position: absolute;
  z-index: 4;
  inset: auto 16px calc(100% + 8px) auto;
  width: min(360px, calc(100vw - 80px));
  padding: 14px;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: #13132b;
  box-shadow: var(--shadow);
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
  transition: opacity 140ms ease, transform 140ms ease;
}
.diff-line:hover .tooltip,
.signal-badge:hover .tooltip {
  opacity: 1;
  transform: translateY(0);
}
.tooltip p {
  margin: 8px 0 0;
}
.signal-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.signal-badge {
  position: relative;
}
.chart-wrap {
  width: 100%;
  height: 320px;
}
.table-wrap {
  overflow: auto;
}
.table {
  width: 100%;
  min-width: 700px;
  border-collapse: collapse;
}
.table th,
.table td {
  padding: 14px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
}
.table th {
  color: var(--muted);
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.rank-1 {
  background: rgba(248, 193, 79, 0.10);
}
.rank-2 {
  background: rgba(174, 184, 209, 0.08);
}
.rank-3 {
  background: rgba(187, 124, 82, 0.08);
}
.filter-row,
.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.button,
.ghost-button,
.chip-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 16px;
  border-radius: 14px;
  border: 1px solid var(--line);
  transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
}
.button:hover,
.ghost-button:hover,
.chip-button:hover {
  transform: translateY(-1px);
}
.button {
  background: var(--green-soft);
  color: var(--green);
}
.button.red {
  background: var(--red-soft);
  color: var(--red);
}
.ghost-button,
.chip-button {
  background: rgba(255, 255, 255, 0.02);
  color: var(--text);
}
.chip-button.active {
  background: var(--blue-soft);
  color: var(--blue);
}
.form-grid {
  display: grid;
  gap: 14px;
}
.form-grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.field {
  display: grid;
  gap: 8px;
}
.field label {
  color: #b9b9d6;
  font-size: 0.9rem;
}
.input,
.select,
.textarea,
.slider {
  width: 100%;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: #090913;
  color: var(--text);
  padding: 12px 14px;
}
.textarea {
  min-height: 130px;
  resize: vertical;
}
.split-view {
  display: grid;
  grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.2fr);
  gap: 18px;
}
.episode-list {
  display: grid;
  gap: 10px;
  max-height: 70vh;
  overflow: auto;
}
.episode-item {
  display: grid;
  gap: 8px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
  text-align: left;
}
.episode-item.active {
  border-color: rgba(68, 136, 255, 0.5);
  background: rgba(68, 136, 255, 0.10);
}
.timeline {
  display: grid;
  gap: 12px;
  max-height: 60vh;
  overflow: auto;
}
.timeline-item {
  border-left: 3px solid var(--blue);
  padding-left: 14px;
}
.task-card {
  transition: border-color 160ms ease, transform 160ms ease, background 160ms ease;
}
.task-card.expanded {
  border-color: rgba(0, 255, 136, 0.35);
  transform: translateY(-2px);
}
.code-block {
  margin: 0;
  padding: 14px;
  border-radius: 18px;
  background: #090913;
  border: 1px solid var(--line);
  overflow: auto;
  color: #dff5e7;
  white-space: pre-wrap;
}
.endpoint-grid {
  display: grid;
  gap: 14px;
}
.endpoint-card {
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.02);
}
.endpoint-card pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.response-box {
  margin-top: 12px;
  padding: 14px;
  border-radius: 16px;
  background: #090913;
  border: 1px solid var(--line);
}
.settings-grid {
  display: grid;
  gap: 14px;
}
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}
.toggle {
  position: relative;
  width: 58px;
  height: 32px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}
.toggle::after {
  content: "";
  position: absolute;
  inset: 4px auto auto 4px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #fff;
  transition: transform 160ms ease;
}
.toggle.on {
  background: var(--green-soft);
}
.toggle.on::after {
  transform: translateX(26px);
  background: var(--green);
}
.empty {
  padding: 40px;
  text-align: center;
  color: var(--muted);
  font-size: 1rem;
  border: 1px dashed var(--line);
  border-radius: 16px;
  background: var(--panel-soft);
}
.button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}
.button.primary {
  background: var(--text);
  color: white;
}
.button.primary:hover {
  background: #334155;
}
.button.outline {
  background: white;
  border: 1px solid var(--line);
  color: var(--text);
}
.button.outline:hover {
  border-color: var(--text);
}
.diff-list {
  background: white;
  border-radius: 20px;
  overflow: hidden;
}
.diff-toolbar {
  padding: 20px 32px;
  background: var(--panel-soft);
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.diff-line {
  display: list-item;
  list-style: none;
  display: grid;
  grid-template-columns: 60px 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 12px 32px;
  border-bottom: 1px solid var(--line);
  transition: background 0.15s ease;
}
.diff-line:hover {
  background: var(--panel-soft);
}
.diff-line.positive {
  background: #f0fdf4;
}
.diff-line.negative {
  background: #fef2f2;
}
.diff-line__number {
  color: #94a3b8;
  font-size: 0.85rem;
  user-select: none;
}
.diff-line__content {
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 0.95rem;
  color: var(--text);
}
.kw { color: #0f172a; font-weight: 700; }
.str { color: #0891b2; }
.num { color: #f59e0b; }
.com { color: #94a3b8; font-style: italic; }

.severity-pill {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.severity-pill.critical { background: var(--red); color: white; }
.severity-pill.medium { background: var(--amber); color: white; }
.severity-pill.low { background: var(--blue); color: white; }

.signal-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}
.signal-badge {
  padding: 4px;
  border-radius: 8px;
  background: var(--panel-soft);
  border: 1px solid var(--line);
}
.table-wrap {
  overflow-x: auto;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: white;
}
.table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.table th {
  padding: 16px 24px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-bottom: 1px solid var(--line);
  background: var(--panel-soft);
}
.table td {
  padding: 18px 24px;
  font-size: 0.95rem;
  border-bottom: 1px solid var(--line);
  color: var(--text);
}
.table tr:last-child td {
  border-bottom: 0;
}
.table tr.rank-1 { background: #fefce8; }
.table tr.rank-2 { background: #f8fafc; }
.table tr.rank-3 { background: #fff7ed; }

.form-grid {
  display: grid;
  gap: 24px;
}
.form-grid.two {
  grid-template-columns: 1fr 1fr;
}
.field {
  display: grid;
  gap: 8px;
}
.field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
}
.input, .select {
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--panel-soft);
  color: var(--text);
  font-size: 0.95rem;
  transition: all 0.2s ease;
  outline: none;
}
.input:focus, .select:focus {
  border-color: var(--blue);
  background: white;
  box-shadow: 0 0 0 4px var(--blue-soft);
}
.chip-button {
  padding: 8px 16px;
  border-radius: 99px;
  border: 1px solid var(--line);
  background: white;
  color: var(--muted);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}
.chip-button:hover {
  background: var(--panel-soft);
}
.chip-button.active {
  background: var(--text);
  color: white;
  border-color: var(--text);
}
.chart-wrap {
  height: 380px;
  width: 100%;
  margin-top: 32px;
  padding: 24px;
  background: white;
  border-radius: 20px;
  border: 1px solid var(--line);
}
.split-view {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 32px;
  align-items: start;
}
.episode-list {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}
.episode-item {
  width: 100%;
  text-align: left;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: white;
  transition: all 0.2s ease;
  cursor: pointer;
}
.episode-item:hover {
  background: var(--panel-soft);
  border-color: var(--blue);
}
.episode-item.active {
  background: var(--blue-soft);
  border-color: var(--blue);
}
.timeline {
  display: grid;
  gap: 16px;
}
.timeline-item {
  padding: 16px;
  border-left: 4px solid var(--blue);
  background: var(--panel-soft);
  border-radius: 4px 12px 12px 4px;
  transition: all 0.2s ease;
}
.timeline-item:hover {
  background: white;
  box-shadow: var(--shadow);
}
.endpoint-card {
  padding: 24px;
  border-bottom: 1px solid var(--line);
  transition: background 0.2s ease;
}
.endpoint-card:hover {
  background: var(--panel-soft);
}
.response-box {
  padding: 20px;
  background: #0f172a;
  color: #f8fafc;
  border-radius: 12px;
  font-size: 0.85rem;
  overflow: auto;
  max-height: 400px;
}
.ghost-button {
  padding: 8px 16px;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font-weight: 600;
  font-size: 0.85rem;
  transition: all 0.2s ease;
  cursor: pointer;
}
.ghost-button:hover {
  background: var(--panel-soft);
  color: var(--text);
}
@keyframes pageFade {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (max-width: 1180px) {
  .grid.two,
  .grid.three,
  .grid.sidebar-right,
  .grid.sidebar-left,
  .split-view,
  .form-grid.two {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 960px) {
  .main-shell {
    padding: 78px 18px 24px;
  }
  .top-strip {
    flex-direction: column;
  }
}
@media (max-width: 720px) {
  .page-title {
    font-size: 1.8rem;
  }
  .diff-line {
    grid-template-columns: 1fr;
  }
  .table {
    min-width: 560px;
  }
}
`

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LiveMonitor />} />
      <Route path="/diff" element={<DiffViewer />} />
      <Route path="/scoring" element={<Scoring />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/replay" element={<Replay />} />
      <Route path="/tasks" element={<TaskExplorer />} />
      <Route path="/api" element={<ApiDocs />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function Shell() {
  const location = useLocation()
  const { connectionStatus, runState, observation } = useAppContext()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const meta = routeMeta[location.pathname] || routeMeta['/']
  const statusText =
    connectionStatus === 'live'
      ? 'WebSocket live'
      : connectionStatus === 'connecting'
        ? 'Connecting'
        : 'Offline'
  const taskName = useMemo(
    () => formatTaskLabel(observation.task_name || normalizeTaskType(observation.task_type)),
    [observation.task_name, observation.task_type],
  )

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={sidebarOpen}
        onOpen={() => setSidebarOpen(true)}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="main-shell">
        <header className="top-strip">
          <div>
            <p className="eyebrow">{meta.eyebrow}</p>
            <h1 className="page-title">{meta.title}</h1>
            <p className="page-subtitle">{meta.subtitle}</p>
          </div>

          <div className="top-strip__meta">
            <span className="status-pill">
              <span className={`status-dot ${connectionStatus === 'live' ? 'live' : 'offline'}`} />
              <strong>{statusText}</strong>
            </span>
            <span className="status-pill">
              Episode
              <strong>{runState.episode_id || 'Waiting'}</strong>
            </span>
            <span className="status-pill">
              Task
              <strong>{taskName}</strong>
            </span>
          </div>
        </header>

        <div className="page-transition" key={location.pathname}>
          <AppRoutes />
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <>
      <style>{globalStyles}</style>
      <BrowserRouter>
        <AppProvider>
          <Shell />
        </AppProvider>
      </BrowserRouter>
    </>
  )
}
