# NostalgicAI Chatbot

This is a standalone chatbot application extracted from the NostalgicAI Electron app, focusing solely on chat functionality.

## Features

- Clean, modern chat interface
- Conversation history preservation
- Responsive design
- Retro-futuristic aesthetic
- Powered by Groq's Llama 3.3 model

## Setup

1. Ensure you have Node.js installed (version 16 or higher recommended)
2. Install dependencies:
   ```
   npm install
   ```

3. Make sure you have a `.env` file with your Groq API key:
   ```
   VITE_GROQ_API_KEY=your_groq_api_key_here
   ```

## Running the Chatbot

### Development Mode

To run the chatbot in development mode:

```
npm run dev:chat
```

The chatbot will be available at http://localhost:3001

### Building for Production

To build the chatbot for production:

```
npm run build:chat
```

The built files will be in the `dist-chat` directory.

## Usage

1. Open the chatbot in your browser
2. Type your message in the input field at the bottom
3. Press Enter or click "Send" to submit your message
4. The AI response will appear in the chat history
5. Use "Clear Chat" to reset the conversation

## Customization

You can customize the chatbot by modifying:

- `src/ChatBot.tsx` - Main chat component
- `src/chat.css` - Styling
- `vite.chat.config.ts` - Build configuration

## API Integration

The chatbot uses the Groq API with the Llama 3.3 model. You can modify the model or API endpoint in `src/ChatBot.tsx`:

```typescript
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Change this to use a different model
const selectedModel = 'llama-3.3-70b-versatile';
```

## Deployment

To deploy the chatbot:

1. Build the application:
   ```
   npm run build:chat
   ```

2. Deploy the contents of the `dist-chat` directory to your web server

## Troubleshooting

- If you see "Missing Groq API Key" error, make sure your `.env` file is properly configured
- If the chatbot doesn't respond, check the browser console for error messages
- For CORS issues, you may need to configure your API provider's whitelist