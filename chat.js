// Chat functionality for NostalgicAI Chat

// Get API key from environment variables
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// System prompt for the chatbot
const SYSTEM_PROMPT = "You are NostalgicAI, a helpful and witty AI assistant with a retro-futuristic personality. You are powered by the openai/gpt-oss-120b model. You can help with coding, writing, and analysis. Keep responses concise and helpful.";

// DOM Elements
let messagesArea, messageInput, sendButton, closeButton, statusText;

// Chat history
let chatHistory = [
    { role: 'assistant', content: 'Hello! I\'m NostalgicAI Chat. How can I assist you today?' }
];

// Initialize chat
function initChat() {
    // Get DOM elements
    messagesArea = document.getElementById('messagesArea');
    messageInput = document.getElementById('messageInput');
    sendButton = document.getElementById('sendButton');
    closeButton = document.getElementById('closeButton');
    statusText = document.getElementById('statusText');

    // Close window handler
    closeButton.addEventListener('click', () => {
        if (window.api && typeof window.api.hideChatWindow === 'function') {
            window.api.hideChatWindow();
        } else {
            console.log('Close button clicked - API not available');
        }
    });

    // Send message handler
    sendButton.addEventListener('click', sendMessage);

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Focus input on load
    window.addEventListener('load', () => {
        messageInput.focus();
    });

    // Render initial message
    renderMessages();
}

// Send message handler
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Add user message to history
    const userMessage = { role: 'user', content: message };
    chatHistory.push(userMessage);

    // Add user message to UI
    addMessageToUI('user', message);
    messageInput.value = '';

    // Update status
    updateStatus('PROCESSING...', true);

    try {
        // Get AI response
        const response = await getAIResponse(message);

        // Add AI message to history
        const aiMessage = { role: 'assistant', content: response };
        chatHistory.push(aiMessage);

        // Add AI response to UI
        addMessageToUI('ai', response);

        // Update status
        updateStatus('READY', false);
    } catch (error) {
        const errorMessage = `Error: ${error.message}`;
        addMessageToUI('ai', errorMessage);
        updateStatus('ERROR', true);
    }
}

// Get AI response from Groq API
async function getAIResponse(userMessage) {
    if (!GROQ_API_KEY) {
        throw new Error('Missing Groq API Key. Please set your API key.');
    }

    try {
        // Prepare messages for API
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...chatHistory.filter(msg => msg.role !== 'system')
        ];

        // Call Groq API
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GROQ_MODEL) || 'openai/gpt-oss-120b',
                messages: messages,
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API Request Failed');
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "No response received.";
    } catch (error) {
        console.error("Groq API Error:", error);
        throw error;
    }
}

// Add message to UI
function addMessageToUI(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;

    const roleDiv = document.createElement('div');
    roleDiv.className = 'message-role';
    roleDiv.textContent = role === 'user' ? 'YOU' : 'AI';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;

    messageDiv.appendChild(roleDiv);
    messageDiv.appendChild(contentDiv);
    messagesArea.appendChild(messageDiv);

    // Scroll to bottom smoothly
    setTimeout(() => {
        messagesArea.scrollTo({
            top: messagesArea.scrollHeight,
            behavior: 'smooth'
        });
    }, 100);
}

// Render all messages
function renderMessages() {
    messagesArea.innerHTML = '';
    chatHistory.forEach(msg => {
        addMessageToUI(msg.role === 'user' ? 'user' : 'ai', msg.content);
    });

    // Scroll to bottom
    setTimeout(() => {
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }, 100);
}

// Update status text
function updateStatus(text, isProcessing) {
    statusText.textContent = `STATUS: ${text}`;
    statusText.className = isProcessing ? 'status-processing' : 'status-ready';
}

// Set API key
function setApiKey(apiKey) {
    localStorage.setItem('GROQ_API_KEY', apiKey);
}

// Get API key
function getApiKey() {
    return localStorage.getItem('GROQ_API_KEY') || '';
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChat);
} else {
    initChat();
}

// Expose functions to global scope
window.NostalgicAIChat = {
    setApiKey,
    getApiKey,
    sendMessage
};