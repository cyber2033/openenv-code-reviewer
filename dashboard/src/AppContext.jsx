import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const API_BASE =
  import.meta.env.VITE_SERVER_URL ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? `${window.location.protocol}//${window.location.hostname}:7860`
    : '')

const SETTINGS_KEY = 'openenv-dashboard-settings'

const EMPTY_STATE = {
  observation: {
    diff: '',
    filename: 'snippet.py',
    step: 0,
    max_steps: 10,
    comments_so_far: [],
    current_score: 0,
    score_delta: 0,
    bugs_remaining_hint: 0,
    task_type: 'idle',
    task_name: '',
    episode_id: '',
    hints_remaining: 0,
  },
  step: 0,
  done: false,
  total_reward: 0,
  success: false,
  episode_id: '',
  task_name: '',
  performance_trend: 'stable',
  started_at: null,
  finished_at: null,
}

const DEFAULT_SETTINGS = {
  hintsEnabled: true,
  llmJudgeEnabled: false,
  modelName: 'gemini-1.5-flash',
  language: 'en',
}

export const taskCatalog = [
  {
    id: 'easy',
    title: 'Easy',
    description: 'Single-function logic and syntax review for quick grading loops.',
    bugs: '1 bug per snippet',
    steps: 6,
    baseline: '0.45 baseline',
    expectedScore: '0.80+ strong run',
    snippet: `def get_average(items):\n    total = sum(items)\n    avg = total / len(items)\n    return avg`,
    formula:
      'Line match plus severity match. Clean precision matters because each wasted comment reduces the score.',
  },
  {
    id: 'medium',
    title: 'Medium',
    description: 'Security-focused Flask review with auth, traversal, and injection issues.',
    bugs: '1 security issue per task',
    steps: 8,
    baseline: '0.55 baseline',
    expectedScore: '0.85+ strong run',
    snippet: `@app.route('/download')\ndef download():\n    filename = request.args.get('file')\n    with open(filename, 'r') as f:\n        return f.read()`,
    formula:
      'Recall and precision both count. Correct category tagging improves the final score while false positives drag it down.',
  },
  {
    id: 'hard',
    title: 'Hard',
    description: 'PR-style diff review with subtle security defects and stricter matching.',
    bugs: '1-2 bugs per diff',
    steps: 10,
    baseline: '0.60 baseline',
    expectedScore: '0.90+ elite run',
    snippet: `--- a/config.py\n+++ b/config.py\n6: data = yaml.load(user_uploaded_config, Loader=yaml.Loader)\n7: return data`,
    formula:
      'Coverage, precision, and severity alignment decide the score. Repeated noisy comments flatten reward gains.',
  },
]

