export interface ProviderConfig {
  id: 'groq' | 'openai' | 'gemini' | 'claude'
  name: string
  icon: string
  placeholder: string
  keyName: string
  docsUrl: string
  defaultModel: string
  models: { id: string; name: string; tag?: string }[]
  endpoint: string
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'groq',
    name: 'Groq Cloud',
    icon: '⚡',
    placeholder: 'gsk_...',
    keyName: 'VITE_GROQ_API_KEY',
    docsUrl: 'https://console.groq.com/keys',
    defaultModel: 'openai/gpt-oss-120b',
    models: [
      { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B', tag: 'Flagship Reasoning' },
      { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B', tag: 'Ultra Fast' },
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', tag: 'Vision & Multimodal' },
      { id: 'allam-2-7b', name: 'Allam 2 7B', tag: 'Fast' }
    ],
    endpoint: 'https://api.groq.com/openai/v1/chat/completions'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🧠',
    placeholder: 'sk-...',
    keyName: 'VITE_OPENAI_API_KEY',
    docsUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tag: 'Efficient' },
      { id: 'gpt-4o', name: 'GPT-4o Omni', tag: 'Flagship' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', tag: 'Advanced' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', tag: 'Legacy' }
    ],
    endpoint: 'https://api.openai.com/v1/chat/completions'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '✨',
    placeholder: 'AIzaSy...',
    keyName: 'VITE_GEMINI_API_KEY',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    defaultModel: 'gemini-1.5-flash',
    models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', tag: 'Fast & Versatile' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', tag: 'Complex Reasoning' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', tag: 'Next-Gen' }
    ],
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    icon: '🎭',
    placeholder: 'sk-ant-...',
    keyName: 'VITE_ANTHROPIC_API_KEY',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', tag: 'Top Coding' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', tag: 'Lightning Speed' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', tag: 'Deep Analysis' }
    ],
    endpoint: 'https://api.anthropic.com/v1/messages'
  }
]

export interface AppSettings {
  activeProvider: 'groq' | 'openai' | 'gemini' | 'claude'
  activeModels: Record<string, string>
  apiKeys: Record<string, string>
  shortcuts: Record<string, string>
  autoStart: boolean
  keepOnTop: boolean
  theme: 'dark-slate' | 'cyberpunk-neon'
}

export const DEFAULT_SHORTCUTS: Record<string, { label: string; defaultKey: string; description: string }> = {
  'enhance-prompt': { label: 'Prompt Enhancer', defaultKey: 'CommandOrControl+Alt+P', description: 'Rewrites selected prompt for maximum LLM performance' },
  'rewrite-code': { label: 'Code Refactorer', defaultKey: 'CommandOrControl+Alt+D', description: 'Cleans and optimizes highlighted source code' },
  'enhance-text': { label: 'Text Polisher', defaultKey: 'CommandOrControl+Alt+E', description: 'Fixes grammar, style, and tone in place' },
  'explain-text': { label: 'Concept Explainer', defaultKey: 'CommandOrControl+Alt+X', description: 'Breaks down complex concepts into simple analogies' },
  'open-chat': { label: 'Quick Chat Window', defaultKey: 'CommandOrControl+Shift+H', description: 'Opens floating retro AI conversational window' },
  'toggle-window': { label: 'Toggle App HUD', defaultKey: 'CommandOrControl+Alt+Space', description: 'Shows/Hides the main control panel' },
  'convert-file': { label: 'Radial Converter', defaultKey: 'CommandOrControl+Alt+C', description: 'Opens round circular menu to convert files in place' }
}

const SETTINGS_KEY = 'nostalgic_ai_settings_v2'

