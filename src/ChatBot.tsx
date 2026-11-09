import { useState, useRef, useEffect } from 'react';
import './chat.css';

// Define types
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Get API key from environment variables
const GROQ_API_KEY = (import.meta.env.VITE_GROQ_API_KEY || '').replace(/^["']|["']$/g, '').trim();
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// System prompt for the chatbot
const SYSTEM_PROMPT = "You are NostalgicAI, a helpful and witty AI assistant with a retro-futuristic personality. You are powered by the openai/gpt-oss-120b model. You can help with coding, writing, and analysis. Keep responses concise and helpful.";

const ChatBot = () => {
  const [input, setInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hello! I\'m NostalgicAI. How can I assist you today?' }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('READY');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const processChat = async (userInput: string) => {
    if (!userInput.trim() || !GROQ_API_KEY || GROQ_API_KEY === 'your_api_key_here') {
      if (!GROQ_API_KEY || GROQ_API_KEY === 'your_api_key_here') {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: 'Error: Missing Groq API Key. Please add VITE_GROQ_API_KEY to your .env file.'
        }]);
      }
      return;
    }

    setIsProcessing(true);
    setStatus('PROCESSING...');

    try {
      // Add user message to history
      const userMessage: ChatMessage = { role: 'user', content: userInput };
      setChatHistory(prev => [...prev, userMessage]);
      setInput('');

      // Prepare messages for API
      const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...chatHistory,
        userMessage
      ];

      // Call Groq API
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: import.meta.env.VITE_GROQ_MODEL || 'openai/gpt-oss-120b',
          messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API Request Failed');
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content || "No response received.";

      // Add AI response to history
      const aiMessage: ChatMessage = { role: 'assistant', content: aiResponse };
      setChatHistory(prev => [...prev, aiMessage]);
      setStatus('READY');
    } catch (error: any) {
      console.error("Groq API Error:", error);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error.message}`
      }]);
      setStatus('ERROR');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processChat(input);
  };

  const clearChat = () => {
    setChatHistory([{ role: 'assistant', content: 'Hello! I\'m NostalgicAI. How can I assist you today?' }]);
    setStatus('READY');
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>NostalgicAI Chat</h2>
          <button className="clear-chat-btn" onClick={clearChat}>
            Clear Chat
          </button>
        </div>
      </div>

      {/* Chat Container */}
      <div className="chat-messages">
        {chatHistory.map((message, index) => (
          <div
            key={index}
            className={`message ${message.role === 'user' ? 'message-user' : 'message-ai'}`}
          >
            <div className="message-sender">
              {message.role === 'user' ? 'You' : 'NostalgicAI'}
            </div>
            <div>{message.content}</div>
          </div>
        ))}
        {isProcessing && (
          <div className="message message-ai">
            <div className="message-sender">NostalgicAI</div>
            <div>Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        <form className="chat-input-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isProcessing}
            className="chat-input"
          />
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            className="send-button"
          >
            Send
          </button>
        </form>
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        STATUS: {status} {isProcessing && '...'}
      </div>
    </div>
  );
};

export default ChatBot;