export const translations = {
  en: {
    offline: 'OFFLINE',
    connecting: 'CONNECTING',
    live: 'WS LIVE',
    session: 'Session',
    task: 'Task',
    performanceScore: 'Performance Score',
    assignedComplexity: 'Assigned Complexity',
    agentDeployment: 'Agent Deployment',
    latestObservations: 'Analyst Observations',
    reconnect: 'Reconnect',
    intelligenceView: 'Intelligence View',
    accuracySignal: 'Accuracy Signal',
    bugsFound: 'Bugs Found',
    remediation: 'Proposed Remediation',
    // Navbar / Sidebar
    navLiveMonitor: 'Live Monitor',
    navLabAudit: 'Custom Lab',
    navDiffViewer: 'Diff Viewer',
    navAnalytics: 'Analytics',
    navLeaderboard: 'Leaderboard',
    navReplay: 'Replay',
    navTasks: 'Tasks',
    navAPI: 'API Docs',
    navSettings: 'Settings',
    navBattle: 'Battle Mode',
    navTitle: 'OpenEnv',
    // Sidebar Meta
    aiEngineConfig: 'AI ENGINE CONFIG',
    sidebarScore: 'Score',
    sidebarConnection: 'Connection',
    sidebarConnected: 'Connected',
    sidebarDisconnected: 'Disconnected',
    // Settings
    settingsTitle: 'Settings',
    settingsDesc: 'Configure your dashboard localization and model preferences.',
    languageSelect: 'Display Language',
    languageEn: 'English',
    languageMr: 'मराठी (Marathi)',
    // LabAudit
    labTitle: 'Custom Security Lab',
    labDesc: 'Paste any snippet below to run a professional AI security audit.',
    labRun: 'Run Security Audit',
    labStarting: 'Starting...',
    labGuideTitle: 'Laboratory Guide',
    labGuideDesc: 'The Custom Lab allows for Ad-Hoc Security Scanning.',
    labStep1: "Paste raw code (doesn't need to be a full file).",
    labStep2: 'Toggle the AI Engine Config in the sidebar before running.',
    labStep3: 'Go to Live Monitor to watch results in real-time.',
    labStep4: 'View the Analytics page for the final Audit Tier.',
    labStatusLabel: 'Status',
    labBusy: 'System Busy',
    labReady: 'System Ready',
    // Leaderboard
    lbTotalEntries: 'Total entries',
    lbTopScore: 'Top score',
    lbRankings: 'Rankings',
    lbRankDesc: 'Top 3 highlighted with gold, silver, and bronze.',
    lbRefresh: '↻ Refresh',
    lbSubmitTitle: 'Submit your score',
    lbSubmitDesc: "Add your agent's result to the leaderboard.",
    lbAgentName: 'Agent name',
    lbTask: 'Task',
    lbScore: 'Score (0–1)',
    lbSteps: 'Steps used',
    lbModel: 'Model (optional)',
    lbSubmit: 'Submit score',
    lbSubmitting: 'Submitting…',
    lbSuccess: 'Submitted successfully!',
    lbColRank: 'Rank',
    lbColAgent: 'Agent',
    lbColTask: 'Task',
    lbColScore: 'Score',
    lbColSteps: 'Steps',
    lbColModel: 'Model',
    lbEmpty: 'No entries yet. Submit a run below!',
    // Scoring
    scoringEvalResult: 'Evaluation Result',
    scoringRating: 'Performance Rating',
    scoringCurrent: 'Current score',
    scoringTP: 'True positives',
    scoringFP: 'False positives',
    scoringSeverity: 'Severity accuracy',
    scoringTrend: 'Performance trend',
    scoringOverTime: 'Score over time',
    scoringRewardPerStep: 'Reward per step',
    scoringStepBreakdown: 'Step breakdown',
    // Settings - remaining sections
    settingsBackendStatus: 'Backend status',
    settingsActiveEpisode: 'Active episode',
    settingsApiTitle: 'Reviewer API configuration',
    settingsApiDesc: 'Verification of API keys in .env file for LLM-based reviews.',
    settingsCheckApi: 'Check API Status',
    settingsChecking: 'Checking...',
    settingsRuntimeTitle: 'Runtime configuration',
    settingsRuntimeDesc: 'Read-only values from the backend.',
    settingsReviewerModel: 'Reviewer model',
    settingsHintsLabel: 'Hints enabled',
    settingsHintsDesc: 'Allow the agent to consume hints. Each hint applies a -0.05 penalty.',
    settingsLlmLabel: 'LLM judge enabled',
    settingsLlmDesc: 'Use the LLM-based secondary judge alongside the rule-based grader.',
    settingsDangerTitle: 'Danger zone',
    settingsDangerDesc: 'These actions clear local dashboard caches.',
    settingsClearLb: 'Clear leaderboard cache',
    settingsClearReplay: 'Clear replay history cache',
  },
  mr: {
    offline: 'ऑफलाईन',
    connecting: 'कनेक्ट होत आहे',
    live: 'लाईव्ह',
    session: 'सेशन',
    task: 'टास्क',
    performanceScore: 'कामगिरी स्कोर',
    assignedComplexity: 'काठीण्य पातळी',
    agentDeployment: 'एजंट स्थिती',
    latestObservations: 'निरीक्षणे',
    reconnect: 'पुन्हा जोडा',
    intelligenceView: 'इंटेलिजेंस व्ह्यू',
    accuracySignal: 'अ‍ॅक्युरेसी सिग्नल',
    bugsFound: 'सापडलेले बग्स',
    remediation: 'उपाय योजना',
    navLiveMonitor: 'लाईव्ह मॉनिटर',
    navLabAudit: 'कस्टम लॅब',
    navDiffViewer: 'डिफ व्ह्यूअर',
    navAnalytics: 'विश्लेषण',
    navLeaderboard: 'लीडरबोर्ड',
    navReplay: 'रिप्ले',
    navTasks: 'टास्क',
    navAPI: 'API डॉक्स',
    navSettings: 'सेटिंग्ज',
    navBattle: 'बॅटल मोड',
    navTitle: 'ओपन-एन्व्ह',
    aiEngineConfig: 'एआय इंजिन',
    sidebarScore: 'स्कोर',
    sidebarConnection: 'कनेक्शन',
    sidebarConnected: 'कनेक्टेड आहे',
    sidebarDisconnected: 'खंडित झाले',
    settingsTitle: 'सेटिंग्ज',
    settingsDesc: 'तुमच्या डॅशबोर्डची भाषा आणि एआय मॉडेल प्राधान्ये कॉन्फिगर करा.',
    languageSelect: 'डॅशबोर्डची भाषा',
    languageEn: 'English',
    languageMr: 'मराठी (Marathi)',
    // LabAudit
    labTitle: 'कस्टम सिक्युरिटी लॅब',
    labDesc: 'खालील बॉक्समध्ये कोड पेस्ट करा आणि AI सिक्युरिटी ऑडिट चालवा.',
    labRun: 'सिक्युरिटी ऑडिट चालवा',
    labStarting: 'सुरू होत आहे...',
    labGuideTitle: 'लॅब मार्गदर्शन',
    labGuideDesc: 'कस्टम लॅब Ad-Hoc सिक्युरिटी स्कॅनिंगसाठी आहे.',
    labStep1: 'कच्चा कोड पेस्ट करा (पूर्ण फाईल असणे आवश्यक नाही).',
    labStep2: 'AI इंजिन सेटिंग साईडबारमध्ये बदला.',
    labStep3: 'रिझल्ट पाहण्यासाठी लाईव्ह मॉनिटरला जा.',
    labStep4: 'अंतिम ऑडिट स्कोरसाठी विश्लेषण पेज पहा.',
    labStatusLabel: 'स्थिती',
    labBusy: 'सिस्टीम व्यस्त आहे',
    labReady: 'सिस्टीम तयार आहे',
    // Leaderboard
    lbTotalEntries: 'एकूण नोंदी',
    lbTopScore: 'सर्वोच्च स्कोर',
    lbRankings: 'क्रमवारी',
    lbRankDesc: 'पहिले ३ सोने, चांदी आणि कांस्यने दाखवले जातात.',
    lbRefresh: '↻ ताजेतवाने करा',
    lbSubmitTitle: 'तुमचा स्कोर सबमिट करा',
    lbSubmitDesc: 'तुमच्या एजंटचा निकाल लीडरबोर्डवर जोडा.',
    lbAgentName: 'एजंटचे नाव',
    lbTask: 'टास्क',
    lbScore: 'स्कोर (0–1)',
    lbSteps: 'वापरलेले स्टेप्स',
    lbModel: 'मॉडेल (ऐच्छिक)',
    lbSubmit: 'स्कोर सबमिट करा',
    lbSubmitting: 'सबमिट होत आहे…',
    lbSuccess: 'यशस्वीरीत्या सबमिट झाले!',
    lbColRank: 'क्रमांक',
    lbColAgent: 'एजंट',
    lbColTask: 'टास्क',
    lbColScore: 'स्कोर',
    lbColSteps: 'स्टेप्स',
    lbColModel: 'मॉडेल',
    lbEmpty: 'अजून कोणत्याही नोंदी नाहीत. खाली सबमिट करा!',
    // Scoring
    scoringEvalResult: 'मूल्यमापन निकाल',
    scoringRating: 'कामगिरी रेटिंग',
    scoringCurrent: 'सध्याचा स्कोर',
    scoringTP: 'खरे सकारात्मक',
    scoringFP: 'चुकीचे सकारात्मक',
    scoringSeverity: 'तीव्रता अचूकता',
    scoringTrend: 'कामगिरी ट्रेंड',
    scoringOverTime: 'वेळानुसार स्कोर',
    scoringRewardPerStep: 'प्रति स्टेप बक्षीस',
    scoringStepBreakdown: 'स्टेप तपशील',
    settingsBackendStatus: 'बॅकएंड स्थिती',
    settingsActiveEpisode: 'सक्रिय एपिसोड',
    settingsApiTitle: 'रिव्ह्यूअर API कॉन्फिगरेशन',
    settingsApiDesc: '.env फाईलमधील API की ची तपासणी.',
    settingsCheckApi: 'API स्थिती तपासा',
    settingsChecking: 'तपासत आहे...',
    settingsRuntimeTitle: 'रनटाइम कॉन्फिगरेशन',
    settingsRuntimeDesc: 'बॅकएंडमधून रीड-ओनली व्हॅल्यूज्.',
    settingsReviewerModel: 'रिव्ह्यूअर मॉडेल',
    settingsHintsLabel: 'हिंट्स सक्षम',
    settingsHintsDesc: 'एजंटला हिंट्स वापरण्याची परवानगी द्या. प्रत्येक हिंटवर -0.05 पेनल्टी.',
    settingsLlmLabel: 'LLM जज सक्षम',
    settingsLlmDesc: 'नियम-आधारित ग्रेडरसोबत LLM-आधारित सेकंडरी जज वापरा.',
    settingsDangerTitle: 'धोका झोन',
    settingsDangerDesc: 'या कृती स्थानिक डॅशबोर्ड कॅशे साफ करतात.',
    settingsClearLb: 'लीडरबोर्ड कॅशे साफ करा',
    settingsClearReplay: 'रिप्ले इतिहास कॅशे साफ करा',
  }
}

