import { useState, useEffect, useRef } from 'react'
import { processAction, ChatMessage } from '../services/processor'
import '../index.css'

export function ChatInterface() {
    const [input, setInput] = useState('')
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'assistant', content: "Hello! I'm NostalgicAI Chat. How can I assist you today?" }
    ])
    const [isProcessing, setIsProcessing] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const sendMessage = async () => {
        if (!input.trim() || isProcessing) return

        const userMsg: ChatMessage = { role: 'user', content: input }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setIsProcessing(true)

        try {
            const result = await processAction(input, 'chat-box', messages)
            const aiMsg: ChatMessage = { role: 'assistant', content: result.text }
            setMessages(prev => [...prev, aiMsg])
        } catch (error) {
            console.error(error)
            setMessages(prev => [...prev, { role: 'assistant', content: "Error: Failed to get response." }])
        } finally {
            setIsProcessing(false)
        }
    }

    const clearChat = () => {
        setMessages([{ role: 'assistant', content: "Chat cleared. How can I help?" }])
    }

    const closeWindow = () => {
        if (window.ipcRenderer) {
            window.ipcRenderer.send('hide-chat-window')
        }
    }

    return (
        <div className="glass-container">
            {/* Header */}
            <div className="glass-header">
                <div className="header-title">
                    <span style={{ fontSize: '1.2rem' }}>🤖</span>
                    <span>NOSTALGIC AI CHAT</span>
                </div>
                <div className="window-controls">
                    <button
                        className="control-btn"
                        onClick={clearChat}
                        title="Clear Chat"
                        style={{ fontSize: '0.9rem' }}
                    >
                        🗑️
                    </button>
                    <button
                        className="close-btn"
                        onClick={closeWindow}
                        title="Close Window"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'hidden' }}>

                {/* Messages Area */}
                <div
                    className="glass-input-area"
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '15px',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderTop: 'none',
                        padding: '15px',
                        borderRadius: '8px'
                    }}
                >
                    {messages.map((msg, index) => (
                        <div key={index} className={`message ${msg.role === 'user' ? 'message-user' : 'message-ai'}`}>
                            <div className="message-sender">
                                {msg.role === 'user' ? 'YOU' : 'AI'}
                            </div>
                            <div className="message-content">
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isProcessing && (
                        <div className="message message-ai">
                            <div className="message-sender">AI</div>
                            <div className="message-content" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                Thinking <div className="mini-loader"></div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="retro-text" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>INPUT</label>
                    </div>
                    <div className="glass-input-area" style={{ padding: 0, background: 'transparent', border: 'none' }}>
                        <input
                            type="text"
                            className="glass-input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Type your message..."
                            disabled={isProcessing}
                            autoFocus
                            style={{ height: '50px' }}
                        />
                        <button
                            className="glass-btn"
                            onClick={sendMessage}
                            disabled={isProcessing || !input.trim()}
                        >
                            {isProcessing ? '...' : 'SEND'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Status Bar */}
            <div className="status-bar">
                <span>{isProcessing ? 'PROCESSING REQUEST...' : 'READY TO ASSIST'}</span>
                {isProcessing && <div className="mini-loader"></div>}
            </div>
        </div>
    )
}
