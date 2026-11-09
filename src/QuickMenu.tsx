import React from 'react'
import ReactDOM from 'react-dom/client'
import './App.css'

const QuickMenu = () => {
    const handleAction = (action: string) => {
        window.ipcRenderer.send('quick-action-triggered', action)
    }

    return (
        <div className="glass-panel" style={{
            width: '100%',
            height: '100%',
            padding: '15px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center', // Center vertically
            gap: '10px',
            background: 'rgba(10, 10, 20, 0.95)',
            border: '1px solid var(--color-primary)',
            borderRadius: '12px',
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.2)'
        }}>
            <div className="retro-text" style={{
                fontSize: '0.8rem',
                color: 'var(--color-secondary)',
                textAlign: 'center',
                marginBottom: '5px',
                textShadow: '0 0 5px var(--color-secondary)'
            }}>
                QUICK ACTIONS
            </div>
            {[
                { id: 'enhance-prompt', label: 'PROMPT' },
                { id: 'rewrite-code', label: 'CODE' },
                { id: 'enhance-text', label: 'TEXT' },
                { id: 'explain-text', label: 'EXPLAIN' }
            ].map((btn) => (
                <button
                    key={btn.id}
                    onClick={() => handleAction(btn.id)}
                    className="neon-border"
                    style={{
                        background: 'rgba(0,0,0,0.6)',
                        color: 'var(--color-primary)',
                        padding: '10px',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textAlign: 'center', // Center text
                        transition: 'all 0.2s ease',
                        border: '1px solid rgba(0, 255, 255, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(0, 255, 255, 0.1)'
                        e.currentTarget.style.borderColor = 'var(--color-primary)'
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.3)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(0,0,0,0.6)'
                        e.currentTarget.style.borderColor = 'rgba(0, 255, 255, 0.3)'
                        e.currentTarget.style.boxShadow = 'none'
                    }}
                >
                    {btn.label}
                </button>
            ))}
        </div>
    )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QuickMenu />
    </React.StrictMode>,
)