const cleanKey = (k: any): string => {
  if (typeof k !== 'string') return ''
  return k.replace(/^["']|["']$/g, '').trim()
}

export function loadSettings(): AppSettings {
  const envGroq = cleanKey((import.meta as any).env?.VITE_GROQ_API_KEY)
  const envOpenAI = cleanKey((import.meta as any).env?.VITE_OPENAI_API_KEY)
  const envGemini = cleanKey((import.meta as any).env?.VITE_GEMINI_API_KEY)
  const envClaude = cleanKey((import.meta as any).env?.VITE_ANTHROPIC_API_KEY)

  const defaultKeys: Record<string, string> = {
    groq: envGroq,
    openai: envOpenAI,
    gemini: envGemini,
    claude: envClaude
  }

  const defaultModels: Record<string, string> = {
    groq: 'openai/gpt-oss-120b',
    openai: 'gpt-4o-mini',
    gemini: 'gemini-1.5-flash',
    claude: 'claude-3-5-sonnet-20241022'
  }

  const defaultShortcutsMap: Record<string, string> = {}
  Object.entries(DEFAULT_SHORTCUTS).forEach(([id, item]) => {
    defaultShortcutsMap[id] = item.defaultKey
  })

  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const parsedKeys = parsed.apiKeys || {}
      const mergedKeys: Record<string, string> = {
        groq: cleanKey(parsedKeys.groq) || envGroq,
        openai: cleanKey(parsedKeys.openai) || envOpenAI,
        gemini: cleanKey(parsedKeys.gemini) || envGemini,
        claude: cleanKey(parsedKeys.claude) || envClaude
      }

      const activeModels = { ...defaultModels, ...(parsed.activeModels || {}) }
      // Migrate any decommissioned/unsupported Groq models (e.g. mixtral, llama) to working model
      const validGroqModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'allam-2-7b']
      if (!validGroqModels.includes(activeModels.groq)) {
        activeModels.groq = 'openai/gpt-oss-120b'
      }

      // Persist migration so old decommissioned model is cleaned from localStorage
      if (parsed.activeModels?.groq !== activeModels.groq) {
        try {
          parsed.activeModels = activeModels
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed))
        } catch {}
      }

      let activeProvider = parsed.activeProvider || 'groq'
      // If current activeProvider has no key, but groq has key, default to groq
      if (!mergedKeys[activeProvider] && mergedKeys.groq) {
        activeProvider = 'groq'
      }

      return {
        activeProvider,
        activeModels,
        apiKeys: mergedKeys,
        shortcuts: { ...defaultShortcutsMap, ...(parsed.shortcuts || {}) },
        autoStart: parsed.autoStart ?? true,
        keepOnTop: parsed.keepOnTop ?? true,
        theme: parsed.theme || 'dark-slate'
      }
    }
  } catch (e) {
    console.warn('Failed to parse saved settings:', e)
  }

  return {
    activeProvider: 'groq',
    activeModels: defaultModels,
    apiKeys: defaultKeys,
    shortcuts: defaultShortcutsMap,
    autoStart: true,
    keepOnTop: true,
    theme: 'dark-slate'
  }
}

export function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('Failed to save settings:', e)
  }
}

// Test Provider Gateway in real time
export async function testProviderGateway(
  providerId: 'groq' | 'openai' | 'gemini' | 'claude',
  apiKey: string,
  modelId?: string
): Promise<{ success: boolean; latencyMs: number; message: string }> {
  apiKey = cleanKey(apiKey)
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_groq_api_key_here') {
    return { success: false, latencyMs: 0, message: 'Please enter a valid API key first.' }
  }

  const startTime = Date.now()
  const provider = PROVIDERS.find(p => p.id === providerId)
  if (!provider) return { success: false, latencyMs: 0, message: 'Unknown provider.' }

  const model = modelId || provider.defaultModel

  try {
    if (providerId === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      const latency = Date.now() - startTime
      if (res.ok) {
        const data = await res.json()
        const modelCount = data.data?.length || 'available'
        return {
          success: true,
          latencyMs: latency,
          message: `Gateway Active! (${latency}ms) — ${modelCount} models connected`
        }
      } else {
        const err = await res.json().catch(() => ({}))
        return {
          success: false,
          latencyMs: latency,
          message: err.error?.message || `Groq Gateway responded with status ${res.status}`
        }
      }
    }

    if (providerId === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      const latency = Date.now() - startTime
      if (res.ok) {
        return {
          success: true,
          latencyMs: latency,
          message: `OpenAI Gateway Active! (${latency}ms)`
        }
      } else {
        const err = await res.json().catch(() => ({}))
        return {
          success: false,
          latencyMs: latency,
          message: err.error?.message || `OpenAI Gateway responded with status ${res.status}`
        }
      }
    }

    if (providerId === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
      const latency = Date.now() - startTime
      if (res.ok) {
        return {
          success: true,
          latencyMs: latency,
          message: `Gemini Gateway Active! (${latency}ms)`
        }
      } else {
        const err = await res.json().catch(() => ({}))
        return {
          success: false,
          latencyMs: latency,
          message: err.error?.message || `Gemini Gateway responded with status ${res.status}`
        }
      }
    }

    if (providerId === 'claude') {
      // Lightweight single message ping to Claude API
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }]
        })
      })
      const latency = Date.now() - startTime
      if (res.ok) {
        return {
          success: true,
          latencyMs: latency,
          message: `Claude Gateway Active! (${latency}ms)`
        }
      } else {
        const err = await res.json().catch(() => ({}))
        return {
          success: false,
          latencyMs: latency,
          message: err.error?.message || `Claude Gateway status ${res.status}`
        }
      }
    }

    return { success: false, latencyMs: 0, message: 'Provider test not configured.' }
  } catch (error: any) {
    const latency = Date.now() - startTime
    return {
      success: false,
      latencyMs: latency,
      message: `Gateway unreachable: ${error.message}`
    }
  }
}

