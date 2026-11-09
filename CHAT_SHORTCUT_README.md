# NostalgicAI Chat with Ctrl+Shift+H Shortcut

This implementation adds a dedicated chat window to the NostalgicAI Electron application that can be opened with the Ctrl+Shift+H keyboard shortcut.

## Features

- Dedicated chat window with retro-futuristic design
- Ctrl+Shift+H shortcut to toggle the chat window
- Persistent chat history during the session
- Integration with Groq's Llama 3.3 model
- Standalone window that can be moved and resized

## Implementation Details

### Files Modified/Added

1. **`electron/main.ts`** - Added:
   - Creation of a separate chat window
   - Registration of Ctrl+Shift+H shortcut
   - IPC handler for hiding the chat window

2. **`electron/preload.ts`** - Added:
   - API exposure for hiding the chat window

3. **`chat.html`** - New file:
   - Dedicated chat interface with styling
   - Connection to chat.js for functionality

4. **`chat.js`** - New file:
   - Chat functionality including message handling
   - Integration with Groq API
   - UI updates and status management

### How It Works

1. When the Electron app starts, two windows are created:
   - The main NostalgicAI window (as before)
   - A hidden chat window

2. Pressing Ctrl+Shift+H toggles the visibility of the chat window:
   - If the chat window is hidden, it becomes visible and focused
   - If the chat window is visible, it gets hidden

3. The chat window communicates with the main process through IPC:
   - The close button sends a signal to hide the window
   - The window can be shown/hidden using the shortcut

## Usage

1. Start the NostalgicAI application as usual:
   ```
   npm run dev
   ```

2. Press Ctrl+Shift+H to open the chat window

3. Type your message in the input field and press Enter or click SEND

4. The AI response will appear in the chat history

5. Press Ctrl+Shift+H again to hide the chat window

6. Click the X button in the top-right corner to close the chat window

## API Key Management

The chat window uses the Groq API for AI responses. You need to:

1. Obtain a Groq API key from https://console.groq.com
2. The application will use the same API key as the main application from the .env file

## Customization

You can customize the chat window by modifying:

- `chat.html` - Interface layout and styling
- `chat.js` - Chat functionality and behavior
- `electron/main.ts` - Window properties and shortcut behavior

## Troubleshooting

- If the shortcut doesn't work, make sure no other application is using Ctrl+Shift+H
- If the chat window doesn't respond, check the console for error messages
- If you get API errors, verify your Groq API key is correct and has credits

## Future Improvements

Possible enhancements:
- Add chat history persistence across sessions
- Implement chat export functionality
- Add support for file attachments
- Include typing indicators
- Add voice input/output capabilities