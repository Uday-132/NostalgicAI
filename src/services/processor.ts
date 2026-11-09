import { loadSettings, PROVIDERS } from './settingsService'

export type ActionType = 'enhance-prompt' | 'enhance-text' | 'rewrite-code' | 'explain-text' | 'chat-box' | 'extract-text'

export interface ProcessResult {
  text: string
  type: ActionType
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  attachments?: string[]
}

const SYSTEM_PROMPTS: Record<ActionType, string> = {
  'enhance-prompt': "You are an expert Prompt Engineer. Your goal is to rewrite the user's prompt to be more precise, detailed, and optimized for Large Language Models. Keep the original intent but maximize clarity and effectiveness. Return ONLY the enhanced prompt.",
  'enhance-text': "You are an expert Editor. Your goal is to improve the grammar, flow, and readability of the user's text. Maintain the original meaning but make it sound more professional and polished. Return ONLY the enhanced text.",
  'rewrite-code': "You are an expert Software Engineer. Your goal is to rewrite the user's code to be cleaner, more efficient, and follow best practices. Add comments where necessary. Return ONLY the code (and comments), no markdown backticks unless requested.",
  'explain-text': "You are a helpful Tutor. Explain the following text or concept clearly and concisely. Use analogies if helpful. Break it down for easy understanding.",
  'chat-box': "You are NostalgicAI, a helpful and witty AI assistant with a retro-futuristic personality. You can help with coding, writing, and analysis. Keep responses concise and helpful.",
  'extract-text': "You are an advanced OCR engine. Your sole purpose is to extract all visible text from the provided image(s). Output ONLY the extracted text."
}

export const processAction = async (input: string, action: ActionType, history: ChatMessage[] = []): Promise<ProcessResult> => {
  const settings = loadSettings()
  let providerId = settings.activeProvider || 'groq'
  
  const cleanKey = (k: any): string => {
    if (typeof k !== 'string') return ''
    return k.replace(/^["']|["']$/g, '').trim()
  }

  let apiKey = cleanKey(settings.apiKeys[providerId]) || cleanKey((import.meta as any).env?.[`VITE_${providerId.toUpperCase()}_API_KEY`])
  
  // If active provider has no key, check groq
  const groqKey = cleanKey(settings.apiKeys.groq) || cleanKey((import.meta as any).env?.VITE_GROQ_API_KEY)
  if (!apiKey && groqKey && groqKey !== 'your_groq_api_key_here') {
    providerId = 'groq'
    apiKey = groqKey
  }

  const provider = PROVIDERS.find(p => p.id === providerId) || PROVIDERS[0]
  let selectedModel = settings.activeModels[providerId] || provider.defaultModel

  // Guard against decommissioned/unsupported Groq models (e.g. mixtral-8x7b-32768, llama)
  const validGroqModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'allam-2-7b']
  if (providerId === 'groq' && !validGroqModels.includes(selectedModel)) {
    selectedModel = 'openai/gpt-oss-120b'
  }

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_groq_api_key_here') {
    return {
      text: `Error: Missing API key for ${provider.name}. Please open Settings -> API Keys & Models to set your key.`,
      type: action
    }
  }

  try {
    const currentUserMessage: ChatMessage = { role: 'user', content: input }

    // Anthropic Claude
    if (providerId === 'claude') {
      const systemPrompt = SYSTEM_PROMPTS[action]
      const messagesPayload = action === 'chat-box'
        ? [...history.filter(m => m.role !== 'system'), currentUserMessage]
        : [currentUserMessage]

      const claudeMessages = messagesPayload.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: selectedModel,
          system: systemPrompt,
          messages: claudeMessages,
          max_tokens: 1500,
          temperature: 0.7
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `Claude request failed (${response.status})`)
      }

      const data = await response.json()
      const resultText = data.content?.[0]?.text || 'No response received.'
      return { text: resultText, type: action }
    }

    // OpenAI-compatible providers: Groq, OpenAI, Google Gemini
    let endpoint = provider.endpoint
    if (providerId === 'gemini') {
      endpoint = `${provider.endpoint}?key=${apiKey}`
    }

    let messages: ChatMessage[] = []
    if (action === 'chat-box') {
      messages = [
        { role: 'system', content: SYSTEM_PROMPTS[action] },
        ...history,
        currentUserMessage
      ]
    } else {
      messages = [
        { role: 'system', content: SYSTEM_PROMPTS[action] },
        currentUserMessage
      ]
    }

    const apiMessages = messages.map(msg => ({ role: msg.role, content: msg.content }))

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (providerId !== 'gemini') {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: selectedModel,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 1500
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`)
    }

    const data = await response.json()
    const resultText = data.choices?.[0]?.message?.content || 'No response received.'

    return {
      text: resultText,
      type: action
    }
  } catch (error: any) {
    console.error('LLM Request Error:', error)
    return {
      text: `Error: ${error.message}`,
      type: action
    }
  }
}
