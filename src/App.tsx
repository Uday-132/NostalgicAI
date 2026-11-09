import { useState, useEffect, useRef } from 'react'
import {
  loadSettings,
  saveSettings,
  AppSettings,
  PROVIDERS,
  DEFAULT_SHORTCUTS,
  testProviderGateway
} from './services/settingsService'
import { processAction, ActionType } from './services/processor'
import { startListening, speak, stopSpeaking } from './services/voiceService'
import { RadialMenu } from './components/RadialMenu'
import './index.css'

export default function App() {
  const [activeTab, setActiveTab] = useState<'general' | 'shortcuts' | 'models' | 'radial' | 'studio' | 'appearance'>('general')
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  
  // Studio State
  const [studioInput, setStudioInput] = useState('')
  const [studioOutput, setStudioOutput] = useState('')
  const [isStudioProcessing, setIsStudioProcessing] = useState(false)
  const [studioMode, setStudioMode] = useState<ActionType>('enhance-prompt')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const stopListeningRef = useRef<(() => void) | null>(null)

  // Gateway check state per provider
  const [gatewayStatus, setGatewayStatus] = useState<Record<string, { loading: boolean; success?: boolean; message?: string }>>({})

  // Shortcut recording state
  const [recordingAction, setRecordingAction] = useState<string | null>(null)
  const [shortcutFeedback, setShortcutFeedback] = useState<string | null>(null)

  // Radial menu state
  const [radialState, setRadialState] = useState<{
    isOpen: boolean
    filePath: string
    fileName?: string
    position?: { x: number; y: number }
  }>({
    isOpen: false,
    filePath: '',
    fileName: ''
  })

  // Sample or selected file for testing converter
  const [demoFilePath, setDemoFilePath] = useState('C:\\Projects\\Quarterly_Review.pptx')

  // Save settings on change
  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial }
      saveSettings(next)
      return next
    })
  }

  // Handle IPC and Shortcuts initialization
  useEffect(() => {
    if (!window.ipcRenderer) return

    // Get current shortcuts from Electron
    window.ipcRenderer.invoke('get-shortcuts').then((sc: Record<string, string>) => {
      if (sc && Object.keys(sc).length > 0) {
        updateSettings({ shortcuts: { ...settings.shortcuts, ...sc } })
      }
    }).catch(console.error)

    // Listen for clipboard detection
    const removeClipboard = window.ipcRenderer.on('clipboard-changed', (_e: any, text: string) => {
      if (text && text.trim().length > 0) {
        setStudioInput(text)
      }
    })

    // Listen for global shortcut triggers
    const removeTrigger = window.ipcRenderer.on('trigger-action', async (_e: any, action: string, text?: string) => {
      setActiveTab('studio')
      const targetInput = (text && text.trim()) ? text.trim() : studioInput
      if (text && text.trim()) {
        setStudioInput(text.trim())
      }
      if (action) {
        setStudioMode(action as ActionType)
        if (targetInput && targetInput.trim()) {
          setIsStudioProcessing(true)
          try {
            const res = await processAction(targetInput, action as ActionType)
            setStudioOutput(res.text)
            if (action !== 'explain-text' && text) {
              window.ipcRenderer.send('replace-selection', res.text)
            }
          } catch (e: any) {
            setStudioOutput(`Error: ${e.message}`)
          } finally {
            setIsStudioProcessing(false)
          }
        }
      }
    })

    // Listen for radial convert trigger
    const removeRadial = window.ipcRenderer.on('trigger-radial-convert', (_e: any, data?: { filePath?: string; x?: number; y?: number }) => {
      setActiveTab('radial')
      const targetPath = data?.filePath || demoFilePath
      const pos = (data?.x && data?.y) ? { x: data.x, y: data.y } : undefined
      openRadialMenu(targetPath, pos)
    })

    return () => {
      removeClipboard()
      removeTrigger()
      removeRadial()
    }
  }, [demoFilePath, settings.shortcuts])

  // Global listener for Ctrl + Left Click anywhere
  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      if (e.ctrlKey && e.button === 0) { // Ctrl + Left Click
        let el = e.target as HTMLElement | null
        let path = ''
        while (el && el !== document.body) {
          if (el.getAttribute('data-filepath')) {
            path = el.getAttribute('data-filepath') || ''
            break
          }
          el = el.parentElement
        }

        const selectedPath = path || demoFilePath
        e.preventDefault()
        e.stopPropagation()
        openRadialMenu(selectedPath, { x: e.clientX, y: e.clientY })
      }
    }

    window.addEventListener('mousedown', handleGlobalMouseDown, { capture: true })
    return () => window.removeEventListener('mousedown', handleGlobalMouseDown, { capture: true })
  }, [demoFilePath])

  // Key recording listener
  useEffect(() => {
    if (!recordingAction) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Ignore lone modifier keys
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return

      const parts: string[] = []
      if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')

      // Key name
      let key = e.key.toUpperCase()
      if (key === ' ') key = 'Space'

      parts.push(key)
      const accelerator = parts.join('+')

      // Update in settings
      const updatedShortcuts = { ...settings.shortcuts, [recordingAction]: accelerator }
      updateSettings({ shortcuts: updatedShortcuts })

      // Send to Electron
      if (window.ipcRenderer) {
        window.ipcRenderer.invoke('update-shortcuts', updatedShortcuts).then(() => {
          setShortcutFeedback(`Updated ${recordingAction} to ${accelerator}`)
          setTimeout(() => setShortcutFeedback(null), 3000)
        }).catch(err => setShortcutFeedback(`Failed: ${err.message}`))
      } else {
        setShortcutFeedback(`Updated to ${accelerator}`)
        setTimeout(() => setShortcutFeedback(null), 3000)
      }

      setRecordingAction(null)
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [recordingAction, settings.shortcuts])

  // Test Gateway Connection
  const handleTestGateway = async (providerId: 'groq' | 'openai' | 'gemini' | 'claude') => {
    const key = settings.apiKeys[providerId] || ''
    const model = settings.activeModels[providerId]

    setGatewayStatus(prev => ({
      ...prev,
      [providerId]: { loading: true }
    }))

    const result = await testProviderGateway(providerId, key, model)

    setGatewayStatus(prev => ({
      ...prev,
      [providerId]: {
        loading: false,
        success: result.success,
        message: result.message
      }
    }))
  }

  // Open File Selector Dialog
  const handleSelectFile = async () => {
    if (window.ipcRenderer) {
      const selected = await window.ipcRenderer.invoke('select-file')
      if (selected) {
        setDemoFilePath(selected)
        openRadialMenu(selected)
      }
    }
  }

  const openRadialMenu = (filePath: string, pos?: { x: number; y: number }) => {
    const fileName = filePath.split(/[/\\]/).pop() || 'Document'
    setRadialState({
      isOpen: true,
      filePath,
      fileName,
      position: pos
    })
  }


  // Run studio action
  const handleStudioRun = async (action: ActionType) => {
    if (!studioInput.trim()) return
    setIsStudioProcessing(true)
    setStudioMode(action)
    try {
      const res = await processAction(studioInput, action)
      setStudioOutput(res.text)
    } catch (e: any) {
      setStudioOutput(`Error: ${e.message}`)
    } finally {
      setIsStudioProcessing(false)
    }
  }

  const toggleListening = () => {
    if (isListening) {
      if (stopListeningRef.current) stopListeningRef.current()
      setIsListening(false)
    } else {
      setIsListening(true)
      stopListeningRef.current = startListening(
        (text) => setStudioInput(prev => prev + (prev ? ' ' : '') + text),
        () => setIsListening(false),
        (err) => { console.error(err); setIsListening(false) }
      )
    }
  }

  const toggleSpeaking = () => {
    if (isSpeaking) {
      stopSpeaking()
      setIsSpeaking(false)
    } else {
      if (!studioOutput) return
      setIsSpeaking(true)
      speak(studioOutput, () => setIsSpeaking(false))
    }
  }

  const closeWindow = () => {
    if (window.ipcRenderer) window.ipcRenderer.send('hide-window')
  }

  return (
    <div className="app-container-v2">
      {/* Top Drag Bar */}
      <div className="app-topbar">
        <div className="topbar-brand">
          <span style={{ fontSize: '1.1rem' }}>⚡</span>
          <span>NOSTALGIC AI</span>
          <span className="ui-badge active" style={{ marginLeft: '6px' }}>v2.0</span>
        </div>
        <div className="topbar-controls">
          <button className="topbar-btn close" onClick={closeWindow} title="Hide window">✕</button>
        </div>
      </div>

      <div className="main-layout">
        {/* Left Sidebar (Matching Screenshot Layout) */}
        <div className="sidebar">
          <div className="sidebar-category">Settings</div>
          
          <div
            className={`sidebar-nav-item ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <span>⚙️</span>
            <span>General</span>
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'shortcuts' ? 'active' : ''}`}
            onClick={() => setActiveTab('shortcuts')}
          >
            <span>⌨️</span>
            <span>Shortcuts</span>
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'models' ? 'active' : ''}`}
            onClick={() => setActiveTab('models')}
          >
            <span>🧠</span>
            <span>Models & API</span>
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'radial' ? 'active' : ''}`}
            onClick={() => setActiveTab('radial')}
          >
            <span>🔄</span>
            <span>File Converter</span>
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'studio' ? 'active' : ''}`}
            onClick={() => setActiveTab('studio')}
          >
            <span>⚡</span>
            <span>Studio HUD</span>
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            <span>🎨</span>
            <span>Appearance</span>
          </div>

          <div className="sidebar-category" style={{ marginTop: '20px' }}>Shortcuts Quick Map</div>
          <div style={{ padding: '4px 12px', fontSize: '0.75rem', color: '#686b78', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div>Prompt: <span style={{ color: '#00f3ff' }}>Ctrl+Alt+P</span></div>
            <div>Code: <span style={{ color: '#00f3ff' }}>Ctrl+Alt+D</span></div>
            <div>Convert: <span style={{ color: '#00f3ff' }}>Ctrl+Click</span></div>
            <div>Chat: <span style={{ color: '#00f3ff' }}>Ctrl+Shift+H</span></div>
          </div>
        </div>

        {/* Content Pane */}
        <div className="content-pane">
          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <div>
              <div className="content-header">
                <h1 className="content-title">General</h1>
                <p className="content-subtitle">
                  Configure agent execution, keyboard triggers, system permissions, and behavior.
                </p>
              </div>

              {/* Global Permissions Section */}
              <div className="settings-section">
                <div className="section-head">
                  <h3 className="section-title">Global Permissions</h3>
                </div>
                <p className="section-subtext">
                  Configure system access, clipboard monitoring, and autonomous execution. <a href="#">Learn more</a>.
                </p>

                <div className="panel-card">
                  <div className="panel-row">
                    <div className="row-info">
                      <div className="row-title">Permission Preset</div>
                      <div className="row-desc">Controls the action authorization levels the agent can take.</div>
                    </div>
                    <select className="ui-pill-select" defaultValue="Turbo">
                      <option value="Turbo">Turbo (Direct In-Place Paste)</option>
                      <option value="Ask">Prompt Confirmation</option>
                      <option value="HUD">Show in HUD Only</option>
                    </select>
                  </div>

                  <div className="panel-row">
                    <div className="row-info">
                      <div className="row-title">
                        Clipboard Auto-Paste <span className="ui-badge">Active</span>
                      </div>
                      <div className="row-desc">Automatically replaces selected text with enhanced output in active app.</div>
                    </div>
                    <button className="ui-pill-btn">Enabled</button>
                  </div>

                  <div className="panel-row">
                    <div className="row-info">
                      <div className="row-title">
                        Radial Menu on Ctrl + Left Click <span className="ui-badge">New</span>
                      </div>
                      <div className="row-desc">Triggers circular file conversion options when clicking files or in file explorer.</div>
                    </div>
                    <button className="ui-pill-btn primary" onClick={() => setActiveTab('radial')}>Configure</button>
                  </div>
                </div>
              </div>

              {/* Application Lifecycle Section */}
              <div className="settings-section">
                <div className="section-head">
                  <h3 className="section-title">System & Startup</h3>
                </div>
                <p className="section-subtext">Control background presence and system integration.</p>

                <div className="panel-card">
                  <div className="panel-row">
                    <div className="row-info">
                      <div className="row-title">Start at Windows Login</div>
                      <div className="row-desc">Keep Nostalgic AI ready ambiently on computer boot.</div>
                    </div>
                    <button
                      className={`ui-pill-btn ${settings.autoStart ? 'primary' : ''}`}
                      onClick={() => updateSettings({ autoStart: !settings.autoStart })}
                    >
                      {settings.autoStart ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  <div className="panel-row">
                    <div className="row-info">
                      <div className="row-title">Always On Top Overlay</div>
                      <div className="row-desc">Float the control window above active full-screen windows.</div>
                    </div>
                    <button
                      className={`ui-pill-btn ${settings.keepOnTop ? 'primary' : ''}`}
                      onClick={() => updateSettings({ keepOnTop: !settings.keepOnTop })}
                    >
                      {settings.keepOnTop ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SHORTCUTS */}
          {activeTab === 'shortcuts' && (
            <div>
              <div className="content-header">
                <h1 className="content-title">Keyboard Shortcuts</h1>
                <p className="content-subtitle">
                  Customize the global hotkeys used to enhance prompts, refactor code, polish text, and convert files.
                </p>
              </div>

              {shortcutFeedback && (
                <div style={{ padding: '10px 16px', background: 'rgba(0, 243, 255, 0.1)', border: '1px solid #00f3ff', borderRadius: '8px', color: '#00f3ff', marginBottom: '18px', fontSize: '0.85rem' }}>
                  ✓ {shortcutFeedback}
                </div>
              )}

              <div className="settings-section">
                <div className="section-head">
                  <h3 className="section-title">Global Feature Triggers</h3>
                </div>
                <p className="section-subtext">
                  Click "Change" on any feature and press your desired key combination to bind it instantly.
                </p>

                <div className="panel-card">
                  {Object.entries(DEFAULT_SHORTCUTS).map(([id, item]) => {
                    const currentAccelerator = settings.shortcuts[id] || item.defaultKey
                    const isRecording = recordingAction === id

                    return (
                      <div key={id} className="panel-row">
                        <div className="row-info">
                          <div className="row-title">
                            {item.label}
                            <span className="ui-badge" style={{ textTransform: 'none' }}>
                              {currentAccelerator}
                            </span>
                          </div>
                          <div className="row-desc">{item.description}</div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            className={`ui-pill-btn ${isRecording ? 'recording-hotkey-pulse' : ''}`}
                            onClick={() => setRecordingAction(isRecording ? null : id)}
                          >
                            {isRecording ? 'Press Keys...' : 'Change'}
                          </button>
                          <button
                            className="ui-pill-btn"
                            style={{ fontSize: '0.75rem', padding: '6px 10px', color: '#7a7e8e' }}
                            title="Reset to default"
                            onClick={() => {
                              const updated = { ...settings.shortcuts, [id]: item.defaultKey }
                              updateSettings({ shortcuts: updated })
                              if (window.ipcRenderer) {
                                window.ipcRenderer.invoke('update-shortcuts', updated)
                              }
                            }}
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MODELS & API KEYS */}
          {activeTab === 'models' && (
            <div>
              <div className="content-header">
                <h1 className="content-title">Models & API Gateways</h1>
                <p className="content-subtitle">
                  Configure API keys for Groq, OpenAI, Google Gemini, and Anthropic Claude, select default models, and test gateway health.
                </p>
              </div>

              {/* Active Provider Selector */}
              <div className="settings-section">
                <div className="section-head">
                  <h3 className="section-title">Active AI Provider</h3>
                </div>
                <p className="section-subtext">Select which provider currently powers all in-place shortcuts and analysis.</p>

                <div className="panel-card" style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    {PROVIDERS.map(p => {
                      const isActive = settings.activeProvider === p.id
                      const hasKey = Boolean(settings.apiKeys[p.id])
                      return (
                        <div
                          key={p.id}
                          onClick={() => updateSettings({ activeProvider: p.id })}
                          style={{
                            padding: '14px',
                            borderRadius: '10px',
                            background: isActive ? '#242633' : '#1c1d24',
                            border: isActive ? '2px solid #00f3ff' : '1px solid #2a2c38',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            boxShadow: isActive ? '0 0 15px rgba(0, 243, 255, 0.2)' : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '1.2rem' }}>{p.icon}</span>
                            {hasKey ? (
                              <span className="ui-badge green">Configured</span>
                            ) : (
                              <span className="ui-badge">No Key</span>
                            )}
                          </div>
                          <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>{p.name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#888c9d' }}>
                            Model: {settings.activeModels[p.id] || p.defaultModel}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Providers Configuration List */}
              <div className="settings-section">
                <div className="section-head">
                  <h3 className="section-title">Provider Keys & Health Verification</h3>
                </div>
                <p className="section-subtext">
                  Enter your credentials and click <strong>Test Gateway</strong> to verify real-time connectivity before execution.
                </p>

                {PROVIDERS.map(p => {
                  const currentKey = settings.apiKeys[p.id] || ''
                  const activeModel = settings.activeModels[p.id] || p.defaultModel
                  const status = gatewayStatus[p.id]

                  return (
                    <div key={p.id} className="panel-card" style={{ marginBottom: '20px' }}>
                      <div className="panel-row">
                        <div className="row-info">
                          <div className="row-title">
                            <span style={{ fontSize: '1.2rem' }}>{p.icon}</span>
                            <span>{p.name}</span>
                            {settings.activeProvider === p.id && <span className="ui-badge active">Active Engine</span>}
                          </div>
                          <div className="row-desc">
                            Manage API authentication and default LLM checkpoint. <a href={p.docsUrl} target="_blank" rel="noreferrer">Get API Key ↗</a>
                          </div>
                        </div>

                        <button
                          className="ui-pill-btn"
                          disabled={status?.loading}
                          onClick={() => handleTestGateway(p.id)}
                        >
                          {status?.loading ? 'Checking Gateway...' : 'Test Gateway ⚡'}
                        </button>
                      </div>

                      {/* Gateway Status Badge */}
                      {status && !status.loading && (
                        <div style={{
                          padding: '8px 14px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          margin: '8px 0',
                          background: status.success ? 'rgba(46, 213, 115, 0.1)' : 'rgba(255, 71, 87, 0.1)',
                          border: status.success ? '1px solid #2ed573' : '1px solid #ff4757',
                          color: status.success ? '#2ed573' : '#ff4757',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span>{status.success ? '✓' : '⚠'}</span>
                          <span>{status.message}</span>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '14px', padding: '12px 0' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#7c7f8e', display: 'block', marginBottom: '4px' }}>
                            API KEY
                          </label>
                          <input
                            type="password"
                            className="ui-pill-input"
                            value={currentKey}
                            placeholder={p.placeholder}
                            onChange={(e) => {
                              const updatedKeys = { ...settings.apiKeys, [p.id]: e.target.value }
                              updateSettings({ apiKeys: updatedKeys })
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.72rem', color: '#7c7f8e', display: 'block', marginBottom: '4px' }}>
                            MODEL CHECKPOINT
                          </label>
                          <select
                            className="ui-pill-select"
                            style={{ width: '100%' }}
                            value={activeModel}
                            onChange={(e) => {
                              const updatedModels = { ...settings.activeModels, [p.id]: e.target.value }
                              updateSettings({ activeModels: updatedModels })
                            }}
                          >
                            {p.models.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} {m.tag ? `(${m.tag})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TAB 4: RADIAL FILE CONVERTER */}
          {activeTab === 'radial' && (
            <div>
              <div className="content-header">
                <h1 className="content-title">Radial File Converter (Ctrl + Click)</h1>
                <p className="content-subtitle">
                  Highlight or click any document with <strong>Ctrl + Left Click</strong> (or shortcut) to open the circular wheel and convert formats in place.
                </p>
              </div>

              <div className="settings-section">
                <div className="section-head">
                  <h3 className="section-title">How It Works</h3>
                </div>
                <p className="section-subtext">
                  The round circle dynamically excludes the file's current format and exposes all alternate destination formats. Converted files are saved directly in the file's original directory.
                </p>

                <div className="panel-card" style={{ padding: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div style={{ background: '#1c1d25', padding: '14px', borderRadius: '10px', border: '1px solid #2a2c38' }}>
                      <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>📊 If File is PowerPoint (.pptx)</div>
                      <div style={{ fontSize: '0.8rem', color: '#9da1b2', lineHeight: 1.5 }}>
                        Options on circle:<br />
                        <span style={{ color: '#00f3ff' }}>• PDF Document (.pdf)</span><br />
                        <span style={{ color: '#00f3ff' }}>• Microsoft Word (.docx)</span><br />
                        <span style={{ color: '#00f3ff' }}>• Plain Text (.txt)</span><br />
                        <span style={{ color: '#00f3ff' }}>• Web Page (.html)</span>
                      </div>
                    </div>

                    <div style={{ background: '#1c1d25', padding: '14px', borderRadius: '10px', border: '1px solid #2a2c38' }}>
                      <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>📄 If File is PDF (.pdf)</div>
                      <div style={{ fontSize: '0.8rem', color: '#9da1b2', lineHeight: 1.5 }}>
                        Options on circle:<br />
                        <span style={{ color: '#00f3ff' }}>• Microsoft Word (.docx)</span><br />
                        <span style={{ color: '#00f3ff' }}>• Plain Text (.txt)</span><br />
                        <span style={{ color: '#00f3ff' }}>• Markdown (.md)</span><br />
                        <span style={{ color: '#00f3ff' }}>• Web Page (.html)</span>
                      </div>
                    </div>

                    <div style={{ background: '#1c1d25', padding: '14px', borderRadius: '10px', border: '1px solid #2a2c38' }}>
                      <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>📝 If File is Word (.docx)</div>
                      <div style={{ fontSize: '0.8rem', color: '#9da1b2', lineHeight: 1.5 }}>
                        Options on circle:<br />
                        <span style={{ color: '#00f3ff' }}>• PDF Document (.pdf)</span><br />
                        <span style={{ color: '#00f3ff' }}>• Plain Text (.txt)</span><br />
                        <span style={{ color: '#00f3ff' }}>• Markdown (.md)</span><br />
                        <span style={{ color: '#00f3ff' }}>• Web Page (.html)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Tester */}
              <div className="settings-section">
                <div className="section-head">
                  <h3 className="section-title">Interactive Live Test — Ctrl + Left Click</h3>
                </div>
                <p className="section-subtext">
                  Hold <strong>Ctrl</strong> and <strong>Left Click</strong> directly on any card below (or click the button) to spawn the Radial Wheel right at that spot!
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { path: 'C:\\Users\\Documents\\Strategy_Quarterly.pptx', name: 'Strategy_Quarterly.pptx', icon: '📊', type: 'PowerPoint Presentation' },
                    { path: 'C:\\Users\\Documents\\Financial_Statement.pdf', name: 'Financial_Statement.pdf', icon: '📄', type: 'PDF Document' },
                    { path: 'C:\\Users\\Documents\\Project_Scope.docx', name: 'Project_Scope.docx', icon: '📝', type: 'Word Document' }
                  ].map((doc) => (
                    <div
                      key={doc.path}
                      data-filepath={doc.path}
                      onClick={(e) => {
                        e.preventDefault()
                        openRadialMenu(doc.path, { x: e.clientX, y: e.clientY })
                      }}
                      className="panel-card"
                      style={{
                        padding: '16px 20px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#191a22',
                        border: '1px solid #282a36',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#00f3ff'
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 243, 255, 0.15)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#282a36'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span style={{ fontSize: '2rem' }}>{doc.icon}</span>
                        <div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                            {doc.name}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#7c8092', marginTop: '2px' }}>
                            {doc.type} • <span style={{ color: '#00f3ff' }}>Click or [Ctrl+Click] to test</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="ui-pill-btn primary"
                          onClick={(e) => {
                            e.stopPropagation()
                            openRadialMenu(doc.path, { x: e.clientX, y: e.clientY })
                          }}
                        >
                          Convert 🔄
                        </button>
                      </div>
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                    <button
                      className="ui-pill-btn"
                      style={{ padding: '8px 24px', fontSize: '0.88rem' }}
                      onClick={handleSelectFile}
                    >
                      📁 Choose Real File From Your Computer...
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: STUDIO / HUD */}
          {activeTab === 'studio' && (
            <div>
              <div className="content-header">
                <h1 className="content-title">AI Studio HUD</h1>
                <p className="content-subtitle">
                  Direct workbench for testing prompts, code refactoring, explanations, text enhancement, and speech synthesis.
                </p>
              </div>

              <div className="settings-section">
                {/* Input Area */}
                <div className="panel-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#888d9f' }}>INPUT PROMPT / CODE</span>
                    <button
                      className="ui-pill-btn"
                      style={{ fontSize: '0.75rem', padding: '4px 10px', color: isListening ? '#ff4757' : '#ededed' }}
                      onClick={toggleListening}
                    >
                      {isListening ? '● REC (Listening...)' : '🎤 MIC'}
                    </button>
                  </div>

                  <textarea
                    className="ui-pill-input"
                    rows={4}
                    value={studioInput}
                    placeholder="Enter prompt, code snippet, or paste text... (Press Ctrl+Enter to run)"
                    onChange={(e) => setStudioInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault()
                        handleStudioRun(studioMode)
                      }
                    }}
                    style={{ resize: 'vertical' }}
                  />

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <button
                      disabled={isStudioProcessing}
                      className={`ui-pill-btn ${studioMode === 'enhance-prompt' ? 'primary' : ''}`}
                      onClick={() => handleStudioRun('enhance-prompt')}
                    >
                      ⚡ Optimize Prompt
                    </button>
                    <button
                      disabled={isStudioProcessing}
                      className={`ui-pill-btn ${studioMode === 'rewrite-code' ? 'primary' : ''}`}
                      onClick={() => handleStudioRun('rewrite-code')}
                    >
                      💻 Refactor Code
                    </button>
                    <button
                      disabled={isStudioProcessing}
                      className={`ui-pill-btn ${studioMode === 'enhance-text' ? 'primary' : ''}`}
                      onClick={() => handleStudioRun('enhance-text')}
                    >
                      📝 Polish Text
                    </button>
                    <button
                      disabled={isStudioProcessing}
                      className={`ui-pill-btn ${studioMode === 'explain-text' ? 'primary' : ''}`}
                      onClick={() => handleStudioRun('explain-text')}
                    >
                      🎓 Explain Concept
                    </button>
                  </div>
                </div>

                {/* Output Area */}
                <div className="panel-card" style={{ padding: '16px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#00f3ff' }}>
                      {isStudioProcessing ? 'PROCESSING VIA ' + settings.activeProvider.toUpperCase() + '...' : 'AI OUTPUT'}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="ui-pill-btn" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={toggleSpeaking}>
                        {isSpeaking ? '🔊 Stop' : '🔈 Read Aloud'}
                      </button>
                      <button
                        className="ui-pill-btn"
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        onClick={() => navigator.clipboard.writeText(studioOutput)}
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <textarea
                    readOnly
                    className="ui-pill-input"
                    rows={6}
                    value={studioOutput}
                    placeholder="Result will appear here..."
                    style={{ resize: 'vertical', border: '1px solid rgba(0, 243, 255, 0.3)' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div>
              <div className="content-header">
                <h1 className="content-title">Appearance</h1>
                <p className="content-subtitle">Customize application styling, dark contrast, and font aesthetics.</p>
              </div>

              <div className="settings-section">
                <div className="panel-card">
                  <div className="panel-row">
                    <div className="row-info">
                      <div className="row-title">Dark Slate Theme (Screenshot Modern)</div>
                      <div className="row-desc">Clean, minimalist charcoal slate UI with sleek cards and crisp typography.</div>
                    </div>
                    <button className="ui-pill-btn primary">Active</button>
                  </div>
                  <div className="panel-row">
                    <div className="row-info">
                      <div className="row-title">Cyberpunk Neon Theme</div>
                      <div className="row-desc">Classic high-glow retro-futuristic aesthetic with vibrant magenta/cyan borders.</div>
                    </div>
                    <button className="ui-pill-btn">Available</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Radial Menu Popup Modal */}
      {radialState.isOpen && (
        <RadialMenu
          filePath={radialState.filePath}
          fileName={radialState.fileName}
          position={radialState.position}
          onClose={() => setRadialState(prev => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  )
}