export const apiDocs = [
  {
    method: 'GET',
    path: '/health',
    description: 'Checks backend liveness and current event stream status.',
    requestExample: null,
    responseExample: {
      status: 'ok',
      version: '1.1.0',
      event_stream: '/ws/events',
      active_episode_id: 'episode-id',
    },
    canTest: true,
  },
  {
    method: 'POST',
    path: '/reset',
    description: 'Starts a fresh episode for a selected task.',
    requestExample: { task_name: 'easy_001' },
    responseExample: {
      observation: { task_name: 'easy_001', step: 0, current_score: 0 },
      info: { message: 'ok' },
    },
    canTest: false,
  },
  {
    method: 'POST',
    path: '/step',
    description: 'Submits a review action and returns reward plus updated observation.',
    requestExample: {
      line: 4,
      severity: 'high',
      category: 'security',
      message: 'Unsanitized user input reaches SQL execution.',
      fix: 'Use parameterized queries.',
      done: false,
    },
    responseExample: {
      reward: 0.25,
      done: false,
      observation: { current_score: 0.5, step: 1 },
    },
    canTest: false,
  },
  {
    method: 'GET',
    path: '/state',
    description: 'Returns the live judge state for the active episode.',
    requestExample: null,
    responseExample: {
      observation: {
        task_name: 'medium_001',
        step: 3,
        current_score: 0.7,
        comments_so_far: [],
      },
      done: false,
      total_reward: 0.7,
    },
    canTest: true,
  },
  {
    method: 'GET',
    path: '/events/recent',
    description: 'Returns the most recent emitted events in reverse chronological order.',
    requestExample: null,
    responseExample: [{ type: 'step_scored', timestamp: '2026-04-07T00:00:00Z' }],
    canTest: true,
  },
  {
    method: 'GET',
    path: '/leaderboard',
    description: 'Returns the top leaderboard entries.',
    requestExample: null,
    responseExample: [
      { rank: 1, agent_name: 'Agent', task: 'hard_001', score: 0.95, steps: 3 },
    ],
    canTest: true,
  },
  {
    method: 'POST',
    path: '/leaderboard/submit',
    description: 'Submits a score for ranking.',
    requestExample: {
      agent_name: 'My Agent',
      task: 'hard_001',
      score: 0.92,
      steps: 4,
      model: 'gpt-x',
    },
    responseExample: { rank: 2, total_entries: 9 },
    canTest: false,
  },
  {
    method: 'GET',
    path: '/hint',
    description: 'Consumes a hint and returns the hinted line window.',
    requestExample: null,
    responseExample: { hint: 'There is a bug between lines 3 and 5', penalty: -0.05 },
    canTest: true,
  },
  {
    method: 'GET',
    path: '/replay/{episode_id}',
    description: 'Returns full recorded steps for a past episode.',
    requestExample: null,
    responseExample: {
      episode_id: 'episode-id',
      final_score: 0.8,
      steps: [{ step_number: 1, line: 4, severity: 'high' }],
    },
    canTest: false,
  },
  {
    method: 'GET',
    path: '/export/json',
    description: 'Exports replay history as JSON.',
    requestExample: null,
    responseExample: [{ episode_id: 'episode-id', final_score: 0.8 }],
    canTest: true,
  },
  {
    method: 'GET',
    path: '/export/csv',
    description: 'Exports replay history as CSV.',
    requestExample: null,
    responseExample: 'episode_id,task,task_name,filename,...',
    canTest: true,
  },
  {
    method: 'WS',
    path: '/ws/events',
    description: 'Streams reset, scoring, hint, and leaderboard updates live.',
    requestExample: null,
    responseExample: { type: 'leaderboard_updated', payload: { rank: 1 } },
    canTest: false,
  },
]

function readStoredSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function buildEventKey(event) {
  return `${event?.type || 'unknown'}-${event?.timestamp || 'no-time'}-${JSON.stringify(
    event?.payload || {},
  )}`
}

function mergeEvents(current, incoming) {
  const merged = [...incoming, ...current]
  const seen = new Set()
  const unique = []

  for (const item of merged) {
    const key = buildEventKey(item)
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(item)
    }
  }

  return unique
    .sort((left, right) => new Date(right?.timestamp || 0) - new Date(left?.timestamp || 0))
    .slice(0, 24)
}

export function formatScore(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(3) : '0.000'
}

export function formatSigned(value) {
  const numeric = Number(value || 0)
  return `${numeric >= 0 ? '+' : ''}${formatScore(numeric)}`
}

export function formatDate(value) {
  if (!value) return 'Waiting for sync'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Waiting for sync'

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export function prettyJson(value) {
  return JSON.stringify(value, null, 2)
}

export function normalizeTaskType(value) {
  const raw = String(value || '').toLowerCase()
  if (raw.startsWith('easy')) return 'easy'
  if (raw.startsWith('medium')) return 'medium'
  if (raw.startsWith('hard')) return 'hard'
  if (raw === 'idle' || raw === 'none') return 'idle'
  return raw || 'idle'
}

export function formatTaskLabel(value) {
  const normalized = normalizeTaskType(value)
  if (normalized === 'idle') return 'Idle'

  return String(value || normalized)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export function parseDiffLines(diff, comments = []) {
  const markersByLine = comments.reduce((accumulator, comment) => {
    const lineNumber = Number(comment?.line)

    if (Number.isFinite(lineNumber)) {
      accumulator[lineNumber] = [...(accumulator[lineNumber] || []), comment]
    }

    return accumulator
  }, {})

  return String(diff || '')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      const match = /^(\d+):\s?(.*)$/.exec(line)
      const number = match ? Number(match[1]) : index + 1
      const content = match ? match[2] : line
      const markers = markersByLine[number] || []
      const positive = markers.some((item) => Number(item?.score_delta) > 0)
      const negative = markers.length > 0 && !positive

      return {
        number,
        content,
        markers,
        totalSignals: markers.length,
        positive,
        negative,
        severity: markers[0]?.severity || 'unknown',
      }
    })
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const retryRef = useRef(null)
  const socketRef = useRef(null)
  const [health, setHealth] = useState({ status: 'checking', version: '', error: '' })
  const [runState, setRunState] = useState(EMPTY_STATE)
  const [leaderboard, setLeaderboard] = useState([])
  const [events, setEvents] = useState([])
  const [rawStream, setRawStream] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [selectedEpisodeId, setSelectedEpisodeId] = useState('')
  const [selectedReplay, setSelectedReplay] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [endpointTests, setEndpointTests] = useState({})
  const [settings, setSettings] = useState(readStoredSettings)
  const [errors, setErrors] = useState({
    health: '',
    state: '',
    leaderboard: '',
    episodes: '',
    replay: '',
    submit: '',
  })
  const [loading, setLoading] = useState({
    replay: false,
    submit: false,
  })
  const [lastUpdated, setLastUpdated] = useState({
    state: null,
    leaderboard: null,
    events: null,
    health: null,
    episodes: null,
  })

  const t = useCallback((key) => {
    const lang = settings.language || 'en'
    return translations[lang][key] || key
  }, [settings.language])

  const requestJson = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': import.meta.env.VITE_APP_API_KEY || 'openenv_secret_key_123',
        ...(options.headers || {}),
      },
      ...options,
    })
    const data = await readJson(response)

    if (!response.ok) {
      throw new Error(data?.error || data?.detail || `Request failed for ${path}`)
    }

    return data
  }, [])

  const refreshHealth = useCallback(async () => {
    try {
      const data = await requestJson('/health')
      startTransition(() => {
        setHealth({ status: data?.status || 'ok', version: data?.version || '', error: '' })
        setErrors((current) => ({ ...current, health: '' }))
        setLastUpdated((current) => ({ ...current, health: new Date() }))
      })
    } catch (error) {
      startTransition(() => {
        setHealth({
          status: 'offline',
          version: '',
          error: error instanceof Error ? error.message : 'API unavailable',
        })
        setErrors((current) => ({
          ...current,
          health: error instanceof Error ? error.message : 'API unavailable',
        }))
      })
    }
  }, [requestJson])

  const refreshState = useCallback(async () => {
    try {
      const data = await requestJson('/state')
      startTransition(() => {
        setRunState({
          ...EMPTY_STATE,
          ...data,
          observation: {
            ...EMPTY_STATE.observation,
            ...(data?.observation || {}),
          },
        })
        setErrors((current) => ({ ...current, state: '' }))
        setLastUpdated((current) => ({ ...current, state: new Date() }))
      })
    } catch (error) {
      startTransition(() => {
        setErrors((current) => ({
          ...current,
          state: error instanceof Error ? error.message : 'Unable to load state',
        }))
      })
    }
  }, [requestJson])

  const refreshLeaderboard = useCallback(async () => {
    try {
      const data = await requestJson('/leaderboard')
      startTransition(() => {
        setLeaderboard(Array.isArray(data) ? data : [])
        setErrors((current) => ({ ...current, leaderboard: '' }))
        setLastUpdated((current) => ({ ...current, leaderboard: new Date() }))
      })
    } catch (error) {
      startTransition(() => {
        setErrors((current) => ({
          ...current,
          leaderboard: error instanceof Error ? error.message : 'Unable to load leaderboard',
        }))
      })
    }
  }, [requestJson])

  const refreshEvents = useCallback(async () => {
    try {
      const data = await requestJson('/events/recent')
      if (!Array.isArray(data)) return

      startTransition(() => {
        setEvents((current) => mergeEvents(current, data))
        setRawStream((current) =>
          [...data.map((item) => prettyJson(item)), ...current].slice(0, 12),
        )
        setLastUpdated((current) => ({ ...current, events: new Date() }))
      })
    } catch {
      return
    }
  }, [requestJson])

  const refreshEpisodes = useCallback(async () => {
    try {
      const data = await requestJson('/export/json')
      const sorted = Array.isArray(data)
        ? [...data].sort(
            (left, right) =>
              new Date(right?.finished_at || right?.timestamp || 0) -
              new Date(left?.finished_at || left?.timestamp || 0),
          )
        : []

      startTransition(() => {
        setEpisodes(sorted)
        setErrors((current) => ({ ...current, episodes: '' }))
        setLastUpdated((current) => ({ ...current, episodes: new Date() }))

        if (!selectedEpisodeId && sorted[0]?.episode_id) {
          setSelectedEpisodeId(sorted[0].episode_id)
          setSelectedReplay(sorted[0])
        } else if (selectedEpisodeId) {
          const refreshed = sorted.find((item) => item?.episode_id === selectedEpisodeId)
          if (refreshed) setSelectedReplay(refreshed)
        }
      })
    } catch (error) {
      startTransition(() => {
        setErrors((current) => ({
          ...current,
          episodes: error instanceof Error ? error.message : 'Unable to load episode history',
        }))
      })
    }
  }, [requestJson, selectedEpisodeId])

  const loadReplay = useCallback(
    async (episodeId) => {
      const value = String(episodeId || '').trim()
      if (!value) return

      startTransition(() => {
        setLoading((current) => ({ ...current, replay: true }))
        setSelectedEpisodeId(value)
      })

      try {
        const data = await requestJson(`/replay/${encodeURIComponent(value)}`)
        startTransition(() => {
          setSelectedReplay(data)
          setErrors((current) => ({ ...current, replay: '' }))
        })
      } catch (error) {
        const fallback = episodes.find((item) => item?.episode_id === value)

        startTransition(() => {
          if (fallback) {
            setSelectedReplay(fallback)
            setErrors((current) => ({ ...current, replay: '' }))
          } else {
            setSelectedReplay(null)
            setErrors((current) => ({
              ...current,
              replay: error instanceof Error ? error.message : 'Unable to load replay',
            }))
          }
        })
      } finally {
        startTransition(() => {
          setLoading((current) => ({ ...current, replay: false }))
        })
      }
    },
    [episodes, requestJson],
  )

  const pushEvent = useCallback(
    (event) => {
      if (!event) return

      startTransition(() => {
        setEvents((current) => mergeEvents(current, [event]))
        setRawStream((current) => [prettyJson(event), ...current].slice(0, 12))
        setLastUpdated((current) => ({ ...current, events: new Date() }))
      })

      if (
        ['episode_reset', 'step_scored', 'episode_finished', 'hint_issued'].includes(event?.type)
      ) {
        refreshState()
      }

      if (['leaderboard_updated', 'episode_finished'].includes(event?.type)) {
        refreshLeaderboard()
      }

      if (event?.type === 'episode_finished') {
        refreshEpisodes()
        if (event?.payload?.episode_id) loadReplay(event.payload.episode_id)
      }
    },
    [loadReplay, refreshEpisodes, refreshLeaderboard, refreshState],
  )

  const submitLeaderboard = useCallback(
    async (payload) => {
      startTransition(() => {
        setLoading((current) => ({ ...current, submit: true }))
        setErrors((current) => ({ ...current, submit: '' }))
      })

      try {
        const response = await requestJson('/leaderboard/submit', {
          method: 'POST',
          body: JSON.stringify({
            agent_name: payload.agent_name,
            task: payload.task,
            score: Number(payload.score),
            steps: Number(payload.steps),
            model: payload.model,
          }),
        })
        await refreshLeaderboard()
        return response
      } catch (error) {
        startTransition(() => {
          setErrors((current) => ({
            ...current,
            submit: error instanceof Error ? error.message : 'Unable to submit score',
          }))
        })
        throw error
      } finally {
        startTransition(() => {
          setLoading((current) => ({ ...current, submit: false }))
        })
      }
    },
    [refreshLeaderboard, requestJson],
  )

  const runAgent = useCallback(
    async (taskName, model = 'gemini-1.5-flash') => {
      try {
        const data = await requestJson('/api/custom/run', {
          method: 'POST',
          body: JSON.stringify({ task_name: taskName, model_name: model }),
        })
        return data
      } catch (err) {
        console.error('Run agent failed:', err)
        throw err
      }
    },
    [requestJson],
  )

  const testEndpoint = useCallback(async (path) => {
    startTransition(() => {
      setEndpointTests((current) => ({
        ...current,
        [path]: { loading: true, status: 'loading', response: '', error: '' },
      }))
    })

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        headers: {
          'X-API-Key': import.meta.env.VITE_APP_API_KEY || 'openenv_secret_key_123',
        }
      })
      const contentType = response.headers.get('content-type') || ''
      let body = null

      if (contentType.includes('application/json')) {
        body = await response.json()
      } else {
        body = await response.text()
      }

      startTransition(() => {
        setEndpointTests((current) => ({
          ...current,
          [path]: {
            loading: false,
            status: `${response.status} ${response.statusText}`,
            response: typeof body === 'string' ? body : prettyJson(body),
            error: '',
          },
        }))
      })
    } catch (error) {
      startTransition(() => {
        setEndpointTests((current) => ({
          ...current,
          [path]: {
            loading: false,
            status: 'offline',
            response: '',
            error: error instanceof Error ? error.message : 'Request failed',
          },
        }))
      })
    }
  }, [])

  const clearLeaderboard = useCallback(() => {
    startTransition(() => {
      setLeaderboard([])
    })
  }, [])

  const clearReplayHistory = useCallback(() => {
    startTransition(() => {
      setEpisodes([])
      setSelectedEpisodeId('')
      setSelectedReplay(null)
    })
  }, [])

  const updateSetting = useCallback((key, value) => {
    startTransition(() => {
      setSettings((current) => ({ ...current, [key]: value }))
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  const pushEventRef = useRef(pushEvent)
  useEffect(() => {
    pushEventRef.current = pushEvent
  }, [pushEvent])

  useEffect(() => {
    let closed = false
    const retryRef = { current: null }

    const connect = () => {
      if (closed) return

      let host = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '')
      if (!host.startsWith('http')) host = window.location.origin
      
      const target = `${host.replace(/^http/, 'ws')}/ws/events`
      console.log('[SOCKET] Connecting to:', target)
      
      const socket = new WebSocket(target)
      socketRef.current = socket
      setConnectionStatus('connecting')

      socket.onopen = () => {
        if (closed) return
        setConnectionStatus('live')
        console.log('[SOCKET] Connected')
      }

      socket.onerror = (err) => {
        if (closed) return
        console.error('[SOCKET] Error:', err)
        setConnectionStatus('offline')
      }

      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data)
          if (pushEventRef.current) pushEventRef.current(data)
        } catch (e) {
          console.error('[SOCKET] Message error:', e)
        }
      }

      socket.onclose = () => {
        if (closed) return
        setConnectionStatus('offline')
        console.log('[SOCKET] Closed, retrying in 4s...')
        retryRef.current = window.setTimeout(connect, 4000)
      }
    }

    // Initial load
    Promise.allSettled([
      refreshHealth(),
      refreshState(),
      refreshLeaderboard(),
      refreshEvents(),
      refreshEpisodes(),
    ])
    
    connect()

    const healthTimer = window.setInterval(refreshHealth, 30000)
    const stateTimer = window.setInterval(refreshState, 5000)
    const leaderboardTimer = window.setInterval(refreshLeaderboard, 10000)
    const replayTimer = window.setInterval(refreshEpisodes, 15000)

    return () => {
      closed = true
      window.clearInterval(healthTimer)
      window.clearInterval(stateTimer)
      window.clearInterval(leaderboardTimer)
      window.clearInterval(replayTimer)
      if (retryRef.current) window.clearTimeout(retryRef.current)
      if (socketRef.current) socketRef.current.close()
    }
  }, [refreshEpisodes, refreshEvents, refreshHealth, refreshLeaderboard, refreshState])

  const observation = runState.observation || EMPTY_STATE.observation
  const comments = useMemo(
    () => (Array.isArray(observation.comments_so_far) ? observation.comments_so_far : []),
    [observation.comments_so_far],
  )
  const diffLines = useMemo(
    () => parseDiffLines(observation.diff, comments),
    [comments, observation.diff],
  )
  const liveSteps = useMemo(
    () =>
      comments.map((item, index) => ({
        ...item,
        step_number: item?.step_number || index + 1,
        reward: Number(item?.score_delta || 0),
      })),
    [comments],
  )
  const scoreSeries = useMemo(() => {
    let running = 0
    const points = [{ step: 0, score: 0, reward: 0 }]

    liveSteps.forEach((item, index) => {
      running += Number(item.reward || 0)
      points.push({
        step: item.step_number || index + 1,
        score: Number(running.toFixed(3)),
        reward: Number(item.reward || 0),
        line: item.line ?? '-',
      })
    })

    if (points.length > 1) {
      points[points.length - 1].score = Number(observation.current_score || running || 0)
    }

    return points
  }, [liveSteps, observation.current_score])
  const rewardSeries = useMemo(
    () =>
      liveSteps.map((item, index) => ({
        step: item.step_number || index + 1,
        reward: Number(item.reward || 0),
        line: item.line ?? '-',
      })),
    [liveSteps],
  )
  const truePositives = useMemo(
    () => liveSteps.filter((item) => Number(item.reward) > 0).length,
    [liveSteps],
  )
  const falsePositives = useMemo(
    () => liveSteps.filter((item) => Number(item.reward) <= 0).length,
    [liveSteps],
  )
  const severityAccuracy = useMemo(() => {
    if (!liveSteps.length) return 0
    return Math.round((truePositives / liveSteps.length) * 100)
  }, [liveSteps.length, truePositives])
  const agentStatus = useMemo(() => {
    if (runState.done) return 'DONE'
    if (observation.task_name) return 'RUNNING'
    return 'IDLE'
  }, [observation.task_name, runState.done])
  const currentTaskType = normalizeTaskType(observation.task_name || observation.task_type)
  const modelName = leaderboard[0]?.model || 'Unknown'
  const configSummary = useMemo(
    () => ({
      serverUrl: API_BASE || (typeof window !== 'undefined' ? window.location.origin : ''),
      modelName,
      maxSteps: { easy: 6, medium: 8, hard: 10 },
      antiSpamThreshold: 'More than 2 repeated comments on the same line',
    }),
    [modelName],
  )

  const value = {
    t,
    apiBase: API_BASE || (typeof window !== 'undefined' ? window.location.origin : ''),
    health,
    runState,
    observation,
    comments,
    diffLines,
    leaderboard,
    events,
    rawStream,
    episodes,
    selectedEpisodeId,
    selectedReplay,
    connectionStatus,
    endpointTests,
    settings,
    errors,
    loading,
    lastUpdated,
    taskCatalog,
    apiDocs,
    liveSteps,
    scoreSeries,
    rewardSeries,
    analytics: {
      truePositives,
      falsePositives,
      severityAccuracy,
      trend: runState.performance_trend || 'stable',
    },
    currentTaskType,
    agentStatus,
    modelName,
    configSummary,
    setSelectedEpisodeId,
    updateSetting,
    refreshHealth,
    refreshState,
    runAgent,
    refreshLeaderboard,
    refreshEvents,
    refreshEpisodes,
    loadReplay,
    submitLeaderboard,
    testEndpoint,
    clearLeaderboard,
    clearReplayHistory,
    requestJson,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const value = useContext(AppContext)

  if (!value) {
    throw new Error('useAppContext must be used inside AppProvider')
  }

  return value
}
