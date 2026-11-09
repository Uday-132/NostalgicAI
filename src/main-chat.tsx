import React from 'react'
import ReactDOM from 'react-dom/client'
import ChatBot from './ChatBot.tsx'
import './chat.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChatBot />
  </React.StrictMode>,
)